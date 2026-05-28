# Requirements Document

## Introduction

Responsive layout improvements for the CompanyDetailsPage to ensure usable, visually balanced rendering on narrow (xs, <600px) screens. The page currently uses flex-wrap and fixed-width patterns that produce uneven layouts, clipped text, and obscured content on small phones. These requirements address six specific areas: stats bar, tab labels, wargear chip overflow, store section buttons, FAB clearance padding, and wanderer inline stats.

## Glossary

- **Stats_Bar**: The horizontal bar below the page header displaying Rating, Influence, Record, and Members statistics.
- **Tab_Strip**: The MUI Tabs component containing Roster, History, and Store navigation tabs.
- **MemberRow**: A clickable card component rendering a single company member's name, role, wargear chips, and rating.
- **Wargear_Chip**: A small MUI Chip displaying a single piece of wargear/equipment on a MemberRow.
- **Store_Section_Buttons**: The six category buttons (Reinforce, Wargear, Equipment, Creatures, Wanderers, Injuries) in the Store tab.
- **FAB**: The fixed-position floating action button ("Start Match") at the bottom-right of the viewport.
- **Wanderer_Stat_Line**: The inline typography element showing a wanderer's combat stats (Mv, F, S, D, A, W, C) in the roster tab.
- **xs_breakpoint**: MUI breakpoint for viewports 0–599px wide.
- **sm_breakpoint**: MUI breakpoint for viewports 600px and wider.

## Requirements

### Requirement 1: Stats Bar Responsive Grid

**User Story:** As a player on a narrow phone, I want the stats bar to display in a balanced 2×2 grid, so that all four stats are evenly sized and readable without awkward wrapping.

#### Acceptance Criteria

1. WHILE the viewport is at xs_breakpoint (0–599px), THE Stats_Bar SHALL render its four stat items in a 2-column, 2-row grid layout with equal column widths (each column occupying 50% of available width), ordered left-to-right then top-to-bottom as: Rating, Influence (first row), Record, Members (second row).
2. WHILE the viewport is at sm_breakpoint (600px or wider), THE Stats_Bar SHALL render its four stat items in a single horizontal row using zero-based positional indexing: Rating=0, Influence=1, Record=2, Members=3.
3. THE Stats_Bar SHALL display all four stat items (Rating, Influence, Record, Members) with their labels and values fully visible without text truncation or overflow at viewport widths from 320px upward.
4. WHILE the viewport is at xs_breakpoint, THE Stats_Bar SHALL NOT use flex-wrap–based flowing layout for its stat items (to prevent uneven row distribution such as 3+1 splits).

### Requirement 2: Tab Strip Icon-Only on Narrow Screens

**User Story:** As a player on a narrow phone, I want the tab labels to show only icons, so that the tabs fit comfortably without text being squeezed by the decorative font.

#### Acceptance Criteria

1. WHILE the viewport is at xs_breakpoint (0–599px), THE Tab_Strip SHALL display only the icon for each tab and hide the text label, while providing an accessible name (aria-label) matching the hidden label text for each tab.
2. WHILE the viewport is at sm_breakpoint (600px or wider), THE Tab_Strip SHALL display both the icon and the text label for each tab with iconPosition="start".
3. THE Tab_Strip SHALL render each tab icon at 1rem (16px) and maintain a minimum tap-target height of 44px at all breakpoints.
4. WHEN a tab is selected, THE Tab_Strip SHALL apply the active indicator (bottom border bar colored primary.main and tab text/icon colored primary.main) identically regardless of whether the text label is visible.
5. WHEN the viewport crosses the 600px boundary, THE Tab_Strip SHALL transition between icon-only and icon-plus-label modes without causing a visible layout shift in surrounding content.

### Requirement 3: MemberRow Wargear Chip Collapse

**User Story:** As a player on a narrow phone, I want wargear chips to collapse after three items with a "+N more" indicator, so that member cards stay compact and scannable.

