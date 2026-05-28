# Implementation Plan: Path Selection Sticky Header

## Overview

Add a fixed-position sticky header (via React Portal) to StepPathSelection on viewports below 900px. Lift `cardIndex` state from PathCardSelector to StepPathSelection so both the sticky header and the card selector share navigation state. Create a new `StickyPathHeader` component rendered through a portal to `document.body`.

## Tasks

- [x] 1. Lift cardIndex state and make PathCardSelector support controlled mode
  - [x] 1.1 Add optional `cardIndex` and `onCardIndexChange` props to PathCardSelector
    - Add `cardIndex?: number` and `onCardIndexChange?: (index: number) => void` to Props interface
    - When both props provided, use them instead of internal `useState`
    - Keep internal state as fallback when props not provided (PostMatchSummaryPage usage)
    - Update `goTo` to call `onCardIndexChange` when in controlled mode
    - Remove the existing broken `position: sticky` attempt on xs breakpoint from the nav/header Box
    - _Requirements: 4.1, 4.2, 6.1, 6.2_

  - [x] 1.2 Lift cardIndex state into StepPathSelection
    - Add `useState` for `cardIndex` in StepPathSelection
    - Pass `cardIndex` and `onCardIndexChange` to PathCardSelector
    - Derive navigation helpers: `goToPrev`, `goToNext`, `canGoPrev`, `canGoNext`
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 2. Create StickyPathHeader component
  - [x] 2.1 Create `src/components/wizard/StickyPathHeader.tsx`
    - Implement `StickyPathHeaderProps` interface per design
    - Use `ReactDOM.createPortal(content, document.body)` to render outside DOM hierarchy
    - Outer Box: `position: fixed`, `top: 64px`, `left: 0`, `right: 0`, `zIndex: 5`
    - Solid dark background matching app theme, bottom border with divider color
    - Total height must not exceed 72px, minimal padding (4px top/bottom per line)
    - Return `null` if `document.body` unavailable (SSR/test safety)
    - _Requirements: 1.1, 1.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.2 Implement Hero_Info_Line in StickyPathHeader
    - Single condensed line: "HeroName · RoleLabel · UnitTypeLabel · Equipment1, Equipment2"
    - Reduced font size compared to static layout
    - Horizontal scroll (`overflowX: auto`, `whiteSpace: nowrap`) when text exceeds width
    - Omit equipment segment if equipment array is empty
    - Display fallback "Hero" if heroName is empty string
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.3 Implement Path_Nav_Line in StickyPathHeader
    - Flex row: left arrow button, path name + "X of Y" counter, right arrow button
    - Left arrow disabled when `canGoPrev` is false (first path)
    - Right arrow disabled when `canGoNext` is false (last path)
    - Arrow buttons call `onPrev`/`onNext` callbacks
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Wire StickyPathHeader into StepPathSelection with conditional rendering
  - [x] 3.1 Add viewport detection and conditional portal rendering
    - Import `useMediaQuery` and `useTheme` from MUI
    - Detect `isMobile = useMediaQuery(theme.breakpoints.down('md'))`
    - When `isMobile` is true, render `StickyPathHeader` with all required props
    - When `isMobile` is false, do not render (component unmounts, removed from DOM)
    - Clamp `cardIndex` to valid range `[0, PATHS.length - 1]` before passing to header
    - _Requirements: 1.1, 1.2, 5.6, 5.7, 6.1, 6.3, 6.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Property-based tests for StickyPathHeader
  - [x]* 5.1 Write property test for hero info line completeness
    - **Property 1: Hero info line completeness**
    - Generate random hero names, roles (leader/sergeant), unit types, equipment lists
    - Assert rendered output contains hero name, role label, unit type label, and all equipment labels
    - **Validates: Requirements 2.1**

  - [x]* 5.2 Write property test for path nav counter accuracy
    - **Property 2: Path nav counter accuracy**
    - Generate random card indices within valid range [0, PATHS.length - 1]
    - Assert rendered output shows correct path name and "(index + 1) of PATHS.length" counter
    - **Validates: Requirements 3.1**

  - [x]* 5.3 Write property test for arrow navigation correctness
    - **Property 3: Arrow navigation correctness**
    - Generate random card indices + direction (left/right)
    - Assert: if navigation allowed, resulting index = original ± 1; if not allowed, button is disabled
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

  - [x]* 5.4 Write property test for conditional DOM rendering
    - **Property 4: Conditional DOM rendering**
    - Generate random viewport widths (300–1200) and step identifiers
    - Assert: StickyPathHeader present in DOM iff viewport < 900px AND step is StepPathSelection
    - **Validates: Requirements 1.1, 1.2, 5.6, 5.7**

- [x] 6. Unit tests for StickyPathHeader
  - [x]* 6.1 Write unit tests for boundary and edge cases
    - Test sticky header renders at viewport 899px on StepPathSelection
    - Test sticky header absent at viewport 900px
    - Test zIndex value is 5
    - Test left arrow disabled when cardIndex === 0
    - Test right arrow disabled when cardIndex === PATHS.length - 1
    - Test portal renders to document.body
    - Test total height does not exceed 72px
    - _Requirements: 1.1, 1.2, 3.4, 3.5, 4.4, 5.3_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing PathCardSelector consumers (PostMatchSummaryPage) remain unaffected due to fallback internal state

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.4", "6.1"] }
  ]
}
```
