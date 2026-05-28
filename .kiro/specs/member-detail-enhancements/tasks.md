# Implementation Plan: Member Detail Enhancements

## Overview

Enhance the Member Details Drawer and Company Details Page with interactive equipment/rule popups, equipment-granted special rules display with rating exclusion, shield mutual exclusivity, torching brand multi-rule handling, parameterised rule label resolution, creature display with detail drawer, and wanderer roster section. All implemented in TypeScript/React with Material UI.

## Tasks

- [x] 1. Create utility functions for granted rules and parameter resolution
  - [x] 1.1 Create `src/utils/grantedRules.ts` with `getGrantedSpecialRules` and `getGrantedRuleIds`
    - Iterate `ownedEquipment`, look up each in `equipment.json`, collect `grantsSpecialRules` entries
    - Return `GrantedRule[]` with `ruleId`, `parameter`, `sourceEquipmentId`, `sourceEquipmentLabel`
    - `getGrantedRuleIds` returns a `Set<string>` of composite keys for exclusion matching
    - Handle torching_brand's array of parameterised objects
    - _Requirements: 2.1, 5.1_

  - [x] 1.2 Create `src/utils/paramLabel.ts` with `resolveParameterisedLabel`
    - Accept `{ id, parameter }` entry and optional `companyMembers` array
    - Look up rule in `specialRules.json` for `parameter_type`
    - For `weapon`: resolve parameter to wargear label via wargear.json lookup
    - For `friendly_hero`: resolve parameter to member name from companyMembers
    - For `integer`, `distance`, `target_integer`, `target_keyword`: display raw value in parentheses
    - Never return a label containing literal "(X)"
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 1.3 Create `src/utils/shieldExclusivity.ts` with `isShieldExclusive`
    - Check if `small_shield` is in `ownedEquipment` and item-to-add has category `shield` in wargear.json
    - Check symmetric case: if any wargear with category `shield` is in `equipment` and item-to-add is `small_shield`
    - Return boolean indicating violation
    - _Requirements: 4.1, 4.2_

  - [x] 1.4 Write property test for `getGrantedSpecialRules` completeness
    - **Property 2: Granted Special Rules Completeness**
    - **Validates: Requirements 2.1**

  - [x] 1.5 Write property test for `resolveParameterisedLabel` correctness
    - **Property 6: Parameter Resolution Correctness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

  - [x] 1.6 Write property test for `isShieldExclusive` mutual exclusivity
    - **Property 4: Shield Mutual Exclusivity**
    - **Validates: Requirements 4.1, 4.2**

- [x] 2. Update ratings calculator to exclude granted rules
  - [x] 2.1 Modify `calcMemberRating` in `src/utils/rating.ts` to call `getGrantedRuleIds`
    - Import `getGrantedRuleIds` from `grantedRules.ts`
    - Before tallying special rule points, compute exclusion set from `member.ownedEquipment`
    - Skip any special rule whose composite key matches the exclusion set
    - Equipment's own `rating` field value continues to be included as before
    - _Requirements: 3.1, 3.2, 3.3, 5.3_

  - [x] 2.2 Write property test for rating invariant under granted rules
    - **Property 3: Rating Invariant Under Granted Rules**
    - **Validates: Requirements 3.1, 3.2, 3.3, 5.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add clickable equipment chips with description popups to MemberDetailsDrawer
  - [x] 4.1 Add equipment chip `onClick` handler and popup dialog in `MemberDetailsDrawer.tsx`
    - Equipment chips with `description` field → show label as title, description as body
    - Equipment chips with no description but `grantsSpecialRules` → show formatted granted rules list
    - Add pointer cursor to all equipment chips
    - Add close button and outside-click dismiss behaviour
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 4.2 Write property test for equipment popup content correctness
    - **Property 1: Equipment Popup Content Correctness**
    - **Validates: Requirements 1.1**

- [x] 5. Display granted special rules in MemberDetailsDrawer
  - [x] 5.1 Render granted special rules in the Special Rules section of `MemberDetailsDrawer.tsx`
    - Call `getGrantedSpecialRules(member.ownedEquipment)` to get granted rules
    - Display each as a chip with distinct border style (e.g. dashed border) and "(from Equipment)" annotation
    - Use `resolveParameterisedLabel` for parameterised granted rules (torching_brand Terror (Beast), etc.)
    - Make granted rule chips clickable → show rule description popup
    - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2_

