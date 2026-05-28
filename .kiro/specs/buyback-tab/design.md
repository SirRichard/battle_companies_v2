# Design Document: Buyback Tab

## Overview

Add a fourth "Buyback" tab to `CompanyDetailsPage` that lets players undo accidental wargear/equipment removals. The feature introduces a `removalLog` on the `Company` model, a new tab panel displaying logged removals grouped by member, and restore logic that validates member existence and equipment capacity before reverting. Additionally, fix small-screen tab layout (equal 25% distribution) and center the stats bar and tab bar on all viewports.

Key design decisions:
- **In-model log** rather than a separate undo stack — keeps persistence simple via existing Dexie/IndexedDB save path
- **200-entry cap** with FIFO eviction — prevents unbounded growth without complex cleanup
- **Match-boundary clearing** — scopes undo to between-match window, preventing stale restorations after game state advances
- **Capacity validation at restore time** — avoids silent data corruption from exceeding equipment limits

## Architecture

```mermaid
graph TD
    subgraph CompanyDetailsPage
        StatsBar[Stats Bar - centered]
        TabBar[Tab Bar - Roster | History | Store | Buyback]
        BuybackPanel[BuybackTab Component]
    end

    subgraph Data Layer
        CompanyModel[Company Model + removalLog]
        RemovalUtils[utils/removalLog.ts]
        CapacityCheck[utils/equipmentCapacity.ts]
    end

    subgraph External Triggers
        MemberDetailsDrawer -->|remove wargear/equipment| RemovalUtils
        MatchTracking -->|match complete| ClearLog[Clear removalLog]
    end

    BuybackPanel --> RemovalUtils
    BuybackPanel --> CapacityCheck
    RemovalUtils --> CompanyModel
    ClearLog --> CompanyModel
```

The architecture follows existing patterns: utility functions handle pure logic, the page component orchestrates state, and `saveCompany` persists changes through `AppContext`.

## Components and Interfaces

### New Utility Module: `src/utils/removalLog.ts`

```typescript
export interface RemovalEntry {
  id: string                    // unique ID (uuid)
  memberId: string              // original member's ID
  memberName: string            // snapshot of member name at removal time
  itemId: string                // wargear or equipment ID
  itemType: 'wargear' | 'equipment'
  removedAt: string             // ISO 8601 timestamp
  poisonedWeaponId?: string     // only for envenom_weapon: the weapon parameter
}

/** Append a removal entry, enforcing 200-entry cap (FIFO). */
export function appendRemoval(
  log: RemovalEntry[],
  entry: Omit<RemovalEntry, 'id'>
): RemovalEntry[]

/** Restore an entry: returns updated member and updated log, or an error. */
export function restoreEntry(
  log: RemovalEntry[],
  entryId: string,
  members: Member[]
): { members: Member[]; log: RemovalEntry[] } | { error: 'member_not_found' | 'capacity_exceeded' }

/** Group and sort log for display: alpha by memberName, desc by removedAt within group. */
export function groupRemovalLog(
  log: RemovalEntry[]
): Array<{ memberName: string; entries: RemovalEntry[] }>
```

### New Utility Module: `src/utils/equipmentCapacity.ts`

```typescript
/**
 * Check whether restoring an item would exceed the member's equipment capacity.
 * Capacity rules: max 1 large + 1 small, OR up to 4 small with backpack.
 */
export function wouldExceedCapacity(
  member: Member,
  itemId: string,
  itemType: 'wargear' | 'equipment'
): boolean
```

### New Component: `src/components/buyback/BuybackTab.tsx`

Renders the buyback panel content:
- Persistent info banner about match-clearing behavior
- Grouped list of removal entries with restore buttons
- Empty state when no entries exist
- Inline messages for disabled restore (member gone / capacity full)

### Modified: `CompanyDetailsPage.tsx`

- Add fourth `<Tab>` with unique icon (e.g., `RestoreIcon` or `UndoIcon`)
- Add `BuybackTab` content panel at `activeTab === 3`
- Apply centering styles to stats bar and tab bar
- Apply equal-width tab distribution below `sm` breakpoint

### Modified: `MemberDetailsDrawer.tsx`

- On wargear/equipment removal, call `appendRemoval` before saving

### Modified: `MatchTrackingPage.tsx` (or navigation handler)

- Clear `removalLog` when advancing to PostMatchSummaryPage

## Data Models

### Extended `Company` interface (in `src/models/index.ts`)

```typescript
export interface Company {
  // ... existing fields ...
  removalLog?: RemovalEntry[]   // optional for backward compat with existing saved companies
}
```

### `RemovalEntry` interface

