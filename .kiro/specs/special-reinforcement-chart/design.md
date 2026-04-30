# Design Document

## Special Reinforcement Chart Reference Display

### Overview

Some Battle Company types have a two-tier reinforcement system: a standard chart (`reinforcementTable`) and an optional special chart (`specialTable`). When a player rolls a "Roll on Special Chart" result on the standard chart, they consult the special chart to determine their actual reinforcement. Currently the Store tab's Reinforce section only shows the standard chart as a Table Reference, leaving players without an in-app reference for the special chart.

This feature adds a **Special Reinforcement Chart Reference** block beneath the existing standard chart reference. It is rendered only when the active company's `CompanyDefinition` has a non-empty `specialTable`. The new block mirrors the visual style of the existing standard chart reference and applies the same label-resolution and formatting rules (unit labels, choice suffix, Rare indicator, count multiplier).

---

### Architecture

The change is entirely contained within `src/pages/CompanyDetailsPage.tsx`. No new files, routes, data models, or services are required.

The existing rendering logic for the standard chart reference lives inside the `StoreTab` component (a local function component within `CompanyDetailsPage.tsx`), in the Reinforce sub-section. The special chart reference block is added immediately after the standard chart reference block, guarded by a conditional check on `companyDef.specialTable`.

```
CompanyDetailsPage
  └── StoreTab
        └── Reinforce section
              ├── [roll controls / recruitment UI]
              ├── Standard Chart Reference  ← existing
              └── Special Chart Reference   ← NEW (conditional)
```

No state changes are needed. The `companyDef` object is already available in `StoreTab` via props.

---

### Components and Interfaces

#### Affected component: `StoreTab` (internal to `CompanyDetailsPage.tsx`)

`StoreTab` already receives `companyDef: CompanyDefinition | undefined` as a prop. The `CompanyDefinition` type already includes:

```ts
specialTable?: SpecialTableEntry[]
```

where `SpecialTableEntry` is:

```ts
interface SpecialTableEntry {
  roll: number[]
  result: string
  baseUnitId?: string
  rare?: number
  count?: number
}
```

No interface changes are required.

#### Helper function: `formatSpecialTableRow`

To keep the JSX readable and to make the formatting logic independently testable, the row-description logic is extracted into a pure helper function:

```ts
/**
 * Produces the human-readable description string for a single SpecialTableEntry,
 * applying the same formatting rules as the standard reinforcement chart rows.
 */
function formatSpecialTableRow(row: SpecialTableEntry): string
```

This function is defined at module scope (or co-located near the existing chart rendering code) and uses the already-imported `getUnitLabel` and `getWargearLabel` utilities.

---

### Data Models

No data model changes are required. The `SpecialTableEntry` type and the `specialTable?: SpecialTableEntry[]` field on `CompanyDefinition` already exist in `src/models/index.ts`.

The relevant subset of `SpecialTableEntry` fields used by the display:

| Field        | Type       | Usage                                                      |
|--------------|------------|------------------------------------------------------------|
| `roll`       | `number[]` | Displayed as the roll range (e.g. `1-3`, `4`, `5-6`)      |
| `result`     | `string`   | Determines base description (`"none"`, `"unit"`, `"choice"`, etc.) |
| `baseUnitId` | `string?`  | Resolved to a human-readable label via `getUnitLabel`      |
| `rare`       | `number?`  | Appended as `(Rare N)` when present                        |
| `count`      | `number?`  | Appended as `×N` when `count > 1`                          |

---

### Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

#### Property Reflection

Before finalising properties, reviewing for redundancy:

- **1.1** (special chart shown when specialTable non-empty) and **1.2** (special chart hidden when specialTable absent/empty) are complementary inverses. Together they form a single round-trip / conditional-visibility property. They can be expressed as one property: "the presence of the special chart reference is exactly determined by whether specialTable is non-empty."
- **1.4** (one row per entry) and **1.5** (unit label resolution) both concern the content of rendered rows. They are distinct enough to keep separate — 1.4 is about count/structure, 1.5 is about label correctness.
- **1.7** (rare indicator) and **1.8** (count multiplier) are independent formatting properties and remain separate.

After reflection: properties 1.1/1.2 are merged; 1.4, 1.5, 1.7, 1.8 remain as individual properties.

---

### Property 1: Special chart visibility is determined by specialTable presence

*For any* `CompanyDefinition`, the special reinforcement chart reference SHALL be rendered if and only if `specialTable` is a non-empty array. Equivalently: if `specialTable` is absent or empty, the special chart reference SHALL NOT be rendered.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: Row count matches specialTable length

*For any* `CompanyDefinition` with a non-empty `specialTable` of length N, the rendered special reinforcement chart reference SHALL contain exactly N rows.

**Validates: Requirements 1.4**

---

### Property 3: Unit label resolution is consistent

*For any* `SpecialTableEntry` with a `baseUnitId`, the text rendered for that entry SHALL contain the string returned by `getUnitLabel(baseUnitId)`.

**Validates: Requirements 1.5**

---

### Property 4: Rare indicator is appended for entries with a rare value

*For any* `SpecialTableEntry` with a `rare` value N, the text rendered for that entry SHALL contain the substring `Rare N`.

**Validates: Requirements 1.7**

---

### Property 5: Count multiplier is appended for entries with count > 1

*For any* `SpecialTableEntry` with a `count` value greater than 1, the text rendered for that entry SHALL contain the substring `×{count}`.

**Validates: Requirements 1.8**

---

### Error Handling

This feature is purely additive and read-only. There are no user inputs, async operations, or mutations. The only failure mode is a missing or malformed `specialTable` in the static JSON data.

- **`specialTable` is `undefined` or empty**: The conditional guard (`companyDef.specialTable?.length`) ensures nothing is rendered. No error state needed.
- **`specialTable` entry has no `baseUnitId`**: The `formatSpecialTableRow` helper falls back to `'—'`, matching the existing standard chart behaviour.
- **`getUnitLabel` returns a humanised fallback**: Already handled by the existing `humanise()` fallback in `labels.ts`. No additional handling needed.

---

### Testing Strategy

This feature involves UI rendering logic and a pure formatting helper. The appropriate testing approach is:

**Unit / property tests** for `formatSpecialTableRow`:
- Use [fast-check](https://github.com/dubzzz/fast-check) (already used in this project) to generate arbitrary `SpecialTableEntry` values and verify the formatting properties above.
- Minimum 100 iterations per property test.
- Each test references its design property via a comment tag: `// Feature: special-reinforcement-chart, Property N: <property text>`

**Example-based tests** for the conditional rendering:
- Render the Reinforce section with a company that has a `specialTable` → assert the special chart heading is present.
- Render the Reinforce section with a company that has no `specialTable` → assert the special chart heading is absent.
- Render an entry with `result: "choice"` → assert "with choice of option" appears.
- Snapshot test for visual style parity between standard and special chart rows.

**No integration tests** are required — there are no external services, API calls, or database operations involved.

**Property test configuration**:
- Library: `fast-check` (already a dev dependency)
- Runner: Vitest (already configured)
- Iterations: 100 minimum per property
- Tag format: `// Feature: special-reinforcement-chart, Property {N}: {property_text}`