- [x] 6. Add clickable special rules with description popups
  - [x] 6.1 Make all special rule chips in `MemberDetailsDrawer.tsx` clickable with description popups
    - Look up rule description from `specialRules.json` by ID
    - For parameterised rules, show description with parameter value contextually noted
    - Add pointer cursor only to chips that have descriptions available
    - Chips without descriptions render without pointer cursor and without click behaviour
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 6.2 Write property test for rule description lookup correctness
    - **Property 5: Rule Description Lookup Correctness**
    - **Validates: Requirements 6.1, 6.2**

- [x] 7. Integrate parameterised rule label resolution
  - [x] 7.1 Replace `formatSpecialRule` usage with `resolveParameterisedLabel` in `MemberDetailsDrawer.tsx`
    - For every parameterised rule entry `{ id, parameter }`, call `resolveParameterisedLabel`
    - Pass `company.members` for `friendly_hero` resolution
    - Ensure no rule label displays literal "(X)" text
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. Implement shield mutual exclusivity enforcement in Store tab
  - [x] 8.1 Add shield exclusivity check in equipment purchase flow in `CompanyDetailsPage.tsx` Store tab
    - Before allowing small_shield purchase, check `isShieldExclusive` against member's equipment
    - Before allowing shield-category wargear purchase, check against member's ownedEquipment
    - Display informative error message when exclusivity violated
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Create CreatureDetailsDrawer component
  - [x] 10.1 Create `src/components/common/CreatureDetailsDrawer.tsx`
    - Accept `creatureId`, `open`, `onClose` props
    - Look up creature data from `creatures.json` by ID
    - Display creature stats in same grid format as MemberDetailsDrawer
    - Display creature special rules as clickable chips with description popups
    - Display creature description text
    - Reuse same popup pattern and styling from MemberDetailsDrawer
    - _Requirements: 8.3, 8.4, 8.5, 8.6_

- [x] 11. Add creature display nested under hero in Roster tab
  - [x] 11.1 Modify Roster tab in `CompanyDetailsPage.tsx` to show creatures under owning heroes
    - For each hero with `creatureId`, render creature sub-row beneath hero row
    - Show creature label, point cost, and key stats in sub-row
    - Make creature sub-row tappable → open `CreatureDetailsDrawer`
    - Add state for selected creature ID and drawer open/close
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 12. Add Wanderer section to Roster tab
  - [x] 12.1 Add "Wanderers" section below Warriors in Roster tab of `CompanyDetailsPage.tsx`
    - Show section only when `company.wandererId` is set
    - Look up wanderer data from `wanderers.json`
    - Display wanderer label, point cost, stats summary, equipment, and special rules
    - Use distinct header style to differentiate from Warriors section
    - Make wanderer row tappable → open detail view (MemberDetailsDrawer or equivalent)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 12.2 Write property test for wanderer display completeness
    - **Property 7: Wanderer Display Completeness**
    - **Validates: Requirements 9.2**

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `formatSpecialRule` in `src/utils/labels.ts` will be superseded by `resolveParameterisedLabel` for parameterised entries
- Store tab wanderer hire/dismiss functionality remains unchanged per Requirement 9.5

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["1.5"] },
    { "id": 5, "tasks": ["1.6"] },
    { "id": 6, "tasks": ["2.1"] },
    { "id": 7, "tasks": ["2.2"] },
    { "id": 8, "tasks": ["3"] },
    { "id": 9, "tasks": ["4.1"] },
    { "id": 10, "tasks": ["4.2"] },
    { "id": 11, "tasks": ["5.1"] },
    { "id": 12, "tasks": ["6.1"] },
    { "id": 13, "tasks": ["6.2"] },
    { "id": 14, "tasks": ["7.1"] },
    { "id": 15, "tasks": ["8.1"] },
    { "id": 16, "tasks": ["9"] },
    { "id": 17, "tasks": ["10.1"] },
    { "id": 18, "tasks": ["11.1"] },
    { "id": 19, "tasks": ["12.1"] },
    { "id": 20, "tasks": ["12.2"] },
    { "id": 21, "tasks": ["13"] }
  ]
}
```
