# Implementation Plan: Buyback Tab

## Overview

Add a Buyback tab to CompanyDetailsPage with removal logging, restore logic, capacity validation, match-clearing, and responsive layout fixes. Implementation follows existing patterns: pure utility functions, React component for the tab panel, and integration into existing pages via AppContext.

## Tasks

- [x] 1. Data model and utility foundations
  - [x] 1.1 Extend Company model with removalLog field
    - Add `removalLog?: RemovalEntry[]` to `Company` interface in `src/models/index.ts`
    - Add `RemovalEntry` interface to `src/models/index.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Create `src/utils/removalLog.ts` utility module
    - Implement `appendRemoval` function enforcing 200-entry FIFO cap
    - Implement `restoreEntry` function with member-existence and capacity checks
    - Implement `groupRemovalLog` function for alphabetical grouping and descending date sort
    - Export `RemovalEntry` type re-export for convenience
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.3 Create `src/utils/equipmentCapacity.ts` utility module
    - Implement `wouldExceedCapacity` function checking large/small item limits and backpack rule
    - _Requirements: 4.6_

  - [x] 1.4 Write property test: RemovalLog cap enforcement
    - **Property 1: RemovalLog cap enforcement**
    - Generate logs of size 0–300, append entry, assert length ≤ 200 and FIFO order preserved
    - **Validates: Requirements 1.1**

  - [x] 1.5 Write property test: Removal entry correctness
    - **Property 2: Removal entry correctness**
    - Generate random members/items/types, call removal, assert entry shape and fields
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [x] 1.6 Write property test: RemovalLog grouping and sorting
    - **Property 3: RemovalLog grouping and sorting**
    - Generate random logs, call `groupRemovalLog`, assert alphabetical groups and descending dates
    - **Validates: Requirements 3.1**

- [x] 2. Restore logic and validation
  - [x] 2.1 Implement restore logic in `restoreEntry` for wargear, equipment, and envenom_weapon
    - Wargear: append itemId to `member.equipment`
    - Equipment: append itemId to `member.ownedEquipment`
    - Envenom_weapon: append "envenom_weapon" to `ownedEquipment` and add `poisoned_attacks` special rule with stored weapon parameter
    - Return error if member not found or capacity exceeded
    - Remove entry from log on success
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.2 Write property test: Restore places item in correct array by type
    - **Property 4: Restore places item in correct array by type**
    - Generate valid restore scenarios, call `restoreEntry`, assert item in correct array
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x] 2.3 Write property test: Successful restore removes entry from log
    - **Property 5: Successful restore removes entry from log**
    - Generate logs, restore one, assert log shrinks by 1 and entry gone
    - **Validates: Requirements 4.4**

  - [x] 2.4 Write property test: Capacity exceeded prevents restore
    - **Property 6: Capacity exceeded prevents restore**
    - Generate members at capacity, attempt restore, assert error returned and state unchanged
    - **Validates: Requirements 4.6**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate removal logging into existing flows
  - [x] 4.1 Hook `appendRemoval` into `MemberDetailsDrawer.tsx` wargear removal
    - On wargear remove action, call `appendRemoval` with member info, item ID, type "wargear"
    - Save updated company via `saveCompany`
    - _Requirements: 1.2_

  - [x] 4.2 Hook `appendRemoval` into `MemberDetailsDrawer.tsx` equipment removal
    - On equipment remove action, call `appendRemoval` with member info, item ID, type "equipment"
    - Handle envenom_weapon specially: include `poisonedWeaponId` from the associated `poisoned_attacks` special rule parameter
    - Save updated company via `saveCompany`
    - _Requirements: 1.3, 1.4_

  - [x] 4.3 Clear removalLog on match completion in `PostMatchPage.tsx`
    - When advancing from MatchTrackingPage to PostMatchSummaryPage, set `company.removalLog = []`
    - Save updated company before navigation
    - _Requirements: 5.1_

- [x] 5. Buyback tab UI
  - [x] 5.1 Create `src/components/buyback/BuybackTab.tsx` component
    - Render persistent info banner about match-clearing behavior
    - Render empty state message when removalLog is empty or undefined
    - Render grouped list (alphabetical by member name, newest first within group)
    - Show item label, item type, member name, and relative time for each entry
    - Render restore button per entry
    - Disable restore button with inline message when member not found
    - Disable restore button with inline message when capacity exceeded
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.5, 4.6, 5.2_

  - [x] 5.2 Add Buyback tab to `CompanyDetailsPage.tsx`
    - Add fourth Tab with unique icon (e.g., `Restore` or `Undo`) and label "Buyback"
    - Label visible only at sm breakpoint and above (≥600px)
    - Render `BuybackTab` panel when `activeTab === 3`
    - Wire restore action: call `restoreEntry`, update company state, call `saveCompany`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 6. Responsive layout fixes
  - [x] 6.1 Fix tab bar equal-width distribution below sm breakpoint
    - Apply 25% width per tab icon below 600px
    - Hide text labels below sm; add `aria-label` matching hidden label text
    - Ensure minimum 44px tap-target height
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.2 Center stats bar and tab bar on all viewports
    - Horizontally center stat items group within full-width container
    - Horizontally center tab items group within full-width container
    - Below sm: arrange stats in 2-column centered grid
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- `removalLog` is optional on Company for backward compatibility — treat `undefined` as `[]`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3", "5.1"] },
    { "id": 5, "tasks": ["5.2", "6.1", "6.2"] }
  ]
}
```
