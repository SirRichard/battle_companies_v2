# Bugfix Requirements Document

## Introduction

The Battle Companies companion app's layout and components do not adapt properly to different screen sizes. On mobile devices, content overflows, stat grids become unreadable, and the multi-step wizard stepper is cramped. On tablets, the narrow max-width containers leave excessive unused space. On desktop, the app is confined to a narrow column without taking advantage of available screen real estate. This fix ensures the app is usable and visually appropriate across mobile (< 600px), tablet (600–900px), and desktop (> 900px) viewports.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the viewport width is below 400px THEN the system renders the 9-column stat grid (MatchTrackingPage, MemberDetailsDrawer) with columns too narrow to read, causing text to overflow or truncate

1.2 WHEN the viewport width is below 600px THEN the system renders the 8-step wizard Stepper with `alternativeLabel` in a single horizontal row, causing step labels to overlap or become unreadable

1.3 WHEN the viewport width is below 600px THEN the system renders MemberRow in CompanyDetailsPage with hero stats, role chip, wargear chips, and rating badge all in a single flex row, causing horizontal overflow or content being pushed off-screen

1.4 WHEN the viewport width is below 600px THEN the system renders the MatchTrackingPage MemberMatchCard with the full stat block, M/W/F controls, XP counter, and casualty button in layouts that do not stack or reflow, causing cramped and unusable controls

1.5 WHEN the viewport width is between 600px and 900px (tablet) THEN the system constrains page content to maxWidth of 560–700px without adapting the layout to use available space effectively

1.6 WHEN the viewport width is above 900px (desktop) THEN the system does not provide a wider content area or multi-column layout, leaving large amounts of unused screen space on either side

1.7 WHEN the viewport width is below 360px THEN the system renders fixed-position elements (FAB "Start Match" button, sticky navigation footer) that overlap with page content or extend beyond the viewport edge

1.8 WHEN the viewport width is below 600px THEN the system renders the History tab's match detail expanded view with metadata items at fixed `minWidth: 100` that cause horizontal overflow within the card

### Expected Behavior (Correct)

2.1 WHEN the viewport width is below 400px THEN the system SHALL render the stat grid in a wrapped or two-row layout so that each stat cell remains readable (minimum ~32px wide) without overflow

2.2 WHEN the viewport width is below 600px THEN the system SHALL render the wizard progress indicator in a compact form (e.g., showing only step numbers, a linear progress bar, or a condensed horizontal stepper without labels) that fits within the viewport without overlap

2.3 WHEN the viewport width is below 600px THEN the system SHALL reflow MemberRow content by stacking secondary information (wargear chips, hero stats, rating) below the primary name/role line, preventing horizontal overflow

2.4 WHEN the viewport width is below 600px THEN the system SHALL stack or reflow the MatchTrackingPage MemberMatchCard sections vertically so that stat blocks, M/W/F controls, XP counters, and action buttons are all accessible without horizontal scrolling

2.5 WHEN the viewport width is between 600px and 900px (tablet) THEN the system SHALL increase content maxWidth to utilize more of the available viewport (e.g., 90% width or ~800px max) and adjust spacing proportionally

2.6 WHEN the viewport width is above 900px (desktop) THEN the system SHALL expand content areas to a wider maxWidth (e.g., 960–1100px) and MAY use multi-column layouts where appropriate (e.g., roster list alongside member details)

2.7 WHEN the viewport width is below 360px THEN the system SHALL ensure fixed-position elements (FAB, sticky footers) remain fully visible within the viewport and do not overlap critical content, using reduced sizing or repositioning as needed

2.8 WHEN the viewport width is below 600px THEN the system SHALL render the History tab's match detail metadata in a wrapping layout where items reflow to new lines rather than overflowing horizontally

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the viewport width is between 375px and 600px (standard mobile) THEN the system SHALL CONTINUE TO display all existing page content, navigation, and interactive elements without removing any functionality

3.2 WHEN the viewport width is any supported size THEN the system SHALL CONTINUE TO apply the existing dark theme, gold accent colors, Cinzel Decorative headings, and IM Fell English body typography without alteration

3.3 WHEN the user interacts with the wizard stepper at any viewport size THEN the system SHALL CONTINUE TO support backward navigation to visited steps and forward progression with the same validation rules

3.4 WHEN the user taps a MemberRow at any viewport size THEN the system SHALL CONTINUE TO open the MemberDetailsDrawer with full member information

3.5 WHEN the user is on the MatchTrackingPage at any viewport size THEN the system SHALL CONTINUE TO support XP increment/decrement, casualty toggling, M/W/F tracking, and the End Match flow without loss of functionality

3.6 WHEN the viewport width is any supported size THEN the system SHALL CONTINUE TO render Framer Motion animations (slide transitions, fade-ins, stagger effects) for page and component transitions

3.7 WHEN the user accesses the app on any device THEN the system SHALL CONTINUE TO use MUI's existing component library (Box, Typography, Chip, Button, Drawer, etc.) without introducing additional CSS frameworks or layout libraries
