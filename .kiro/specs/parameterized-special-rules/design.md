# Design Document: Parameterized Special Rules

## Overview

This feature adds parameter collection UI to the postmatch advancement flow for parameterised special rules. Currently, `applySpecialRule` stores only a plain label string, ignoring the `parameterised` flag and `parameter_type` metadata in `specialRules.json`. The gap is that when a player selects a parameterised minor rule (e.g., Combat Synergy, Poisoned Attacks) during hero path progression or the minor rule picker, no parameter is collected.

The solution introduces a `ParameterSelector` sub-component that appears inline after a parameterised rule is selected, collects the required parameter value, and stores the rule as a structured `{ id, parameter }` object in the member's `specialRules` array. The existing `resolveParameterisedLabel` utility already handles display resolution — this feature closes the input side of the loop.

**Key design decisions:**
- Parameter collection happens inline (not in a separate dialog) to maintain flow continuity
- The `applySpecialRule` utility is replaced with a new `applyParameterisedRule` function for parameterised rules, while the existing function remains for non-parameterised rules
- Ownership/duplicate detection is unified into a single utility function that handles both string entries and object entries

## Architecture

```mermaid
flowchart TD
    A[Minor Rule Picker / Path Progression] -->|selects rule| B{Is parameterised?}
    B -->|No| C[applySpecialRule - existing flow]
    B -->|Yes| D[Show ParameterSelector]
    D --> E{parameter_type?}
    E -->|friendly_hero| F[HeroSelector]
    E -->|weapon| G[WeaponSelector]
    E -->|integer/distance/target_*| H[ValueInput]
    F --> I[User picks hero]
    G --> J[User picks weapon]
    H --> K[User enters value]
    I --> L[applyParameterisedRule]
    J --> L
    K --> L
    L --> M[Store {id, parameter} + subtract 5 XP]
```

The architecture layers:

1. **Data layer** — `specialRules.json` already has `parameterised` and `parameter_type` fields; `wargear.json` has categories; member model supports `{ id, parameter }` objects
2. **Logic layer** — new utility functions for eligibility filtering, ownership checking, and parameterised rule application
3. **UI layer** — `ParameterSelector` component with sub-variants per `parameter_type`, integrated into the existing `HeroAdvancementPanel` and minor rule picker

## Components and Interfaces

### New Utility Functions (`src/utils/parameterizedRules.ts`)

```typescript
import type { Member } from '../models'

interface SpecialRuleEntry {
  id: string
  label: string
  parameterised?: boolean
  parameter_type?: string
  minor?: boolean
}

interface WargearEntry {
  id: string
  label: string
  category: string
}

/**
 * Determines if a rule is "already owned" by a member.
 * - Non-parameterised: owned if specialRules contains a string matching rule.id OR rule.label
 * - Parameterised: owned if specialRules contains an object with matching id AND same parameter,
 *   OR a plain string matching the rule's id (legacy format)
 */
export function isRuleOwned(
  member: Member,
  rule: SpecialRuleEntry,
  candidateParameter?: string | number
): boolean

/**
 * Returns eligible hero targets for Combat Synergy (friendly_hero parameter_type).
 * Includes only members with role: leader | sergeant | hero_in_making,
 * excludes the receiving member.
 */
export function getEligibleHeroes(
  companyMembers: Member[],
  receivingMemberId: string
): Member[]

/**
 * Returns eligible weapons for Poisoned Attacks (weapon parameter_type).
 * Merges baseWargear + member.equipment, filters by category (weapon|bow|throwing),
 * excludes weapons that already have a poisoned_attacks rule assigned to this member.
 */
export function getEligibleWeapons(
  member: Member,
  baseWargear: string[],
  wargearData: WargearEntry[]
): WargearEntry[]

/**
 * Applies a parameterised rule to a member.
 * Stores as { id, parameter } object, subtracts 5 XP (floored at 0).
 * Returns unchanged member if duplicate exists.
 */
export function applyParameterisedRule(
  member: Member,
  ruleId: string,
  parameter: string | number
): Member

/**
 * Validates a parameter value against its expected type.
 * Returns true if the value is non-empty and matches the parameter_type constraints.
 */
export function isValidParameter(
  value: string | number | null | undefined,
  parameterType: string
): boolean
```

### New UI Component (`src/components/match/ParameterSelector.tsx`)

```typescript
interface ParameterSelectorProps {
  rule: SpecialRuleEntry
  receivingMember: Member
  companyMembers: Member[]
  baseWargear: string[]
  onParameterSelected: (value: string | number) => void
  onCancel: () => void
}
```

Renders the appropriate sub-UI based on `rule.parameter_type`:
- `friendly_hero` → list of hero-role company members (chips, single-select)
- `weapon` → list of eligible wargear items (chips, single-select)
- `integer` / `target_integer` → numeric input field
- `distance` → numeric input with `"` suffix
- `target_keyword` → text input field

### Modified Components

**`PostMatchSummaryPage.tsx` — `HeroAdvancementPanel`**
- After minor rule chip selection, check if selected rule has `parameterised: true`
- If yes, render `ParameterSelector` inline below the chip list
- Disable "Apply" button until parameter is valid
- On apply, call `applyParameterisedRule` instead of `applySpecialRule`

