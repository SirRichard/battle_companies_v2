# Implementation Plan: Match Tracking Responsive

## Overview

Refactor the MatchTrackingPage to introduce responsive expand/collapse behavior on member cards using MUI Collapse + useMediaQuery, add chip tap-to-view description popups via MUI Popover, and synthesize envenom weapon entries as wargear chips. The existing monolithic `MemberMatchCard` inline component is extracted and decomposed into focused sub-components (`PrimaryInfoRow`, `StatGrid`, `MWFSummary`, `ChipDetailPopover`) with breakpoint-driven conditional rendering.

## Tasks

- [x] 1. Create utility functions and shared types
  - [x] 1.1 Create `getChipDescription` utility and `ChipPopupContent` type
    - Create `src/utils/chipDescription.ts`
    - Define `ChipPopupContent` interface (`{ label: string; description: string }`)
    - Implement `getChipDescription(chipId, type, parameter?)` with priority logic: description field → grantsSpecialRules resolution → fallback message
    - Import equipment data, wargear data, and specialRules data for lookups
    - For `envenom_weapon::<id>` chips, look up the `envenom_weapon` entry in equipment data
    - For parameterised special rules, append parameter context to description
    - _Requirements: 8.1, 8.2, 8.3, 8.7_

  - [x] 1.2 Create envenom weapon synthesis utility
    - Create `src/utils/envenomSynthesis.ts`
    - Implement `synthesizeEnvenomChips(specialRules)` that extracts `poisoned_attacks` parameterised entries and returns `envenom_weapon::<weapon_id>` chip IDs
    - Implement `filterEnvenomFromRules(specialRules)` that removes `poisoned_attacks` parameterised entries from the special rules array
    - _Requirements: 9.1, 9.2_

  - [x] 1.3 Write property test for equipment chip description resolution
    - **Property 4: Equipment chip description resolution**
    - **Validates: Requirements 8.1, 8.7**

  - [x] 1.4 Write property test for special rule chip description resolution
    - **Property 5: Special rule chip description resolution**
    - **Validates: Requirements 8.2**

  - [x] 1.5 Write property test for envenom weapon synthesis and filtering
    - **Property 6: Envenom weapon synthesis and filtering**
    - **Validates: Requirements 9.1, 9.2**

