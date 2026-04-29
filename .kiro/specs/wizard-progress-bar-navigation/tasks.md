# Implementation Plan: Wizard Progress Bar Navigation

## Overview

Add backward navigation to the company creation wizard's progress bar by tracking visited steps in `WizardState`, rendering completed+visited step labels as `StepButton` elements, and wiring a `handleProgressBarClick` handler that applies the correct downstream state resets before navigating.

## Tasks

- [x] 1. Extend `WizardState` with `visitedSteps` and update `INITIAL_WIZARD`
  - Add `visitedSteps: number[]` field to the `WizardState` interface in `src/models/index.ts`
  - Update `INITIAL_WIZARD` in `CreateCompanyPage.tsx` to include `visitedSteps: [0]`
  - Add a fallback in the `useState` initialiser that coerces `visitedSteps: undefined` (stale sessionStorage drafts) to `[0]`
  - _Requirements: 5.3_

- [x] 2. Update `go()` to record visited steps
  - [x] 2.1 Modify `go()` in `CreateCompanyPage.tsx` to push `nextStep` into `visitedSteps` (deduplicated) on every call
    - Deduplication: only append if `!next.visitedSteps.includes(nextStep)`
    - Keep the existing forced-role logic for step 5 intact
    - _Requirements: 5.3_

  - [x] 2.2 Write property test for `visitedSteps` never containing skipped steps (Property 3)
    - **Property 3: visitedSteps never contains skipped steps**
    - Simulate a wizard flow where `allRolesForced = true` (step 4 → step 6 via `setWizard` directly, bypassing `go()`) and assert `5 ∉ visitedSteps`
    - Simulate a flow where `selectedCompany.gold === 0` (step 6 → finish, bypassing `go()`) and assert `7 ∉ visitedSteps`
    - **Validates: Requirements 5.1, 5.2**

  - [x] 2.3 Write property test for `visitedSteps` deduplication (Property 6)
    - **Property 6: visitedSteps is a subset of go()-called steps with no duplicates**
    - Generate arbitrary sequences of `go(n)` calls and assert `visitedSteps ⊆ { n | go(n) was called }` and no duplicates
    - **Validates: Requirements 5.3**

- [x] 3. Implement `handleProgressBarClick` handler
  - [x] 3.1 Add `handleProgressBarClick(targetStep: number)` to `CreateCompanyPage.tsx`
    - Guard 1: return early if `targetStep >= wizard.step`
    - Guard 2: return early if `!wizard.visitedSteps.includes(targetStep)`
    - Apply downstream resets via `setWizard` before calling `go(targetStep)`:
      - `targetStep <= 0`: reset `factionId`, `companyTypeId`, `variantId`, `memberNames`, `leaderId`, `sergeantIds`, `heroPaths`, `heroSpellChoices`
      - `targetStep <= 1`: reset `companyTypeId`, `variantId`, `memberNames`, `leaderId`, `sergeantIds`, `heroPaths`, `heroSpellChoices`
      - `targetStep <= 2`: reset `variantId`, `memberNames`, `leaderId`, `sergeantIds`, `heroPaths`, `heroSpellChoices`
      - Steps 3–6: no resets needed
    - Wrap in `useCallback` with deps `[wizard.step, wizard.visitedSteps, forcedLeaderId, forcedSergeantIds]`
    - _Requirements: 1.1, 1.2, 2.2_

  - [x] 3.2 Write property test for backward-only navigation (Property 1)
    - **Property 1: Backward-only navigation**
    - For arbitrary `WizardState` and `targetStep`, assert `handleProgressBarClick` only changes `wizard.step` when `targetStep < wizard.step AND targetStep ∈ wizard.visitedSteps`; otherwise `wizard.step` is unchanged
    - **Validates: Requirements 1.1, 1.4, 1.5**

  - [x] 3.3 Write property test for direction always being backward (Property 2)
    - **Property 2: Direction is always backward**
    - For any valid click (`targetStep < wizard.step AND targetStep ∈ wizard.visitedSteps`), assert `direction === -1` after `handleProgressBarClick`
    - **Validates: Requirements 1.2**

  - [x] 3.4 Write property test for state preservation on backward navigation (Property 4)
    - **Property 4: State preservation on backward navigation**
    - For arbitrary wizard state at step S and valid `targetStep t < S`, assert that fields belonging to steps > t that are NOT downstream of t are unchanged, and fields downstream of t are reset to null/empty per the reset rules
    - **Validates: Requirements 2.1, 2.2**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update the Stepper rendering to use `StepButton` for clickable steps
  - [x] 5.1 Add `StepButton` to the MUI import in `CreateCompanyPage.tsx`
    - _Requirements: 1.3, 3.1_

  - [x] 5.2 Replace the existing `Stepper` block in the JSX return with the new conditional rendering logic
    - For each step, compute `isCompleted`, `isVisited`, and `isClickable = isCompleted && isVisited`
    - `isCompleted` for the "Command" step: `allRolesForced && wizard.step > 5`; for all others: `index < wizard.step`
    - Render `StepButton` (with `onClick`, `aria-label="Go back to {label} step"`, hover underline, and focus-visible outline styles) when `isClickable`
    - Render `StepLabel` (with `cursor: 'default'`, `pointerEvents: 'none'`, and `aria-disabled`) when not clickable
    - _Requirements: 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2_

- [x] 6. Verify round-trip navigation behaviour
  - [x] 6.1 Write property test for round-trip navigation (Property 5)
    - **Property 5: Round-trip navigation**
    - For wizard state at step S and valid `targetStep t` where `t > 2` (no downstream resets), navigate back to t via `handleProgressBarClick`, then advance forward to S without changes, and assert `wizard.step === S` with all selections at steps t+1..S intact
    - **Validates: Requirements 2.3**

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- The `visitedSteps` array has at most 8 entries; no memoisation is needed for the array operations themselves
- `handleProgressBarClick` must be wrapped in `useCallback` to avoid unnecessary Stepper re-renders
- Old sessionStorage drafts without `visitedSteps` are handled gracefully by the fallback in the state initialiser (task 1)
