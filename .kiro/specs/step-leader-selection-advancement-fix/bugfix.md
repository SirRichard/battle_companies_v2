# Bugfix Requirements Document

## Introduction

After the implementation of Task 40 from the battle-companies-fixes-and-features spec, which attempted to fix a stale closure issue with the `canAdvance()` function for step 5 (StepLeaderSelection), users are unable to advance past the leader selection step after selecting a leader and 2 sergeants. The Next button remains disabled even when the selection criteria are met (`leaderId !== null && sergeantIds.length === 2`). The only company that can proceed is Helm's Deep, which skips step 5 entirely because all roles are pre-assigned via `mustBeLeader`/`mustBeSergeant` flags.

This bug prevents players from creating companies and completing the wizard flow, blocking a critical user journey. The issue appears to be related to how the wizard state is being updated when heroes are selected or deselected in StepLeaderSelection, despite the `canAdvance()` function logic appearing correct.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user selects a leader and 2 sergeants in StepLeaderSelection (step 5) THEN the system does not enable the Next button

1.2 WHEN `wizard.leaderId` is set to a non-null value and `wizard.sergeantIds.length === 2` THEN the system does not reflect this state change in the Next button's disabled state

1.3 WHEN a user deselects and reselects a sergeant THEN the system does not reactively update the Next button's enabled/disabled state

1.4 WHEN a company other than Helm's Deep completes hero selection THEN the system prevents advancement to step 6 (path selection)

### Expected Behavior (Correct)

2.1 WHEN a user selects a leader and 2 sergeants in StepLeaderSelection (step 5) THEN the system SHALL enable the Next button immediately

2.2 WHEN `wizard.leaderId` is set to a non-null value and `wizard.sergeantIds.length === 2` THEN the system SHALL evaluate `canAdvance()` as true and enable the Next button

2.3 WHEN a user deselects and reselects a sergeant THEN the system SHALL reactively update the Next button's enabled/disabled state without requiring additional interaction

2.4 WHEN a company other than Helm's Deep completes hero selection THEN the system SHALL allow advancement to step 6 (path selection)

2.5 WHEN the wizard state changes in StepLeaderSelection THEN the system SHALL trigger a re-evaluation of `canAdvance()` that reads the current wizard state

### Unchanged Behavior (Regression Prevention)

3.1 WHEN Helm's Deep company skips step 5 due to `allRolesForced` being true THEN the system SHALL CONTINUE TO advance directly from step 4 to step 6

3.2 WHEN a user has not yet selected a leader THEN the system SHALL CONTINUE TO keep the Next button disabled

3.3 WHEN a user has selected a leader but fewer than 2 sergeants THEN the system SHALL CONTINUE TO keep the Next button disabled

3.4 WHEN a user has selected a leader and more than 2 sergeants THEN the system SHALL CONTINUE TO prevent this state (maximum 2 sergeants enforced)

3.5 WHEN the Enter key shortcut is used and `canAdvance()` returns true THEN the system SHALL CONTINUE TO advance to the next step

3.6 WHEN `canAdvance()` is called for other wizard steps THEN the system SHALL CONTINUE TO evaluate correctly for those steps
