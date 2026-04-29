# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Next Button Enables After Hero Selection
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that when step is 5, leaderId is non-null, and sergeantIds has exactly 2 entries, the Next button is enabled (disabled prop is false)
  - The test assertions should match the Expected Behavior Properties from design: Next button SHALL be enabled immediately when `leaderId !== null && sergeantIds.length === 2`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (e.g., "After selecting leader and 2 sergeants, Next button remains disabled")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Other Steps Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (other wizard steps, incomplete hero selection)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For any wizard state where step is NOT 5, Next button enabled/disabled state is determined by existing logic
    - For step 5 where hero selection criteria are not met (leaderId is null OR sergeantIds.length !== 2), Next button remains disabled
    - Helm's Deep company (allRolesForced = true) skips step 5 and advances from step 4 to step 6
    - Enter key shortcut works correctly for all steps when canAdvance() returns true
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for Next button not enabling after hero selection

  - [x] 3.1 Stabilize callback functions using useCallback
    - Wrap `toggleSergeant` in `useCallback` with no dependencies (uses functional state update)
    - Extract inline `onSelectLeader` arrow function and wrap in `useCallback` as `handleSelectLeader` with no dependencies
    - Wrap `handleFinish` in `useCallback` with dependencies `[selectedCompany, wizard.step]`
    - Update StepLeaderSelection JSX to use `onSelectLeader={handleSelectLeader}` instead of inline arrow function
    - _Bug_Condition: isBugCondition(input) where input.step === 5 AND input.leaderId !== null AND input.sergeantIds.length === 2 AND userAction IN ['selectLeader', 'toggleSergeant'] AND nextButtonIsDisabled()_
    - _Expected_Behavior: For any wizard state where step is 5, leaderId is non-null, and sergeantIds has exactly 2 entries, the Next button SHALL be enabled (disabled prop is false)_
    - _Preservation: For any wizard state where step is NOT 5, or where step is 5 but the hero selection criteria are not met, the Next button's enabled/disabled state SHALL be determined by the same logic as before the fix_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Next Button Enables After Hero Selection
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Other Steps Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
