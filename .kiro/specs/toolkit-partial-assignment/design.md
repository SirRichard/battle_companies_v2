# Toolkit Partial Assignment Bugfix Design

## Overview

The "Begin Battle" button on `ToolkitAssignmentPage` is unconditionally disabled whenever any kit item is unassigned. This prevents users from proceeding even when partial assignment is intentional or acceptable. The fix enables the button as soon as a kit is selected, and inserts a confirmation dialog when the user tries to proceed with unassigned items, warning them that those items will be lost. If all items are assigned the flow is unchanged — no dialog is shown.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a kit is selected, at least one item is unassigned, and the user attempts to click "Begin Battle".
- **Property (P)**: The desired behavior when the bug condition holds — the button is enabled and a confirmation dialog is shown before navigating away.
- **Preservation**: Existing behavior that must remain unchanged — the all-assigned fast path, the parameter dialog for Envenom Weapon, and the no-kit-selected state.
- **`allAssigned`**: The boolean derived in `ToolkitAssignmentPage` that is `true` only when every item in the selected kit has a non-empty `memberId`.
- **`handleProceed`**: The async function in `ToolkitAssignmentPage` that saves toolkit items to the active match and navigates to the next page.
- **`ConfirmDialog`**: The shared MUI-based confirmation dialog component at `src/components/common/ConfirmDialog.tsx`.
- **`toolkitItems`**: The array of `{ memberId, itemId, parameter? }` objects saved to the active match; only assigned items (non-empty `memberId`) are included.

## Bug Details

### Bug Condition

The bug manifests when a kit is selected and at least one item has no assigned member. The `allAssigned` flag is `false`, which is used both to disable the "Begin Battle" button and to gate `handleProceed`. There is no alternative path for the user to proceed with partial assignments.

**Formal Specification:**
```
FUNCTION isBugCondition(state)
  INPUT: state of type { kitId: string | null, assignments: Array<{ memberId: string }> }
  OUTPUT: boolean

  IF state.kitId IS NULL THEN RETURN false
  kit := TOOLKIT_KITS.find(k => k.id === state.kitId)
  IF kit IS NULL THEN RETURN false

  hasUnassigned := state.assignments.some(a => a.memberId === '')
  RETURN hasUnassigned
END FUNCTION
```

### Examples

- **Kit selected, 2 of 3 items assigned**: "Begin Battle" is disabled. User cannot proceed. Expected: button enabled; clicking shows confirmation dialog.
- **Kit selected, 0 of 3 items assigned**: "Begin Battle" is disabled. User cannot proceed. Expected: button enabled; clicking shows confirmation dialog.
- **Kit selected, all 3 items assigned**: "Begin Battle" is enabled and proceeds directly. This is correct behavior and must be preserved.
- **No kit selected**: "Begin Battle" is not shown. This is correct behavior and must be preserved.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When all kit items are assigned, "Begin Battle" must remain enabled and navigate directly without showing a confirmation dialog.
- The Envenom Weapon parameter dialog must continue to appear when assigning that item to a member.
- When no kit is selected, the item assignment section and "Begin Battle" button must remain hidden.
- Mouse/touch interactions with all other controls (kit selection, member dropdowns, back navigation) must be unaffected.

**Scope:**
All states that do NOT involve a kit being selected with at least one unassigned item should be completely unaffected by this fix. This includes:
- The fully-assigned state (all items have a `memberId`)
- The no-kit-selected state
- The parameter dialog flow for Envenom Weapon
- Navigation away via the back button

## Hypothesized Root Cause

Based on the bug description and the source code in `ToolkitAssignmentPage.tsx`:

1. **Overly strict `allAssigned` gate on the button**: The `disabled={!allAssigned}` prop on the "Begin Battle" button prevents any interaction when items are unassigned. The fix must relax this to `disabled={!kitId}` (button is only disabled when no kit is selected at all).

2. **`handleProceed` guards on `allAssigned`**: The early return `if (!kit || !allAssigned) return` inside `handleProceed` must be split — the `!kit` guard stays, but `!allAssigned` must be replaced with a confirmation dialog branch.

3. **No confirmation dialog state exists**: There is currently no state variable or UI element for a partial-assignment confirmation dialog. New state (`confirmPartialOpen`) and a `ConfirmDialog` render must be added.

4. **`toolkitItems` includes all slots including unassigned ones**: The mapping `assignments.map(...)` will produce entries with empty `memberId` for unassigned slots. The fix must filter these out so only assigned items are saved to the match.

## Correctness Properties

Property 1: Bug Condition - Partial Assignment Enables Proceed with Confirmation

_For any_ state where a kit is selected and at least one item is unassigned (isBugCondition returns true), the fixed `ToolkitAssignmentPage` SHALL enable the "Begin Battle" button and, when clicked, SHALL display a confirmation dialog warning the user that unassigned items will be lost before navigating away.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Full Assignment Fast Path Unchanged

_For any_ state where a kit is selected and all items are assigned (isBugCondition returns false), the fixed `ToolkitAssignmentPage` SHALL enable the "Begin Battle" button and proceed directly to the next page without showing a confirmation dialog, preserving the existing all-assigned behavior.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `src/pages/ToolkitAssignmentPage.tsx`

