# Design Document — derived-unit-stats

## Overview

Some entries in `baseUnits.json` carry a `derivedFrom` field that points to a parent unit. These derived units share the same base stats as their parent but differ in name, stat overrides, additional special rules, or extra fields (e.g. `riderCount`). Currently `EditStatsPage` treats every unit as independent, so users must type stats from scratch even when the parent's stats are already known.

This feature makes the stats-entry flow aware of the `derivedFrom` relationship. The two key behaviours are:

1. **Auto-save**: when a derived unit's parent stats are already in the Stats_Library, the derived unit's stats are computed (parent stats + `statOverrides`) and saved immediately — no form is shown.
2. **Parent injection**: when the parent's stats are missing, the parent is inserted into the work queue immediately before the derived unit so the user enters the parent first; the derived unit is then auto-saved from those freshly entered stats.

The `warg_marauder` unit is a special case: it derives from `moria_goblin_warrior` but also carries `riderCount` and `additionalRiders` fields that must be preserved in its saved stats record.

### Affected units

| Derived unit | Parent unit | Difference |
|---|---|---|
| `ranger_of_ithilien` | `ranger_of_gondor` | `additionalSpecialRules` only |
| `helminga` | `warrior_of_rohan` | `statOverrides: { strength: 4 }` |
| `lorien_guard` | `galadhrim_warrior` | `additionalSpecialRules` only |
| `noldorin_exile` | `lothlorien_warrior` | `statOverrides: { move: 8 }` |
| `battlin_brandybuck` | `hobbit_militia` | `statOverrides: { strength: 3 }` |
| `tookish_hunter` | `hobbit_archer` | `additionalSpecialRules` only |
| `warg_marauder` | `moria_goblin_warrior` | `riderCount`, `additionalRiders` |
| `goblin_hulk` | `gundabad_ogre` | `keywordOverride` only |

---

## Architecture

The change is confined to `EditStatsPage` and a new pure-function utility module. No new routes, no new context methods, and no changes to `AppContext` or `companyService` are required.

```
src/
  pages/
    EditStatsPage.tsx          ← queue-building logic extended
  utils/
    derivedUnits.ts            ← NEW: pure helpers for derived-unit logic
```

The `derivedUnits.ts` module is kept separate so its pure functions can be unit-tested and property-tested in isolation, without mounting the full React component.

### Data flow

```
EditStatsPage (mount)
  │
  ├─ buildDerivedAwareQueue(rawUnitIds, statsLibrary, baseUnits)
  │     ├─ for each unit: check derivedFrom
  │     ├─ if derived + parent missing → inject parent before child
  │     └─ returns QueueEntry[]  (each entry knows if it is injected / auto-saveable)
  │
  ├─ [queues] = useState(...)   ← locked on mount, same as today
  │
  └─ render loop
        ├─ if currentEntry.autoSave → call autoSaveDerivedUnit() → advance
        └─ else → show form as today
```

---

## Components and Interfaces

### `derivedUnits.ts` — pure utility module

