# Requirements Document

## Introduction

Add a "Buyback" tab to CompanyDetailsPage, positioned to the right of the existing Store tab. Buyback lets users revert accidental wargear or equipment removals. Additionally, fix layout: on small screens the four tab icons must share equal space across the full width, and on all screens the stats bar (Rating/Influence/Record/Members) and tabs row must be horizontally centered.

## Glossary

- **Buyback_Tab**: Fourth tab in CompanyDetailsPage, placed after Store, showing removable item history and allowing repurchase
- **Removal_Log**: Array stored on the Company model tracking each wargear or equipment removal with enough data to restore it
- **Stats_Bar**: Horizontal row displaying Rating, Influence, Record, and Members above the tabs
- **Tab_Bar**: Row of navigation tabs (Roster, History, Store, Buyback) below the Stats_Bar
- **Member**: A company member (hero or warrior) who owns wargear and equipment
- **Wargear**: Combat items assigned via equipment array on Member
- **Equipment**: Non-combat items stored in ownedEquipment array on Member

## Requirements

### Requirement 1: Removal Log Data Model

**User Story:** As a player, I want removals tracked so that I can undo accidental deletions later.

#### Acceptance Criteria

1. THE Company model SHALL include a `removalLog` array field storing removal entries, with a maximum of 200 entries retained (oldest entries discarded first when limit exceeded)
2. WHEN a wargear item is removed from a Member, THE System SHALL append an entry to `removalLog` containing the member ID, member name, item ID, item type ("wargear"), and removal timestamp in ISO 8601 format
3. WHEN an equipment item is removed from a Member, THE System SHALL append an entry to `removalLog` containing the member ID, member name, item ID, item type ("equipment"), and removal timestamp in ISO 8601 format
4. WHEN an envenom_weapon is removed from a Member, THE System SHALL append an entry to `removalLog` containing the member ID, member name, item ID, item type ("equipment"), the associated poisoned_attacks special rule parameter (weapon ID string), and removal timestamp in ISO 8601 format

### Requirement 2: Buyback Tab Placement

**User Story:** As a player, I want a Buyback tab next to Store so that I can quickly find undo options.

#### Acceptance Criteria

1. THE Tab_Bar SHALL display four tabs in order: Roster, History, Store, Buyback
2. THE Buyback_Tab SHALL use an icon unique among the tab bar icons and the label "Buyback" visible only on viewports at or above the sm breakpoint (≥600px)
3. WHEN the Buyback_Tab is selected, THE System SHALL display the buyback content panel and visually indicate the Buyback_Tab as the active tab
4. WHEN any tab is selected, THE System SHALL hide the content panels of all other tabs so that only one tab content panel is visible at a time

### Requirement 3: Buyback Tab Content

**User Story:** As a player, I want to see removed items and restore them so that I can fix mistakes.

#### Acceptance Criteria

1. THE Buyback_Tab SHALL display a list of all entries in the company's `removalLog`, grouped by member name in alphabetical order, with entries within each group sorted by removal date descending (newest first)
2. WHEN no removal entries exist, THE Buyback_Tab SHALL display an empty-state message indicating no items available for buyback
3. WHEN a removal entry exists, THE Buyback_Tab SHALL show the item label, item type, member name, and removal date formatted as a relative time string (e.g., "2 days ago") for each entry
4. THE Buyback_Tab SHALL provide a restore button for each removal entry; WHEN the removalLog is empty, THE Buyback_Tab SHALL show no restore buttons

### Requirement 4: Restore Action

**User Story:** As a player, I want to restore a removed item to the original member so that the accidental removal is fully reverted.

#### Acceptance Criteria

1. WHEN the restore button is activated for a removal entry with item type "wargear", THE System SHALL append the item ID back to the original Member's equipment array
2. WHEN the restore button is activated for a removal entry with item type "equipment", THE System SHALL append the item ID back to the original Member's ownedEquipment array
3. WHEN an envenom_weapon entry is restored, THE System SHALL append "envenom_weapon" to the Member's ownedEquipment array and add a poisoned_attacks special rule entry with the weapon parameter stored in the removal entry
4. WHEN a restore completes successfully (all system constraints satisfied: member exists, equipment capacity not exceeded), THE System SHALL remove the corresponding entry from `removalLog` and update the Buyback_Tab list within 1 second
5. IF the original Member no longer exists in the company members array, THEN THE System SHALL disable the restore button for that entry and display an inline message below the entry indicating the member is no longer available
6. IF the restore would exceed the Member's equipment capacity (1 large item and 1 small item, or 4 small items with backpack), THEN THE System SHALL disable the restore button and display an inline message indicating insufficient capacity

### Requirement 5: Match Completion Clearing

**User Story:** As a player, I want the buyback log cleared after a match completes so that only recent between-match removals are available for undo.

#### Acceptance Criteria

1. WHEN the user advances from MatchTrackingPage to PostMatchSummaryPage, THE System SHALL clear the company's `removalLog` array (set to empty) before navigating
2. THE Buyback_Tab SHALL display a persistent informational message (visible whether or not entries exist) communicating that the buyback log is cleared upon match completion, so users understand the time-limited nature of the undo window

### Requirement 6: Small Screen Tab Layout

**User Story:** As a mobile user, I want tabs evenly spaced across the full width so that all four icons are easy to tap.

#### Acceptance Criteria

1. WHILE the viewport is below the `sm` breakpoint (below 600px), THE Tab_Bar SHALL distribute all four tab icons with equal width (each tab occupying 25% of container width) spanning the full container width
2. WHILE the viewport is below the `sm` breakpoint (below 600px), THE Tab_Bar SHALL display only icons without text labels, providing an accessible name (aria-label) matching the hidden label text for each tab
3. WHILE the viewport is below the `sm` breakpoint, THE Tab_Bar SHALL maintain a minimum tap-target height of 44px for each tab icon

### Requirement 7: Stats Bar and Tab Bar Centering

**User Story:** As a user, I want the stats and tabs visually centered so that the layout looks balanced on all screen sizes.

#### Acceptance Criteria

1. THE Stats_Bar SHALL horizontally center its group of stat items within the full-width container so that equal space appears on the left and right of the stat item group on all viewport widths
2. THE Tab_Bar SHALL horizontally center its tab items within the full-width container so that equal space appears on the left and right of the tab item group on all viewport widths
3. WHILE the viewport is below the sm breakpoint (600px), THE Stats_Bar SHALL arrange stat items in a 2-column grid that is itself horizontally centered within the container
