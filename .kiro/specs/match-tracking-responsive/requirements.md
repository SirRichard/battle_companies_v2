# Requirements Document

## Introduction

The MatchTrackingPage displays all company members with full stat blocks, M/W/F controls, equipment chips, special rules, toolkit items, XP counters, and casualty toggles. On small screens with 8–12 members, this creates excessive vertical scrolling. This feature introduces progressive disclosure via expand/collapse behavior so that only essential match-tracking information (name, XP, casualty) is always visible, while secondary details collapse behind a chevron on smaller viewports.

## Glossary

- **Match_Tracking_Page**: The active match screen that displays all participating company members and their interactive controls during a game.
- **Member_Card**: A single card component within Match_Tracking_Page representing one company member and all associated stats and controls.
- **Primary_Info**: The subset of member data that remains visible regardless of viewport size: member name, role chip, XP counter (+/− buttons), and casualty marker/button.
- **Secondary_Info**: The subset of member data hidden behind a collapse on small viewports: full 9-stat block, M/W/F interactive +/− controls, equipment chips, special rules chips, and toolkit items.
- **Collapse_Panel**: An expandable/collapsible container (MUI Collapse component) that wraps Secondary_Info within a Member_Card.
- **Expand_Chevron**: A tappable icon button that toggles the Collapse_Panel open or closed.
- **xs_Breakpoint**: Viewport width below 600px.
- **sm_Breakpoint**: Viewport width between 600px and 899px.
- **md_Breakpoint**: Viewport width of 900px and above.
- **Stat_Grid**: A CSS Grid layout (5 columns, 2 rows) used to display the 9-stat block on xs viewports without unpredictable wrapping.
- **MWF_Summary**: A compact inline display showing current Might/Will/Fate values (without +/− buttons) visible in the Primary_Info row on sm breakpoint.
- **Chip_Detail_Popup**: An MUI Popover component anchored to the tapped chip element that appears when a user taps an equipment chip or special rule chip, displaying the description text for that entry.
- **Equipment_Chip**: A small MUI Chip component on a Member_Card that displays the label of a wargear or equipment item the member carries.
- **Special_Rule_Chip**: A small MUI Chip component on a Member_Card that displays the label of a special rule the member possesses.
- **Envenom_Weapon_Rule**: A parameterised special rule stored as `{ id: "poisoned_attacks", parameter: "<weapon_id>" }` in member data, representing a weapon that has been envenomed via the Hunter's Kit toolkit. On the Match_Tracking_Page, envenom weapons are displayed as wargear chips (synthesized entries with format `envenom_weapon::<weapon_id>`) in the equipment chip area, NOT as special rule chips. The corresponding `poisoned_attacks` parameterised entries are filtered out of the special rules chip display.

## Requirements

### Requirement 1: Collapse Behavior at xs Breakpoint

**User Story:** As a player using a phone, I want member cards to show only essential info by default, so that I can see all my members without excessive scrolling.

#### Acceptance Criteria

1. WHILE the viewport width is below 600px, THE Member_Card SHALL render Secondary_Info inside a Collapse_Panel that is collapsed by default.
2. WHILE the viewport width is below 600px, THE Member_Card SHALL display Primary_Info (member name, role chip, XP counter with +/− buttons, and casualty button) without requiring expansion.
3. WHILE the viewport width is below 600px, THE Member_Card SHALL display an Expand_Chevron that points downward when collapsed and rotates to point upward when expanded, and that toggles the Collapse_Panel between collapsed and expanded states.
4. WHEN the user taps the Expand_Chevron on a collapsed Member_Card, THE Collapse_Panel SHALL animate open within 300ms to reveal Secondary_Info, and the Expand_Chevron SHALL set aria-expanded to true.
5. WHEN the user taps the Expand_Chevron on an expanded Member_Card, THE Collapse_Panel SHALL animate closed within 300ms to hide Secondary_Info, and the Expand_Chevron SHALL set aria-expanded to false.
6. WHILE the viewport width is below 600px, THE Expand_Chevron SHALL render with an aria-expanded attribute reflecting the current collapsed (false) or expanded (true) state of the Collapse_Panel.

### Requirement 2: Collapse Behavior at sm Breakpoint

**User Story:** As a player using a tablet in portrait mode, I want to see M/W/F values at a glance alongside the essential info, so that I can track hero resources without expanding every card.

#### Acceptance Criteria

