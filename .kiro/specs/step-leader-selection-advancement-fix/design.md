# Step Leader Selection Advancement Fix - Bugfix Design

## Overview

The Next button in StepLeaderSelection (step 5 of the company creation wizard) remains disabled even after a user selects a leader and 2 sergeants, preventing progression to the path selection step. This bug emerged after Task 40's implementation, which wrapped `canAdvance()` in `useCallback` to fix a stale closure issue. While the logic in `canAdvance()` is correct (`leaderId !== null && sergeantIds.length === 2`), the Next button's disabled state does not update reactively when heroes are selected or deselected.

The root cause is that the callback functions passed to StepLeaderSelection (`onSelectLeader` and `onToggleSergeant`) are not wrapped in `useCallback`, causing them to be recreated on every render. Additionally, `handleFinish` is also not memoized, causing the Enter key `useEffect` to re-subscribe unnecessarily. While these unstable callbacks don't prevent state updates from occurring, they may interfere with React's rendering optimization or cause subtle timing issues that prevent the Next button from re-evaluating its disabled state.

The fix will stabilize these callbacks using `useCallback` to ensure predictable re-rendering behavior and eliminate any potential race conditions or stale closure issues.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a user selects a leader and 2 sergeants in StepLeaderSelection, but the Next button remains disabled
- **Property (P)**: The desired behavior - the Next button should become enabled immediately when `leaderId !== null && sergeantIds.length === 2`
- **Preservation**: All other wizard step advancement logic and keyboard shortcuts must continue to work unchanged
- **canAdvance()**: The function in `CreateCompanyPage.tsx` that determines whether the Next button should be enabled for the current wizard step
- **wizard.leaderId**: The state property that stores the selected leader's temporary ID (e.g., "member_0")
- **wizard.sergeantIds**: The state array that stores the selected sergeants' temporary IDs (e.g., ["member_1", "member_2"])
- **toggleSergeant**: The callback function passed to StepLeaderSelection that adds or removes a sergeant from the selection
- **onSelectLeader**: The callback function passed to StepLeaderSelection that sets or clears the leader selection
- **handleFinish**: The function that handles the final "Form Company" action
- **Unstable callback**: A function that is recreated on every render because it's not wrapped in `useCallback`, causing its reference identity to change

## Bug Details

### Bug Condition

The bug manifests when a user is on step 5 (StepLeaderSelection) and selects a leader and 2 sergeants. Despite the wizard state being updated correctly (`wizard.leaderId` is set and `wizard.sergeantIds.length === 2`), the Next button remains disabled. The `canAdvance()` function logic is correct and would return `true` for this state, but the button's disabled prop does not update reactively.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { step: number, leaderId: string | null, sergeantIds: string[], userAction: 'selectLeader' | 'toggleSergeant' }
  OUTPUT: boolean
  
  RETURN input.step === 5
         AND input.leaderId !== null
         AND input.sergeantIds.length === 2
         AND userAction IN ['selectLeader', 'toggleSergeant']
         AND nextButtonIsDisabled()
