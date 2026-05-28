# Implementation Plan: Toolkit Special Units & Hero Upgrades

## Overview

Three additive features implemented across existing pages: (1) Toolkit ATO multi-select with sequential kit assignment, (2) Hero upgrade display in company creation wizard, (3) Special unit purchases in Store reinforce tab. All use TypeScript/React with existing Vitest + fast-check test infrastructure.

## Tasks

- [x] 1. Toolkit ATO Multi-Select on MatchSetupPage
  - [x] 1.1 Implement toolkit counter logic in MatchSetupPage
    - Add `getToolkitCount` helper that filters `atoBonuses` for `'toolkit'` entries and returns count
    - Replace single toolkit toggle with counter-based selection: click increments (up to 5), long-press/secondary action decrements
    - Store repeated `'toolkit'` entries in `atoBonuses` array (N entries = N kits)
    - Enforce max 5 selections AND budget constraint (each adds 30 pts)
    - Update budget calculation: toolkit contributes `30 * count`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8_

  - [x] 1.2 Implement toolkit count display badge
    - Show count badge (e.g. "×3") adjacent to Toolkit label when count > 0
    - Hide badge when count is zero (default unselected state)
    - Disable increment when count === 5 or budget insufficient for +30
    - _Requirements: 1.6, 1.7_

  - [x] 1.3 Write property tests for toolkit selection validity (Properties 1–4)
    - **Property 1: Toolkit selection validity** — selection accepted iff count < 5 AND cumulative + 30 ≤ opponent rating
    - **Property 2: Toolkit deselection frees budget** — removing one entry reduces count by 1 and total by 30
    - **Property 3: Toolkit count display** — indicator visible with correct count iff toolkit entries > 0
    - **Property 4: Toolkit count encoding round-trip** — encoding N as repeated entries then filtering yields exactly N
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1**
    - File: `src/pages/__tests__/toolkitMultiSelect.property.test.ts`

- [x] 2. Sequential Kit Assignment Flow on ToolkitAssignmentPage
  - [x] 2.1 Add multi-kit state management to ToolkitAssignmentPage
    - Add state: `currentKitIndex`, `accumulatedItems`, `selectedKitIds`
    - Derive `totalKits` from `getToolkitCount(match.atoBonuses)`
    - Disable previously-selected kit types in kit list (grey out by checking `selectedKitIds`)
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Implement kit confirmation and progression logic
    - Disable confirm button when not all items assigned
    - On confirm: append items to `accumulatedItems`, push kitId to `selectedKitIds`, increment `currentKitIndex`
    - When `currentKitIndex === totalKits`: save all `accumulatedItems` to `ActiveMatchState.toolkitItems` and navigate (wanderer page if 'wanderer' in atoBonuses, else match tracking)
    - Lock kit selection while current kit is active (prevent switching mid-assignment)
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [x] 2.3 Add progress indicator for multi-kit flow
    - Show "Kit {currentKitIndex + 1} of {totalKits}" when totalKits > 1
    - Hide progress indicator when totalKits === 1 (single-kit backward compat)
    - _Requirements: 2.7, 2.8_

  - [x] 2.4 Write property tests for sequential kit flow (Properties 5–7)
    - **Property 5: Kit type exclusion across selections** — available kits at step K = full pool minus all selected in steps 0..K-1
    - **Property 6: Kit confirmation requires full assignment and advances state** — rejected when incomplete, appends N items and increments index when complete
    - **Property 7: Progress indicator correctness** — text reads "Kit {idx+1} of {total}" when total > 1, hidden when total === 1
    - **Validates: Requirements 2.2, 2.4, 2.5, 2.7, 2.8**
    - File: `src/pages/__tests__/toolkitSequentialFlow.property.test.ts`

- [x] 3. Checkpoint - Toolkit flow complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Hero Upgrade Display in Company Creation Wizard
  - [x] 4.1 Implement hero upgrade section in StepCompany expanded details
    - Add "HERO UPGRADES" heading between Company Special Rules and Starting Roster sections
    - Normalize `heroUpgrade` field: if single object, wrap in array
    - Render each entry's `label` and `description` in source order
    - Resolve `baseUnitIds` to unit labels via baseUnits data lookup
    - Skip section entirely when `heroUpgrade` is empty/undefined
    - Style heading consistent with existing "COMPANY SPECIAL RULES" and "STARTING ROSTER" headings
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.2 Write property tests for hero upgrade display (Properties 8–10)
    - **Property 8: Hero upgrade rendering completeness and order** — all entries rendered in source order; no section when empty/undefined
    - **Property 9: Hero upgrade unit label resolution** — each baseUnitId resolved to correct label
    - **Property 10: Hero upgrade normalization** — single object normalized to one-element array deeply equal to original
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6**
    - File: `src/components/wizard/__tests__/heroUpgradeDisplay.property.test.ts`

- [x] 5. Checkpoint - Hero upgrade display complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Special Units in Store Reinforce Tab
  - [x] 6.1 Implement special units section in StoreTab
    - Add "Special Units" sub-section in reinforcements area of `StoreTab` component
    - Render only when `companyDef.specialUnits` is non-empty
    - For each entry: resolve unit label from baseUnits data, display influenceCost, display rare as limit count (e.g. "Limit: 1")
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Implement special unit purchase logic
    - On purchase: deduct `influenceCost` from company influence
    - Create new `Member` with `baseUnitId`, role `'warrior'`, default wargear from baseUnits
    - Append new member to roster, persist via `saveCompany`
    - _Requirements: 4.4_

  - [x] 6.3 Implement purchase disablement rules
    - Disable purchase when `company.influence < entry.influenceCost`
    - Disable all purchases when roster count >= `companyDef.maxCompanySize`
    - Disable specific unit when roster count of matching `baseUnitId` >= `entry.rare`
    - Show "Limit reached" message when rare limit hit; hide message otherwise
    - _Requirements: 4.5, 4.6, 4.7, 4.8_

  - [x] 6.4 Write property tests for special unit purchase (Properties 11–13)
    - **Property 11: Special unit display completeness** — row contains resolved label, influenceCost, and rare limit
    - **Property 12: Special unit purchase state transition** — influence reduced by cost, new Member with correct baseUnitId/role/wargear
    - **Property 13: Special unit purchase disablement** — disabled iff influence < cost OR roster >= max OR count >= rare
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.8**
    - File: `src/pages/__tests__/specialUnitPurchase.property.test.ts`

- [x] 7. Final checkpoint - All features integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from design document (13 total)
- Unit tests validate specific examples and edge cases
- All code uses TypeScript with existing React/MUI/Vitest/fast-check stack
- No new routes or pages introduced — all changes additive to existing components

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1", "4.2", "6.1"] },
    { "id": 2, "tasks": ["2.2", "6.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "6.3"] },
    { "id": 4, "tasks": ["6.4"] }
  ]
}
```
