# Implementation Plan: Parameterized Special Rules

## Overview

Add parameter collection UI to postmatch advancement flow for parameterised special rules. Implement utility functions for eligibility filtering, ownership detection, and parameterised rule application, then wire a `ParameterSelector` component into the existing `HeroAdvancementPanel` and minor rule picker.

## Tasks

- [x] 1. Create utility functions for parameterised rule logic
  - [x] 1.1 Create `src/utils/parameterizedRules.ts` with `isRuleOwned`, `isValidParameter`, and `applyParameterisedRule`
    - Implement `isRuleOwned` to check both string entries and `{ id, parameter }` objects in `specialRules` array
    - Implement `isValidParameter` to validate parameter values against `parameter_type` constraints (string for friendly_hero/weapon/target_keyword, positive integer for integer/target_integer, positive number for distance)
    - Implement `applyParameterisedRule` to store `{ id, parameter }` object, subtract 5 XP (floored at 0), and return unchanged member if duplicate exists
    - _Requirements: 1.2, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_

  - [x] 1.2 Add `getEligibleHeroes` and `getEligibleWeapons` to `src/utils/parameterizedRules.ts`
    - Implement `getEligibleHeroes` filtering company members by role (leader, sergeant, hero_in_making) excluding receiving member
    - Implement `getEligibleWeapons` merging baseWargear + member.equipment, filtering by category (weapon, bow, throwing), excluding weapons already assigned poisoned_attacks for this member
    - _Requirements: 1.4, 2.1, 3.1_

  - [x] 1.3 Write property test: Parameter validation correctness
    - **Property 1: Parameter validation correctness**
    - Generate random values across all parameter_types, verify `isValidParameter` returns true iff value is non-empty and matches type constraints
    - **Validates: Requirements 1.2**

  - [x] 1.4 Write property test: Ownership determination correctness
    - **Property 8: Ownership determination correctness**
    - Generate mixed specialRules arrays (strings and objects), verify `isRuleOwned` correctly identifies ownership for parameterised and non-parameterised rules
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [x] 1.5 Write property test: Hero eligibility filter
    - **Property 3: Hero eligibility filter**
    - Generate random company member arrays, verify `getEligibleHeroes` returns only hero-role members excluding receiving member
    - **Validates: Requirements 1.4, 2.1**

  - [x] 1.6 Write property test: Weapon eligibility filter
    - **Property 4: Weapon eligibility filter**
    - Generate random equipment sets and existing rules, verify `getEligibleWeapons` returns only eligible-category weapons not already assigned poisoned_attacks
    - **Validates: Requirements 3.1**

- [x] 2. Checkpoint - Verify utility functions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement parameterised rule application and storage logic
  - [x] 3.1 Write property test: Parameterised rule storage format
    - **Property 5: Parameterised rule storage format**
    - Generate random rule IDs and parameter values, verify `applyParameterisedRule` produces `{ id, parameter }` object in specialRules (not a plain string)
    - **Validates: Requirements 3.3, 4.1**

  - [x] 3.2 Write property test: XP deduction on parameterised rule confirmation
    - **Property 6: XP deduction on parameterised rule confirmation**
    - Generate random XP values (0–100), verify resulting experience equals `max(0, xp - 5)` after non-duplicate application
    - **Validates: Requirements 4.2**

  - [x] 3.3 Write property test: Duplicate parameterised rule prevention
    - **Property 7: Duplicate parameterised rule prevention**
    - Generate members with pre-existing parameterised rules, verify calling `applyParameterisedRule` with same id+parameter returns identical member (no mutation, no XP change)
    - **Validates: Requirements 4.3**

- [x] 4. Create ParameterSelector UI component
  - [x] 4.1 Create `src/components/match/ParameterSelector.tsx` with base structure and props interface
    - Implement component accepting `rule`, `receivingMember`, `companyMembers`, `baseWargear`, `onParameterSelected`, `onCancel` props
    - Render appropriate sub-UI based on `rule.parameter_type`: chip list for friendly_hero/weapon, input for integer/distance/target_keyword
    - Display "No valid targets available" or "No weapons available" message when eligible list is empty
    - Disable confirm until valid parameter selected
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.2 Write property test: Parameter state reset on rule change
    - **Property 2: Parameter state reset on rule change**
    - Generate rule selection sequences, verify parameter value clears when a different rule is selected
    - **Validates: Requirements 1.3**

- [x] 5. Checkpoint - Verify component and property tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate into PostMatchSummaryPage
  - [x] 6.1 Modify `PostMatchSummaryPage.tsx` minor rule picker filter to use `isRuleOwned`
    - Replace current filter `!member.specialRules.some((sr) => sr === r.label)` with call to `isRuleOwned(member, rule)`
    - Handles both legacy string entries and new `{ id, parameter }` object entries
    - _Requirements: 4.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 6.2 Modify `PostMatchSummaryPage.tsx` HeroAdvancementPanel to integrate ParameterSelector
    - After parameterised rule chip selection, render `ParameterSelector` inline below chip list
    - Disable "Apply" button until `isValidParameter` returns true
    - On apply, call `applyParameterisedRule` instead of `applySpecialRule` for parameterised rules
    - Clear parameter state when selected rule changes or is deselected
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2_

  - [x] 6.3 Write unit tests for PostMatchSummaryPage integration
    - Test full flow: select parameterised rule → collect parameter → verify stored object
    - Test deselection clears parameter state
    - Test confirm disabled until valid parameter
    - _Requirements: 1.1, 1.2, 1.3, 4.1_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code in TypeScript, using fast-check + vitest for property-based tests
- Existing `resolveParameterisedLabel` handles display — this feature closes the input side

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "1.6", "3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "6.1"] },
    { "id": 5, "tasks": ["6.2"] },
    { "id": 6, "tasks": ["6.3"] }
  ]
}
```
