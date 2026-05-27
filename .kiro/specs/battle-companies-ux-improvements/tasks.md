# Implementation Plan: Battle Companies UX Improvements

## Overview

Three localised UX fixes in existing React components: (1) fix path selection sub-flow advancement in CreateCompanyPage step 6, (2) add dedicated Equipment section to MemberDetailsDrawer, (3) show disabled Treat button with "No IP Available" feedback. All changes are TypeScript/React, no new services or routes.

## Tasks

- [x] 1. Fix path selection sub-flow and wizard footer button at step 6
  - [x] 1.1 Update wizard footer button logic at step 6 in CreateCompanyPage
    - Derive `allHeroesHavePaths` and `pendingHeroTempId` from wizard state
    - When in picking mode (not all heroes have paths): set button label to "Select", disable when current pending hero has no path selected
    - When in review mode (all heroes have paths): set button label to "Next", onClick calls `go(wizard.step + 1)`
    - In picking mode onClick: re-set current hero's path in state (no-op trigger for re-render) or do nothing since card onSelect already advances
    - Remove the current unconditional `go(wizard.step + 1)` call at step 6
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 1.2 Verify onSelect handler in step 6 already advances sub-flow via derived state
    - Confirm `pendingHeroTempId` recomputes when `heroPaths[currentHero]` is set
    - Confirm card's onSelect fires unconditionally (PathCardSelector unchanged)
    - Add inline comment documenting the implicit advancement mechanism
    - _Requirements: 1.1, 1.2, 1.8, 1.9_

  - [x] 1.3 Write property test: onSelect always fires with displayed path ID (Property 1)
    - **Property 1: onSelect always fires with displayed path ID regardless of selection state**
    - **Validates: Requirements 1.1, 1.2, 1.8**

  - [x] 1.4 Write property test: Select button label and variant match selection state (Property 2)
    - **Property 2: Select button label and variant match selection state**
    - **Validates: Requirements 1.9**

  - [x] 1.5 Write property test: Path sub-flow advances on selection (Property 3)
    - **Property 3: Path sub-flow advances on selection (onSelect sets path and derived state advances)**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 1.6 Write property test: Wizard footer button disabled when current hero has no path (Property 4)
    - **Property 4: Wizard footer button disabled when current hero has no path**
    - **Validates: Requirements 1.4**

  - [x] 1.7 Write property test: Wizard footer button label matches mode (Property 5)
    - **Property 5: Wizard footer button label matches mode**
    - **Validates: Requirements 1.6, 1.7**

  - [x] 1.8 Write property test: Review mode footer button advances wizard (Property 6)
    - **Property 6: Review mode footer button advances wizard (not sub-flow)**
    - **Validates: Requirements 1.5, 1.6**

- [x] 2. Checkpoint - Verify path selection fix
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add Equipment section to MemberDetailsDrawer
  - [x] 3.1 Implement Equipment section rendering between Wargear and Experience
    - Derive `displayEquipment` from `member.ownedEquipment` filtering out `envenom_weapon`
    - Render section header "Equipment" with item list (lookup labels from `equipment.json`)
    - Show italicised "No equipment" placeholder when array is empty/undefined
    - Filter `displayEquipment` items OUT of the Wargear section to prevent duplication
    - _Requirements: 2.1, 2.2, 2.3, 2.7_

  - [x] 3.2 Implement edit mode with remove controls for hero roles
    - Show "Edit" button on Equipment section header when member role is leader, sergeant, or hero_in_making
    - Add `equipEditMode` state; toggle on Edit click
    - In edit mode: show remove control (icon button) on each equipment item
    - On remove: show confirmation dialog, on confirm remove item from `ownedEquipment` and call `onSaveCompany`
    - Show "Done" button in edit mode that exits edit mode
    - Guard: hide Edit/remove controls when `onSaveCompany` is undefined
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 3.3 Write property test: Equipment/Wargear partition correctness (Property 7)
    - **Property 7: Equipment/Wargear partition correctness**
    - **Validates: Requirements 2.1, 2.7**

  - [x] 3.4 Write property test: Edit button visibility matches hero role (Property 8)
    - **Property 8: Edit button visibility matches hero role**
    - **Validates: Requirements 2.4**

  - [x] 3.5 Write property test: Remove control present for each equipment item in edit mode (Property 9)
    - **Property 9: Remove control present for each equipment item in edit mode**
    - **Validates: Requirements 2.5**

- [x] 4. Checkpoint - Verify Equipment section
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement disabled Treat button with IP feedback
  - [x] 5.1 Add disabled Treat button state and "No IP Available" error text
    - Derive `hasIP` from `company.influence >= 1`
    - Determine treatability per injury: `missing_next_game` for any role; `arm_wound`, `leg_wound`, `broken_honour` for hero roles only
    - When `!hasIP` and injury is treatable: render Treat button with `disabled` prop, opacity 0.4, and red "No IP Available" text below
    - When `hasIP` and injury is treatable: render Treat button in normal interactive state (existing behaviour)
    - Ensure disabled button does NOT initiate treatment flow on click
    - When `company` prop is undefined: keep existing behaviour (button hidden)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 Write property test: Treat button state matches IP availability (Property 10)
    - **Property 10: Treat button state matches IP availability**
    - **Validates: Requirements 3.1, 3.2, 3.4**

  - [x] 5.3 Write property test: Disabled Treat button prevents treatment flow (Property 11)
    - **Property 11: Disabled Treat button prevents treatment flow**
    - **Validates: Requirements 3.3**

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` + `vitest` (already installed in project)
- All changes localised to `CreateCompanyPage.tsx` and `MemberDetailsDrawer.tsx` — no new files needed for implementation
- PathCardSelector component requires NO changes (already correct per design)