**Specific Changes**:

1. **Add confirmation dialog state**: Introduce a `confirmPartialOpen` boolean state variable (default `false`) to control the visibility of the partial-assignment confirmation dialog.

2. **Relax the button's `disabled` condition**: Change `disabled={!allAssigned}` to `disabled={!kit}` so the button is enabled whenever a kit is selected, regardless of assignment completeness.

3. **Update the helper text**: Replace the static "Assign all items to proceed." caption with conditional text — show it only when a kit is selected but no items are assigned yet (i.e. the user hasn't started assigning), or remove it entirely in favour of the dialog warning.

4. **Split `handleProceed` into two paths**:
   - If `!allAssigned`: set `confirmPartialOpen = true` and return (do not navigate yet).
   - If `allAssigned`: proceed as before (save all items and navigate).

5. **Add a `handleConfirmPartial` function**: When the user confirms the dialog, filter `assignments` to only those with a non-empty `memberId`, build `toolkitItems` from the filtered set, save to the active match, and navigate.

6. **Filter unassigned items when saving**: In both `handleProceed` (all-assigned path) and `handleConfirmPartial`, ensure `toolkitItems` is built from `assignments.filter(a => a.memberId !== '')` to avoid saving empty-memberId entries.

7. **Render `ConfirmDialog`**: Add a `<ConfirmDialog>` instance (already available at `src/components/common/ConfirmDialog.tsx`) with:
   - `open={confirmPartialOpen}`
   - `title="Unassigned Items"`
   - `message` explaining that not all items have been assigned and unassigned items will be lost.
   - `confirmLabel="Proceed Anyway"`
   - `onConfirm={handleConfirmPartial}`
   - `onCancel={() => setConfirmPartialOpen(false)}`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render `ToolkitAssignmentPage` with a kit selected and at least one item unassigned, then assert that the "Begin Battle" button is enabled. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **Button disabled with partial assignment** (will fail on unfixed code): Select a kit, assign only some items, assert "Begin Battle" is enabled.
2. **Confirmation dialog shown on proceed** (will fail on unfixed code): Select a kit, leave items unassigned, click "Begin Battle", assert a confirmation dialog appears.
3. **Confirm navigates with partial items** (will fail on unfixed code): Confirm the dialog, assert navigation occurs and only assigned items are saved.
4. **Cancel returns to page** (will fail on unfixed code): Cancel the dialog, assert no navigation occurs and the page state is unchanged.

**Expected Counterexamples**:
- "Begin Battle" button is found to be disabled when items are unassigned.
- Possible causes: `disabled={!allAssigned}` prop on the button, `handleProceed` early-return on `!allAssigned`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL state WHERE isBugCondition(state) DO
  result := render ToolkitAssignmentPage_fixed(state)
  ASSERT "Begin Battle" button is enabled
  ASSERT clicking "Begin Battle" opens confirmation dialog
  ASSERT confirming dialog saves only assigned items and navigates
  ASSERT cancelling dialog closes dialog without navigating
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL state WHERE NOT isBugCondition(state) DO
  ASSERT ToolkitAssignmentPage_original(state) = ToolkitAssignmentPage_fixed(state)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (varying kits, member counts, assignment combinations).
- It catches edge cases that manual unit tests might miss (e.g. all items assigned to the same member, kits with duplicate items).
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on UNFIXED code first for the all-assigned and no-kit states, then write property-based tests capturing that behavior.

**Test Cases**:
1. **All-assigned fast path preservation**: Verify that when all items are assigned, clicking "Begin Battle" navigates directly without a dialog — same as before the fix.
2. **No-kit-selected preservation**: Verify that when no kit is selected, the assignment section and "Begin Battle" button are not rendered.
3. **Parameter dialog preservation**: Verify that assigning an Envenom Weapon item still opens the weapon-selection parameter dialog.
4. **Saved items correctness**: Verify that when all items are assigned, the full set of `toolkitItems` is saved (no items dropped by the filter).

### Unit Tests

- Test that "Begin Battle" is enabled when a kit is selected with partial assignments.
- Test that "Begin Battle" is enabled when a kit is selected with all assignments.
- Test that "Begin Battle" is disabled when no kit is selected.
- Test that clicking "Begin Battle" with partial assignments opens the confirmation dialog.
- Test that confirming the dialog saves only assigned items and navigates.
- Test that cancelling the dialog closes it without navigating.
- Test that clicking "Begin Battle" with all assignments navigates directly (no dialog).

### Property-Based Tests

- Generate random kit selections and partial assignment states; verify the button is always enabled when a kit is selected.
- Generate random fully-assigned states; verify no confirmation dialog is shown and navigation occurs directly.
- Generate random assignment combinations; verify that only items with a non-empty `memberId` appear in the saved `toolkitItems`.

### Integration Tests

- Full flow: select kit → partially assign → click "Begin Battle" → confirm dialog → verify match saved with only assigned items → verify navigation to next page.
- Full flow: select kit → fully assign → click "Begin Battle" → verify no dialog → verify match saved with all items → verify navigation.
- Cancel flow: select kit → partially assign → click "Begin Battle" → cancel dialog → verify still on assignment page with state intact.
