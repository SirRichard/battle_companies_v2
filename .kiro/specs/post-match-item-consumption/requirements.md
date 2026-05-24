# Requirements Document

## Introduction

Post-match item consumption logic for Wondrous Cram and Healing Herbs equipment items. These items have effects that trigger at end of game based on casualty status. Temporary (toolkit-assigned) versions auto-consume; permanent (owned) versions prompt user for confirmation. Items must not be usable during battle but remain visible in member's item list.

## Glossary

- **Post_Match_System**: The post-match processing flow (PostMatchSummaryPage) that handles injuries, progression, and influence after a match ends
- **Match_Tracking_System**: The active match screen (MatchTrackingPage) where battles are tracked in real-time
- **Wondrous_Cram**: Equipment item that, when consumed at end of game where bearer was removed as casualty, skips injury roll and grants automatic Full Recovery
- **Healing_Herbs**: Equipment item that, when consumed at end of game where bearer was NOT removed as casualty, grants all company members +1 to their injury rolls
- **Temporary_Item**: An item assigned via the Toolkit ATO bonus for a single match only (discarded after match)
- **Permanent_Item**: An item owned by a member on their equipment roster (persists between matches)
- **Casualty**: A member marked as removed from play during the match
- **Injury_Roll**: The 2D6 roll made during post-match to determine casualty fate


## Requirements

### Requirement 1: Block Battle-Time Consumption

**User Story:** As a player, I want Wondrous Cram and Healing Herbs to be non-consumable during battle, so that they cannot be accidentally used at the wrong time.

#### Acceptance Criteria

1. WHILE a match is active, THE Match_Tracking_System SHALL display Wondrous Cram as a non-interactive item chip (not a "Use" button) among member's toolkit items
2. WHILE a match is active, THE Match_Tracking_System SHALL display Healing Herbs as a non-interactive item chip (not a "Use" button) among member's toolkit items
3. THE Match_Tracking_System SHALL treat Wondrous Cram and Healing Herbs as non-consumable for purposes of the toolkit "Use" interaction regardless of their `consumable` field in data

### Requirement 2: Wondrous Cram Post-Match Effect

**User Story:** As a player, I want Wondrous Cram to automatically grant Full Recovery when used on a casualty at end of game, so that I can protect my members from injury rolls.

#### Acceptance Criteria

1. WHEN post-match processing begins and a casualty member has Wondrous Cram (permanent or temporary), THE Post_Match_System SHALL identify that member as eligible for Wondrous Cram consumption
2. WHEN Wondrous Cram is consumed for a casualty member, THE Post_Match_System SHALL skip the injury roll for that member and apply the Full Recovery result automatically
3. WHEN a member was NOT removed as a casualty, THE Post_Match_System SHALL NOT offer or trigger Wondrous Cram consumption for that member
4. WHEN Wondrous Cram is consumed from a permanent equipment slot, THE Post_Match_System SHALL remove Wondrous Cram from that member's owned equipment

### Requirement 3: Healing Herbs Post-Match Effect

**User Story:** As a player, I want Healing Herbs to grant +1 to all company injury rolls when used by a non-casualty hero, so that my company has better survival odds.

#### Acceptance Criteria

1. WHEN post-match processing begins and a hero member has Healing Herbs (permanent or temporary) and was NOT removed as a casualty, THE Post_Match_System SHALL identify that hero as eligible for Healing Herbs consumption
2. WHEN Healing Herbs is consumed, THE Post_Match_System SHALL apply a +1 modifier to all injury rolls for all casualties in the company during that post-match phase; this modifier is NOT cumulative (maximum +1 regardless of how many Healing Herbs are consumed)
3. WHEN a hero member WAS removed as a casualty, THE Post_Match_System SHALL NOT offer or trigger Healing Herbs consumption for that hero
4. WHEN Healing Herbs is consumed, THE Post_Match_System SHALL always remove Healing Herbs from that hero's equipment (no retention roll)


### Requirement 4: Temporary Item Auto-Consumption

**User Story:** As a player, I want temporary (toolkit-assigned) versions of these items to be used automatically without prompting, so that the post-match flow is streamlined for disposable items.

#### Acceptance Criteria

1. WHEN a temporary Wondrous Cram is assigned to a member who was removed as a casualty, THE Post_Match_System SHALL automatically consume it without prompting the user
2. WHEN temporary Healing Herbs are assigned to a hero who was NOT removed as a casualty, THE Post_Match_System SHALL automatically consume them without prompting the user
3. THE Post_Match_System SHALL discard temporary items after consumption (toolkit items are single-use by nature)

### Requirement 5: Permanent Item User Prompt

**User Story:** As a player, I want to be prompted before permanent versions of these items are consumed, so that I can choose to save them for a future match.

#### Acceptance Criteria

1. WHEN a permanent Wondrous Cram is available on a casualty member, THE Post_Match_System SHALL display a prompt asking the user whether to consume the item
2. WHEN permanent Healing Herbs are available on a non-casualty hero, THE Post_Match_System SHALL display a prompt asking the user whether to consume the item
3. IF the user declines consumption, THEN THE Post_Match_System SHALL retain the item on the member's equipment and proceed with normal post-match processing (injury roll without modification)
4. IF the user accepts consumption, THEN THE Post_Match_System SHALL apply the item's effect and handle removal per Requirements 2 and 3

### Requirement 6: Item Visibility During Battle

**User Story:** As a player, I want to see Wondrous Cram and Healing Herbs listed among a member's items during battle, so that I know which members carry them.

#### Acceptance Criteria

1. THE Match_Tracking_System SHALL display Wondrous Cram in the member's equipment/toolkit section during an active match
2. THE Match_Tracking_System SHALL display Healing Herbs in the member's equipment/toolkit section during an active match
3. THE Match_Tracking_System SHALL visually distinguish these items from usable consumables (no "Use" button, displayed as passive item chips)

### Requirement 7: Post-Match Consumption Ordering

**User Story:** As a player, I want item consumption to happen before injury rolls, so that Wondrous Cram can skip the roll and Healing Herbs can modify remaining rolls.

#### Acceptance Criteria

1. THE Post_Match_System SHALL resolve all Wondrous Cram consumption (removing eligible members from the injury roll queue) before any injury rolls begin
2. THE Post_Match_System SHALL resolve all Healing Herbs consumption (determining the +1 modifier) before any injury rolls begin
3. WHEN both Wondrous Cram and Healing Herbs are eligible in the same post-match, THE Post_Match_System SHALL process Wondrous Cram first (to remove members from injury queue), then Healing Herbs (to apply modifier to remaining casualties)
