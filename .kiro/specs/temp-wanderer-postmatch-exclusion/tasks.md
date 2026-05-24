# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Temp Wanderer Excluded From Post-Match Arrays
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate temp wanderers leak into casualties/xpGained arrays
  - **Scoped PBT Approach**: Generate match states containing at least one ATO wanderer (memberId in wanderers.json but NOT in company.members) with `isCasualty === true` and/or `xpCounterGains > 0`
  - Extract `handleEndMatch` post-match data building logic into a pure testable function (or replicate inline)
  - Bug Condition: `isAtoWanderer(memberId)` — memberId exists in wanderers.json AND NOT in company.members
  - Assert: for all members where `isAtoWanderer(memberId)` is true, memberId NOT IN `postMatchData.casualties[].memberId`
  - Assert: for all members where `isAtoWanderer(memberId)` is true, memberId NOT IN `postMatchData.xpGained[].memberId`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - proves bug exists: casualties array includes ATO wanderers)
  - Document counterexamples found (e.g., "wanderer_gandalf with isCasualty=true appears in casualties array")
  - Mark task complete when test is written, run, and failure is documented
  - Test file: `src/pages/__tests__/tempWandererPostmatchExclusion.bugCondition.property.test.ts`
  - _Requirements: 1.1, 2.1, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Permanent Members Unaffected In Post-Match Arrays
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: permanent company member with `isCasualty === true` appears in casualties array on unfixed code
  - Observe: permanent company member with `xpCounterGains > 0` appears in xpGained array with correct XP calculation
  - Observe: permanent wanderer (hired via `company.wandererId`, present in `company.members`) also processed normally
  - Write property-based test: for all members where `isAtoWanderer(memberId)` is FALSE and `isCasualty === true`, member appears in casualties output
  - Write property-based test: for all members where `isAtoWanderer(memberId)` is FALSE, member appears in xpGained with xp = 1 + xpCounterGains + xpBonus
  - Generate random `ActiveMatchState` + `Company` pairs with only permanent members (no ATO wanderers)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - Test file: `src/pages/__tests__/tempWandererPostmatchExclusion.preservation.property.test.ts`
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix for temp wanderer post-match exclusion

  - [x] 3.1 Implement the fix
    - Change 1: Add `&& !isAtoWanderer(m.memberId)` to casualties filter in `handleEndMatch` (~line 220 in MatchTrackingPage.tsx)
    - Current: `.filter((m) => m.isCasualty)`
    - Fixed: `.filter((m) => m.isCasualty && !isAtoWanderer(m.memberId))`
    - Change 2: Wrap XP counter (Divider + Row 5 box) in `{!isAtoWanderer && (...)}` in MemberMatchCard (~line 1195)
    - Current: unconditional `<Divider>` + XP counter `<Box>`
    - Fixed: `{!isAtoWanderer && (<>...</>)}`
    - _Bug_Condition: isAtoWanderer(memberId) — memberId in wanderers.json AND NOT in company.members_
    - _Expected_Behavior: temp wanderers excluded from casualties/xpGained arrays; XP counter hidden_
    - _Preservation: permanent members (NOT isAtoWanderer) unaffected in both arrays and XP counter display_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Temp Wanderer Excluded From Post-Match Arrays
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (no ATO wanderer in casualties/xpGained)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Permanent Members Unaffected In Post-Match Arrays
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to confirm no regressions
  - Ensure both property tests pass on fixed code
  - Ask user if questions arise
