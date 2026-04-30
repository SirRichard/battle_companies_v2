# Implementation Plan: Special Reinforcement Chart Reference

## Overview

Add a `formatSpecialTableRow` pure helper function and a conditional Special Reinforcement Chart Reference block to the `StoreTab` component in `CompanyDetailsPage.tsx`. The block renders beneath the existing standard chart reference and is only shown when the active company's `CompanyDefinition` has a non-empty `specialTable`.

## Tasks

- [x] 1. Add `formatSpecialTableRow` helper function to `CompanyDetailsPage.tsx`
  - Define a pure function `formatSpecialTableRow(row: SpecialTableEntry): string` at module scope (near the existing chart rendering code)
  - Apply the same label-resolution and formatting rules as the standard chart rows:
    - If `row.baseUnitId` is present, resolve it via `getUnitLabel`; otherwise return `'—'`
    - If `row.result === 'choice'`, append `' with choice of option'`
    - If `row.rare` is present, append ` (Rare ${row.rare})`
    - If `row.count > 1`, append ` ×${row.count}`
  - `SpecialTableEntry` is already imported via the `CompanyDefinition` type; no new imports needed
  - _Requirements: 1.5, 1.6, 1.7, 1.8_

  - [ ]* 1.1 Write property test for `formatSpecialTableRow` — Property 3: Unit label resolution
    - **Property 3: Unit label resolution is consistent**
    - **Validates: Requirements 1.5**
    - File: `src/pages/__tests__/specialTableRow.property.test.ts`
    - Use `fast-check` to generate arbitrary `SpecialTableEntry` values with a `baseUnitId`
    - Assert the returned string contains `getUnitLabel(row.baseUnitId)`
    - Tag: `// Feature: special-reinforcement-chart, Property 3: Unit label resolution is consistent`

  - [ ]* 1.2 Write property test for `formatSpecialTableRow` — Property 4: Rare indicator
    - **Property 4: Rare indicator is appended for entries with a rare value**
    - **Validates: Requirements 1.7**
    - File: `src/pages/__tests__/specialTableRow.property.test.ts`
    - Use `fast-check` to generate entries with a `rare` value N
    - Assert the returned string contains `Rare ${N}`
    - Tag: `// Feature: special-reinforcement-chart, Property 4: Rare indicator is appended for entries with a rare value`

  - [ ]* 1.3 Write property test for `formatSpecialTableRow` — Property 5: Count multiplier
    - **Property 5: Count multiplier is appended for entries with count > 1**
    - **Validates: Requirements 1.8**
    - File: `src/pages/__tests__/specialTableRow.property.test.ts`
    - Use `fast-check` to generate entries with `count > 1`
    - Assert the returned string contains `×${count}`
    - Tag: `// Feature: special-reinforcement-chart, Property 5: Count multiplier is appended for entries with count > 1`

- [x] 2. Render the Special Reinforcement Chart Reference block in `StoreTab`
  - Locate the existing "Reinforcement table reference" `<Box>` block (around line 2709 in `CompanyDetailsPage.tsx`)
  - Immediately after the closing `</Box>` of that block, add a new conditional block:
    - Guard: `{companyDef.specialTable && companyDef.specialTable.length > 0 && ( ... )}`
    - Heading: a `<Typography>` with the same `variant="caption"` and `sx` style as the "Table Reference" heading, with text `Special Table Reference`
    - Rows: map over `companyDef.specialTable`, rendering one `<Box>` row per entry using the same layout and `sx` as the standard chart rows
    - Roll column: `{row.roll.join('-')}` with the same `Cinzel Decorative` typography
    - Description column: call `formatSpecialTableRow(row)` for the text content
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.9_

  - [ ]* 2.1 Write property test for conditional visibility — Property 1: Special chart visibility
    - **Property 1: Special chart visibility is determined by specialTable presence**
    - **Validates: Requirements 1.1, 1.2**
    - File: `src/pages/__tests__/specialTableVisibility.property.test.ts`
    - Use `fast-check` to generate `CompanyDefinition`-shaped objects with varying `specialTable` values (absent, empty array, non-empty array)
    - Render the relevant section and assert the special chart heading is present if and only if `specialTable` is non-empty
    - Tag: `// Feature: special-reinforcement-chart, Property 1: Special chart visibility is determined by specialTable presence`

  - [ ]* 2.2 Write property test for row count — Property 2: Row count matches specialTable length
    - **Property 2: Row count matches specialTable length**
    - **Validates: Requirements 1.4**
    - File: `src/pages/__tests__/specialTableVisibility.property.test.ts`
    - Use `fast-check` to generate non-empty `specialTable` arrays of length N
    - Render the section and assert exactly N rows are rendered in the special chart reference
    - Tag: `// Feature: special-reinforcement-chart, Property 2: Row count matches specialTable length`

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `formatSpecialTableRow` must be exported or at least accessible to the property test file; consider exporting it from `CompanyDetailsPage.tsx`
- The `SpecialTableEntry` type is already defined in `src/models/index.ts` — no model changes needed
- The `getUnitLabel` import is already present in `CompanyDetailsPage.tsx`
- Property tests use `fast-check` (already a dev dependency) and run under Vitest