1. WHILE the viewport width is between 600px and 899px, THE Member_Card SHALL render Secondary_Info inside a Collapse_Panel that is collapsed by default.
2. WHILE the viewport width is between 600px and 899px, IF the member role is leader, sergeant, or hero_in_making, THEN THE Member_Card SHALL display Primary_Info and an MWF_Summary on the same always-visible row, positioned after Primary_Info.
3. WHILE the viewport width is between 600px and 899px, IF the member role is warrior, THEN THE Member_Card SHALL display Primary_Info on the always-visible row without an MWF_Summary.
4. WHILE the viewport width is between 600px and 899px, THE MWF_Summary SHALL display the current Might, Will, and Fate numeric values as read-only text without +/− buttons.
5. WHILE the viewport width is between 600px and 899px, THE Member_Card SHALL display an Expand_Chevron that toggles the Collapse_Panel between collapsed and expanded states, and the Expand_Chevron SHALL visually indicate the current state by pointing downward when collapsed and upward when expanded.
6. WHILE the viewport width is between 600px and 899px, WHEN the user activates the Expand_Chevron to expand the Collapse_Panel, THE Member_Card SHALL display the full M/W/F interactive +/− controls within the expanded Collapse_Panel for hero members. IF the Collapse_Panel is already expanded, THEN activating the Expand_Chevron SHALL collapse it rather than re-rendering the M/W/F controls.

### Requirement 3: Full Expansion at md+ Breakpoint

**User Story:** As a player using a desktop or large tablet, I want all member details visible without interaction, so that I have full situational awareness during the match.

#### Acceptance Criteria

1. WHILE the viewport width is 900px or above, THE Member_Card SHALL display all Primary_Info and Secondary_Info without wrapping them in a Collapse_Panel component (the Collapse_Panel SHALL NOT be present in the rendered DOM).
2. WHILE the viewport width is 900px or above, THE Member_Card SHALL NOT render an Expand_Chevron or any collapse toggle control.
3. WHEN the viewport width transitions from below 900px to 900px or above, THE Member_Card SHALL display all Secondary_Info immediately without requiring user interaction, regardless of the previous collapsed or expanded state.

### Requirement 4: Stat Grid Layout on xs Viewport

**User Story:** As a player on a phone, I want the stat block to use a predictable grid layout when expanded, so that stats are easy to read without awkward wrapping.

#### Acceptance Criteria

1. WHILE the viewport width is below 600px AND the Collapse_Panel is expanded, THE Stat_Grid SHALL render the 9 stats in a 5-column, 2-row CSS Grid layout where each column occupies an equal fraction of the available grid width (1fr).
2. WHILE the viewport width is below 600px, THE Stat_Grid SHALL place the first 5 stats (Mv, Fv, Sv, S, D) in row 1 columns 1–5, and the remaining 4 stats (A, W, C, I) in row 2 columns 1–4, leaving column 5 of row 2 empty.
3. WHILE the viewport width is below 600px, THE Stat_Grid SHALL display each stat cell with a label above the value, both center-aligned within the cell.
4. WHILE the viewport width is below 600px, THE Stat_Grid SHALL use identical column track sizes across all Member_Cards so that stat columns align vertically when multiple cards are visible.

### Requirement 5: Expand/Collapse State Independence

**User Story:** As a player, I want each member card to expand and collapse independently, so that I can view details for specific members without affecting others.

#### Acceptance Criteria

1. WHEN the user taps the expand toggle on a Member_Card, THE Match_Tracking_Page SHALL reveal that card's full content (stat block, M/W/F controls, equipment, special rules, toolkit items) without changing the collapsed or expanded state of any other Member_Card.
2. WHEN the user taps the expand toggle on an already-expanded Member_Card, THE Match_Tracking_Page SHALL always collapse that card back to showing only Primary_Info.
3. THE Match_Tracking_Page SHALL maintain each Member_Card's expand/collapse state independently using the member's unique memberId as the state key, so that expanding or collapsing one card never mutates the state of another card.
4. WHEN the user toggles a Member_Card's casualty status or modifies XP while the card is expanded, THE Match_Tracking_Page SHALL keep that card in the expanded state.

### Requirement 6: Collapse Animation

**User Story:** As a player, I want smooth expand/collapse transitions, so that the interface feels polished and I can track what is opening or closing.

#### Acceptance Criteria

1. WHEN the Collapse_Panel transitions between collapsed and expanded states, THE Member_Card SHALL animate the height change using MUI Collapse's built-in transition with the default duration.
2. WHEN the Collapse_Panel transitions, THE Expand_Chevron SHALL rotate 180 degrees over 200 milliseconds using a CSS transform transition, pointing down when collapsed and pointing up when expanded.
3. IF the player toggles the Collapse_Panel while a previous transition is still in progress, THEN THE Member_Card SHALL reverse the animation from its current position without jumping or resetting to the start, and SHALL debounce or queue rapid successive toggles to prevent animation flickering.

### Requirement 7: Accessibility of Expand/Collapse Control