```ts
/** Subset of baseUnits.json fields relevant to derived-unit logic. */
export interface BaseUnitDef {
  id: string
  label: string
  derivedFrom?: string
  statOverrides?: Partial<MemberStats>
  riderCount?: number
  additionalRiders?: Array<{ equipment: string[] }>
  keywordOverride?: string[]
}

/**
 * A single entry in the stats work queue.
 * Extends the plain string ID used today with derived-unit metadata.
 */
export interface QueueEntry {
  unitId: string
  /** True when this entry was injected as a parent dependency. */
  isInjectedParent: boolean
  /**
   * When set, this entry should be auto-saved from the parent's stats
   * rather than shown to the user as a form.
   * Populated only when the parent's stats are already in the library
   * at queue-build time.
   */
  autoSaveFromParentId: string | null
  /**
   * Human-readable label for the derived unit this parent was injected for.
   * Only set when isInjectedParent === true.
   * Used to render the contextual "Required for X" message (Req 5.3).
   */
  injectedForLabel: string | null
}

/**
 * Builds a derived-unit-aware work queue from a raw list of unit IDs.
 *
 * Rules applied in order:
 * 1. Skip any unit already in the Stats_Library (idempotent — Req 6.1, 6.2).
 * 2. For each derived unit not yet in the library:
 *    a. If parent IS in library → mark entry as autoSave (Req 2.1).
 *    b. If parent NOT in library AND parent not already in queue →
 *       inject parent entry immediately before the derived unit (Req 1.4).
 * 3. Non-derived units are included as plain entries.
 *
 * @param rawUnitIds   The unit IDs that need stats (from wizard or company).
 * @param getStats     Lookup function for the Stats_Library (from AppContext).
 * @param baseUnits    Full baseUnits.json array.
 */
export function buildDerivedAwareQueue(
  rawUnitIds: string[],
  getStats: (id: string) => StoredBaseUnitStats | undefined,
  baseUnits: BaseUnitDef[]
): QueueEntry[]

/**
 * Computes the derived unit's stats by copying the parent's stats and
 * applying any statOverrides declared on the derived unit definition.
 *
 * @param parentStats   The parent's StoredBaseUnitStats.stats record.
 * @param unitDef       The derived unit's definition (for statOverrides).
 */
export function applyStatOverrides(
  parentStats: Required<MemberStats>,
  unitDef: BaseUnitDef
): Required<MemberStats>

/**
 * Builds the full StoredBaseUnitStats record for a derived unit,
 * including any extra fields (riderCount, additionalRiders) from the
 * unit definition.
 *
 * For warg_marauder this preserves riderCount and additionalRiders
 * alongside the copied base stats (Req 4.2, 4.3).
 */
export function buildDerivedUnitStats(
  derivedUnitDef: BaseUnitDef,
  parentStats: Required<MemberStats>
): StoredBaseUnitStats
```

### Changes to `EditStatsPage`

#### Queue building (`useState` initialiser)

Replace the current plain `string[]` queues with `QueueEntry[]` produced by `buildDerivedAwareQueue`. The existing split into `unitQueue` / `mountQueue` is preserved — mounts are never derived units, so the mount queue is unaffected.

```ts
const [queues] = useState<{ unitQueue: QueueEntry[]; mountQueue: QueueEntry[] }>(
  () => {
    const rawUnitIds = /* same logic as today */
    const unitEntries = buildDerivedAwareQueue(rawUnitIds, getStatsForUnit, BASE_UNITS)
    // mounts remain plain entries (no derivedFrom on mounts)
    const mountEntries = rawMountIds
      .filter(id => !getStatsForUnit(id))
      .map(id => ({ unitId: id, isInjectedParent: false, autoSaveFromParentId: null, injectedForLabel: null }))
    return { unitQueue: unitEntries, mountQueue: mountEntries }
  }
)
```

#### Auto-save effect

A `useEffect` fires whenever `currentIndex` or `phase` changes. If the current entry has `autoSaveFromParentId` set, it calls `buildDerivedUnitStats`, saves via `saveStats`, and advances the index — all without rendering a form.

```ts
useEffect(() => {
  const entry = activeQueue[currentIndex]
  if (!entry || !entry.autoSaveFromParentId) return

  const parentStats = getStatsForUnit(entry.autoSaveFromParentId)
  if (!parentStats) return // parent not yet saved; wait for manual save

  const unitDef = BASE_UNITS.find(u => u.id === entry.unitId)
  if (!unitDef) return

  const derived = buildDerivedUnitStats(unitDef, parentStats.stats)
  saveStats(derived).then(() => {
    setSavedIds(prev => [...prev, entry.unitId])
    // advance to next entry
    if (currentIndex < activeQueue.length - 1) {
      setDirection(1)
      setCurrentIndex(i => i + 1)
    } else {
      // handle phase transition / completion as today
    }
  })
}, [currentIndex, phase])
```

#### Progress display

`totalNeeded` is already `unitQueue.length + mountQueue.length`. Because injected parents are included in `unitQueue`, the count automatically reflects the expanded queue (Req 5.1, 5.2).

The `phaseSubtitle` string is updated to show the contextual "Required for X" message when the current entry is an injected parent (Req 5.3):

```ts
const contextualNote = currentEntry?.isInjectedParent && currentEntry.injectedForLabel
  ? `Required for ${currentEntry.injectedForLabel}`
  : null
```

