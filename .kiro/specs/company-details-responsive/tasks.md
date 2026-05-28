# Implementation Plan: Company Details Responsive

## Overview

Modify `CompanyDetailsPage.tsx` to fix six responsive layout issues on narrow (xs, <600px) viewports. All changes are CSS/layout-only using MUI `sx` breakpoint objects, with one `useMediaQuery` hook for conditional chip rendering. No new components or files introduced.

## Tasks

- [x] 1. Stats Bar responsive grid layout
  - [x] 1.1 Convert Stats Bar from flex-wrap to responsive grid/flex
    - Replace `display: 'flex'` + `flexWrap: 'wrap'` with `display: { xs: 'grid', sm: 'flex' }`
    - Add `gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: undefined }`
    - Verify 2×2 grid on xs (Rating/Influence top, Record/Members bottom) and single row on sm+
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Tab Strip icon-only on narrow screens
  - [x] 2.1 Add useMediaQuery hook and conditional tab labels
    - Import `useMediaQuery` and `useTheme` from MUI
    - Create `isSmUp = useMediaQuery(theme.breakpoints.up('sm'))` in component body
    - Set each Tab's `label` to `isSmUp ? "TabName" : undefined`
    - Add `aria-label` attribute to each Tab matching its label text
    - Ensure `minHeight: 44` on tab root (already present, verify)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. MemberRow wargear chip collapse
  - [x] 3.1 Implement chip slicing and "+N more" indicator in MemberRow
    - Pass `isSmUp` to MemberRow or use `useMediaQuery` within MemberRow
    - On xs: slice `displayWargear` to first 3 items
    - Render "+N more" Chip when hidden count > 0 (fontSize: '0.6rem', height: 20)
    - On sm+: render all chips unchanged
    - Full wargear list remains in MemberDetailsDrawer (no change needed)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Verify roster tab changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Store Section Buttons grid layout
  - [x] 5.1 Convert Store Section Buttons to responsive grid/flex
    - Locate section toggle button container in StoreTab
    - Replace with `display: { xs: 'grid', sm: 'flex' }`, `gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: undefined }`
    - Set `gap: { xs: '4px', sm: 0.5 }` and keep `flexWrap: { sm: 'wrap' }` for sm+
    - Maintain `minWidth: 68` and minimum 44px tap target height on buttons
    - Verify selected-state styling preserved
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. FAB clearance padding for History and Store tabs
  - [x] 6.1 Add bottom padding to History and Store tab containers
    - Add `pb: 10` to History tab content container (when entries exist)
    - Add explicit `pb: 0` to History tab empty state
    - Add `pb: 10` to Store tab content container
    - Verify Roster tab retains existing `pb: 10` unchanged
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7. Wanderer Stats mini grid on narrow screens
  - [x] 7.1 Implement responsive wanderer stat line rendering
    - On xs: render 7 stats (Mv, F, S, D, A, W, C) in grid with `gridTemplateColumns: 'repeat(5, 1fr)'`
    - Each cell shows abbreviated label above numeric value (fontSize: '0.55rem' label, '0.75rem' value)
    - On sm+: keep existing pipe-separated Typography format
    - Use `isSmUp` conditional rendering (same hook from task 2.1)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8. Final checkpoint - Verify all responsive changes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All changes confined to `src/pages/CompanyDetailsPage.tsx`
- No new components, files, or dependencies introduced
- Uses MUI `sx` breakpoint syntax for CSS-only changes where possible
- `useMediaQuery` used only for conditional DOM rendering (tabs label, chip collapse, wanderer stats)
- No property-based tests — feature is purely presentational layout
- Primary validation via browser DevTools responsive mode at 320px–414px (xs) and 600px+ (sm)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["3.1", "5.1", "6.1"] },
    { "id": 2, "tasks": ["7.1"] }
  ]
}
```