**User Story:** As a player using assistive technology, I want the expand/collapse control to be properly announced, so that I can operate it without visual cues.

#### Acceptance Criteria

1. THE Expand_Chevron SHALL have an aria-expanded attribute reflecting the current state of the Collapse_Panel (true when expanded, false when collapsed).
2. THE Expand_Chevron SHALL have an aria-label that includes the member name and reflects the current state (e.g., "Expand details for Aragorn" when collapsed, "Collapse details for Aragorn" when expanded).
3. THE Expand_Chevron SHALL have an aria-controls attribute referencing the id of the associated Collapse_Panel.
4. THE Collapse_Panel content SHALL have an aria-hidden attribute set to true when collapsed and false when expanded.
5. WHEN the user presses Enter or Space while the Expand_Chevron has focus, THE System SHALL toggle the Collapse_Panel between expanded and collapsed states.

### Requirement 8: Equipment and Special Rule Chip Tap-to-View Description

**User Story:** As a player, I want to tap on an equipment chip or special rule chip to see its description, so that I can quickly reference rule text without leaving the match tracking page.

#### Acceptance Criteria

1. WHEN the user taps an Equipment_Chip on a Member_Card, THE Match_Tracking_Page SHALL look up the equipment entry and display a Chip_Detail_Popup with the following content: the equipment description field if present; otherwise, if the equipment entry has a grantsSpecialRules array, the resolved granted special rule labels (one per line); otherwise, a fallback message indicating no description is available.
2. WHEN the user taps a Special_Rule_Chip on a Member_Card, THE Match_Tracking_Page SHALL look up the description from specialRules data by rule ID and display a Chip_Detail_Popup containing that description text. For parameterised rules, the Chip_Detail_Popup SHALL append the parameter context to the description.
3. WHEN the user taps an envenom weapon chip (wargear chip with format `envenom_weapon::<weapon_id>`), THE Match_Tracking_Page SHALL display a Chip_Detail_Popup containing the envenom_weapon equipment description from equipment data.
4. THE Chip_Detail_Popup SHALL render as an MUI Popover anchored to the tapped chip element, displaying the item or rule label as a heading and the description text as body content.
5. WHEN the user taps outside the Chip_Detail_Popup or presses Escape, THE Match_Tracking_Page SHALL dismiss the Chip_Detail_Popup.
6. THE Chip_Detail_Popup SHALL reposition to remain fully within the visible viewport when the default anchored position would cause overflow.
7. IF the description text for a tapped chip is empty or unavailable and the equipment entry has no grantsSpecialRules, THEN THE Chip_Detail_Popup SHALL display the label with a fallback message indicating no description is available.
8. WHEN the user taps a chip while a Chip_Detail_Popup is already open, THE Match_Tracking_Page SHALL dismiss the existing popup before displaying the new Chip_Detail_Popup for the newly tapped chip.
9. WHEN the user presses Enter or Space while an Equipment_Chip or Special_Rule_Chip has keyboard focus, THE Match_Tracking_Page SHALL display the Chip_Detail_Popup with the same content display rules as mouse tapping, including description lookup, grantsSpecialRules resolution, and fallback message behavior.

### Requirement 9: Envenom Weapon Display as Wargear Chip

**User Story:** As a player, I want envenomed weapons to display as wargear chips labeled "Envenom Weapon (weapon name)" in the equipment area, so that the presentation matches the MemberDetailsDrawer and avoids redundant special rule entries.

#### Acceptance Criteria

1. WHEN a member has an Envenom_Weapon_Rule in their special rules data, THE Match_Tracking_Page SHALL synthesize a wargear entry with format `envenom_weapon::<weapon_id>` and render it as an Equipment_Chip in the wargear/equipment chip area of the Member_Card.
2. WHEN a member has an Envenom_Weapon_Rule in their special rules data, THE Match_Tracking_Page SHALL filter out the corresponding `poisoned_attacks` parameterised entry from the special rules chip display entirely.
3. THE Equipment_Chip for an envenom weapon entry SHALL display the label resolved by getWargearLabel, which produces "Envenom Weapon (weapon_label)" where weapon_label is the resolved wargear label for the parameterised weapon.
4. WHEN the Envenom_Weapon_Rule parameter field references a weapon identifier not found in wargear data, THE Equipment_Chip SHALL automatically display "Envenom Weapon (humanised_weapon_id)" using title-cased, space-separated formatting of the parameter field value as a fallback, as getWargearLabel already provides this behavior.
5. WHEN the user taps an envenom weapon Equipment_Chip, THE Chip_Detail_Popup SHALL display the heading "Envenom Weapon (weapon_label)" and the description text of the envenom_weapon equipment entry from equipment data.
