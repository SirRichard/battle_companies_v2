# Requirements Document

## Introduction

Three UX improvements to the Battle Companies companion app addressing usability gaps in path selection during company creation, equipment visibility in the member details drawer, and injury treatment feedback when insufficient Influence Points are available.

## Glossary

- **Path_Card_Selector**: The swipeable card component (`PathCardSelector`) used to browse and select hero paths during company creation and post-match hero advancement.
- **Select_Button**: The primary action button at the bottom of each path card in the Path_Card_Selector. Displays "Select This Path" when unselected and "Path Chosen ✓" when selected.
- **Wizard_Footer_Button**: The primary action button in the sticky navigation footer of the company creation wizard (`CreateCompanyPage`). During step 6 (Paths), displays "Select" while a hero is pending path selection and "Next" when all heroes have paths and the review summary is shown.
- **Member_Details_Drawer**: The bottom drawer component (`MemberDetailsDrawer`) that displays full details for a single company member including stats, wargear, equipment, injuries, and special rules.
- **Wargear**: Combat gear items (weapons, shields, armour, mounts, bows) defined in `wargear.json` that a member carries. These have a `category` field.
- **Equipment**: Non-combat utility items (backpacks, healing herbs, maps, talismans, etc.) defined in `equipment.json` that a member owns. Stored in `member.ownedEquipment`.
- **Treat_Button**: The "Treat" button displayed on injury cards in the Member_Details_Drawer that initiates the injury treatment flow.
- **Influence_Points (IP)**: A company resource spent to treat injuries, purchase equipment, and recruit reinforcements.
- **Company**: The user's battle company containing members, resources, and match history.

## Requirements

### Requirement 1: Path Selection Confirmation via Card Button and Wizard Footer Button

**User Story:** As a player creating a company, I want both the path card's "Select This Path" button and the wizard footer's "Select" button to confirm my current path selection and advance to the next hero, so that I can proceed naturally from either location without confusion.

#### Acceptance Criteria

1. WHEN the user activates the Select_Button on a path card that is already selected, THE Path_Card_Selector SHALL confirm the selection and advance the path sub-flow to the next hero requiring a path (or to the review summary if all heroes have paths).
2. WHEN the user activates the Select_Button on a path card that is not yet selected, THE Path_Card_Selector SHALL assign that path to the current hero and advance the path sub-flow to the next hero requiring a path (existing selection behaviour preserved, now also advances).
3. WHEN the user activates the Wizard_Footer_Button while the wizard is on step 6 and a hero is pending path selection, THE Wizard_Footer_Button SHALL confirm the current hero's selected path and advance the path sub-flow to the next hero requiring a path (identical effect to the Select_Button on the card).
4. WHILE the currently displayed hero does not yet have a path selected, THE Wizard_Footer_Button SHALL be enabled IF any hero in the company already has a path assigned; otherwise THE Wizard_Footer_Button SHALL remain disabled until the user selects a path via the Select_Button on a card.
5. WHEN all heroes have been assigned paths, THE Wizard SHALL display the review summary view showing all chosen paths with "Change Path" buttons for each hero.
6. WHILE the review summary view is displayed, THE Wizard_Footer_Button SHALL display the label "Next" and, when activated, advance the wizard to the next step (Gold/Equipment).
7. WHILE a hero is pending path selection (not in review mode), THE Wizard_Footer_Button SHALL display the label "Select".
8. THE Select_Button SHALL remain enabled and clickable regardless of whether the displayed path is currently selected.
9. WHEN a path's selection state changes, THE Select_Button SHALL immediately update its label ("Path Chosen ✓" for selected, "Select This Path" for unselected) and variant (`outlined` for selected, `contained` for unselected) without waiting for a card re-render.

### Requirement 2: Separate Equipment Section in Member Details Drawer

**User Story:** As a player managing my company, I want equipment items displayed in their own section separate from wargear in the member details drawer, so that I can clearly distinguish utility items from combat gear.

#### Acceptance Criteria

1. THE Member_Details_Drawer SHALL display a dedicated "Equipment" section that lists all items from the member's `ownedEquipment` array, excluding any `envenom_weapon` entries which remain displayed in the Wargear section.
2. THE Member_Details_Drawer SHALL display the "Equipment" section after the Wargear section and before the Experience section.
3. IF a member's `ownedEquipment` array is empty or undefined, THEN THE Member_Details_Drawer SHALL display an italicised "No equipment" placeholder in the Equipment section.
4. IF the member's role is leader, sergeant, or hero_in_making, THEN THE Member_Details_Drawer SHALL display an "Edit" button on the Equipment section header that enables edit mode for equipment management.
5. WHILE the Equipment section is in edit mode, THE Member_Details_Drawer SHALL display a remove control on each equipment item that, when activated, presents a confirmation prompt and upon confirmation removes the item from the member's `ownedEquipment` array and persists the updated company.
6. WHILE the Equipment section is in edit mode, THE Member_Details_Drawer SHALL display a "Done" button that exits edit mode and hides the remove controls.
7. THE Member_Details_Drawer SHALL enforce that items present in `ownedEquipment` (other than `envenom_weapon` entries) are excluded from the Wargear section whenever they are shown in the Equipment section, to avoid duplication.

### Requirement 3: Disabled Treat Button with Insufficient IP Feedback

**User Story:** As a player viewing an injured member, I want to see why I cannot treat an injury when my company lacks Influence Points, so that I understand the constraint rather than wondering why the option is missing.

#### Acceptance Criteria

1. WHEN the company has fewer than 1 Influence Point, THE Member_Details_Drawer SHALL display the Treat_Button in a visually disabled state (opacity between 0.3 and 0.5) on each injury card that would otherwise be treatable (missing_next_game for any member; arm_wound, leg_wound, or broken_honour for hero members only).
2. WHEN the company has fewer than 1 Influence Point, THE Member_Details_Drawer SHALL display red error text reading "No IP Available" immediately below or inline-end of the disabled Treat_Button only on injury cards that would be treatable if IP were available (i.e., not on injuries ineligible for other reasons such as wrong member type).
3. WHILE the Treat_Button is in a disabled state, THE Member_Details_Drawer SHALL prevent the injury treatment flow from being initiated when the button is tapped.
4. WHEN the company has 1 or more Influence Points, THE Member_Details_Drawer SHALL display the Treat_Button in its normal interactive state without error text on eligible injury cards (existing behaviour preserved).
5. WHEN the company Influence Points change while the Member_Details_Drawer is open, THE Member_Details_Drawer SHALL update the Treat_Button state (disabled or enabled) and error text visibility within 1 second without requiring the drawer to be closed and reopened.
