# Abandon Creation State Reset Bugfix Design

## Overview

When a user confirms "Abandon Creation" in the company creation wizard, the `handleAbort`
callback removes the sessionStorage draft and navigates to the home screen, but never resets
the in-memory React state. Because React Router does not unmount `CreateCompanyPage` between
navigations, the `useState` lazy initializer does not re-run on return visits. All abandoned
selections therefore persist in memory and reappear the next time the user opens the wizard.

The fix is a single-line addition to `handleAbort`: call `setWizard(INITIAL_WIZARD)` before
navigating away. No new components, no new abstractions, and no changes to the sessionStorage
restore path are required.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — the user confirms "Abandon
  Creation" and `handleAbort` is invoked, but the in-memory `wizard` state is not reset to
  `INITIAL_WIZARD`.
- **Property (P)**: The desired behavior when the bug condition holds — after `handleAbort`
  completes, the `wizard` state SHALL equal `INITIAL_WIZARD` so that any subsequent mount or
  re-visit starts from a clean slate.
- **Preservation**: The existing sessionStorage-restore path (used when returning from the
  stats-entry page mid-wizard) and all other wizard navigation behaviors that must remain
  unchanged by the fix.
- **`handleAbort`**: The `useCallback` in `src/pages/CreateCompanyPage.tsx` that is invoked
  when the user confirms the abandon dialog. Currently calls
  `sessionStorage.removeItem(WIZARD_DRAFT_KEY)` and `navigate('/')`.
- **`INITIAL_WIZARD`**: The constant `WizardState` object defined at module scope in
  `CreateCompanyPage.tsx` representing a blank wizard (step 0, all fields null/empty).
- **`WIZARD_DRAFT_KEY`**: The sessionStorage key `'bc_wizard_draft'` used to persist and
  restore wizard progress across navigations.
- **`setWizard`**: The React state setter for the `wizard` state variable inside
  `CreateCompanyPage`.

## Bug Details

### Bug Condition

The bug manifests when a user confirms "Abandon Creation" after making one or more selections
in the wizard. The `handleAbort` callback clears sessionStorage but does not call
`setWizard(INITIAL_WIZARD)`, so the React state retains all prior selections. Because React
Router keeps `CreateCompanyPage` mounted across navigations, the `useState` lazy initializer
never re-runs, and the stale state is visible on the next visit.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input — a WizardState at the moment handleAbort is called
  OUTPUT: boolean

  RETURN input.step > 0
         OR input.alignment IS NOT NULL
         OR input.factionId IS NOT NULL
         OR input.companyTypeId IS NOT NULL
         OR input.companyName IS NOT EMPTY
         OR input.memberNames IS NOT EMPTY
         OR input.leaderId IS NOT NULL
         OR input.sergeantIds IS NOT EMPTY
         OR input.heroPaths IS NOT EMPTY
         OR input.heroSpellChoices IS NOT EMPTY
         OR input.goldPurchases IS NOT EMPTY
