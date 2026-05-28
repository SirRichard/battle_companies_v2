# Requirements Document

## Introduction

Responsive design overhaul for the company creation wizard in Battle Companies. Primary focus: StepCompany layout transformation on selection, "Next" button for revisited Alignment/Faction steps, and multi-column responsive grids across remaining wizard steps. All styling via MUI sx prop using default breakpoints (xs:0, sm:600, md:900, lg:1200).

## Glossary

- **Wizard**: The multi-step company creation flow managed by CreateCompanyPage
- **StepCompany**: Step 2 of the Wizard where users select a company type
- **StepAlignment**: Step 0 of the Wizard where users choose Good or Evil alignment
- **StepFaction**: Step 1 of the Wizard where users choose a faction within their alignment
- **StepLeaderSelection**: Step 5 of the Wizard where users assign Leader and Sergeant roles
- **StepSpellSelection**: Sub-step shown when a hero picks Path of Channeling
- **StepMemberNames**: Step 4 of the Wizard where users name roster members
- **StepGoldEquipment**: Step 7 of the Wizard where users spend starting gold on wargear
- **Company_List**: The grid or list of available companies shown in StepCompany before selection
- **Company_Details**: The expanded view showing variant picker for a selected company
- **Collapse_Button**: A UI control shown only within the Focused_Layout that returns StepCompany to the full Company_List; no separate expand button exists since selection itself triggers the Focused_Layout
- **Back_Button**: The wizard-level navigation button that moves to the previous step
- **Next_Button**: A navigation button that advances to the next wizard step without re-selecting an option
- **Sidebar**: A compact list of unselected companies shown on md+ screens when a company is selected
- **Focused_Layout**: The layout state where a selected company's details occupy the primary content area

## Requirements

### Requirement 1: StepCompany Focused Layout on Selection

**User Story:** As a user, I want selecting a company to immediately show its details in a focused layout, so that I can review company information without distraction.

#### Acceptance Criteria

1. WHEN a company is selected from the Company_List, THE StepCompany SHALL track the selected company in state and transition to the Focused_Layout displaying the Company_Details for the selected company
2. WHILE the Focused_Layout is active on viewports at or above the md breakpoint (900px), THE StepCompany SHALL display unselected companies in a compact Sidebar on the left showing only company names, and the Company_Details in the main content area on the right
3. WHILE the Focused_Layout is active on viewports below the md breakpoint, THE StepCompany SHALL hide all unselected companies and display only the Company_Details
4. WHILE the Focused_Layout is active on viewports at or above the md breakpoint, THE Sidebar SHALL render all unselected companies as a compact list without independent scrolling, fitting within the visible viewport
5. WHEN a user clicks a company in the Sidebar, THE StepCompany SHALL switch the Focused_Layout to display the newly selected company's details and move the previously selected company back into the Sidebar list

### Requirement 2: StepCompany Return to Company List

**User Story:** As a user, I want clear ways to return from the focused company view to the full company list, so that I can browse other options.

#### Acceptance Criteria

1. WHILE the Focused_Layout is active, THE StepCompany SHALL display the Collapse_Button in a visible, consistently positioned location within the Company_Details area
2. WHEN the Collapse_Button is activated, THE StepCompany SHALL deselect the current company, clear any associated variant selection, and restore the full Company_List layout showing all available companies
3. WHILE the Focused_Layout is active on viewports below the md breakpoint (900px), THE Collapse_Button SHALL remain visible as the only mechanism for returning to the Company_List since the Sidebar is hidden
4. WHEN the Back_Button is pressed while the Focused_Layout is active, THE Wizard SHALL deselect the current company, clear any associated variant selection, and return to the full Company_List state without navigating to the previous step
5. WHEN the Back_Button is pressed while the Company_List is displayed (no company selected), THE Wizard SHALL navigate to the Faction step (Step 1)

### Requirement 3: Alignment and Faction Step Next Button

**User Story:** As a user returning to the Alignment or Faction step with a previous selection still active, I want a "Next" button so I can proceed without re-clicking my existing choice.

#### Acceptance Criteria

