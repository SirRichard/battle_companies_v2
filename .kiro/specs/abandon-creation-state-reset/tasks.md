# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Wizard State Not Reset on Abandon
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate stale wizard state persists after `handleAbort`
  - **Scoped PBT Approach**: Generate `WizardState` objects where `isBugCondition` is true (at least one field differs from `INITIAL_WIZARD`), invoke `handleAbort` logic, then assert the resulting state still contains non-default values — confirming the reset never happened
  - Test that for all `WizardState` inputs where `isBugCondition(input)` is true, calling `handleAbort` on unfixed code leaves `wizard` state unchanged (i.e., NOT equal to `INITIAL_WIZARD`)
  - `isBugCondition(input)`: `input.step > 0 || input.alignment !== null || input.factionId !== null || input.companyTypeId !== null || input.companyName !== '' || Object.keys(input.memberNames).length > 0 || input.leaderId !== null || input.sergeantIds.length > 0 || Object.keys(input.heroPaths).length > 0 || Object.keys(input.heroSpellChoices).length > 0 || Object.keys(input.goldPurchases).length > 0`
  - Create test file at `src/pages/__tests__/abandonCreationStateReset.bugCondition.property.test.ts`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., `{ alignment: 'good', step: 0, ... }` — state unchanged after abort)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Abort Wizard Interactions Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for interactions that do NOT involve confirming the abandon dialog
  - Observe: step navigation (`go(n)`) updates `wizard.step` and leaves other fields intact
  - Observe: `selectAlignment('good')` sets `alignment` and clears downstream fields (`factionId`, `companyTypeId`)
  - Observe: `sessionStorage` draft is written on every `setWizard` call (via the `useEffect` persist hook)
  - Observe: returning with `?from=stats` restores the draft from `sessionStorage` and sets `step: 6`
  - Write property-based tests capturing these observed behaviors from the Preservation Requirements in design
  - Test that for all non-abort interactions, the wizard state transitions match the original (unfixed) behavior
  - Create test file at `src/pages/__tests__/abandonCreationStateReset.preservation.property.test.ts`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix: wizard state not reset when abandoning company creation

  - [x] 3.1 Implement the fix
    - Open `src/pages/CreateCompanyPage.tsx`
    - Locate the `handleAbort` `useCallback`
    - Add `setWizard(INITIAL_WIZARD)` between `sessionStorage.removeItem(WIZARD_DRAFT_KEY)` and `navigate('/')`
    - The fixed implementation should be:
      ```typescript
      const handleAbort = useCallback(() => {
        sessionStorage.removeItem(WIZARD_DRAFT_KEY)
        setWizard(INITIAL_WIZARD)
        navigate('/')
      }, [navigate])
      ```
    - No other files need to change — `INITIAL_WIZARD` is already defined at module scope in the same file
    - _Bug_Condition: `isBugCondition(input)` where `input` differs from `INITIAL_WIZARD` in any field_
    - _Expected_Behavior: after `handleAbort` completes, `wizard` state SHALL equal `INITIAL_WIZARD`_
    - _Preservation: stats-entry restore path, successful formation, cancel/dismiss, and page-refresh flows SHALL remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Wizard State Reset on Abandon
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior: after `handleAbort`, `wizard` state equals `INITIAL_WIZARD`
    - When this test passes, it confirms the expected behavior is satisfied for all `isBugCondition` inputs
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Abort Navigation Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions in stats-entry restore, formation, cancel, and refresh flows)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite to confirm no regressions
  - Ensure all tests pass; ask the user if questions arise