END FUNCTION
```

In other words: the bug condition holds whenever the wizard state differs from `INITIAL_WIZARD`
at the time the user confirms abandonment.

### Examples

- **Step 1 abandoned**: User selects "Good" alignment, then clicks "Abandon Creation" and
  confirms. Expected: next visit shows step 0 with no alignment selected. Actual (unfixed):
  next visit shows step 0 with "Good" still highlighted.
- **Step 3 abandoned**: User selects alignment, faction, company, and types a company name,
  then abandons. Expected: next visit shows a blank step 0. Actual (unfixed): next visit
  shows step 0 but all prior selections are still in state; advancing steps reveals them.
- **Step 6 abandoned**: User completes steps 0–5, assigns paths, then abandons. Expected:
  next visit shows a blank step 0. Actual (unfixed): next visit shows step 0 but hero paths
  and all other selections persist.
- **Abandon at step 0 with no selections**: `isBugCondition` returns false (state already
  equals `INITIAL_WIZARD`); the fix has no observable effect in this case.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When a user navigates away to the stats-entry page mid-wizard and returns via
  `?from=stats`, the system SHALL continue to restore the wizard draft from sessionStorage
  and resume at step 6.
- When a user completes the wizard and forms a company, the system SHALL continue to clear
  the sessionStorage draft and navigate to the new company's detail page.
- When a user clicks "Cancel" or dismisses the abandon dialog without confirming, the system
  SHALL continue to keep the current wizard state unchanged.
- When a user is mid-wizard and the page is refreshed, the system SHALL continue to restore
  the wizard draft from sessionStorage so progress is not lost on accidental refresh.

**Scope:**
All inputs that do NOT involve confirming the abandon dialog should be completely unaffected
by this fix. This includes:
- Mouse clicks on step navigation buttons (Next, Back)
- Selecting alignment, faction, company, names, paths, and gold purchases
- The stats-entry redirect and return flow (`?from=stats`)
- Completing the wizard with "Form Company"

## Hypothesized Root Cause

Based on the bug description and code review, the root cause is straightforward:

1. **Missing `setWizard(INITIAL_WIZARD)` call**: `handleAbort` only removes the sessionStorage
   entry and navigates away. It never resets the React state. This is the direct cause.

2. **React Router component persistence**: React Router v6 does not unmount route components
   on navigation by default. The `useState` lazy initializer therefore only runs once — on
   the very first mount — and never again for the lifetime of the router. Any state set
   before navigation persists across visits.

3. **sessionStorage removal is insufficient**: Removing the draft key prevents restoration
   on a hard refresh, but has no effect on the already-live in-memory state for the current
   session.

4. **No reset on route entry**: There is no `useEffect` that resets state when the wizard
   route is entered fresh (only when `?from=stats` is present), so there is no secondary
   mechanism to catch the stale state.

## Correctness Properties

Property 1: Bug Condition - Wizard State Reset on Abandon

_For any_ `WizardState` where `isBugCondition` returns true (i.e., the wizard has at least
one non-default selection at the time the user confirms abandonment), the fixed `handleAbort`
function SHALL reset the in-memory wizard state to `INITIAL_WIZARD` before navigating to
`'/'`, so that a subsequent visit to the creation wizard presents a clean step-0 form with
no pre-filled selections.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Abort Navigation Behavior

_For any_ wizard interaction that does NOT involve confirming the abandon dialog (step
navigation, field edits, stats-entry redirect/return, successful company formation, page
refresh), the fixed code SHALL produce exactly the same behavior as the original code,
preserving all existing sessionStorage draft persistence, restoration, and navigation flows.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `src/pages/CreateCompanyPage.tsx`

**Function**: `handleAbort`

**Current implementation:**
```typescript
const handleAbort = useCallback(() => {
  sessionStorage.removeItem(WIZARD_DRAFT_KEY)
  navigate('/')
}, [navigate])
```

**Fixed implementation:**
```typescript
const handleAbort = useCallback(() => {
  sessionStorage.removeItem(WIZARD_DRAFT_KEY)
  setWizard(INITIAL_WIZARD)
  navigate('/')
}, [navigate])
```

**Specific Changes:**
1. **Add `setWizard(INITIAL_WIZARD)` call**: Insert the reset call between the sessionStorage
   removal and the `navigate('/')` call. This synchronously resets all wizard fields to their
   defaults before the navigation occurs.
2. **Add `setWizard` to the `useCallback` dependency array**: `setWizard` is a stable
   reference from `useState` so React will not require it in the deps array, but it should
   be noted that no additional dependencies are introduced.
3. **No other files need to change**: `INITIAL_WIZARD` is already defined at module scope in
   the same file; no imports or new abstractions are needed.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that
demonstrate the bug on unfixed code, then verify the fix works correctly and preserves
existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix.
Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Render `CreateCompanyPage` in a test environment, advance the wizard to a
non-zero state, invoke `handleAbort`, then inspect the wizard state (or re-render the
component) to confirm that stale selections are still present on unfixed code.

**Test Cases**:
1. **Single-field abandon test**: Set `alignment = 'Good'`, call `handleAbort`, re-render —
   expect `alignment` to still be `'Good'` on unfixed code (will fail after fix).
2. **Multi-step abandon test**: Advance to step 3 with alignment, faction, company, and name
   set, call `handleAbort`, re-render — expect all fields still populated on unfixed code.
3. **Full wizard abandon test**: Complete steps 0–6 including hero paths, call `handleAbort`,
   re-render — expect `heroPaths` and `sergeantIds` still populated on unfixed code.
4. **Step-0 no-op test**: Call `handleAbort` with state already equal to `INITIAL_WIZARD` —
   behavior should be identical before and after the fix (edge case).

**Expected Counterexamples**:
- After `handleAbort` is called on unfixed code, the wizard state retains non-default values.
- Possible causes: `setWizard(INITIAL_WIZARD)` is never called; React Router does not
  unmount the component; the `useState` lazy initializer does not re-run.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function
produces the expected behavior.

**Pseudocode:**
```
FOR ALL wizardState WHERE isBugCondition(wizardState) DO
  mountComponent(initialState = wizardState)
  invoke handleAbort()
  ASSERT currentWizardState = INITIAL_WIZARD
  ASSERT sessionStorage.getItem(WIZARD_DRAFT_KEY) = null
  ASSERT navigate WAS CALLED WITH '/'
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed
function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL interaction WHERE NOT isBugCondition(interaction) DO
  ASSERT fixedComponent(interaction) = originalComponent(interaction)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking
