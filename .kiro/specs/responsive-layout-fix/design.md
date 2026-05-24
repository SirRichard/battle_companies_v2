# Responsive Layout Fix — Bugfix Design

## Overview

The Battle Companies companion app uses fixed-width layouts and single-row flex arrangements that break down on narrow viewports. The stat grids (9 columns), wizard stepper (8 steps with `alternativeLabel`), MemberRow (hero stats + chips + rating in one row), and MemberMatchCard controls all assume a minimum viewport width of ~600px. This fix introduces responsive breakpoints using MUI's existing `sx` responsive props, `useMediaQuery`, and `theme.breakpoints` to reflow content at mobile (< 600px), tablet (600–900px), and desktop (> 900px) without introducing new CSS frameworks.

## Glossary

- **Bug_Condition (C)**: The viewport width falls below the threshold at which a component's fixed layout causes overflow, truncation, or unreadable content
- **Property (P)**: At any viewport width, all content remains readable, accessible, and interactive without horizontal overflow
- **Preservation**: Existing theme styling (dark mode, gold accents, Cinzel Decorative headings, IM Fell English body), animations (Framer Motion), functionality (wizard navigation, drawer interactions, match tracking), and desktop appearance remain unchanged
- **Stat Grid**: The 9-column characteristics display (Mv, Fv, Sv, S, D, A, W, C, I) used in MemberDetailsDrawer and MatchTrackingPage
- **MemberRow**: The roster list item in CompanyDetailsPage showing name, role, hero stats, wargear chips, and rating
- **MemberMatchCard**: The per-member card in MatchTrackingPage with stat block, M/W/F controls, XP counter, and casualty button
- **Wizard Stepper**: The 8-step MUI `<Stepper alternativeLabel>` in CreateCompanyPage

## Bug Details

### Bug Condition

The bug manifests when the viewport width is below the minimum width assumed by fixed-layout components. Each component has a different threshold, but the common condition is: the viewport is narrow enough that flex rows with `minWidth` constraints, fixed column counts, or `alternativeLabel` steppers overflow or become unreadable.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { viewportWidth: number, component: ComponentType }
  OUTPUT: boolean
  
  RETURN (input.viewportWidth < 600 AND input.component IN [StatGrid, WizardStepper, MemberRow, MemberMatchCard, HistoryMetadata])
         OR (input.viewportWidth < 400 AND input.component = StatGrid)
         OR (input.viewportWidth < 360 AND input.component IN [FAB, StickyFooter])
         OR (input.viewportWidth >= 600 AND input.viewportWidth <= 900 AND input.component IN [ContentContainer] AND maxWidth < 800)
         OR (input.viewportWidth > 900 AND input.component IN [ContentContainer] AND maxWidth < 960)
