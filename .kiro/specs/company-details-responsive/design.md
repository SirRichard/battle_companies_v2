# Design Document: Company Details Responsive

## Overview

This design addresses six responsive layout issues on the `CompanyDetailsPage` that produce uneven, clipped, or obscured content on narrow (xs, <600px) viewports. All changes are CSS/layout-only modifications to existing MUI `sx` props — no new components, no data model changes, no new dependencies.

The approach uses MUI's responsive `sx` prop syntax (`{ xs: ..., sm: ... }`) to switch between narrow and wide layouts at the 600px breakpoint. This keeps logic co-located with the components it affects and avoids introducing a separate responsive utility layer.

## Architecture

All changes live within `src/pages/CompanyDetailsPage.tsx`. No new files or modules are introduced. The existing component hierarchy remains:

```
CompanyDetailsPage
├── PageHeader
├── Stats Bar (inline Box)
├── Tab Strip (Tabs)
├── Tab Content
│   ├── Roster Tab
│   │   ├── MemberRow (heroes)
│   │   ├── MemberRow (warriors)
│   │   └── Wanderer section
│   ├── HistoryTab
│   └── StoreTab
│       └── Section Buttons
└── FAB
```

### Design Decisions

1. **CSS-only approach** — All responsive behaviour is achieved through MUI `sx` breakpoint objects. No JavaScript `useMediaQuery` hooks needed because MUI's `sx` compiles to CSS media queries at build time, avoiding hydration mismatches and re-renders.

2. **No component extraction** — The affected elements (stats bar, tab strip, wargear chips, store buttons, wanderer stats) are small enough to remain inline. Extracting them would add indirection without meaningful reuse benefit.

3. **Chip collapse uses `useMediaQuery` exception** — Requirement 3 (wargear chip collapse) requires conditional rendering (showing N chips vs all chips). This is the one case where a `useMediaQuery('(min-width:600px)')` hook is justified, since the chip count changes the DOM structure, not just styling.

## Components and Interfaces

### 1. Stats Bar (Requirement 1)

**Current**: `display: 'flex'` with `flexWrap: 'wrap'` — produces uneven 3+1 splits on narrow screens.

**New**: Switch to CSS Grid on xs, flex row on sm+.

```tsx
// Stats bar container sx
{
  px: { xs: 2, sm: 3 },
  py: 1.5,
  display: { xs: 'grid', sm: 'flex' },
  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: undefined },
  gap: { xs: 2, sm: 3 },
  borderBottom: '1px solid',
  borderColor: 'divider',
  background: 'rgba(0,0,0,0.2)',
  flexShrink: 0,
}
```

On xs: 2-column grid → Rating/Influence top row, Record/Members bottom row.
On sm+: single flex row (existing behaviour preserved).

### 2. Tab Strip (Requirement 2)

**Current**: Always shows icon + text label with `iconPosition="start"`.

**New**: On xs, render icon-only tabs with `aria-label`. On sm+, render icon + label.

```tsx
// Each Tab receives conditional props:
<Tab
  icon={<SportsMartialArtsIcon sx={{ fontSize: '1rem' }} />}
  iconPosition="start"
  label={isSmUp ? "Roster" : undefined}
  aria-label="Roster"
/>
```

Uses `useMediaQuery(theme.breakpoints.up('sm'))` to toggle label visibility. The `aria-label` ensures accessibility when text is hidden.

Tab root `minHeight: 44` already set — satisfies tap target requirement.

### 3. MemberRow Wargear Chip Collapse (Requirement 3)

**Current**: All wargear chips rendered with `flexWrap: 'wrap'`.

**New**: On xs, slice to first 3 chips + render a "+N more" chip if overflow exists.

```tsx
const isSmUp = useMediaQuery(theme.breakpoints.up('sm'))
const visibleWargear = isSmUp ? displayWargear : displayWargear.slice(0, 3)
const hiddenCount = displayWargear.length - visibleWargear.length
```

The "+N more" chip uses identical styling (`fontSize: '0.6rem'`, `height: 20`) to existing wargear chips. Full list remains accessible in `MemberDetailsDrawer` (no change needed there).

### 4. Store Section Buttons (Requirement 4)

**Current**: `display: 'flex'` with `flexWrap: 'wrap'` and `flex: '1 1 auto'`, `minWidth: 68`.

