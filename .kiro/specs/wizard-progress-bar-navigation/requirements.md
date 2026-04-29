# Requirements Document

## Introduction

The company creation wizard in the Battle Companies app uses a progress bar (MUI Stepper) at the top of the screen to show the user which step they are on. Currently the step labels are purely decorative — they display progress but are not interactive.

This feature makes each completed step label in the progress bar a tappable/clickable button that navigates the user back to that step. Forward navigation via the progress bar is explicitly prohibited; users may only jump to steps they have already visited. The existing Back and Next footer buttons are unaffected.

## Glossary

- **Wizard**: The multi-step company creation flow rendered by `CreateCompanyPage`.
- **Progress_Bar**: The MUI `Stepper` component displayed at the top of the Wizard, showing all step labels.
- **Step_Label**: An individual step indicator inside the Progress_Bar (e.g. "Alignment", "Faction", "Company").
- **Active_Step**: The step the user is currently on, identified by `wizard.step`.
- **Completed_Step**: Any step whose index is strictly less than the Active_Step index.
- **Future_Step**: Any step whose index is strictly greater than the Active_Step index.
- **Backward_Navigation**: Moving from a higher-indexed step to a lower-indexed step.
- **Wizard_State**: The `WizardState` object that tracks all user selections across steps.

## Requirements

### Requirement 1: Backward Navigation via Progress Bar

**User Story:** As a user creating a new company, I want to tap a previously completed step in the progress bar, so that I can quickly return to that step to review or change my earlier choices.

#### Acceptance Criteria

1. WHEN the user taps a Completed_Step label in the Progress_Bar, THE Wizard SHALL navigate to that step.
2. WHEN the user taps a Completed_Step label in the Progress_Bar, THE Wizard SHALL animate the step transition in the backward direction (sliding right-to-left entry).
3. THE Progress_Bar SHALL render each Completed_Step label as an interactive element with a pointer cursor.
4. THE Progress_Bar SHALL render the Active_Step label as a non-interactive element (no navigation on tap).
5. THE Progress_Bar SHALL render each Future_Step label as a non-interactive element (no navigation on tap).

### Requirement 2: State Preservation on Backward Navigation

**User Story:** As a user, I want my selections on later steps to be preserved when I jump back to an earlier step, so that I do not lose my work if I only want to review or make a small change.

#### Acceptance Criteria

1. WHEN the user navigates backward via the Progress_Bar, THE Wizard_State SHALL retain all field values for steps after the destination step.
2. WHEN the user navigates backward via the Progress_Bar to a step whose selections affect downstream steps (steps 0, 1, or 2), THE Wizard SHALL reset all downstream-dependent state in the same way the existing Back button and step-change handlers do.
3. WHEN the user navigates backward via the Progress_Bar and then navigates forward again without making changes, THE Wizard SHALL reach the same step the user came from with all prior selections intact.

### Requirement 3: Visual Affordance for Clickable Steps

**User Story:** As a user, I want completed steps in the progress bar to look visually distinct from non-interactive steps, so that I understand which steps I can tap to navigate back.

#### Acceptance Criteria

1. THE Progress_Bar SHALL display Completed_Step labels with a visual affordance (such as an underline on hover or a distinct cursor) that distinguishes them from non-interactive steps.
2. THE Progress_Bar SHALL NOT display a clickable affordance on the Active_Step label.
3. THE Progress_Bar SHALL NOT display a clickable affordance on Future_Step labels.
4. WHEN a Completed_Step label receives keyboard focus, THE Progress_Bar SHALL display a visible focus indicator on that label.

### Requirement 4: Accessibility

**User Story:** As a user relying on keyboard or assistive technology, I want the clickable step labels to be accessible, so that I can navigate the wizard without a pointer device.

#### Acceptance Criteria

1. THE Progress_Bar SHALL expose each Completed_Step label as a focusable element reachable via keyboard Tab navigation.
2. WHEN a Completed_Step label has keyboard focus and the user presses Enter or Space, THE Wizard SHALL navigate to that step.
3. THE Progress_Bar SHALL provide each Completed_Step label with an accessible label (e.g. `aria-label="Go back to Alignment step"`) that describes the navigation action.
4. THE Progress_Bar SHALL mark each Future_Step and the Active_Step label as non-interactive so assistive technologies do not present them as actionable controls.

### Requirement 5: Skipped-Step Handling

**User Story:** As a user whose company has pre-assigned roles (all roles forced), I want the progress bar to correctly reflect which steps I actually visited, so that I am not offered navigation to a step I was automatically skipped past.

#### Acceptance Criteria

1. WHEN the Wizard automatically skips step 5 (Command) because all roles are forced, THE Progress_Bar SHALL NOT treat step 5 as a Completed_Step available for backward navigation.
2. WHEN the Wizard automatically skips step 7 (Gold) because the company has no starting gold, THE Progress_Bar SHALL NOT treat step 7 as a Completed_Step available for backward navigation.
3. THE Wizard SHALL track which steps were actually visited by the user so that the Progress_Bar can accurately determine Completed_Steps versus skipped steps.
