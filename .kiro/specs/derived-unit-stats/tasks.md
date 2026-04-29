# Implementation Plan: derived-unit-stats

## Overview

Extend the stats-entry flow to understand the `derivedFrom` relationship between base units. The implementation proceeds in four layers: model extension, pure utility functions, page integration, and property-based tests. Each layer builds directly on the previous one.

## Tasks

- [x] 1. Extend `StoredBaseUnitStats` model with optional rider fields
  - In `src/models/index.ts`, add `riderCount?: number` and `additionalRiders?: Array<{ equipment: string[] }>` to the `StoredBaseUnitStats` interface
  - These fields are `undefined` for all units except `warg_marauder`
  - _Requirements: 4.2, 4.3_

- [x] 2. Create `src/utils/derivedUnits.ts` with core interfaces and pure functions
  - [x] 2.1 Define `BaseUnitDef` and `QueueEntry` interfaces
    - `BaseUnitDef` is a typed subset of the `baseUnits.json` shape: `id`, `label`, `derivedFrom?`, `statOverrides?`, `riderCount?`, `additionalRiders?`, `keywordOverride?`
    - `QueueEntry` carries `unitId`, `isInjectedParent`, `autoSaveFromParentId`, and `injectedForLabel`
    - Export both interfaces from the module
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Implement `applyStatOverrides`
    - Accepts `parentStats: Required<MemberStats>` and `unitDef: BaseUnitDef`
    - Returns a new `Required<MemberStats>` that is a shallow copy of `parentStats` with every key present in `unitDef.statOverrides` replaced by the override value
    - Keys absent from `statOverrides` retain the parent value unchanged
    - _Requirements: 2.1, 2.2_

  - [x] 2.3 Write property test for `applyStatOverrides` (Property 4)
    - **Property 4: Stat overrides are applied correctly**
    - **Validates: Requirements 2.1, 2.2**
    - Generate a random `Required<MemberStats>` (all nine stat keys, integers in valid ranges) and a random subset of stat keys with random valid override values
    - Assert every overridden key equals the override value and every non-overridden key equals the parent value

  - [x] 2.4 Implement `buildDerivedUnitStats`
    - Accepts `derivedUnitDef: BaseUnitDef` and `parentStats: Required<MemberStats>`
    - Calls `applyStatOverrides` to produce the derived stats
    - Returns a `StoredBaseUnitStats` record with `baseUnitId` set to `derivedUnitDef.id`, `stats` set to the computed stats, and — when present on the definition — `riderCount` and `additionalRiders` copied from `derivedUnitDef`
    - _Requirements: 2.3, 4.2, 4.3_

  - [x] 2.5 Write property test for `buildDerivedUnitStats` (Property 5)
    - **Property 5: Derived stats are saved under the derived unit's own ID**
    - **Validates: Requirements 2.3**
    - Generate a random derived unit definition and random parent stats; call `buildDerivedUnitStats`; assert `result.baseUnitId === derivedUnitDef.id`

  - [x] 2.6 Implement `buildDerivedAwareQueue`
    - Accepts `rawUnitIds: string[]`, `getStats: (id: string) => StoredBaseUnitStats | undefined`, and `baseUnits: BaseUnitDef[]`
    - Returns `QueueEntry[]` applying these rules in order:
      1. Skip any unit whose stats are already in the library (idempotent)
      2. For each derived unit not yet in the library: if parent IS in library → set `autoSaveFromParentId`; if parent NOT in library AND not already queued → inject a parent entry immediately before the derived unit with `isInjectedParent: true` and `injectedForLabel` set to the derived unit's `label`
      3. Non-derived units become plain entries (`isInjectedParent: false`, `autoSaveFromParentId: null`, `injectedForLabel: null`)
    - If a unit's `derivedFrom` references an ID not found in `baseUnits`, treat it as non-derived (fallback)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2_

  - [x] 2.7 Write property test for `buildDerivedAwareQueue` — Property 1 (derived units identified)
    - **Property 1: Derived units are identified in the queue**
    - **Validates: Requirements 1.1, 1.2**
    - Generate a random subset of unit IDs from `baseUnits.json` mixing derived and non-derived; call `buildDerivedAwareQueue` with an empty library; for every unit with a `derivedFrom` field verify the queue contains either an `autoSaveFromParentId` entry or an injected parent entry immediately before it

  - [x] 2.8 Write property test for `buildDerivedAwareQueue` — Property 2 (no parent duplication)
    - **Property 2: Parent is not duplicated when already in the library**
    - **Validates: Requirements 1.3, 6.1**
    - Generate a random derived unit; pre-populate the library with the parent's stats; call `buildDerivedAwareQueue`; verify the parent ID does not appear as a separate `QueueEntry`

  - [x] 2.9 Write property test for `buildDerivedAwareQueue` — Property 3 (parent injected before child)
    - **Property 3: Parent is injected immediately before the derived unit when missing**
    - **Validates: Requirements 1.4**
    - Generate a random derived unit; use an empty library; call `buildDerivedAwareQueue`; find the derived unit's entry at index `i`; verify the entry at `i-1` has `unitId === derivedUnit.derivedFrom`

  - [x] 2.10 Write property test for `buildDerivedAwareQueue` — Property 6 (both excluded when both in library)
    - **Property 6: Both parent and derived are excluded when both are in the library**
    - **Validates: Requirements 6.2**
    - Generate a random derived unit; pre-populate the library with both the parent's and the derived unit's stats; call `buildDerivedAwareQueue`; verify neither ID appears in the returned queue

  - [x] 2.11 Write property test for `buildDerivedAwareQueue` — Property 7 (queue length accounts for injected parents)
    - **Property 7: Total queue length accounts for injected parents**
    - **Validates: Requirements 5.1**
    - Generate a random list of unit IDs containing K derived units whose parents are absent from the library; call `buildDerivedAwareQueue`; verify `result.length === (units not in library) + K`

  - [x] 2.12 Write property test for `buildDerivedAwareQueue` — Property 8 (injected parent carries derived unit's label)
    - **Property 8: Injected parent entries carry the derived unit's label**
    - **Validates: Requirements 5.3**
    - Generate a random derived unit whose parent is absent from the library; call `buildDerivedAwareQueue`; find the injected parent entry; verify `entry.injectedForLabel === derivedUnit.label`

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update `EditStatsPage` queue building to use `QueueEntry[]`
  - [x] 4.1 Import `buildDerivedAwareQueue`, `QueueEntry`, and `BaseUnitDef` from `../utils/derivedUnits`
    - Update the `BASE_UNITS` cast at the top of the file to `BaseUnitDef[]` so the richer type is available throughout the component
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 4.2 Replace the `useState` queue initialiser to produce `QueueEntry[]`
    - Change the `queues` state type from `{ unitQueue: string[]; mountQueue: string[] }` to `{ unitQueue: QueueEntry[]; mountQueue: QueueEntry[] }`
    - In the wizard-mode branch, call `buildDerivedAwareQueue(rawUnitIds, getStatsForUnit, BASE_UNITS)` to produce `unitEntries`
    - In the company-mode branch, call `buildDerivedAwareQueue(allUnits.filter(…), getStatsForUnit, BASE_UNITS)` to produce `unitEntries`
    - Mount entries remain plain `QueueEntry` objects with `isInjectedParent: false`, `autoSaveFromParentId: null`, `injectedForLabel: null`
    - Update all downstream references to `activeQueue[currentIndex]` to use `entry.unitId` instead of the raw string
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1_

  - [x] 4.3 Add the auto-save `useEffect` for derived units
    - Add a `useEffect` that fires when `currentIndex` or `phase` changes
    - If `activeQueue[currentIndex]?.autoSaveFromParentId` is set, look up the parent stats via `getStatsForUnit`; if found, call `buildDerivedUnitStats(unitDef, parentStats.stats)` and save via `saveStats`; then advance the index (or transition phase / navigate) exactly as `handleSave` does after a successful save
    - If parent stats are not yet available, return early (the user will see the normal form as a fallback)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 4.1, 4.4, 4.5_

  - [x] 4.4 Add the "Required for X" contextual note to the progress display
    - Derive `contextualNote` from `currentEntry?.isInjectedParent && currentEntry.injectedForLabel`
    - Render it as a small `Alert severity="info"` (or `Typography`) below the rulebook reminder `Alert`, visible only when `contextualNote` is non-null
    - The text should read: `Required for {currentEntry.injectedForLabel}`
    - _Requirements: 5.3_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All property tests live in `src/utils/__tests__/derivedUnits.property.test.ts`
- Each property test file header must include the feature tag and property number comment matching the pattern used in the rest of the codebase
- The `BASE_UNITS` cast in `EditStatsPage` must be widened to `BaseUnitDef[]` (task 4.1) before the queue-building changes in task 4.2 will type-check
- Mount entries are never derived units; the mount queue path is unaffected by this feature
- The auto-save effect (task 4.3) must mirror the navigation/phase-transition logic already in `handleSave` to avoid leaving the user stranded at a completed queue
