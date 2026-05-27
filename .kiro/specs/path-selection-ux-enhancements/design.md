# Path Selection UX Enhancements Bugfix Design

## Overview

The path selection step (Step 6) in the company creation wizard has five UX defects: the member details header wastes vertical space on wider screens and scrolls out of view, the navigation "Next" button uses incorrect labelling during path selection, the path card action button says "Choose" instead of "Select", and the path review summary derives path names from string manipulation of IDs rather than using the canonical `label` field from `paths.json`. The fix targets layout responsiveness, sticky positioning, and label corrections across `StepPathSelection.tsx`, `PathCardSelector.tsx`, and `CreateCompanyPage.tsx`.

## Glossary

- **Bug_Condition (C)**: The set of conditions under which incorrect labels are displayed or layout is suboptimal — specifically when the user is on step 6 with heroes still needing paths, when viewing path cards, or when viewing the path review summary
- **Property (P)**: Correct label text ("Select", "Select This Path", canonical path label) and responsive/sticky layout for the member details header
- **Preservation**: Existing behaviors that must remain unchanged — narrow viewport stacking, "Form Company" on final step, "Path Chosen ✓" for selected paths, "Next" on non-path steps, card animations, and "Change Path" functionality
- **StepPathSelection**: Component in `src/components/wizard/StepPathSelection.tsx` rendering the member details header and delegating to PathCardSelector
- **PathCardSelector**: Component in `src/components/common/PathCardSelector.tsx` rendering swipeable path cards with the action button
- **CreateCompanyPage**: Parent page in `src/pages/CreateCompanyPage.tsx` containing the navigation footer button and path review summary

## Bug Details

### Bug Condition

The bugs manifest across five scenarios in the path selection step: (1) the member details header renders in a purely vertical stack regardless of viewport width, (2) the header scrolls away with content, (3) the footer "Next" button shows "Next" when it should show "Select" during active path selection, (4) the path card button says "Choose This Path" instead of "Select This Path", and (5) the review summary derives path names via `replace(/_/g, ' ')` instead of looking up `label` from `paths.json`.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { step: number, allHeroesHavePaths: boolean, viewingPathCard: boolean, viewingReview: boolean, viewportWidth: number }
  OUTPUT: boolean

  RETURN (input.step === 6 AND NOT input.allHeroesHavePaths AND footerButtonLabel === "Next")
         OR (input.step === 6 AND input.viewingPathCard AND actionButtonLabel === "Choose This Path")
         OR (input.step === 6 AND input.viewingReview AND pathNameDerivedFromStringManipulation)
         OR (input.step === 6 AND input.viewportWidth >= smBreakpoint AND headerLayoutIsVerticalOnly)
         OR (input.step === 6 AND headerIsNotSticky)
END FUNCTION
```

### Examples

- User on step 6 with 2/3 heroes still needing paths → footer button shows "Next" instead of "Select"
- User views Path of the Tactician card → bottom button reads "Choose This Path" instead of "Select This Path"
- User completes all path selections → review shows "The tactician" (derived from ID) instead of "Path of the Tactician" (from `label` field)
- User on tablet (768px wide) → member details stacks vertically taking excessive space instead of flowing horizontally
- User scrolls down through path progression table → member details header disappears from view

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- On narrow viewports (below `sm` breakpoint), member details continues to stack vertically
- On the final step (Gold/step 7), footer button continues to display "Form Company"
- When a path is already selected, the card button continues to display "Path Chosen ✓"
- On steps 0–5, the footer "Next" button continues to display "Next"
- Card swipe animations and dot indicators continue to function identically
- "Change Path" button on review page continues to clear selection and return to card selector

**Scope:**
All inputs that do NOT involve step 6 path selection should be completely unaffected by this fix. This includes:
- Navigation on steps 0–5 and step 7
- Path card selection mechanics (the `onSelect` callback)
- Wizard state management (heroPaths, heroSpellChoices)
- The PathCardSelector when used from PostMatchSummaryPage (hero advancement)

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **Non-responsive header layout**: `StepPathSelection.tsx` renders the header `Box` with no responsive flex direction — it always stacks vertically. Missing `flexDirection: { xs: 'column', sm: 'row' }` or similar responsive styling.

2. **Non-sticky header**: The `headerSlot` in `PathCardSelector.tsx` is rendered as a plain `Box` without `position: 'sticky'` or `top: 0` styling, so it scrolls with content.

3. **Hardcoded "Next" label**: `CreateCompanyPage.tsx` line ~1558 unconditionally renders `"Next"` for all steps < final step. No conditional check for step 6 to show "Select" when heroes still need paths.

4. **Wrong action button text**: `PathCardSelector.tsx` line ~586 uses the literal string `'Choose This Path'` instead of `'Select This Path'`.

5. **String-derived path names**: `CreateCompanyPage.tsx` lines ~970–975 use `pathId?.replace(/_/g, ' ').replace(/\bpath of\b/i, '').trim()` instead of looking up the path's `label` field from the imported `pathsData`.

## Correctness Properties

Property 1: Bug Condition - Correct Labels and Layout on Step 6

_For any_ wizard state where step === 6 and there exists at least one hero without a selected path, the footer navigation button SHALL display "Select"; the path card action button SHALL display "Select This Path" for unselected paths; the path review summary SHALL display the canonical `label` from `paths.json`; and the member details header SHALL use a responsive horizontal layout on viewports >= sm breakpoint and remain sticky when scrolling.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Non-Path-Selection Behavior Unchanged

_For any_ wizard state where step !== 6, or where the input does not involve the path selection UI (steps 0–5, step 7, already-selected path cards, narrow viewport layout), the fixed code SHALL produce exactly the same behavior as the original code, preserving footer button labels ("Next" on steps 2–5, "Form Company" on step 7), "Path Chosen ✓" display, vertical stacking on narrow viewports, card animations, and "Change Path" functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/components/wizard/StepPathSelection.tsx`

