# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Pre-Roll Boost Shown & Post-Roll Auto-Success
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists in both locations
  - **Scoped PBT Approach**: Generate tuples of (location, rollResult, ipBalance) where rollResult < 5
  - Test file: `src/pages/__tests__/woundRecoveryIpBoost.bugCondition.property.test.ts`
  - Property under test: For any hero recovery attempt, NO pre-roll boost controls exist; after a failed roll (< 5), post-roll increment/decrement controls are shown with IP balance, and recovery succeeds IFF rollResult + ipSpent >= 5
  - Model the treatment flow logic: extract `treatDialog`/`treatStage` state machine behavior
  - For CompanyDetailsPage (`InjuryTreatmentPanel`): assert pre-roll boost controls (`treatAdjust` UI in `treatDialog === 'roll'` before rolling) should NOT exist
  - For CompanyDetailsPage: assert post-roll boost controls appear when `treatRollResult < 5`
  - For MemberDetailsDrawer: assert no "Pre-roll IP boost (optional)" controls in `options` stage
  - For MemberDetailsDrawer: assert `handleSpendIP` does NOT auto-succeed — recovery succeeds only if `rolledValue + ipSpent >= 5`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., "pre-roll boost controls rendered", "roll 1 + spend 1 IP = auto-success instead of failure")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Boost Flows Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `src/pages/__tests__/woundRecoveryIpBoost.preservation.property.test.ts`
  - Observe on UNFIXED code: successful rolls (>= 5) remove injury with 1 IP cost, no boost prompt
  - Observe on UNFIXED code: warrior `remove_missing` treatment deducts 1 IP and removes `missing_next_game`
  - Observe on UNFIXED code: hero `miss_hero` (Send to Healers) deducts 1 IP, removes target injury, adds `missing_next_game`
  - Write property-based tests generating random (rollResult in [5,6], ipBalance >= 1) tuples — verify injury removed, 1 IP deducted, no boost prompt
  - Write property-based tests generating random warrior members with `missing_next_game` — verify 1 IP removal works identically
  - Write property-based tests generating random hero members choosing "Send to Healers" — verify miss-next-game + injury removal
  - Write property-based test: insufficient IP (company.influence == 1, failed roll) — increment control disabled, user can only accept failure
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix wound recovery IP boost in both locations

  - [x] 3.1 Remove pre-roll boost and add post-roll boost in CompanyDetailsPage
    - In `InjuryTreatmentPanel`, remove the `treatAdjust` increment/decrement UI from `treatDialog === 'roll'` stage (lines showing +/- buttons and "Boost roll with extra IP" text BEFORE the "Roll D6" button)
    - Remove the `treatAdjust >= 3` cap and `company.influence < 1 + treatAdjust + 1` pre-roll check
    - After `treatRollResult` is set and result < 5, show: IP balance display, increment/decrement controls for `treatAdjust` (allow any amount up to `company.influence - 1`)
    - Disable increment button when `company.influence < 1 + treatAdjust + 1`
    - Show dynamic total: `treatRollResult + treatAdjust` with success/failure indicator
    - Keep existing success logic: `treatRollResult + treatAdjust >= 5`
    - Update "Confirm" button label to show total cost: `1 + treatAdjust` IP
    - _Bug_Condition: isBugCondition(input) where preRollBoostControlsVisible OR (rollResult < 5 AND NOT postRollBoostControlsVisible)_
    - _Expected_Behavior: No pre-roll boost; post-roll shows IP balance + increment/decrement; success IFF rollResult + treatAdjust >= 5_
    - _Preservation: Successful rolls (>= 5) show success immediately; warrior/healer treatments unchanged_
    - _Requirements: 1.1, 1.3, 2.1, 2.3, 2.4_

  - [x] 3.2 Remove pre-roll boost and replace auto-success in MemberDetailsDrawer
    - Remove "Pre-roll IP boost (optional)" section shown when `treatType === 'roll_hero'` in `options` stage (the Box with +/- buttons and `treatAdjust >= 3` cap)
    - Remove `handleSpendIP` function entirely (it auto-succeeds regardless of roll value)
    - In `ip_prompt` stage, replace "Spend 1 IP to improve outcome" box with increment/decrement controls for `treatAdjust`
    - Remove the +3 cap; allow any amount up to `company.influence - 1` (base cost is 1 IP)
    - Show: current boost value, updated total (`rolledValue + treatAdjust`), dynamic success/failure indicator
    - Disable increment when `company.influence < 1 + treatAdjust + 1`
    - Remove "Spend 1 IP" action button from DialogActions; keep "Accept Result" button which uses `handleTreatConfirm` (already handles `rolledValue + treatAdjust >= 5` correctly)
    - Update "Accept Result" button label to show total cost: `1 + treatAdjust` IP
    - _Bug_Condition: isBugCondition(input) where preRollBoostControlsVisible OR postRollAction == 'auto_success_1ip'_
    - _Expected_Behavior: No pre-roll boost; post-roll shows increment/decrement; success IFF rolledValue + treatAdjust >= 5_
    - _Preservation: Successful rolls show success; warrior/healer treatments unchanged; animated die sequence unchanged_
    - _Requirements: 1.2, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Pre-Roll Boost Removed & Post-Roll Incremental Boost Works
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (no pre-roll boost, incremental post-roll boost, success IFF total >= 5)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run: `npx vitest --run src/pages/__tests__/woundRecoveryIpBoost.bugCondition.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Boost Flows Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run: `npx vitest --run src/pages/__tests__/woundRecoveryIpBoost.preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions in successful rolls, warrior treatment, healer treatment)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npx vitest --run`
  - Ensure all property tests pass (both bug condition and preservation)
  - Ensure no regressions in existing tests
  - Ask the user if questions arise