**New**: On xs, use CSS Grid with 3 columns. On sm+, keep existing flex-wrap.

```tsx
// Section toggle container sx
{
  display: { xs: 'grid', sm: 'flex' },
  gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: undefined },
  gap: { xs: '4px', sm: 0.5 },
  mb: 3,
  flexWrap: { sm: 'wrap' },
}
```

Button items keep `minWidth: 68` and `py: 1` (≥44px tap target with padding + font). Selected state styling unchanged.

### 5. FAB Clearance Padding (Requirement 5)

**Current**: Roster tab has `pb: 10`. History and Store tabs have no explicit bottom padding.

**New**: Add `pb: 10` to History tab (when entries exist) and Store tab container. History empty state gets explicit `pb: 0`.

```tsx
// HistoryTab — when entries exist
<Box sx={{ px: { xs: 2, sm: 3 }, py: 3, maxWidth: 700, mx: 'auto', pb: 10 }}>

// HistoryTab — empty state (no change, already centered with minHeight)
// pb: 0 explicitly to prevent inheritance

// StoreTab container
<Box sx={{ px: { xs: 2, sm: 3 }, py: 3, maxWidth: 600, mx: 'auto', pb: 10 }}>
```

### 6. Wanderer Stats Mini Grid (Requirement 6)

**Current**: Single `Typography` with pipe-separated stats: `Mv 6" | F 5/4+ | S 4 | D 5 | A 2 | W 2 | C 5`.

**New**: On xs, render a grid matching the wanderer detail dialog pattern. On sm+, keep existing inline format.

```tsx
{isSmUp ? (
  <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.6rem' }}>
    Mv {stats.move}" | F {stats.fight}/{stats.shoot ?? '-'}+ | ...
  </Typography>
) : (
  <Box sx={{
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 0.5,
    mt: 0.5,
  }}>
    {statEntries.map(({ label, value }) => (
      <Box key={label} sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.55rem', opacity: 0.5, textTransform: 'uppercase' }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'info.light' }}>
          {value}
        </Typography>
      </Box>
    ))}
  </Box>
)}
```

Grid uses `repeat(5, 1fr)` — 7 stats wrap to 5+2 layout, matching the wanderer detail dialog structure.

## Data Models

No data model changes. All modifications are presentational. The existing `Company`, `Member`, and wanderer data structures remain unchanged.

## Error Handling

No new error states introduced. All changes are CSS/layout modifications that degrade gracefully:
- If `useMediaQuery` fails to evaluate (SSR edge case), components fall back to their sm+ (full) rendering — no content is lost.
- Chip collapse shows all chips if the media query cannot be determined — safe fallback.

## Testing Strategy

### Why Property-Based Testing Does Not Apply

This feature is purely UI rendering and responsive layout. The changes modify CSS properties and conditional rendering based on viewport width. There are no pure functions with varying input spaces, no data transformations, no serialization, and no business logic. PBT is not appropriate here.

### Recommended Testing Approach

**Visual/Manual Testing:**
- Primary validation via browser DevTools responsive mode at 320px, 375px, 414px (xs) and 600px, 768px (sm+).
- Verify no text truncation, no overflow, no layout shift at breakpoint boundary.

**Example-Based Unit Tests (optional, low priority):**
- Test that `MemberRow` renders exactly 3 chips + "+N more" when given 5 wargear items and `isSmUp = false`.
- Test that `MemberRow` renders all 5 chips when `isSmUp = true`.
- Test that the "+N more" chip displays correct count.

**Integration Tests:**
- Verify `aria-label` attributes present on tabs when in icon-only mode (accessibility).
- Verify FAB does not overlap last content item at xs viewport (visual regression or snapshot).

**Test Tools:**
- `@testing-library/react` for component rendering assertions.
- `vitest` as test runner.
- Manual testing with Chrome DevTools for visual verification.

### Test Priority

| Area | Priority | Method |
|------|----------|--------|
| Chip collapse logic | Medium | Unit test (RTL) |
| Tab aria-labels | Medium | Unit test (RTL) |
| Grid layouts | Low | Visual/manual |
| FAB clearance | Low | Visual/manual |
| Breakpoint transitions | Low | Manual |