END FUNCTION
```

### Examples

- **Stat Grid on 320px viewport**: 9 stat cells at `minWidth: 30` plus borders and gaps require ~300px minimum, but with padding the container is only ~280px wide — cells overflow or text truncates
- **Wizard Stepper on 375px viewport**: 8 steps with `alternativeLabel` renders labels below icons in a single row — labels overlap and become unreadable at this width
- **MemberRow on 360px viewport**: Name + role chip + M/W/F stats + wargear chips + rating badge in a single flex row exceeds viewport width, pushing rating off-screen
- **History metadata on 400px viewport**: Items with `minWidth: 100` in a flex-wrap row still overflow when 5 items × 100px + gaps > container width

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All existing page content, navigation, and interactive elements remain functional at every viewport size
- Dark theme with gold accents (#C9A84C), Cinzel Decorative headings, and IM Fell English body typography remain unaltered
- Wizard stepper backward navigation to visited steps and forward progression validation rules remain identical
- Tapping a MemberRow continues to open MemberDetailsDrawer with full member information
- MatchTrackingPage XP increment/decrement, casualty toggling, M/W/F tracking, and End Match flow remain fully functional
- Framer Motion animations (slide transitions, fade-ins, stagger effects) continue to render
- MUI component library usage continues without introducing additional CSS frameworks

**Scope:**
All inputs at viewport widths ≥ 600px where components currently render correctly should be completely unaffected by this fix. The fix targets only the responsive reflow behavior — no changes to data flow, state management, or business logic.

## Hypothesized Root Cause

Based on the code analysis, the root causes are:

1. **Fixed single-row flex layouts without responsive breakpoints**: MemberRow uses `display: 'flex', alignItems: 'center'` with all content (name, chips, stats, wargear, rating) in one row. No `flexWrap` or responsive stacking is applied.

2. **Stat grid assumes sufficient width**: Both MemberDetailsDrawer and MatchTrackingPage render 9 stat cells in a single flex row with `minWidth: 30`. On very narrow viewports, the combined minimum width exceeds the container.

3. **Wizard Stepper uses `alternativeLabel` unconditionally**: The 8-step stepper always renders with labels below icons in a horizontal row. MUI's `alternativeLabel` prop is not conditionally applied based on viewport width.

4. **Hard-coded `maxWidth` values on content containers**: Pages use `maxWidth: 600` or `maxWidth: 700` regardless of viewport size, wasting space on tablets and desktops.

5. **History metadata uses fixed `minWidth: 100`**: The expanded match detail renders metadata items with `minWidth: 100` in a flex-wrap container, but on narrow viewports the items still overflow.

6. **Fixed-position elements (FAB, sticky footer) don't adapt**: The FAB uses `position: 'fixed', bottom: 24, right: 24` without responsive sizing, and the sticky navigation footer doesn't account for very narrow viewports.

## Correctness Properties

Property 1: Bug Condition - Responsive Reflow Prevents Overflow

_For any_ viewport width and component combination where the bug condition holds (isBugCondition returns true), the fixed layout SHALL reflow content such that no horizontal overflow occurs, all text remains readable (minimum effective cell width of 32px for stat grids), and all interactive elements remain accessible without horizontal scrolling.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

Property 2: Preservation - Desktop and Existing Behavior Unchanged

_For any_ viewport width and component combination where the bug condition does NOT hold (isBugCondition returns false — i.e., standard desktop widths where layouts already work), the fixed code SHALL produce the same visual output and behavior as the original code, preserving theme styling, animations, functionality, and layout.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/pages/CompanyDetailsPage.tsx`

**Component**: `MemberRow`

**Specific Changes**:
1. **Stack secondary content on mobile**: Use `sx` responsive props to switch from single-row to stacked layout below `sm` breakpoint. Move wargear chips, hero M/W/F stats, and rating badge below the name/role line on mobile.
2. **Adjust content container maxWidth**: Change `maxWidth: 700` to responsive values: `{ xs: '100%', sm: '100%', md: 900, lg: 1100 }`.

**File**: `src/pages/CreateCompanyPage.tsx`

**Component**: Wizard Stepper section

**Specific Changes**:
3. **Conditional stepper rendering**: Use `useMediaQuery(theme.breakpoints.down('sm'))` to detect mobile. On mobile, render a compact progress indicator (e.g., `MobileStepper` or a simple "Step X of 8" with linear progress) instead of the full `alternativeLabel` stepper.
4. **Adjust step content maxWidth**: Change `maxWidth: 600` to responsive values for tablet/desktop.

**File**: `src/pages/MatchTrackingPage.tsx`

**Component**: `MemberMatchCard`

**Specific Changes**:
5. **Stat grid wrap on narrow viewports**: The stat grid already uses `flexWrap: 'wrap'` — verify it works correctly. Add responsive `minWidth` adjustments if needed.
6. **M/W/F controls responsive sizing**: Reduce button sizes and spacing on mobile using responsive `sx` props.
7. **Stack card sections vertically on mobile**: Ensure the name row, stat block, M/W/F controls, and XP/casualty controls stack cleanly.

**File**: `src/components/common/MemberDetailsDrawer.tsx`

**Component**: Stat grid section

