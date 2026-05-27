# Bugfix Requirements Document

## Introduction

During company creation, the hero path selection step (Step 6) has several UX issues: the member details header is not responsive and not sticky, button labels are inconsistent with the intended "Select" terminology, and the path review page derives path names from IDs via string manipulation instead of using the canonical `label` field from `paths.json`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the viewport is wide enough to accommodate a horizontal layout THEN the member details section (name, role, unit type, equipment) stacks vertically, wasting vertical space unnecessarily

1.2 WHEN the user scrolls down through path card content THEN the member details header scrolls out of view, losing context about which hero is currently selecting a path

1.3 WHEN the user is on step 6 (Paths) and there are still heroes that need to choose a path THEN the navigation footer button displays "Next" instead of "Select"

1.4 WHEN the user views a path card and taps the bottom action button THEN the button reads "Choose This Path" instead of "Select This Path"

1.5 WHEN the user reaches the path review summary (all heroes have paths selected) THEN path names are derived by stripping underscores and capitalizing the path ID string rather than using the `label` field from `paths.json`

### Expected Behavior (Correct)

2.1 WHEN the viewport is wide enough (e.g. sm breakpoint and above) THEN the member details section SHALL flatten into a more horizontal/compact layout so that name, role, unit type, and equipment occupy less vertical space, reverting to the stacked layout only on narrow viewports

2.2 WHEN the user scrolls down through path card content THEN the member details header SHALL remain persistently visible (sticky) at the top of the scrollable area so the user always knows which hero is selecting

2.3 WHEN the user is on step 6 (Paths) and there are still heroes that need to choose a path THEN the navigation footer button SHALL display "Select" instead of "Next"; the button SHALL only display "Next" on the review page after all heroes have selected their path

2.4 WHEN the user views a path card and taps the bottom action button THEN the button SHALL read "Select This Path" instead of "Choose This Path"

2.5 WHEN the user reaches the path review summary THEN path names SHALL be resolved by looking up the path ID in `paths.json` and using the `label` field (e.g. "Path of the Tactician") rather than deriving it from the ID string

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the viewport is narrow (below sm breakpoint) THEN the member details section SHALL CONTINUE TO display in its current stacked vertical layout

3.2 WHEN the user is on the final step (Gold/step 7) THEN the navigation footer button SHALL CONTINUE TO display "Form Company"

3.3 WHEN a path is already selected THEN the bottom button on the path card SHALL CONTINUE TO display "Path Chosen ✓"

3.4 WHEN the user is on steps 0-5 (before path selection) THEN the navigation footer "Next" button label SHALL CONTINUE TO display "Next" as before

3.5 WHEN the user navigates between path cards using swipe or arrow buttons THEN the card animation and dot indicators SHALL CONTINUE TO function identically

3.6 WHEN the user clicks "Change Path" on the review page THEN the system SHALL CONTINUE TO clear that hero's path selection and return to the path card selector for that hero