```typescript
export interface RemovalEntry {
  id: string
  memberId: string
  memberName: string
  itemId: string
  itemType: 'wargear' | 'equipment'
  removedAt: string             // ISO 8601
  poisonedWeaponId?: string     // present only for envenom_weapon removals
}
```

The `removalLog` field is optional (`RemovalEntry[] | undefined`) so existing saved companies load without migration. Code treats `undefined` as `[]`.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: RemovalLog cap enforcement

*For any* removalLog of any length (0–300+), after calling `appendRemoval`, the resulting log length SHALL be at most 200, and if the input log was at capacity, the oldest entry (earliest `removedAt`) SHALL have been discarded.

**Validates: Requirements 1.1**

### Property 2: Removal entry correctness

*For any* member and any item (wargear, equipment, or envenom_weapon), calling the removal function SHALL produce an entry containing the correct memberId, memberName, itemId, itemType, a valid ISO 8601 timestamp, and — for envenom_weapon only — the poisonedWeaponId matching the associated weapon parameter.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 3: RemovalLog grouping and sorting

*For any* removalLog with arbitrary entries, `groupRemovalLog` SHALL return groups ordered alphabetically by memberName, and within each group entries SHALL be ordered by `removedAt` descending (newest first).

**Validates: Requirements 3.1**

### Property 4: Restore places item in correct array by type

*For any* valid removal entry where the member exists and capacity is not exceeded: restoring a "wargear" entry SHALL add the itemId to `member.equipment`, restoring an "equipment" entry SHALL add the itemId to `member.ownedEquipment`, and restoring an envenom_weapon entry SHALL add "envenom_weapon" to `member.ownedEquipment` AND add a `poisoned_attacks` special rule with the stored weapon parameter.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 5: Successful restore removes entry from log

*For any* removalLog with N entries (N ≥ 1), after a successful restore of one entry, the resulting log SHALL have exactly N-1 entries and SHALL NOT contain the restored entry's ID.

**Validates: Requirements 4.4**

### Property 6: Capacity exceeded prevents restore

*For any* member whose current equipment load is at capacity, attempting to restore an item that would exceed the limit SHALL return a capacity error and leave both the member's arrays and the removalLog unchanged.

**Validates: Requirements 4.6**

## Error Handling

| Scenario | Handling |
|----------|----------|
| Member deleted after removal logged | Restore button disabled; inline message "Member no longer in company" |
| Equipment capacity exceeded | Restore button disabled; inline message "Insufficient equipment capacity" |
| removalLog undefined on old company | Treat as empty array `[]`; no migration needed |
| Concurrent tab switch during restore | `saveCompany` is async but atomic per Dexie transaction; UI updates on completion |
| removalLog exceeds 200 (corruption) | `appendRemoval` trims to 200 from front regardless of current length |

## Testing Strategy

### Property-Based Tests (fast-check, 200 iterations each)

Library: **fast-check** (already in devDependencies)

Each property test references its design property via tag comment:

1. **RemovalLog cap** — Generate logs of size 0–300, append entry, assert length ≤ 200 and FIFO order preserved.
   - Tag: `Feature: buyback-tab, Property 1: RemovalLog cap enforcement`

2. **Removal entry correctness** — Generate random members/items/types, call removal, assert entry shape.
   - Tag: `Feature: buyback-tab, Property 2: Removal entry correctness`

3. **Grouping/sorting** — Generate random logs, call `groupRemovalLog`, assert alphabetical groups and descending dates.
   - Tag: `Feature: buyback-tab, Property 3: RemovalLog grouping and sorting`

4. **Restore correctness** — Generate valid restore scenarios, call `restoreEntry`, assert item in correct array.
   - Tag: `Feature: buyback-tab, Property 4: Restore places item in correct array by type`

5. **Restore removes entry** — Generate logs, restore one, assert log shrinks by 1 and entry gone.
   - Tag: `Feature: buyback-tab, Property 5: Successful restore removes entry from log`

6. **Capacity guard** — Generate members at capacity, attempt restore, assert error returned and state unchanged.
   - Tag: `Feature: buyback-tab, Property 6: Capacity exceeded prevents restore`

### Unit Tests (example-based)

- Tab order renders as Roster, History, Store, Buyback
- Buyback icon is unique among tab icons
- Label hidden below sm breakpoint; aria-label present
- Empty state message when removalLog is empty
- Persistent info banner always visible
- Restore button disabled when member missing (with inline message)
- Match completion clears removalLog
- Stats bar centering styles applied
- Tab bar centering styles applied
- Below sm: tabs use 25% width, min-height 44px

### Integration Tests

- Full flow: remove wargear → appears in Buyback tab → restore → item back on member
- Match complete → Buyback tab shows empty state