- [x] 2. Create new sub-components
  - [x] 2.1 Create `MWFSummary` component
    - Create `src/components/match/MWFSummary.tsx`
    - Accept `might`, `will`, `fate` as nullable numbers
    - Render compact inline read-only M/W/F values (no +/− buttons)
    - Only render if at least one value is non-null
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 2.2 Create `StatGrid` component
    - Create `src/components/match/StatGrid.tsx`
    - Accept `baseStats`, `statIncreases`, `statDecreases`, `equipmentBonuses` props
    - Render 9 stats in CSS Grid: `grid-template-columns: repeat(5, 1fr)` with 2 rows
    - Row 1: Mv, Fv, Sv, S, D (columns 1–5); Row 2: A, W, C, I (columns 1–4), column 5 empty
    - Each cell: label above value, both center-aligned
    - Reuse existing stat formatting/colouring logic from current `MemberMatchCard`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.3 Create `PrimaryInfoRow` component
    - Create `src/components/match/PrimaryInfoRow.tsx`
    - Accept props: `mm`, `expanded`, `onToggle`, `onXpChange`, `onCasualtyToggle`, `showMwfSummary`, `showChevron`
    - Render member name, role chip, XP counter (+/− buttons), casualty button
    - Conditionally render `MWFSummary` when `showMwfSummary` is true
    - Conditionally render expand chevron (ExpandMore icon) when `showChevron` is true
    - Chevron rotates 180° via CSS transform transition (200ms) based on `expanded` prop
    - Set `aria-expanded`, `aria-label` (includes member name + action verb), `aria-controls` on chevron
    - _Requirements: 1.2, 1.3, 2.2, 2.5, 7.1, 7.2, 7.3, 7.5_

  - [x] 2.4 Create `ChipDetailPopover` component
    - Create `src/components/match/ChipDetailPopover.tsx`
    - Accept `anchorEl`, `content` (ChipPopupContent | null), `onClose`
    - Render MUI Popover anchored to chip element
    - Display label as heading, description as body text
    - Close on outside click, Escape key
    - Use `anchorOrigin`/`transformOrigin` for viewport-safe positioning
    - _Requirements: 8.4, 8.5, 8.6_

  - [x] 2.5 Write property test for aria-label construction
    - **Property 3: Aria-label reflects member name and state**
    - **Validates: Requirements 7.2**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Refactor MemberMatchCard with responsive collapse behavior
  - [x] 4.1 Extract `MemberMatchCard` into its own file with collapse logic
    - Create `src/components/match/MemberMatchCard.tsx`
    - Move existing `MemberMatchCard` from `MatchTrackingPage.tsx` into new file
    - Add `expanded` state (default `false`) and `useMediaQuery` hooks for `isXs`, `isSm`, `isMd`
    - Add `onChipTap` prop for popover delegation to parent
    - At md+: render all content flat (no Collapse wrapper, no chevron)
    - At xs/sm: wrap secondary info (stat block, M/W/F controls, equipment chips, special rules, toolkit) in MUI `Collapse` component
    - Use `PrimaryInfoRow` for always-visible content
    - Pass `showMwfSummary: isSm && isHero`, `showChevron: !isMd`
    - Set `aria-hidden` on collapse content based on expanded state
    - Add unique `id` to collapse panel for `aria-controls` reference
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.5, 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.1, 7.4_

  - [x] 4.2 Integrate `StatGrid` at xs breakpoint
    - Within the collapse panel, conditionally render `StatGrid` component at xs breakpoint
    - At sm/md, keep existing flex-wrap stat layout
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 4.3 Integrate envenom weapon synthesis into chip rendering
    - In `MemberMatchCard`, call `synthesizeEnvenomChips` to generate envenom wargear chip entries
    - Append synthesized entries to equipment chip list
    - Call `filterEnvenomFromRules` to remove `poisoned_attacks` from special rules chip display
    - Equipment chips and special rule chips call `onChipTap` with resolved `ChipPopupContent` on click/Enter/Space
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 8.1, 8.2, 8.9_

  - [x] 4.4 Wire `MemberMatchCard` and `ChipDetailPopover` into `MatchTrackingPage`
    - Replace inline `MemberMatchCard` function in `MatchTrackingPage.tsx` with import from new file
    - Add `ChipPopoverState` (`anchorEl`, `content`) to page-level state
    - Pass `onChipTap` handler that sets popover state
    - Render single `ChipDetailPopover` instance at page level
    - Dismiss existing popup when new chip tapped (requirement 8.8)
    - _Requirements: 8.4, 8.5, 8.6, 8.8_

  - [x] 4.5 Write property test for expand/collapse state independence
    - **Property 1: Expand/collapse state independence**
    - **Validates: Requirements 5.1, 5.3**

  - [x] 4.6 Write property test for expanded state preserved during mutations
    - **Property 2: Expanded state preserved during XP/casualty mutations**
    - **Validates: Requirements 5.4**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integration and polish
  - [x] 6.1 Add sm-breakpoint MWF interactive controls inside collapse
    - When collapse is expanded at sm breakpoint for hero members, render full M/W/F interactive +/− controls inside the collapse panel
    - MWF_Summary remains visible in PrimaryInfoRow as read-only glance
    - _Requirements: 2.6_

  - [x] 6.2 Handle animation and debounce edge cases
    - Add 100ms debounce guard on chevron click to prevent animation flickering during rapid toggles
    - MUI Collapse handles mid-animation reversal natively; verify no jump/reset behavior
    - Ensure chevron rotation CSS transition (200ms) uses `transform: rotate(180deg)` with smooth easing
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.3 Write unit tests for breakpoint rendering and chip popover
    - Test xs shows collapse + chevron, sm shows collapse + MWF summary for heroes, md shows flat content
    - Test popover opens on chip click with correct content, closes on outside click / Escape
    - Test keyboard activation (Enter/Space) on chevron and chips
    - Test envenom chip renders with correct label format
    - _Requirements: 1.1, 2.1, 3.1, 8.4, 8.5, 8.9, 9.3_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `MemberMatchCard` is currently an inline function (~550 lines) inside `MatchTrackingPage.tsx` — extraction into its own file is the primary structural change
- `getWargearLabel` in `src/utils/labels.ts` already handles `envenom_weapon::<id>` format with humanised fallback
- `fast-check` and `vitest` are already in devDependencies

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "2.3", "2.4"] },
    { "id": 2, "tasks": ["2.5", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["4.4"] },
    { "id": 5, "tasks": ["4.5", "4.6", "6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3"] }
  ]
}
```
