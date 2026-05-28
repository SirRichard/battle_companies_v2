# Implementation Plan: Wizard Responsive Design

## Overview

Transform the company creation wizard from single-column mobile-first layout into a responsive multi-layout experience. Changes span 7 wizard step components and the parent CreateCompanyPage, adding focused layouts, responsive grids, split-pane views, and conditional navigation buttons. All responsive behavior uses MUI `sx` prop with default breakpoints.

## Tasks

- [x] 1. Add Next button to StepAlignment and StepFaction
  - [x] 1.1 Add `onNext` prop and Next button to StepAlignment
    - Add `onNext?: () => void` to Props interface
    - Render a "Next" Button below alignment options when `value !== null`
    - Button calls `onNext?.()` on click
    - Preserve existing `onAdvance` auto-advance behavior on option click
    - _Requirements: 3.1, 3.3, 3.5, 3.7_

  - [x] 1.2 Add `onNext` prop and Next button to StepFaction
    - Add `onNext?: () => void` to Props interface
    - Render a "Next" Button below faction grid when `value !== null`
    - Button calls `onNext?.()` on click
    - Preserve existing `onAdvance` auto-advance behavior on option click
    - _Requirements: 3.2, 3.4, 3.6, 3.8_

  - [x] 1.3 Wire `onNext` props in CreateCompanyPage
    - Pass `onNext={() => go(1)}` to StepAlignment
    - Pass `onNext={() => go(2)}` to StepFaction
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [ ]* 1.4 Write property test for Next button visibility (Property 4)
    - **Property 4: Next button visibility matches non-null selection**
    - Generate random wizard states with null/non-null alignment/factionId
    - Assert Next button rendered iff corresponding value is non-null
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ]* 1.5 Write property test for Next button state preservation (Property 5)
    - **Property 5: Next button preserves downstream state**
    - Generate wizard states with existing downstream data
    - Trigger Next → assert only step field changes, all other fields preserved
    - **Validates: Requirements 3.5, 3.6**

  - [ ]* 1.6 Write property test for option click auto-advance (Property 6)
    - **Property 6: Option click updates state and auto-advances**
    - Generate random alignment/faction clicks
    - Assert state field updates to clicked value and step increments by 1
    - **Validates: Requirements 3.7, 3.8**

- [x] 2. Implement StepCompany focused layout
  - [x] 2.1 Refactor StepCompany to focused layout mode
    - When `value !== null`, render Focused_Layout instead of Company_List
    - At md+ (900px): `grid-template-columns: 220px 1fr` — sidebar left, details right
    - At xs–sm: details only, sidebar hidden via `display: { xs: 'none', md: 'block' }`
    - Sidebar renders compact `<List>` of unselected company names; each item calls `onChange(companyId)`
    - Company_Details area shows the selected company's expanded content (flavor, rules, roster, variant picker)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Add Collapse button to StepCompany focused layout
    - Render a Collapse_Button inside Company_Details area (top-right header action)
    - Button calls `onChange(null)` to deselect and restore Company_List
    - Button visible at all viewport sizes when in focused mode
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.3 Add Back button guard in CreateCompanyPage
    - In back button handler: if `wizard.step === 2` and `wizard.companyTypeId !== null`, call `selectCompany(null)` and return early
    - When Company_List is displayed (no selection), Back navigates to step 1 as before
    - _Requirements: 2.4, 2.5_

  - [ ]* 2.4 Write property test for company selection → focused layout (Property 1)
    - **Property 1: Company selection transitions to focused layout**
    - Generate random factionId → filter companies → select random company
    - Assert `companyTypeId` matches selected company ID (value becomes non-null)
    - **Validates: Requirements 1.1**

  - [ ]* 2.5 Write property test for sidebar swap (Property 2)
    - **Property 2: Sidebar selection swaps focused company**
    - Generate random faction with 2+ companies → select one → click another in sidebar
    - Assert companyTypeId switches to new company, old company appears in unselected list
    - **Validates: Requirements 1.5**

  - [ ]* 2.6 Write property test for deselection (Property 3)
    - **Property 3: Deselection actions clear company state**
    - Generate random company + variant selection → trigger Collapse_Button or Back_Button
    - Assert `companyTypeId` and `variantId` both become null
    - **Validates: Requirements 2.2, 2.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement responsive grids for remaining steps
  - [x] 4.1 Add 3-tier responsive grid to StepFaction
    - Change grid from `{ xs: '1fr', sm: '1fr 1fr' }` to `{ xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }`
    - Maintain consistent gap spacing across all breakpoints
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 4.2 Add 2-column responsive grid to StepLeaderSelection
    - Change member cards container from `flexDirection: 'column'` to `display: 'grid'` with `gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }` and `gap: 1.5`
    - _Requirements: 4.1, 4.2_

  - [x] 4.3 Add 2-column responsive grid to StepSpellSelection
    - Change spell buttons container to `display: 'grid'` with `gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }` and `gap: 0.75`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.4 Add 2-column responsive grid to StepMemberNames
    - Change container to `display: 'grid'` with `gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }` and `gap: 1.5`
    - Group labels/dividers use `gridColumn: '1 / -1'` to span full width
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 4.5 Write unit tests for responsive grid layouts
    - Test StepFaction: 1-col at xs, 2-col at sm, 3-col at lg
    - Test StepLeaderSelection: 2-col at sm+, 1-col below
    - Test StepSpellSelection: 2-col at sm+, 1-col below
    - Test StepMemberNames: 2-col at sm+, group labels span full width
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3_

- [x] 5. Implement StepGoldEquipment split-pane layout
  - [x] 5.1 Refactor StepGoldEquipment to split-pane at md+
    - At md+: outer container uses `display: { xs: 'block', md: 'grid' }` with `gridTemplateColumns: { md: '35% 65%' }` and `gap: 2`
    - Left pane: member list (always visible, clickable to select)
    - Right pane: purchase panel for selected member, or placeholder prompt if none selected
    - At xs–sm: existing accordion behavior unchanged
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 5.2 Write unit tests for StepGoldEquipment split-pane
    - Test split-pane renders at md+
    - Test accordion renders below md
    - Test placeholder prompt shown when no member selected in split-pane mode
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All responsive behavior uses MUI `sx` prop breakpoint objects — no new dependencies needed
- StepCompany is the most complex change (focused layout with sidebar); other steps are straightforward grid additions

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "4.1", "4.2", "4.3", "4.4"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "1.6", "4.5"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["5.2"] }
  ]
}
```