This note is rendered as a small `Alert` or `Typography` below the form header.

---

## Data Models

### Extended `StoredBaseUnitStats`

The existing model is extended to carry the optional rider fields for `warg_marauder`. These fields are `undefined` for all other units.

```ts
// src/models/index.ts — additions to StoredBaseUnitStats
export interface StoredBaseUnitStats {
  baseUnitId: string
  stats: Required<MemberStats>
  isMountStats?: boolean
  // warg_marauder-specific fields (Req 4.2, 4.3)
  riderCount?: number
  additionalRiders?: Array<{ equipment: string[] }>
}
```

### `QueueEntry` (internal to `derivedUnits.ts`)

Described above. Not persisted — computed fresh on each `EditStatsPage` mount.

### `BaseUnitDef` (internal to `derivedUnits.ts`)

A typed subset of the raw JSON shape, used only within the utility module. The full `baseUnits.json` array is cast to `BaseUnitDef[]` at the call site.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Derived units are identified in the queue

*For any* set of unit IDs that includes at least one unit with a `derivedFrom` field, `buildDerivedAwareQueue` must mark every such unit as derived (i.e. `autoSaveFromParentId` is non-null when the parent is in the library, or the parent is injected before it when the parent is absent).

**Validates: Requirements 1.1, 1.2**

### Property 2: Parent is not duplicated when already in the library

*For any* derived unit whose parent's stats are already present in the Stats_Library, the queue built by `buildDerivedAwareQueue` must not contain a separate entry for the parent unit.

**Validates: Requirements 1.3, 6.1**

### Property 3: Parent is injected immediately before the derived unit when missing

*For any* derived unit whose parent's stats are absent from the Stats_Library, the queue built by `buildDerivedAwareQueue` must contain the parent entry at the position immediately preceding the derived unit's entry.

**Validates: Requirements 1.4**

### Property 4: Stat overrides are applied correctly

*For any* `MemberStats` record (representing parent stats) and *for any* `statOverrides` map, `applyStatOverrides` must return a stats record where every key present in `statOverrides` has the override value, and every key absent from `statOverrides` retains the parent's value.

**Validates: Requirements 2.1, 2.2**

### Property 5: Derived stats are saved under the derived unit's own ID

*For any* derived unit, `buildDerivedUnitStats` must return a `StoredBaseUnitStats` record whose `baseUnitId` equals the derived unit's ID (not the parent's ID).

**Validates: Requirements 2.3**

### Property 6: Both parent and derived are excluded when both are in the library

*For any* derived unit whose stats AND whose parent's stats are both present in the Stats_Library, `buildDerivedAwareQueue` must not include either unit in the returned queue.

**Validates: Requirements 6.2**

### Property 7: Total queue length accounts for injected parents

*For any* input list of unit IDs containing K derived units whose parents are absent from the Stats_Library, the queue returned by `buildDerivedAwareQueue` must have length equal to (number of units not already in library) + K.

**Validates: Requirements 5.1**

### Property 8: Injected parent entries carry the derived unit's label

*For any* injected parent entry in the queue, `injectedForLabel` must equal the `label` field of the derived unit that caused the injection (as declared in `baseUnits.json`).

**Validates: Requirements 5.3**

---

## Error Handling

### Parent unit not found in `baseUnits.json`

If a unit's `derivedFrom` references an ID that does not exist in `baseUnits.json`, `buildDerivedAwareQueue` treats the unit as non-derived (falls back to showing the form). This is a data-integrity guard; it should not occur in production.

### Parent stats disappear between queue build and auto-save

The auto-save `useEffect` checks `getStatsForUnit(entry.autoSaveFromParentId)` at execution time. If the parent stats are somehow absent (e.g. `clearAllStats` was called in another tab), the effect returns early and the derived unit remains at the current index. The user will see the normal form for the derived unit as a fallback. This is an extremely unlikely edge case.

### `statOverrides` contains an unknown stat key

`applyStatOverrides` spreads the parent stats and then applies overrides by key. Unknown keys are silently ignored because `MemberStats` is typed — TypeScript will catch invalid keys at compile time. At runtime, an unknown key would be written to the record but ignored by the rest of the app.

### `warg_marauder` parent stats missing at auto-save time

