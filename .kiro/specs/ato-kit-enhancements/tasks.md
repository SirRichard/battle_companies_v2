# Implementation Plan: ATO Kit Enhancements

## Overview

Implement five enhancements to the ATO Toolkit bonus flow: kit info dialog, Dwarven Brew auto-use for temporary items, permanent Dwarven Brew manual use with intelligence test, duplicate item assignment prevention, and dynamic proceed button labelling. Changes span `ToolkitAssignmentPage.tsx`, `MatchTrackingPage.tsx`, and two new utility modules.

## Tasks

- [x] 1. Create kit eligibility utility module
  - [x] 1.1 Create `src/utils/kitEligibility.ts` with `getItemIneligibilityReason`, `hasDuplicateAssignment`, and `hasPermanentOwnership` functions
    - `getItemIneligibilityReason(memberId, itemId, currentAssignments, memberOwnedEquipment)` returns null if eligible, reason string if not
    - `hasDuplicateAssignment` checks if same itemId already assigned to same member
    - `hasPermanentOwnership` checks if itemId exists in member's ownedEquipment
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 1.2 Write property tests for kit eligibility (Property 5 & 6)
    - **Property 5: No duplicate kit item assigned to same member**
    - **Property 6: No kit item assigned to member with permanent ownership**
    - Test file: `src/utils/__tests__/kitEligibility.property.test.ts`
    - Generate random kit item lists + assignment sequences with fast-check
    - **Validates: Requirements 3.1, 3.2**

- [x] 2. Create Dwarven Brew utility module
  - [x] 2.1 Create `src/utils/dwarvenBrew.ts` with `hasTemporaryDwarvenBrew`, `getDwarvenBrewCourageBonus`, `memberOwnsDwarvenBrew`, and `dwarvenBrewIntelligenceTestPasses` functions
    - `hasTemporaryDwarvenBrew(toolkitItems)` returns true if any toolkit item has itemId === 'dwarven_brew'
    - `getDwarvenBrewCourageBonus(toolkitItems, permanentBrewUsed)` returns 1 or 0
    - `memberOwnsDwarvenBrew(member)` checks ownedEquipment for 'dwarven_brew'
    - `dwarvenBrewIntelligenceTestPasses(rollResult, intelligenceStat)` returns true if roll >= stat value
    - _Requirements: 2.1, 2.3, 2.4, 5.4, 5.5, 5.6_

  - [x] 2.2 Write property tests for Dwarven Brew courage bonus (Properties 3, 4, 8, 9, 10)
    - **Property 3: Temporary dwarven_brew applies +1 courage to all members**
    - **Property 4: Permanent dwarven_brew does not auto-apply courage bonus**
    - **Property 8: Intelligence test determines retention (roll >= stat → pass)**
    - **Property 9: Permanent elected use applies same +1 courage bonus as temporary**
    - **Property 10: Declining permanent use applies no bonus and retains item**
    - Test file: `src/utils/__tests__/dwarvenBrewCourage.property.test.ts`
    - **Validates: Requirements 2.1, 2.2, 2.4, 5.2, 5.3, 5.5, 5.6, 5.7**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Kit Info Dialog on ToolkitAssignmentPage
  - [x] 4.1 Add info button (IconButton with InfoOutlined icon) adjacent to each kit option in the kit selection list
    - Clicking opens the info dialog for that specific kit
    - _Requirements: 1.1, 1.2_

  - [x] 4.2 Implement KitInfoDialog component within ToolkitAssignmentPage
    - Derive unique items from `kit.items` with quantity counts via Map
    - Look up each item in `equipment.json` for `description` field
    - For items without description, display formatted `grantsSpecialRules` or fallback "No description available"
    - Display each unique item once with quantity prefix (e.g. "3× Wondrous Cram")
    - Close button returns focus to kit selection area
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 4.3 Write property tests for kit info deduplication and fallback (Properties 1, 2)
    - **Property 1: Kit info deduplication preserves total count**
    - **Property 2: Item description fallback completeness**
    - Test file: `src/utils/__tests__/kitInfoDeduplication.property.test.ts` and `src/utils/__tests__/kitInfoFallback.property.test.ts`
    - **Validates: Requirements 1.3, 1.4**

