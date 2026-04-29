# Bugfix Requirements Document

## Introduction

When a user clicks "Abandon Creation" in the company creation wizard and confirms the dialog, they are navigated back to the home screen. However, the wizard's in-memory React state is not reset. If the user then navigates back to the wizard (e.g. via the "New Company" button), all previous selections — alignment, faction, company type, member names, hero assignments, paths, and gold purchases — are still present instead of starting fresh. This creates a confusing experience where abandoned progress unexpectedly reappears.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user confirms "Abandon Creation" after making selections in the wizard THEN the system removes the sessionStorage draft but does NOT reset the in-memory wizard state

1.2 WHEN a user returns to the company creation wizard after abandoning a previous session THEN the system displays the previously abandoned selections (alignment, faction, company, names, hero roles, paths, gold purchases) instead of a blank wizard

1.3 WHEN a user abandons the wizard at any step beyond step 0 THEN the system navigates to the home screen but leaves the wizard component's React state intact for the current session

### Expected Behavior (Correct)

2.1 WHEN a user confirms "Abandon Creation" THEN the system SHALL reset the wizard state to its initial default values (step 0, all fields cleared) before navigating to the home screen

2.2 WHEN a user returns to the company creation wizard after abandoning a previous session THEN the system SHALL present a clean wizard starting at step 0 with no pre-filled selections

2.3 WHEN a user abandons the wizard at any step THEN the system SHALL discard all selections including alignment, faction, company type, variant, company name, member names, leader/sergeant assignments, hero paths, spell choices, and gold purchases

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user navigates away from the wizard to the stats entry page mid-wizard and returns THEN the system SHALL CONTINUE TO restore the wizard draft from sessionStorage and resume at the correct step

3.2 WHEN a user completes the wizard and forms a company THEN the system SHALL CONTINUE TO clear the sessionStorage draft and navigate to the new company's detail page

3.3 WHEN a user clicks "Cancel" or "Back" on step 0 without confirming the abandon dialog THEN the system SHALL CONTINUE TO keep the current wizard state unchanged

3.4 WHEN a user is mid-wizard and the page is refreshed THEN the system SHALL CONTINUE TO restore the wizard draft from sessionStorage so progress is not lost on accidental refresh
