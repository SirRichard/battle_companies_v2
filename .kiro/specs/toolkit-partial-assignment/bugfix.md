# Bugfix Requirements Document

## Introduction

On the Toolkit Assignment page, the "Begin Battle" button is disabled whenever one or more kit items have not been assigned to a member. This prevents the user from proceeding at all, even though partial assignment is a valid scenario (e.g. a member is unavailable or the user intentionally skips an item). The fix should allow the user to proceed with partial assignments, but surface a confirmation dialog warning them that unassigned items will be lost before continuing.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a kit is selected and one or more items have not been assigned to a member THEN the system disables the "Begin Battle" button, preventing the user from proceeding.

1.2 WHEN a kit is selected and one or more items have not been assigned to a member THEN the system displays the message "Assign all items to proceed." with no alternative path forward.

### Expected Behavior (Correct)

2.1 WHEN a kit is selected and one or more items have not been assigned to a member THEN the system SHALL enable the "Begin Battle" button, allowing the user to attempt to proceed.

2.2 WHEN the user clicks "Begin Battle" and one or more items have not been assigned THEN the system SHALL display a confirmation dialog warning the user that not all items have been assigned and that unassigned items will be lost.

2.3 WHEN the user confirms the dialog with partial assignments THEN the system SHALL proceed to the next page (saving only the assigned items).

2.4 WHEN the user cancels the dialog THEN the system SHALL dismiss the dialog and return the user to the assignment page without navigating away.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN all kit items have been assigned to members THEN the system SHALL CONTINUE TO enable the "Begin Battle" button and proceed directly without showing a confirmation dialog.

3.2 WHEN the user assigns a kit item that requires a parameter (e.g. Envenom Weapon) THEN the system SHALL CONTINUE TO prompt the parameter selection dialog before confirming the assignment.

3.3 WHEN no kit has been selected THEN the system SHALL CONTINUE TO not show the item assignment section or the "Begin Battle" button.