1. WHILE a user is on StepAlignment and the alignment value in wizard state is non-null, THE StepAlignment SHALL display a Next_Button below the alignment options that, when activated, advances the wizard to StepFaction
2. WHILE a user is on StepFaction and the factionId value in wizard state is non-null, THE StepFaction SHALL display a Next_Button below the faction options that, when activated, advances the wizard to StepCompany
3. IF the alignment value in wizard state is null when StepAlignment is displayed, THEN THE StepAlignment SHALL NOT display a Next_Button
4. IF the factionId value in wizard state is null when StepFaction is displayed, THEN THE StepFaction SHALL NOT display a Next_Button
5. WHEN the Next_Button is activated on StepAlignment, THE Wizard SHALL advance to StepFaction preserving the current alignment selection without resetting downstream state
6. WHEN the Next_Button is activated on StepFaction, THE Wizard SHALL advance to StepCompany preserving the current faction selection without resetting downstream state
7. WHEN a user clicks any alignment option on StepAlignment (same or different from current selection), THE StepAlignment SHALL update the alignment value and immediately auto-advance to StepFaction without requiring Next_Button activation
8. WHEN a user clicks any faction option on StepFaction (same or different from current selection), THE StepFaction SHALL update the factionId value and immediately auto-advance to StepCompany without requiring Next_Button activation

### Requirement 4: StepLeaderSelection Responsive Grid

**User Story:** As a user on a wider screen, I want member cards displayed in two columns, so that I can see more members at once without scrolling.

#### Acceptance Criteria

1. WHILE the viewport is at or above the sm breakpoint (600px), THE StepLeaderSelection SHALL display member cards in a 2-column grid layout with equal-width columns and consistent gap spacing
2. WHILE the viewport is below the sm breakpoint, THE StepLeaderSelection SHALL display member cards in a single-column layout

### Requirement 5: StepSpellSelection Responsive Grid

**User Story:** As a user on a wider screen, I want spell buttons displayed in two columns, so that I can browse spells more efficiently.

#### Acceptance Criteria

1. WHILE the viewport width is at or above 600px (inclusive), THE StepSpellSelection SHALL display spell buttons in a 2-column grid layout with equal-width columns and consistent spacing between items
2. WHILE the viewport width is below 600px, THE StepSpellSelection SHALL display spell buttons in a single-column layout where each button occupies the full available width
3. WHEN the viewport is resized across the 600px boundary, THE StepSpellSelection SHALL transition between single-column and 2-column layouts without requiring a page reload

### Requirement 6: StepMemberNames Responsive Grid

**User Story:** As a user on a wider screen, I want name fields displayed in two columns, so that I can fill in names more efficiently.

#### Acceptance Criteria

1. WHILE the viewport is at or above the sm breakpoint (600px, where exactly 600px uses single-column per MUI default breakpoint behavior), THE StepMemberNames SHALL display name input fields in a 2-column grid layout with equal-width columns and consistent spacing between grid items
2. WHILE the viewport is below the sm breakpoint, THE StepMemberNames SHALL display name input fields in a single-column layout
3. WHEN a group label or divider is rendered within the grid, THE StepMemberNames SHALL span that label or divider across the full width of both columns so that it visually separates groups without breaking the column flow

### Requirement 7: StepGoldEquipment Split-Pane Layout

**User Story:** As a user on a wider screen, I want the member list and purchase panel displayed side by side, so that I can see my roster while shopping for equipment.

#### Acceptance Criteria

1. WHILE the viewport is at or above the md breakpoint (900px), THE StepGoldEquipment SHALL display a split-pane layout with the member list on the left (~35% width) and the purchase panel for the selected member on the right (~65% width)
2. WHILE the viewport is below the md breakpoint, THE StepGoldEquipment SHALL display the existing single-column accordion layout
3. WHILE the split-pane layout is active and no member is selected, THE right pane SHALL display a prompt instructing the user to select a member from the list

### Requirement 8: StepFaction Responsive Grid Enhancement

**User Story:** As a user on a large screen, I want faction options displayed in three columns, so that I can see all factions at a glance.

#### Acceptance Criteria

1. WHILE the viewport width is at or above 1200px (lg breakpoint), THE StepFaction SHALL display faction buttons in a 3-column grid layout with equal-width columns
2. WHILE the viewport width is at or above 600px (sm breakpoint, inclusive) but below 1200px, THE StepFaction SHALL display faction buttons in a 2-column grid layout with equal-width columns
3. WHILE the viewport width is below 600px (sm breakpoint), THE StepFaction SHALL display faction buttons in a single-column layout where each button occupies the full available width
4. THE StepFaction SHALL maintain consistent gap spacing between grid items across all breakpoints