**Changes**:
1. **Responsive layout**: Add responsive `sx` props to the header `Box` so that on `sm` and above, the name/role/unit info flows horizontally (e.g. `flexDirection: { xs: 'column', sm: 'row' }`, `alignItems`, `gap`) to reduce vertical space
2. **Sticky positioning**: Add `position: 'sticky'`, `top: 0`, `zIndex`, and `backgroundColor` to the header `Box` so it remains visible when scrolling through path cards

**File**: `src/components/common/PathCardSelector.tsx`

**Function**: Button render (~line 586)

**Changes**:
3. **Button label**: Change `'Choose This Path'` to `'Select This Path'`

**File**: `src/pages/CreateCompanyPage.tsx`

**Function**: Navigation footer button (~line 1558)

**Changes**:
4. **Footer button label**: Add conditional logic so that when `wizard.step === 6` and not all heroes have paths, the button displays `"Select"` instead of `"Next"`. When on the review page (all heroes have paths, step 6), display `"Next"`.

**Function**: Path review summary (~lines 970–975)

**Changes**:
5. **Path name resolution**: Import `pathsData` (already available) and replace the string manipulation with a lookup: `pathsData.find(p => p.id === pathId)?.label ?? pathId`. Remove the `replace(/_/g, ' ')` chain.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render the path selection components and assert on button labels, path name display, and layout styles. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Footer Button Label Test**: Render CreateCompanyPage at step 6 with incomplete hero paths → assert footer button text is "Select" (will fail on unfixed code — shows "Next")
2. **Path Card Action Button Test**: Render PathCardSelector with no selected path → assert button text is "Select This Path" (will fail on unfixed code — shows "Choose This Path")
3. **Path Review Name Test**: Render review summary with `heroPaths = { member_0: 'path_of_the_tactician' }` → assert displayed name is "Path of the Tactician" (will fail on unfixed code — shows derived string)
4. **Responsive Layout Test**: Render StepPathSelection at sm breakpoint → assert header uses horizontal flex direction (will fail on unfixed code — always vertical)

**Expected Counterexamples**:
- Footer button renders "Next" when it should render "Select"
- Action button renders "Choose This Path" instead of "Select This Path"
- Path name renders as "The tactician" instead of "Path of the Tactician"

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderPathSelectionUI_fixed(input)
  ASSERT footerButton.text === (input.allHeroesHavePaths ? "Next" : "Select")
  ASSERT actionButton.text === "Select This Path" (when path not selected)
  ASSERT pathReviewName === pathsData.find(p => p.id === input.pathId).label
  ASSERT headerLayout.isResponsive === true (when viewport >= sm)
  ASSERT headerLayout.isSticky === true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderUI_original(input) = renderUI_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many wizard states across steps 0–5 and step 7 to verify "Next" and "Form Company" labels are unchanged
- It generates path card states with `selectedPathId` set to verify "Path Chosen ✓" is unchanged
- It catches edge cases like empty path IDs or missing paths.json entries

**Test Plan**: Observe behavior on UNFIXED code first for non-step-6 navigation and selected-path cards, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Footer Label Preservation**: For any step in [2,3,4,5], verify footer button text is "Next"; for step 7, verify "Form Company"
2. **Selected Path Button Preservation**: For any path card where `selectedPathId === path.id`, verify button text is "Path Chosen ✓"
3. **Narrow Viewport Preservation**: For viewport < sm breakpoint on step 6, verify header remains in vertical stacked layout
4. **Card Animation Preservation**: Verify swipe/navigation between cards continues to animate identically

### Unit Tests

- Test that `getPathLabel(pathId)` returns the correct label from paths.json for all known path IDs
- Test footer button label logic: "Select" on step 6 with pending heroes, "Next" on step 6 review, "Next" on steps 2–5, "Form Company" on step 7
- Test PathCardSelector button text: "Select This Path" when unselected, "Path Chosen ✓" when selected

### Property-Based Tests

- Generate random wizard states across all steps and verify footer button label matches the expected value for each step
- Generate random path IDs from paths.json and verify review summary displays the canonical label
- Generate random viewport widths and verify header layout switches between vertical (< sm) and horizontal (>= sm)

### Integration Tests

- Full wizard flow: select paths for all 3 heroes, verify review page shows correct path labels from paths.json
- Verify "Select" button advances to next hero after path selection, then shows "Next" on review page
- Verify sticky header remains visible while scrolling through path progression content
