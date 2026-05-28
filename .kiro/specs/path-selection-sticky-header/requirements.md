# Requirements Document

## Introduction

On the StepPathSelection step of the company creation wizard, users on small viewports (below 900px) lose sight of which hero they are choosing a path for and which path they are currently viewing when scrolled into the path card content. This feature compresses the hero member details and path carousel navigation into a sticky header that remains pinned at the top of the visible area, below the existing PageHeader, so context is never lost during scrolling.

The core technical challenge is that `position: sticky` has been attempted inside PathCardSelector but does not work due to the DOM hierarchy — specifically the `overflowX: 'clip'` on the step content container and the AnimatePresence/motion.div wrappers which create containing blocks that prevent sticky from escaping to the viewport scroll context. The solution must either restructure the DOM to allow sticky to function, or use an alternative approach (e.g., fixed-position overlay rendered via a React portal).

## Glossary

- **Sticky_Header**: A condensed UI bar containing hero info and path navigation that remains pinned below the PageHeader on viewports below the md breakpoint
- **PageHeader**: The existing top-level sticky navigation bar (`position: sticky`, `top: 0`, `zIndex: 10`, `minHeight: 64px`)
- **PathCardSelector**: The shared swipeable path card carousel component used by StepPathSelection
- **StepPathSelection**: The wizard step where users choose a hero advancement path
- **Step_Content_Container**: The flex-1 Box in CreateCompanyPage that wraps step content with `overflowX: 'clip'`
- **Hero_Info_Line**: A condensed single line showing hero name, role, and unit type
- **Path_Nav_Line**: A condensed single line showing left arrow, path name, counter ("X of Y"), and right arrow
- **md_breakpoint**: MUI default breakpoint at 900px viewport width
- **Portal**: A React mechanism to render a component outside its parent DOM hierarchy

## Requirements

### Requirement 1: Sticky Header Visibility on Small Viewports

**User Story:** As a user on a small screen, I want the hero info and path navigation to stay visible at the top of the screen while I scroll through path card content, so that I always know which hero I am choosing for and which path I am viewing.

#### Acceptance Criteria

1. WHILE the viewport width is below the md_breakpoint (900px) AND the user is on the StepPathSelection step, THE Sticky_Header SHALL remain pinned visually below the PageHeader at a vertical offset equal to the PageHeader height (64px)
2. WHILE the viewport width is at or above the md_breakpoint (≥ 900px), THE Sticky_Header SHALL NOT be rendered; the existing static layout SHALL display instead (the breakpoint boundary itself is treated as "large" viewport)
3. WHEN the user scrolls the step content, THE Sticky_Header SHALL remain fixed in its pinned position without scrolling away

### Requirement 2: Sticky Header Content — Hero Info Line

**User Story:** As a user, I want to see a condensed summary of the hero I am choosing a path for, so that I can confirm I am on the correct hero without scrolling back up.

#### Acceptance Criteria

1. THE Hero_Info_Line SHALL display the hero name, role label, unit type label, and equipment names in a single condensed inline format (e.g., "Aragorn · Leader · Ranger · Sword, Bow")
2. THE Hero_Info_Line format SHALL differ from the static (non-sticky) header layout; reformatting for compactness is acceptable and expected
3. IF the combined Hero_Info_Line text exceeds the available width, THEN THE Hero_Info_Line SHALL use horizontal scrolling or selective truncation rather than aggressive single-point ellipsis truncation

### Requirement 3: Sticky Header Content — Path Navigation Line

**User Story:** As a user, I want to navigate between paths from the sticky header, so that I can browse paths without scrolling to the top.

#### Acceptance Criteria

1. THE Path_Nav_Line SHALL display a left arrow button, the current path name, a counter in the format "X of Y", and a right arrow button
2. WHEN the user taps the left arrow in the Path_Nav_Line, THE PathCardSelector SHALL navigate to the previous path card
3. WHEN the user taps the right arrow in the Path_Nav_Line, THE PathCardSelector SHALL navigate to the next path card
4. WHEN the current path is the first path, THE Path_Nav_Line SHALL disable the left arrow button
5. WHEN the current path is the last path, THE Path_Nav_Line SHALL disable the right arrow button

### Requirement 4: DOM Structure Compatibility

**User Story:** As a developer, I want the sticky header solution to work within the existing DOM hierarchy, so that no regressions are introduced to the wizard layout or animations.

#### Acceptance Criteria

1. THE Sticky_Header SHALL function correctly despite the Step_Content_Container having `overflowX: 'clip'` applied
2. THE Sticky_Header SHALL function correctly despite AnimatePresence and motion.div wrappers in the DOM ancestry
3. IF `position: sticky` cannot work within the current DOM hierarchy, THEN THE system SHALL automatically detect the failure and fall back to an alternative approach (such as a fixed-position overlay rendered via a React Portal) without manual configuration
4. THE Sticky_Header SHALL use a zIndex value greater than the step content (zIndex > 1) but less than or equal to the PageHeader (zIndex ≤ 10) to layer correctly

### Requirement 5: Minimal Vertical Footprint

**User Story:** As a user on a small screen, I want the sticky header to consume as little vertical space as possible, so that the majority of the screen remains available for path card content.

#### Acceptance Criteria

1. THE Sticky_Header SHALL use minimal vertical padding (no more than 4px top and bottom per line)
2. THE Sticky_Header SHALL use reduced font sizes compared to the static layout to minimize line height
3. THE Sticky_Header total height (both lines combined including padding and border) SHALL NOT exceed 72px
4. THE Sticky_Header SHALL use a solid or semi-opaque background matching the application dark theme to prevent content from showing through behind it
5. THE Sticky_Header SHALL display a bottom border matching the existing divider color to visually separate it from scrolling content below
6. WHEN the Sticky_Header is not needed (viewport ≥ md OR user is not on StepPathSelection OR viewport is small AND user IS on StepPathSelection but header is not applicable), THE Sticky_Header SHALL be removed from the DOM entirely (not merely hidden with CSS)
7. WHEN the user navigates away from StepPathSelection to a different page, THE Sticky_Header SHALL be removed from the DOM entirely

### Requirement 6: No Regression to Existing Behavior

**User Story:** As a developer, I want the feature to be additive without breaking existing wizard functionality, so that the path selection step continues to work correctly on all screen sizes.

#### Acceptance Criteria

1. WHILE the viewport width is at or above the md_breakpoint, THE StepPathSelection step SHALL render identically to its current behavior (static header + full PathCardSelector layout)
2. THE path selection functionality (choosing a path, swiping between cards, dot indicators) SHALL continue to work correctly at all viewport sizes
3. THE AnimatePresence step transition animations in CreateCompanyPage SHALL continue to function without visual glitches when the Sticky_Header is present
4. THE PageHeader sticky behavior SHALL remain unaffected by the Sticky_Header implementation