**`PostMatchSummaryPage.tsx` — Minor Rule Picker filter**
- Replace current filter `!member.specialRules.some((sr) => sr === r.label)` with call to `isRuleOwned(member, rule)`
- This handles both string entries (legacy) and object entries (new format)

## Data Models

No schema changes needed. The existing `Member.specialRules` type already supports the mixed array:

```typescript
specialRules: Array<string | { id: string; parameter: string | number }>
```

The `specialRules.json` entries already have the required metadata:

```typescript
interface SpecialRuleData {
  id: string
  label: string
  parameterised: boolean
  parameter_type?: 'friendly_hero' | 'weapon' | 'integer' | 'distance' | 'target_integer' | 'target_keyword'
  minor: boolean
}
```

No database migrations needed — Dexie stores the member objects as-is.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Parameter validation correctness

*For any* parameter value and parameter_type combination, `isValidParameter` SHALL return `true` if and only if the value is non-empty and matches the type constraints (string for friendly_hero/weapon/target_keyword, positive integer for integer/target_integer, positive number with optional quote for distance).

**Validates: Requirements 1.2**

### Property 2: Parameter state reset on rule change

*For any* sequence where a parameterised rule is selected and a parameter value is chosen, then a different rule is selected, the parameter value SHALL be cleared (reset to null/empty).

**Validates: Requirements 1.3**

### Property 3: Hero eligibility filter

*For any* company member array and receiving member ID, `getEligibleHeroes` SHALL return only members whose role is one of (leader, sergeant, hero_in_making) AND whose ID is not equal to the receiving member ID. The result SHALL never include the receiving member and SHALL never include warriors.

**Validates: Requirements 1.4, 2.1**

### Property 4: Weapon eligibility filter

*For any* member with a combined wargear set (baseWargear ∪ equipment, deduplicated) and existing specialRules, `getEligibleWeapons` SHALL return only wargear items whose category is in {weapon, bow, throwing} AND whose id does not appear as the parameter of an existing `{ id: "poisoned_attacks", parameter: <weapon_id> }` entry in the member's specialRules.

**Validates: Requirements 3.1**

### Property 5: Parameterised rule storage format

*For any* valid rule ID and valid parameter value, `applyParameterisedRule` SHALL produce a member whose specialRules array contains an object `{ id: ruleId, parameter: parameterValue }` (not a plain string).

**Validates: Requirements 3.3, 4.1**

### Property 6: XP deduction on parameterised rule confirmation

*For any* member with experience value `xp`, after `applyParameterisedRule` is called (and the rule is not a duplicate), the resulting member's experience SHALL equal `max(0, xp - 5)`.

**Validates: Requirements 4.2**

### Property 7: Duplicate parameterised rule prevention

*For any* member whose specialRules already contains `{ id: ruleId, parameter: paramValue }`, calling `applyParameterisedRule(member, ruleId, paramValue)` SHALL return a member with identical specialRules array and identical experience value (no mutation).

**Validates: Requirements 4.3**

### Property 8: Ownership determination correctness

*For any* member specialRules array (containing a mix of strings and `{ id, parameter }` objects) and any candidate rule:
- A non-parameterised rule is "owned" if and only if the array contains a string matching the rule's id or label
- A parameterised rule is "owned" if and only if the array contains an object with matching id AND exact same parameter, OR a plain string matching the rule's id (legacy)
- A parameterised rule with same id but different parameter is NOT "owned"

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

## Error Handling

| Scenario | Handling |
|----------|----------|
| No eligible heroes for Combat Synergy | Display "No valid targets available" message; disable confirm button |
| No eligible weapons for Poisoned Attacks | Display "No weapons available" message; disable confirm button |
| Member removed while selector open | Re-evaluate eligibility on company state change; close selector if no targets remain |
| Legacy string entry matches parameterised rule id | Treat as owned; exclude from picker (backward compatibility) |
| Invalid parameter value submitted | `isValidParameter` returns false; confirm button remains disabled |
| Rule already owned with same parameter | `applyParameterisedRule` returns member unchanged (idempotent) |

## Testing Strategy

**Property-Based Testing (fast-check, vitest)**

This feature is well-suited for PBT because the core logic involves filtering functions and validation with large input spaces (arbitrary member arrays, equipment combinations, parameter values).

- Library: `fast-check` (already in devDependencies)
- Runner: `vitest --run`
- Minimum 100 iterations per property test
- Tag format: `Feature: parameterized-special-rules, Property {N}: {title}`

**Property tests** (8 properties from Correctness Properties section):
1. Parameter validation — generate random values across all parameter_types
2. State reset — generate rule selection sequences
3. Hero eligibility — generate random company member arrays
4. Weapon eligibility — generate random equipment sets and existing rules
5. Storage format — generate random rule IDs and parameter values
6. XP deduction — generate random XP values (0–100)
7. Duplicate prevention — generate members with pre-existing parameterised rules
8. Ownership determination — generate mixed specialRules arrays

**Unit tests** (example-based):
- Combat Synergy with specific company compositions
- Poisoned Attacks with specific equipment sets
- Edge case: single eligible weapon still requires selection
- Edge case: receiving member is only hero → empty list
- Integration: full flow from chip selection through parameter collection to storage

**Integration tests:**
- End-to-end postmatch flow: select parameterised rule → collect parameter → verify stored object
- Verify `resolveParameterisedLabel` correctly displays stored parameterised rules after the flow completes