**Specific Changes**:
8. **Stat grid responsive layout**: On viewports < 400px, allow the stat grid to wrap into two rows (5+4 or similar) instead of forcing all 9 in one row. Use `flexWrap: 'wrap'` with responsive `flex` values.

**File**: `src/pages/CompanyDetailsPage.tsx`

**Component**: `HistoryMatchCard` expanded detail

**Specific Changes**:
9. **Reduce metadata item minWidth on mobile**: Change `minWidth: 100` to `{ xs: 70, sm: 100 }` or remove the constraint on mobile.

**File**: `src/pages/CompanyDetailsPage.tsx`

**Component**: FAB and page-level containers

**Specific Changes**:
10. **Responsive FAB sizing**: Reduce FAB size and adjust positioning on very narrow viewports (< 360px).
11. **Responsive content maxWidth for tablet/desktop**: Increase maxWidth on `md` and `lg` breakpoints.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render components at various viewport widths and assert that no horizontal overflow occurs. Use `@testing-library/react` with viewport simulation to check container widths vs content widths. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Stat Grid Overflow at 320px**: Render MemberMatchCard at 320px viewport width, assert stat grid container does not overflow (will fail on unfixed code)
2. **Wizard Stepper Overflow at 375px**: Render CreateCompanyPage stepper at 375px, assert no label overlap or overflow (will fail on unfixed code)
3. **MemberRow Overflow at 360px**: Render MemberRow with hero stats + wargear at 360px, assert no horizontal overflow (will fail on unfixed code)
4. **History Metadata Overflow at 400px**: Render HistoryMatchCard expanded at 400px, assert metadata items wrap without overflow (will fail on unfixed code)

**Expected Counterexamples**:
- Container `scrollWidth` exceeds `clientWidth` at narrow viewports
- Possible causes: fixed minWidth constraints, no flexWrap, unconditional alternativeLabel

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed components produce layouts without overflow.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderComponent_fixed(input.component, input.viewportWidth)
  ASSERT result.containerScrollWidth <= result.containerClientWidth
  ASSERT result.allTextReadable (minCellWidth >= 32px for stat grids)
  ASSERT result.allControlsAccessible (no elements clipped or off-screen)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed components produce the same visual output as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderComponent_original(input) = renderComponent_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many viewport width values across the non-buggy range (600px+)
- It catches edge cases at breakpoint boundaries that manual tests might miss
- It provides strong guarantees that desktop behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for desktop viewports (≥ 600px), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Desktop Layout Preservation**: Verify that at viewport widths ≥ 900px, content containers, stat grids, and member rows render identically to unfixed code
2. **Theme Preservation**: Verify that responsive changes do not alter color values, font families, or spacing at any viewport width
3. **Functionality Preservation**: Verify that wizard navigation, drawer opening, and match tracking interactions work identically after the fix
4. **Animation Preservation**: Verify that Framer Motion variants and transitions are not affected by responsive layout changes

### Unit Tests

- Test stat grid renders without overflow at 320px, 375px, 414px viewport widths
- Test wizard stepper renders compact form at < 600px and full form at ≥ 600px
- Test MemberRow stacks content at < 600px and renders single-row at ≥ 600px
- Test FAB remains visible and within viewport at 320px
- Test content maxWidth increases appropriately at tablet and desktop breakpoints

### Property-Based Tests

- Generate random viewport widths in [280, 600) range and verify no component produces horizontal overflow after fix
- Generate random viewport widths in [600, 1920] range and verify layout matches original behavior (preservation)
- Generate random member configurations (varying wargear counts, hero vs warrior) and verify MemberRow adapts correctly at mobile widths

### Integration Tests

- Test full wizard flow at 375px viewport: navigate all 8 steps, verify stepper is usable
- Test CompanyDetailsPage at 360px: tap member rows, verify drawer opens with readable stat grid
- Test MatchTrackingPage at 320px: verify all M/W/F controls, XP buttons, and casualty toggles are accessible
