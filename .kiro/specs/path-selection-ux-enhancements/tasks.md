# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Incorrect Labels and Non-Responsive/Non-Sticky Header on Step 6
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the five UX bugs exist
  - **Scoped PBT Approach**: Scope the property to concrete failing cases on step 6:
    - Generate wizard states at step 6 with 1–3 heroes still needing paths
    - Assert footer button text === "Select" (bug: shows "Next")
    - Assert path card action button text === "Select This Path" for unselected paths (bug: shows "Choose This Path")
    - Generate path IDs from paths.json, assert review summary displays `pathsData.find(p => p.id === pathId).label` (bug: uses string manipulation from ID)
    - Assert header Box has responsive flexDirection (`column` on xs, `row` on sm+) (bug: always column)
    - Assert header Box has `position: 'sticky'` (bug: not sticky)
  - Test file: `src/pages/__tests__/pathSelectionUx.bugCondition.property.test.ts`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bugs exist)
  - Document counterexamples found (e.g., footer shows "Next" instead of "Select", button shows "Choose This Path")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Path-Selection Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Observe: footer button on steps 2–5 shows "Next"
    - Observe: footer button on step 7 shows "Form Company"
    - Observe: path card button when `selectedPathId === path.id` shows "Path Chosen ✓"
    - Observe: header on narrow viewport (below sm) uses vertical stacked layout
    - Observe: "Change Path" button clears hero path selection
    - Observe: steps 0–1 have no Next button rendered (auto-advance on selection)
  - Write property-based tests capturing observed behavior patterns:
    - For all steps in [2,3,4,5], footer button text === "Next"
    - For step 7, footer button text === "Form Company"
    - For any path card where selectedPathId matches path.id, button text === "Path Chosen ✓"
    - For narrow viewport on step 6, header flexDirection remains "column"
    - Card swipe navigation and dot indicators function identically
  - Test file: `src/pages/__tests__/pathSelectionUx.preservation.property.test.ts`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix path selection UX defects

  - [x] 3.1 Implement responsive member details header layout
    - In `src/components/wizard/StepPathSelection.tsx`, update the header `Box` sx props
    - Add `flexDirection: { xs: 'column', sm: 'row' }` to arrange name/role/unit horizontally on wider viewports
    - Add `alignItems: { xs: 'flex-start', sm: 'center' }` and appropriate `gap` for horizontal flow
    - Ensure equipment chips wrap naturally in both layouts
    - _Bug_Condition: input.step === 6 AND input.viewportWidth >= smBreakpoint AND headerLayoutIsVerticalOnly_
    - _Expected_Behavior: header uses horizontal layout on sm+ viewports, vertical on xs_
    - _Preservation: narrow viewport (< sm) continues to stack vertically (Requirement 3.1)_
    - _Requirements: 2.1, 3.1_

  - [x] 3.2 Implement sticky member details header
    - In `src/components/wizard/StepPathSelection.tsx`, add sticky positioning to the header `Box`
    - Add `position: 'sticky'`, `top: 0`, `zIndex: 2`, and `backgroundColor: 'background.default'` (or theme surface)
    - Ensure header remains visible when scrolling through path card content
    - _Bug_Condition: input.step === 6 AND headerIsNotSticky_
    - _Expected_Behavior: header remains persistently visible at top during scroll_
    - _Preservation: no impact on other components or scroll behavior_
    - _Requirements: 2.2_

  - [x] 3.3 Implement footer button label fix
    - In `src/pages/CreateCompanyPage.tsx`, locate the navigation footer Next button (~line 1558)
    - Change the hardcoded `"Next"` label to conditional logic:
      - When `wizard.step === 6` and not all heroes have paths: display `"Select"`
      - When `wizard.step === 6` and all heroes have paths (review page): display `"Next"`
      - All other steps: continue displaying `"Next"`
    - Use `canAdvance()` or check `heroTempIds.every(tid => wizard.heroPaths[tid])` for the condition
    - _Bug_Condition: input.step === 6 AND NOT input.allHeroesHavePaths AND footerButtonLabel === "Next"_
    - _Expected_Behavior: footer shows "Select" during active path selection, "Next" on review_
    - _Preservation: steps 0–5 continue showing "Next", step 7 continues showing "Form Company" (Requirements 3.2, 3.4)_
    - _Requirements: 2.3, 3.2, 3.4_

  - [x] 3.4 Implement path card action button text fix
    - In `src/components/common/PathCardSelector.tsx`, locate the select button (~line 586)
    - Change `'Choose This Path'` to `'Select This Path'`
    - Keep `'Path Chosen ✓'` unchanged for already-selected paths
    - _Bug_Condition: input.viewingPathCard AND actionButtonLabel === "Choose This Path"_
    - _Expected_Behavior: button reads "Select This Path" for unselected paths_
    - _Preservation: "Path Chosen ✓" display unchanged for selected paths (Requirement 3.3)_
    - _Requirements: 2.4, 3.3_

  - [x] 3.5 Implement path review name resolution from paths.json
    - In `src/pages/CreateCompanyPage.tsx`, locate the path review summary (~lines 970–975)
    - Import `pathsData` from `'../../data/paths.json'` (already imported in PathCardSelector; add to CreateCompanyPage if not present)
    - Replace the string manipulation chain (`pathId?.replace(/_/g, ' ').replace(/\bpath of\b/i, '').trim()`) with: `(pathsData as Array<{id: string; label: string}>).find(p => p.id === pathId)?.label ?? pathId`
    - Remove the `formattedPath` variable and `"Path of "` prefix since `label` already includes it
    - _Bug_Condition: input.viewingReview AND pathNameDerivedFromStringManipulation_
    - _Expected_Behavior: review displays canonical label from paths.json (e.g. "Path of the Tactician")_
    - _Preservation: "Change Path" functionality unchanged (Requirement 3.6)_
    - _Requirements: 2.5, 3.6_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Correct Labels and Responsive/Sticky Header
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Path-Selection Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to confirm no regressions
  - Ensure all property-based tests pass
  - Ask the user if questions arise