because:
- It generates many wizard state combinations automatically across the input domain.
- It catches edge cases that manual unit tests might miss (e.g., unusual combinations of
  paths and spell choices).
- It provides strong guarantees that the stats-entry restore path and other flows are
  unchanged for all non-abort interactions.

**Test Plan**: Observe behavior on UNFIXED code first for non-abort interactions (step
navigation, sessionStorage restore, company formation), then write property-based tests
capturing that behavior.

**Test Cases**:
1. **Stats-entry restore preservation**: Verify that navigating back with `?from=stats`
   still restores the draft and advances to step 6 after the fix.
2. **SessionStorage draft persistence preservation**: Verify that every `setWizard` call
   (other than the abort reset) still writes to sessionStorage as before.
3. **Successful formation preservation**: Verify that completing the wizard still clears
   sessionStorage and navigates to the company detail page.
4. **Cancel/dismiss preservation**: Verify that dismissing the abandon dialog without
   confirming leaves the wizard state unchanged.

### Unit Tests

- Test that `handleAbort` resets wizard state to `INITIAL_WIZARD` after the fix.
- Test that `handleAbort` removes the sessionStorage draft key.
- Test that `handleAbort` calls `navigate('/')`.
- Test edge case: `handleAbort` called when state is already `INITIAL_WIZARD` — no
  observable difference before or after fix.

### Property-Based Tests

- Generate random `WizardState` objects where `isBugCondition` returns true; verify that
  after `handleAbort` the state equals `INITIAL_WIZARD` (fix checking).
- Generate random non-abort wizard interactions; verify that the wizard state after each
  interaction matches the original behavior (preservation checking).
- Generate random sequences of step advances followed by an abort; verify the final state
  is always `INITIAL_WIZARD` regardless of how far the user progressed.

### Integration Tests

- Full flow: advance wizard to step 3, confirm abandon, navigate back to `/create` — verify
  the wizard renders at step 0 with no pre-filled fields.
- Stats-entry round-trip: advance to step 4, redirect to stats, return with `?from=stats` —
  verify the wizard resumes at step 6 with the draft intact (regression check).
- Successful formation: complete all steps and form a company — verify sessionStorage is
  cleared and the user lands on the company detail page (regression check).
