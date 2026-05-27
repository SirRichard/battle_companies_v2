# Requirements Document

## Introduction

Enhancements to the Against the Odds (ATO) Toolkit bonus flow. Covers five areas: kit info popup showing item details, Dwarven Brew auto-use logic for temporary kit items with courage bonus reflected in match stats, permanent Dwarven Brew manual use flow with intelligence test and potential removal, duplicate item assignment prevention (including permanent ownership conflicts), and dynamic proceed button labelling based on whether the wanderer screen follows kit assignment.

## Glossary

- **Toolkit_Assignment_Page**: The page (`ToolkitAssignmentPage.tsx`) where users select a kit and assign items to company members before a match.
- **Match_Tracking_Page**: The page (`MatchTrackingPage.tsx`) displaying live member stats and toolkit items during an active match.
- **Kit**: A predefined collection of temporary equipment items selectable via the ATO Toolkit bonus (defined in `TOOLKIT_KITS`).
- **Kit_Item**: A single equipment or wargear entry within a Kit, temporarily assigned to a member for one match.
- **Dwarven_Brew**: An equipment item (`dwarven_brew`) that grants +1 Courage to all friendly models for the remainder of the game when used.
- **Temporary_Item**: A Kit_Item assigned from a Kit for a single match only, removed after the match ends.
- **Permanent_Item**: An equipment item owned by a member via `member.ownedEquipment`, persisting across matches.
- **Member**: A company member eligible to receive Kit_Item assignments.
- **Info_Dialog**: A modal popup displaying the full list of items in a Kit with their descriptions.
- **Duplicate_Item**: A Kit_Item that appears more than once in the same Kit's item list.
- **Wanderer_Selection_Page**: The page shown after toolkit assignment when the wanderer ATO bonus is also selected.
- **Intelligence_Test**: A D6 roll against the model's Intelligence stat value. The roll succeeds if the result meets or exceeds the Intelligence value; otherwise it fails.

## Requirements

### Requirement 1: Kit Information Dialog

**User Story:** As a player, I want to view detailed information about all items in a kit before selecting it, so that I can make an informed decision about which kit to choose.

#### Acceptance Criteria

1. WHEN a Kit is displayed on the Toolkit_Assignment_Page, THE Toolkit_Assignment_Page SHALL render an information button adjacent to each Kit option.
2. WHEN the information button for a Kit is pressed, THE Toolkit_Assignment_Page SHALL display an Info_Dialog containing the name and description of every unique item in that Kit.
3. WHILE the Info_Dialog is open, THE Info_Dialog SHALL list each unique item once with its quantity if the item appears more than once in the Kit.
4. WHEN an item in the Info_Dialog has no description field in the data source, THE Info_Dialog SHALL display the item name with its granted special rules or a fallback indicator.
5. WHEN the user dismisses the Info_Dialog, THE Toolkit_Assignment_Page SHALL close the dialog and return focus to the kit selection area.

### Requirement 2: Dwarven Brew Auto-Use for Temporary Kit Items

**User Story:** As a player, I want the temporary Dwarven Brew from a kit to be automatically applied at match start without requiring an intelligence test, so that I receive the courage bonus without manual intervention for an item that will be discarded after the match anyway.

#### Acceptance Criteria

1. WHEN a Temporary_Item with id `dwarven_brew` is assigned to a Member via the Toolkit_Assignment_Page, THE Match_Tracking_Page SHALL automatically apply a +1 Courage bonus to all company members at match start.
2. WHILE the Dwarven_Brew courage bonus is active from a Temporary_Item, THE Match_Tracking_Page SHALL reflect the +1 Courage increase in each member's displayed Courage stat.
3. WHEN the Dwarven_Brew is a Temporary_Item, THE Match_Tracking_Page SHALL skip the intelligence test contingency because the item is discarded after the match regardless.
4. WHEN a Member owns a Permanent_Item `dwarven_brew` (via `ownedEquipment`), THE Match_Tracking_Page SHALL NOT auto-use it and SHALL present the standard manual use flow with intelligence test.

### Requirement 3: Duplicate Item Assignment Prevention

**User Story:** As a player, I want the system to prevent assigning more than one copy of the same kit item to a single member, so that items are distributed fairly across the company.

#### Acceptance Criteria

1. WHEN a Kit contains Duplicate_Items, THE Toolkit_Assignment_Page SHALL prevent assigning more than one instance of the same item to the same Member.
2. WHEN a Member already has a Permanent_Item matching a Kit_Item id (via `ownedEquipment`), THE Toolkit_Assignment_Page SHALL prevent assigning that Kit_Item to that Member.
3. WHEN a Member is ineligible for a Kit_Item due to duplicate or permanent ownership conflict, THE Toolkit_Assignment_Page SHALL display that Member as disabled in the assignment dropdown with a reason message.
4. WHEN all instances of a Duplicate_Item have been assigned, THE Toolkit_Assignment_Page SHALL allow reassignment by clearing a previous assignment and selecting a different Member.

### Requirement 4: Dynamic Proceed Button Label

**User Story:** As a player, I want the proceed button after kit assignment to indicate whether I will go to the wanderer selection screen or directly begin the match, so that I know what to expect next.

#### Acceptance Criteria

1. WHEN the wanderer ATO bonus is also selected alongside the toolkit bonus, THE Toolkit_Assignment_Page SHALL display the proceed button with label "Next: Choose Wanderer →".
2. WHEN the wanderer ATO bonus is not selected, THE Toolkit_Assignment_Page SHALL display the proceed button with label "Begin Battle".
3. WHEN the proceed button label changes due to ATO bonus state, THE Toolkit_Assignment_Page SHALL update the label without requiring a page reload.

### Requirement 5: Permanent Dwarven Brew Manual Use Flow

**User Story:** As a player who permanently owns a Dwarven Brew, I want to be able to elect to use it at the start of a match with the proper intelligence test contingency, so that the game rules are correctly enforced and the item is removed if the keg runs dry.

#### Acceptance Criteria

1. WHEN a Member owns a Permanent_Item `dwarven_brew` AND a match begins, THE Match_Tracking_Page SHALL present a prompt allowing the player to elect whether to use the Dwarven Brew for this game.
2. WHEN the player elects to use the permanent Dwarven_Brew, THE Match_Tracking_Page SHALL apply a +1 Courage bonus to all company members for the remainder of the game.
3. WHILE the permanent Dwarven_Brew courage bonus is active, THE Match_Tracking_Page SHALL reflect the +1 Courage increase in each member's displayed Courage stat (identical to the temporary bonus display).
4. WHEN the player elects to use the permanent Dwarven_Brew, THE Match_Tracking_Page SHALL prompt the player to take an Intelligence_Test (roll D6 against the owning model's Intelligence stat).
5. WHEN the Intelligence_Test fails (roll < Intelligence value), THE Match_Tracking_Page SHALL mark the Dwarven Brew for removal from the owning Member's equipment at the end of the match.
6. WHEN the Intelligence_Test succeeds (roll >= Intelligence value), THE Match_Tracking_Page SHALL retain the Dwarven Brew in the owning Member's equipment.
7. WHEN the player declines to use the permanent Dwarven_Brew, THE Match_Tracking_Page SHALL NOT apply any courage bonus and SHALL retain the item in the Member's equipment.