#### Acceptance Criteria

1. WHILE the viewport is at xs_breakpoint, THE MemberRow SHALL display only the first three Wargear_Chips in source order (heroes: baseWargear then purchased equipment order; warriors: loadout-option equipment order).
2. WHILE the viewport is at xs_breakpoint AND a member has more than three wargear items, THE MemberRow SHALL display a "+N more" Chip (matching existing chip dimensions of fontSize 0.6rem and height 20) where N equals the count of hidden chips.
3. WHILE the viewport is at sm_breakpoint or wider, THE MemberRow SHALL display all Wargear_Chips without truncation.
4. THE MemberRow SHALL preserve the full wargear list in the member details drawer regardless of viewport width.

### Requirement 4: Store Section Buttons Grid Layout

**User Story:** As a player on a narrow phone, I want the store section buttons to display in a balanced 3×2 grid, so that no orphaned button appears on a row by itself.

#### Acceptance Criteria

1. WHILE the viewport is at xs_breakpoint, THE Store_Section_Buttons SHALL render in a 3-column, 2-row grid layout (or flex-wrap producing the same 3×2 visual arrangement) with equal column widths and a gap of 4px between cells.
2. WHILE the viewport is at sm_breakpoint or wider, THE Store_Section_Buttons SHALL render using flex-wrap layout with minimum button width of 68px and a gap of 4px between items.
3. THE Store_Section_Buttons SHALL maintain a minimum tap target height of 44px, preserve the selected-state visual indicator (highlighted border and background), and display the same label text at all breakpoints.
4. IF the viewport transitions between xs_breakpoint and sm_breakpoint, THEN THE Store_Section_Buttons SHALL switch layout without losing the currently selected section state.

### Requirement 5: History and Store Tab FAB Clearance

**User Story:** As a player scrolling the History or Store tab, I want bottom padding so that the floating Start Match button does not obscure the last items of content.

#### Acceptance Criteria

1. WHEN the History tab contains match history entries, THE History tab content container SHALL apply a bottom padding of at least 80px (MUI spacing pb: 10) to prevent the fixed-position FAB from overlapping the last visible item.
2. THE Store tab content container SHALL apply a bottom padding of at least 80px (MUI spacing pb: 10) to prevent the fixed-position FAB from overlapping the last visible item.
3. THE Roster tab SHALL retain its existing bottom padding of pb: 10 unchanged.
4. IF the History tab has no match history entries (empty state), THEN THE History tab SHALL explicitly prevent bottom padding (pb: 0) beyond its existing centered layout.

### Requirement 6: Wanderer Stats Mini Grid on Narrow Screens

**User Story:** As a player on a narrow phone, I want the wanderer's inline stats to display as a compact grid instead of a pipe-separated string, so that the stats wrap gracefully and remain readable.

#### Acceptance Criteria

1. WHILE the viewport is at xs_breakpoint (0–599px), THE Wanderer_Stat_Line SHALL render the 7 stats (Mv, F, S, D, A, W, C) in a grid layout with no more than 5 columns per row, allowing remaining cells to wrap to a second row.
2. WHILE the viewport is at sm_breakpoint (600px or wider), THE Wanderer_Stat_Line SHALL render stats in the existing inline pipe-separated format as a single Typography element.
3. THE Wanderer_Stat_Line SHALL display identical stat values and labels (Mv, F, S, D, A, W, C) at all breakpoints, with no stat omitted or added based on viewport size.
4. WHILE the viewport is at xs_breakpoint, THE Wanderer_Stat_Line grid layout SHALL use the same grid structure as the wanderer detail dialog stat grid (display: grid, gridTemplateColumns: repeat(5, 1fr), centered text with label above value).
5. WHEN the Wanderer_Stat_Line renders in grid layout, THE system SHALL display each stat cell with the abbreviated label (e.g., "Mv", "F", "S") above the numeric value, matching the font sizing and opacity pattern used in the wanderer detail dialog stat cells.
