# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Partial Assignment Enables Proceed with Confirmation
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases — a kit is selected and at least one assignment has `memberId === ''`
  - Test file: `src/pages/__tests__/toolkitPartialAssignment.bugCondition.property.test.ts`
  - Bug condition predicate (`isBugCondition`): `state.kitId !== null AND state.assignments.some(a => a.memberId === '')`
  - Generate states where a kit is selected and 1–(n-1) items are assigned; assert the "Begin Battle" button is **enabled** (not disabled)
  - Also assert that clicking "Begin Battle" opens a confirmation dialog (not navigating immediately)
  - Run test on UNFIXED code — the button is `disabled={!allAssigned}` so the test will FAIL
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., "Begin Battle button is disabled when 1 of 3 items assigned")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Full Assignment Fast Path and No-Kit State Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **GOAL**: Capture baseline behavior on UNFIXED code for all non-buggy inputs
  - Test file: `src/pages/__tests__/toolkitPartialAssignment.preservation.property.test.ts`
  - Non-bug condition: `state.kitId === null` OR `state.assignments.every(a => a.memberId !== '')`
  - Observe on UNFIXED code:
    - When all items are assigned, "Begin Battle" is enabled and `handleProceed` navigates directly (no dialog)
    - When no kit is selected, the assignment section and "Begin Battle" button are not rendered
    - The `toolkitItems` saved to the match equals `assignments.map((a, i) => ({ memberId: a.memberId, itemId: kit.items[i], parameter: a.parameter }))` for the all-assigned case
  - Write property-based tests capturing these observed behaviors:
    - For all fully-assigned states: button is enabled, no confirmation dialog is shown, navigation occurs directly
    - For all no-kit states: assignment section is absent, "Begin Battle" is absent
    - For all fully-assigned states: saved `toolkitItems` length equals the number of kit items (no items dropped)
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix: enable "Begin Battle" with partial assignments and show confirmation dialog

  - [x] 3.1 Implement the fix in `src/pages/ToolkitAssignmentPage.tsx`
    - Add `confirmPartialOpen` boolean state variable (default `false`) to control the partial-assignment confirmation dialog
    - Change `disabled={!allAssigned}` to `disabled={!kit}` so the button is enabled whenever a kit is selected
    - Update the helper caption: show it only when a kit is selected but no items are assigned yet, or remove it in favour of the dialog warning
    - Split `handleProceed` into two paths: if `!allAssigned` → set `confirmPartialOpen = true` and return; if `allAssigned` → proceed as before
    - Add `handleConfirmPartial` function: filter `assignments` to those with non-empty `memberId`, build `toolkitItems` from the filtered set, save to active match, and navigate
    - Filter unassigned items in both paths: build `toolkitItems` from `assignments.filter(a => a.memberId !== '')` to avoid saving empty-memberId entries
    - Render `<ConfirmDialog>` (from `src/components/common/ConfirmDialog.tsx`) with: `open={confirmPartialOpen}`, `title="Unassigned Items"`, `message` warning that unassigned items will be lost, `confirmLabel="Proceed Anyway"`, `onConfirm={handleConfirmPartial}`, `onCancel={() => setConfirmPartialOpen(false)}`
    - _Bug_Condition: `isBugCondition(state)` where `state.kitId !== null AND state.assignments.some(a => a.memberId === '')`_
    - _Expected_Behavior: button is enabled; clicking opens confirmation dialog; confirming saves only assigned items and navigates; cancelling closes dialog without navigating_
    - _Preservation: all-assigned fast path navigates directly without dialog; no-kit state hides assignment section and button; Envenom Weapon parameter dialog is unaffected_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Partial Assignment Enables Proceed with Confirmation
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (button enabled, dialog shown on click)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run `src/pages/__tests__/toolkitPartialAssignment.bugCondition.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Full Assignment Fast Path and No-Kit State Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `src/pages/__tests__/toolkitPartialAssignment.preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions introduced)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite to confirm no regressions across the codebase
  - Ensure all tests pass; ask the user if questions arise