Handled by the general "parent stats disappear" case above. The user will be shown the `warg_marauder` form as a fallback, which is acceptable.

---

## Testing Strategy

### Unit tests (example-based)

- `buildDerivedAwareQueue` with an empty input → returns empty array.
- `buildDerivedAwareQueue` with all units already in library → returns empty array.
- `buildDerivedAwareQueue` with a derived unit whose parent is in the library → entry has `autoSaveFromParentId` set, no separate parent entry.
- `buildDerivedAwareQueue` with a derived unit whose parent is absent → parent entry injected immediately before child, `injectedForLabel` set correctly.
- `applyStatOverrides` with no overrides → returns parent stats unchanged.
- `applyStatOverrides` with `helminga` overrides (`{ strength: 4 }`) → only strength changes.
- `buildDerivedUnitStats` for `warg_marauder` → `riderCount: 3` and `additionalRiders` array present in result.
- `buildDerivedUnitStats` for `ranger_of_ithilien` → no `riderCount` / `additionalRiders` in result.
- Auto-save effect: given a queue entry with `autoSaveFromParentId`, verify `saveStats` is called with the correct derived stats and the index advances.
- Contextual message: given an injected parent entry, verify the "Required for X" note is rendered.

### Property-based tests (vitest + fast-check)

The property-based tests live in `src/utils/__tests__/derivedUnits.property.test.ts` and target the pure functions in `derivedUnits.ts`.

Each test runs a minimum of 100 iterations.

**Property 1 — Derived units identified**
Generate a random subset of unit IDs from `baseUnits.json` (mixing derived and non-derived). Call `buildDerivedAwareQueue` with an empty library. For every unit with a `derivedFrom` field, verify the queue contains either an `autoSaveFromParentId` entry or an injected parent entry immediately before it.
*Tag: Feature: derived-unit-stats, Property 1: derived units are identified in the queue*

**Property 2 — No parent duplication**
Generate a random derived unit. Pre-populate the library with the parent's stats. Call `buildDerivedAwareQueue`. Verify the parent ID does not appear as a separate `QueueEntry`.
*Tag: Feature: derived-unit-stats, Property 2: parent is not duplicated when already in the library*

**Property 3 — Parent injected before child**
Generate a random derived unit. Use an empty library. Call `buildDerivedAwareQueue`. Find the derived unit's entry index `i`. Verify the entry at `i-1` has `unitId === derivedUnit.derivedFrom`.
*Tag: Feature: derived-unit-stats, Property 3: parent is injected immediately before the derived unit when missing*

**Property 4 — Stat overrides applied correctly**
Generate a random `MemberStats` object (all fields populated with integers in valid ranges) and a random `statOverrides` map (subset of stat keys with random valid values). Call `applyStatOverrides`. For every key in `statOverrides`, verify the result equals the override value. For every key not in `statOverrides`, verify the result equals the parent value.
*Tag: Feature: derived-unit-stats, Property 4: stat overrides are applied correctly*

**Property 5 — Derived stats saved under derived ID**
Generate a random derived unit and random parent stats. Call `buildDerivedUnitStats`. Verify `result.baseUnitId === derivedUnit.id`.
*Tag: Feature: derived-unit-stats, Property 5: derived stats are saved under the derived unit's own ID*

**Property 6 — Both excluded when both in library**
Generate a random derived unit. Pre-populate the library with both the parent's and the derived unit's stats. Call `buildDerivedAwareQueue`. Verify neither ID appears in the returned queue.
*Tag: Feature: derived-unit-stats, Property 6: both parent and derived are excluded when both are in the library*

**Property 7 — Queue length accounts for injected parents**
Generate a random list of unit IDs containing K derived units whose parents are absent from the library. Call `buildDerivedAwareQueue`. Verify `result.length === (units not in library) + K`.
*Tag: Feature: derived-unit-stats, Property 7: total queue length accounts for injected parents*

**Property 8 — Injected parent carries derived unit's label**
Generate a random derived unit whose parent is absent from the library. Call `buildDerivedAwareQueue`. Find the injected parent entry. Verify `entry.injectedForLabel === derivedUnit.label`.
*Tag: Feature: derived-unit-stats, Property 8: injected parent entries carry the derived unit's label*