END FUNCTION
```

### Examples

- **Example 1**: User selects "Aragorn" as leader (leaderId = "member_0"), then selects "Legolas" as sergeant (sergeantIds = ["member_1"]), then selects "Gimli" as sergeant (sergeantIds = ["member_1", "member_2"]). Expected: Next button enables. Actual: Next button remains disabled.

- **Example 2**: User selects leader and 2 sergeants, then deselects one sergeant (sergeantIds.length = 1). Expected: Next button disables. Then user reselects a sergeant (sergeantIds.length = 2). Expected: Next button enables. Actual: Next button remains disabled.

- **Example 3**: User selects leader and 1 sergeant, then clicks a third member to add as second sergeant. Expected: Next button enables immediately. Actual: Next button remains disabled.

- **Edge case**: Helm's Deep company with `allRolesForced = true` skips step 5 entirely. Expected: This continues to work correctly (no regression).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Helm's Deep company (and any other company with `allRolesForced = true`) must continue to skip step 5 and advance directly from step 4 to step 6
- The Next button must remain disabled when `leaderId` is null (no leader selected)
- The Next button must remain disabled when `leaderId` is set but `sergeantIds.length < 2` (fewer than 2 sergeants)
- The Enter key shortcut must continue to work for advancing steps when `canAdvance()` returns true
- All other wizard steps (0-4, 6-7) must continue to evaluate `canAdvance()` correctly
- The "Back" button must continue to work correctly
- The wizard state persistence to sessionStorage must continue to work

**Scope:**
All inputs that do NOT involve step 5 hero selection should be completely unaffected by this fix. This includes:
- Mouse clicks on the Next button for other steps
- Keyboard Enter key for other steps
- All wizard state updates for other steps (alignment, faction, company, name, member names, paths, gold)

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Unstable Callback References**: The `toggleSergeant` function and the inline `onSelectLeader` arrow function are not wrapped in `useCallback`, causing them to be recreated on every render. This means StepLeaderSelection receives new function references on every render, which could interfere with React's rendering optimization or cause subtle timing issues.

2. **Unstable handleFinish Reference**: The `handleFinish` function is not wrapped in `useCallback`, causing the Enter key `useEffect` to re-subscribe on every render. While this doesn't directly affect the Next button, it indicates a pattern of unstable function references that could contribute to rendering issues.

3. **React Batching or Timing Issue**: When `setWizard` is called from within StepLeaderSelection's callbacks, React may batch the state update with other updates, causing a delay in re-rendering. If the callbacks are unstable, this could exacerbate timing issues.

4. **Stale Closure in Inline Arrow Function**: The `onSelectLeader` prop is defined as an inline arrow function in the JSX: `onSelectLeader={(tempId) => setWizard((w) => ...)}`. While this should work correctly because it uses a functional state update, the inline definition means a new function is created on every render, which could cause issues if there's any memoization or optimization in the rendering path.

## Correctness Properties

Property 1: Bug Condition - Next Button Enables After Hero Selection

_For any_ wizard state where step is 5, leaderId is non-null, and sergeantIds has exactly 2 entries, the Next button SHALL be enabled (disabled prop is false), allowing the user to advance to step 6.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Other Steps Unchanged

_For any_ wizard state where step is NOT 5, or where step is 5 but the hero selection criteria are not met (leaderId is null OR sergeantIds.length !== 2), the Next button's enabled/disabled state SHALL be determined by the same logic as before the fix, preserving all existing advancement behavior for other steps.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the fix involves stabilizing all callback functions using `useCallback`:

**File**: `src/pages/CreateCompanyPage.tsx`

**Function**: Multiple callback functions in the component body

**Specific Changes**:

1. **Wrap `toggleSergeant` in `useCallback`**: 
   - Current: `const toggleSergeant = (tempId: string) => { ... }`
   - Fixed: `const toggleSergeant = useCallback((tempId: string) => { ... }, [])` (no dependencies needed since it uses functional state update)
   - This ensures the function reference is stable across renders

2. **Wrap `handleFinish` in `useCallback`**:
   - Current: `const handleFinish = () => { ... }`
   - Fixed: `const handleFinish = useCallback(() => { ... }, [selectedCompany, wizard.step])` (depends on selectedCompany and wizard.step)
   - This prevents the Enter key `useEffect` from re-subscribing on every render

3. **Extract and memoize `onSelectLeader` callback**:
   - Current: Inline arrow function in JSX: `onSelectLeader={(tempId) => setWizard((w) => ({ ... }))}`
   - Fixed: Define as a separate `useCallback` before the JSX:
     ```typescript
     const handleSelectLeader = useCallback((tempId: string) => {
       setWizard((w) => ({
         ...w,
         leaderId: w.leaderId === tempId ? null : tempId,
         sergeantIds: w.sergeantIds.filter((id) => id !== tempId),
       }))
     }, [])
     ```
   - Then use in JSX: `onSelectLeader={handleSelectLeader}`
   - This ensures the callback reference is stable

4. **Verify `canAdvance` dependencies**: 
   - Already correctly wrapped in `useCallback` with `[wizard, selectedCompany]` dependencies
   - No changes needed

5. **Verify Next button rendering**:
   - Already correctly calls `canAdvance()` inline: `disabled={!canAdvance()}`
   - No changes needed

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write integration tests that simulate user interactions in StepLeaderSelection and assert that the Next button's disabled state updates correctly. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Select Leader and 2 Sergeants Test**: Simulate clicking to select a leader, then clicking to select 2 sergeants. Assert that after the second sergeant is selected, the Next button is enabled. (will fail on unfixed code)

2. **Deselect and Reselect Sergeant Test**: Simulate selecting leader and 2 sergeants, then deselecting one sergeant, then reselecting a sergeant. Assert that the Next button disables after deselection and re-enables after reselection. (will fail on unfixed code)

3. **Select in Different Order Test**: Simulate selecting sergeants first, then selecting a leader. Assert that the Next button enables when all criteria are met regardless of selection order. (will fail on unfixed code)

4. **Helm's Deep Skip Test**: Simulate selecting Helm's Deep company (allRolesForced = true) and verify that step 5 is skipped entirely. (should pass on unfixed code - this is preservation)

**Expected Counterexamples**:
- Next button remains disabled even when `leaderId !== null && sergeantIds.length === 2`
- Possible causes: unstable callback references, React batching issues, stale closure in inline arrow function

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := nextButtonDisabledState_fixed(input)
  ASSERT result === false  // Next button should be enabled
END FOR
```

**Test Plan**: After implementing the fix (wrapping callbacks in `useCallback`), run the same integration tests and verify that the Next button enables correctly when hero selection criteria are met.

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT nextButtonDisabledState_original(input) = nextButtonDisabledState_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for other wizard steps and edge cases, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Other Steps Advancement Preservation**: Verify that steps 0-4 and 6-7 continue to evaluate `canAdvance()` correctly and the Next button enables/disables as expected
2. **Incomplete Selection Preservation**: Verify that when `leaderId` is null or `sergeantIds.length < 2`, the Next button remains disabled
3. **Helm's Deep Skip Preservation**: Verify that companies with `allRolesForced = true` continue to skip step 5
4. **Enter Key Shortcut Preservation**: Verify that the Enter key continues to advance steps when `canAdvance()` returns true
5. **Back Button Preservation**: Verify that the Back button continues to work correctly for all steps

### Unit Tests

- Test that `toggleSergeant` callback is stable across renders (same reference)
- Test that `handleSelectLeader` callback is stable across renders (same reference)
- Test that `handleFinish` callback is stable across renders (same reference)
- Test that `canAdvance()` returns correct values for step 5 with various `leaderId` and `sergeantIds` combinations (already covered by existing property test)

### Property-Based Tests

- Generate random wizard states with step 5 and various `leaderId`/`sergeantIds` combinations, verify Next button disabled state matches `canAdvance()` result
- Generate random wizard states for other steps (0-4, 6-7), verify Next button disabled state is unchanged from original behavior
- Generate random sequences of hero selections/deselections, verify Next button updates correctly after each action

### Integration Tests

- Test full wizard flow from step 0 to step 8 with hero selection at step 5
- Test that selecting leader and 2 sergeants enables Next button and allows advancement to step 6
- Test that deselecting a hero disables Next button and prevents advancement
- Test that Helm's Deep company skips step 5 correctly
- Test that Enter key shortcut works correctly at step 5 when heroes are selected