- [x] 5. Implement duplicate item assignment prevention on ToolkitAssignmentPage
  - [x] 5.1 Integrate `getItemIneligibilityReason` from `kitEligibility.ts` into the member dropdown for each kit item
    - Build `currentAssignments` array from state: `assignments.map((a, i) => ({ memberId: a.memberId, itemId: kit.items[i] }))`
    - For each member in dropdown, call `getItemIneligibilityReason` to check eligibility
    - Disable ineligible members and display reason text (e.g. "Already assigned" or "Permanently owned")
    - Allow reassignment by clearing previous assignment first (existing unassign flow)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Implement dynamic proceed button label
  - [x] 6.1 Load active match state on mount to access `atoBonuses` array
    - Change button label: if `atoBonuses.includes('wanderer')` → "Next: Choose Wanderer →", else "Begin Battle"
    - No page reload needed — label derived from state already available
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Write property test for proceed button label (Property 7)
    - **Property 7: Proceed button label determined by wanderer bonus presence**
    - Test file: `src/utils/__tests__/proceedButtonLabel.property.test.ts`
    - **Validates: Requirements 4.1, 4.2**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Dwarven Brew auto-use for temporary kit items on MatchTrackingPage
  - [x] 8.1 Add courage bonus calculation to stat display in MemberMatchCard
    - Import `hasTemporaryDwarvenBrew` and `getDwarvenBrewCourageBonus` from `dwarvenBrew.ts`
    - When `hasTemporaryDwarvenBrew(match.toolkitItems)` is true, add +1 to displayed courage stat for all members
    - Integrate into existing `effectiveVal` / `formatStat` logic for the courage stat
    - No intelligence test prompt for temporary items
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 9. Implement permanent Dwarven Brew manual use flow on MatchTrackingPage
  - [x] 9.1 Add DwarvenBrewState to MatchTrackingPage component state
    - Track: `promptResolved`, `elected`, `intelligenceTestResult`, `testPassed`, `ownerMemberId`
    - On mount, check if any company member has `dwarven_brew` in `ownedEquipment` (using `memberOwnsDwarvenBrew`)
    - If permanent brew owner exists and no temporary brew in toolkit, show use prompt
    - _Requirements: 5.1, 2.4_

  - [x] 9.2 Implement Dwarven Brew use prompt dialog
    - Show dialog: "Use Dwarven Brew? (+1 Courage to all, Intelligence Test required)"
    - "Use" button → apply +1 courage bonus, then show intelligence test dialog
    - "Decline" button → no bonus, retain item, close dialog
    - _Requirements: 5.1, 5.2, 5.7_

  - [x] 9.3 Implement intelligence test dialog and outcome handling
    - Show D6 roll prompt against owner's Intelligence stat
    - If roll >= Intelligence value → test passes, brew retained, show success message
    - If roll < Intelligence value → test fails, mark brew for removal at end of match
    - Store test outcome in component state for post-match processing
    - Default to Intelligence 4+ if stat not available
    - _Requirements: 5.4, 5.5, 5.6_

  - [x] 9.4 Apply courage bonus from permanent brew to stat display
    - When `permanentBrewUsed` is true, add +1 to displayed courage stat for all members (same as temporary)
    - Pass `permanentBrewUsed` flag to `getDwarvenBrewCourageBonus` utility
    - _Requirements: 5.2, 5.3_

  - [x] 9.5 Handle brew removal on match end when intelligence test failed
    - In `handleEndMatch`, if `testPassed === false`, remove `dwarven_brew` from owner's `ownedEquipment`
    - Save updated company with brew removed
    - _Requirements: 5.5_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The two new utility modules (`kitEligibility.ts`, `dwarvenBrew.ts`) are pure functions, easy to test in isolation before integrating into page components
