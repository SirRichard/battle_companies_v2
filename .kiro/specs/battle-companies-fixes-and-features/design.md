# Design Document — Battle Companies Fixes and Features

## Overview

This document covers the technical design for four bug fixes and eight new features in the Battle Companies companion app. The app is a React + TypeScript + MUI + Dexie.js PWA that manages MESBG Battle Companies campaigns with all data stored locally via IndexedDB.

The changes span the rating calculator, post-match flow, match tracking, company roster display, member details drawer, stats entry form, and the store/armoury tab. Each item is self-contained and can be implemented independently.

---

## Architecture

The app follows a layered architecture:

```
Data Layer      src/data/*.json          — static game data (read-only)
Model Layer     src/models/*.ts          — TypeScript interfaces for live data
Service Layer   src/services/**          — Dexie.js DB, company factory, rating calculator
Utility Layer   src/utils/*.ts           — pure functions (rating, advancement, labels)
Context Layer   src/context/AppContext   — React context providing companies, stats, save fns
Page Layer      src/pages/*.tsx          — route-level components
Component Layer src/components/**        — reusable UI components
```

All 12 items fit within this existing architecture. No new layers or services are required.

---

## Components and Interfaces

### BUG-1: Minor Special Rule Rating Cap

**Affected files:** `src/utils/rating.ts`, `src/services/calculator/ratingCalculator.ts`

**Current behaviour:** Both calculators apply `member.specialRules.length * 5` with no distinction between minor and major rules, and no cap on minor rules.

**Fix:** Build a lookup map from `specialRules.json` (which has a `minor: boolean` field on each entry) and split the hero's `specialRules` array into minor and major buckets. Apply the cap only to the minor bucket.

The `specialRules.json` entries use `label` as the stored value in `member.specialRules`. The lookup must match by label.

```typescript
// Pseudocode for the new special rule rating logic in rating.ts
const MINOR_RULE_LABELS = new Set(
  specialRulesData.filter(r => r.minor).map(r => r.label)
)

const countableRules = member.specialRules.filter(r => !HEROIC_ACTION_LABELS.has(r))
const minorRules = countableRules.filter(r => MINOR_RULE_LABELS.has(r))
const majorRules = countableRules.filter(r => !MINOR_RULE_LABELS.has(r))

const minorPts = Math.min(minorRules.length * 5, 10)  // capped at 10
const majorPts = majorRules.length * 5                 // uncapped
heroPoints += minorPts + majorPts
```

The same logic must be applied in `ratingCalculator.ts` which uses a different signature but the same conceptual calculation.

---

### BUG-2: Wounds of a Hero — D6 Roll Visibility

**Affected files:** `src/pages/PostMatchSummaryPage.tsx`

**Current behaviour:** When `resolveHeroInjury` returns `wounds_of_a_hero`, the bonus influence D6 is rolled silently inside `applyInjuryAndAdvance` and added to `bonusInfluence` state without any user-visible roll animation.

**Fix:** Introduce a new dialog state `woundsOfHeroDialog` that holds the pre-rolled D6 value and the member name. When `applyInjuryAndAdvance` encounters a `wounds_of_a_hero` outcome, instead of immediately applying the bonus influence, it sets this dialog state. The dialog renders an `AnimatedDice` component (already used elsewhere in the page) showing the D6 result, the computed bonus influence, and an "Acknowledge" button. On acknowledgment, the bonus influence is applied and injury processing continues.

The D6 value must be rolled once before the dialog opens (not on acknowledgment) to satisfy requirement 2.5.

```typescript
// New state
const [woundsOfHeroDialog, setWoundsOfHeroDialog] = useState<{
  memberName: string
  d6Roll: number
  bonusInfluence: number
} | null>(null)
```

The `AnimatedDice` component accepts a `value` prop and a `onSettled` callback — the dialog will show the die animating to the pre-rolled value, then reveal the bonus influence text once settled.

---

### BUG-3: Match History — Human-Readable Injury Labels

**Affected files:** `src/pages/CompanyDetailsPage.tsx` (the `HistoryMatchCard` component and its `injuryLabel` helper)

**Current behaviour:** The `injuryLabel` function uses a generic `raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())` transform, which produces "Arm Wound" correctly but also produces "Warrior Dead" instead of "Dead" for `warrior_dead`.

**Fix:** Replace the generic transform with an explicit lookup map, with the generic transform as a fallback for unknown types.

```typescript
const INJURY_OUTCOME_LABELS: Record<string, string> = {
  arm_wound: 'Arm Wound',
  leg_wound: 'Leg Wound',
  broken_honour: 'Broken Honour',
  missing_next_game: 'Missing Next Game',
  dead: 'Dead',
  full_recovery: 'Full Recovery',
  protection_by_valar: 'Protection by the Valar',
  wounds_of_a_hero: 'Wounds of a Hero',
  warrior_dead: 'Dead',
  warrior_injured: 'Injured',
  warrior_full_recovery: 'Full Recovery',
  warrior_lesson_learned: 'Lesson Learned',
}

function injuryLabel(raw: string): string {
  return INJURY_OUTCOME_LABELS[raw]
    ?? raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
```

This function is already defined inside `HistoryMatchCard` — it just needs to be replaced with the map-based version.

---

### BUG-4: Stats Entry — Min/Max Range Validation

**Affected files:** `src/pages/EditStatsPage.tsx`

**Current behaviour:** The `validateForm` function already exists and already checks `min`/`max` bounds and `warnBelow`/`warnAbove` thresholds. However, the Save button is not disabled when errors exist — `handleSave` calls `validateForm` and returns early if errors are found, but the button itself has no `disabled` prop tied to the error state.

**Fix:** The validation logic is already correct. The only missing piece is disabling the Save button when errors are present. Add a `hasErrors` derived value and pass it to the button's `disabled` prop.

```typescript
const hasErrors = Object.keys(errors).length > 0
// ...
<Button
  variant="contained"
  onClick={handleSave}
  disabled={hasErrors}
  sx={{ minWidth: 160, minHeight: 44 }}
>
```

Additionally, validate on every field change (not just on save attempt) so the button state is live. The `handleFieldChange` function should call `validateForm` after updating the value and update both `errors` and `warnings` state.

---

### FEAT-1: Company Size Counter on Roster Tab

**Affected files:** `src/pages/CompanyDetailsPage.tsx`

**Current behaviour:** The stats bar shows `{ label: 'Members', value: \`${company.members.length}\` }` — a raw count with no maximum.

**Fix:** Replace the Members stat bar entry with a counter that shows `X/Y members` where X includes the wanderer (if hired) and Y is `companyDef.maxCompanySize`.

```typescript
const wandererCount = company.wandererId ? 1 : 0
const totalMembers = company.members.length + wandererCount
const maxSize = companyDef?.maxCompanySize ?? 15
const isAtMax = totalMembers >= maxSize
```

The counter value becomes `\`${totalMembers}/${maxSize}\`` and the `color` of the Typography is set to `'warning.main'` when `isAtMax` is true.

---

### FEAT-2: Promotion Eligibility Indicator in MemberDetailsDrawer

**Affected files:** `src/components/common/MemberDetailsDrawer.tsx`

**Current behaviour:** The XP progress bar is shown but there is no indicator when a member has 5+ XP.

**Fix:** Add a `Chip` component near the XP display that renders only when `member.experience >= 5`. The chip uses the app's primary colour palette and is labelled "Ready to Advance".

The XP section already exists in the drawer's scrollable body. The chip is inserted immediately after the `LinearProgress` bar.

```tsx
{member.experience >= 5 && (
  <Chip
    label="Ready to Advance"
    size="small"
    sx={{
      mt: 0.75,
      fontSize: '0.65rem',
      background: 'rgba(201,168,76,0.15)',
      color: 'primary.main',
      border: '1px solid',
      borderColor: 'primary.main',
    }}
  />
)}
```

---

### FEAT-3: Leader/Sergeant Death Cascade

**Affected files:** `src/pages/PostMatchSummaryPage.tsx`

**Current behaviour:** When a hero dies, they are removed from `workingCompany.members` but no role reassignment occurs.

**Design:** The cascade is triggered inside `applyInjuryAndAdvance` after a member is confirmed dead. It runs after the member is removed from the working company.

**Cascade logic:**

```
Leader dies:
  1. Find surviving sergeants, sort by XP desc, then rating desc
  2. If exactly one candidate → auto-promote to leader
  3. If multiple tied → show CascadeChoiceDialog
  4. If no sergeants → skip (notify user)

Sergeant dies (and surviving sergeants < 2 after death):
  1. Find hero_in_making members, sort by XP desc, then rating desc
  2. If found → promote best to sergeant
  3. If none → find warriors, sort by XP desc, then rating desc
     a. Auto-promote best warrior to hero_in_making + sergeant
     b. Show PathSelectionDialog (same as existing hero_in_making path selection)
  4. If no members at all → skip (notify user)
```

**New state:**

```typescript
const [cascadeDialog, setCascadeDialog] = useState<{
  type: 'leader' | 'sergeant'
  candidates: Array<{ memberId: string; memberName: string; xp: number; rating: number }>
} | null>(null)

const [cascadeSummary, setCascadeSummary] = useState<string | null>(null)
```

The cascade path selection for a newly promoted warrior reuses the existing `pathSelectMember` state and `applyHeroPath` function already present in the page.

**Role change application:** Role changes are applied to `workingCompany` via `setWorkingCompany`. The cascade summary is shown as a dismissible `Alert` or `Snackbar` before the user proceeds to the next casualty.

---

### FEAT-4: Wanderer in Match Tracking Roster

**Affected files:** `src/pages/MatchTrackingPage.tsx`, `src/models/match.ts`

**Current behaviour:** `ActiveMatchState.members` only contains `MemberMatchState` entries for `company.members`. The wanderer is not included.

**Design:** At match setup time (in `MatchSetupPage.tsx` or wherever `ActiveMatchState` is constructed), if `company.wandererId` is set, a synthetic `MemberMatchState` is created from the wanderer's profile in `wanderers.json` and appended to `members`.

The wanderer's `memberId` is set to `company.wandererId` (the wanderer ID string, e.g. `"wandering_swordsman"`). This is safe because wanderer IDs are distinct from UUID member IDs.

The wanderer's role is set to `"wanderer"` — a new string value that the sort function treats as equivalent to `hero_in_making` (position 2.5, after sergeants/heroes-in-making but before warriors, or simply appended after heroes).

The wanderer has M/W/F stats from `wanderers.json`, so `mightMax`, `willMax`, `fateMax` are populated.

**Post-match data:** When `handleEndMatch` builds `xpGained`, the wanderer entry is included. The wanderer's XP gains are passed in `PostMatchData.xpGained` but are NOT applied to `company.members` (since the wanderer is not a member). The post-match page can display the wanderer's XP for record-keeping but does not persist it.

**No model change required** for `MemberMatchState` — the `role` field is already `string`, so `"wanderer"` is valid. The `memberId` field holds the wanderer ID.

---

### FEAT-5: Wanderer Rating Included in Company Rating

**Affected files:** `src/utils/rating.ts`, `src/pages/CompanyDetailsPage.tsx`

**Current behaviour:** `calcCompanyRating` only sums over `company.members`. The wanderer's `pointsCost` is not included.

**Fix:** Add an optional `wanderer` parameter to `calcCompanyRating`:

```typescript
interface WandererData {
  pointsCost: number
  // future: could add isInjured flag if wanderer injury tracking is added
}

export function calcCompanyRating(
  members: Member[],
  getStatsForUnit: (id: string) => StoredBaseUnitStats | undefined,
  wanderer?: WandererData
): number {
  const memberTotal = members
    .filter(m => !m.injuries.some(i => i.type === 'missing_next_game'))
    .reduce((sum, m) => sum + calcMemberRating(m, getStatsForUnit(m.baseUnitId)), 0)
  
  const wandererTotal = wanderer ? wanderer.pointsCost : 0
  return memberTotal + wandererTotal
}
```

`CompanyDetailsPage` resolves the wanderer from `wanderersData` using `company.wandererId` and passes `{ pointsCost: wanderer.pointsCost }` to `calcCompanyRating`.

The same pattern applies to `ratingCalculator.ts` for consistency.

---

### FEAT-6: Spells Persisted on Member Model

**Affected files:** `src/models/index.ts`, `src/components/wizard/StepSpellSelection.tsx` (indirectly via wizard), `src/pages/PostMatchSummaryPage.tsx`, `src/components/common/MemberDetailsDrawer.tsx`

**Model changes:**

```typescript
export interface Member {
  // ... existing fields ...
  spells?: string[]                          // spell IDs from CHANNELING_SPELLS
  spellImprovements?: Record<string, number> // spellId → number of casting value improvements
}
```

Both fields are optional for backward compatibility with existing persisted data.

**Wizard (CreateCompanyPage):** The wizard already collects `heroSpellChoices` in `WizardState`. The `companyFactory.ts` must be updated to write `member.spells = [heroSpellChoices[tempId]]` when creating a hero on Path of Channeling.

**PostMatchSummaryPage:** When a hero advancement roll produces a `magical_power` result, the chosen spell ID is appended to `member.spells`. When the result is `improve_casting_value`, the chosen spell's improvement count in `member.spellImprovements` is incremented (max 2 per spell per the rules).

**MemberDetailsDrawer:** A new "Magical Powers" section is rendered when `member.spells?.length > 0`. Each spell is displayed with its label (looked up from `CHANNELING_SPELLS`) and its effective casting value (base casting value minus the number of improvements, since lower is better in MESBG).

---

### FEAT-7: Hero Wargear Accessibility

**Affected files:** `src/pages/CompanyDetailsPage.tsx` (the `StoreTab` component)

**Current behaviour:** The wargear purchase list for a hero is built from the hero's own `baseUnitId` profile only.

**Fix:** Expand the wargear pool to include all `baseUnitId` values referenced in the company's `reinforcementTable`, `specialTable`, and `specialUnits` arrays.

```typescript
function getAllCompanyProfileIds(companyDef: CompanyDefinition): string[] {
  const ids = new Set<string>()
  for (const row of companyDef.reinforcementTable) {
    if (row.baseUnitId) ids.add(row.baseUnitId)
    if (row.units) row.units.forEach(u => ids.add(u.baseUnitId))
    if (row.pool) row.pool.forEach(u => ids.add(u.baseUnitId))
  }
  for (const row of companyDef.specialTable ?? []) {
    if (row.baseUnitId) ids.add(row.baseUnitId)
  }
  for (const unit of companyDef.specialUnits ?? []) {
    ids.add(unit.baseUnitId)
  }
  return Array.from(ids)
}
```

The wargear available to each profile is derived from `baseUnits.json` (`baseEquipment` + `equipmentOptions`). The union of all profiles' wargear (de-duplicated) forms the hero's purchase pool. The existing cost rules (lower cost if A+W < 3, higher if A+W ≥ 3) apply unchanged.

---

### FEAT-8: Injury Treatment from Store Tab

**Affected files:** `src/pages/CompanyDetailsPage.tsx` (the `StoreTab` component)

**Current behaviour:** Injury treatment is only accessible from `MemberDetailsDrawer`.

**Design:** Add an "Injury Treatment" section to `StoreTab`. This section lists all members with treatable injuries (warriors with `missing_next_game`, heroes with `arm_wound`, `leg_wound`, or `broken_honour`).

The treatment logic is extracted from `MemberDetailsDrawer` into a shared utility or replicated inline in `StoreTab`. To avoid divergence, the treatment state machine (options dialog → roll dialog → confirm) is implemented as a self-contained sub-component `InjuryTreatmentPanel` that can be used in both locations.

```typescript
interface InjuryTreatmentPanelProps {
  member: Member
  company: Company
  onSaveCompany: (c: Company) => Promise<void>
}
```

The panel renders:
- Current influence balance
- For warriors: "Remove injury (1 IP)" button
- For heroes: "Miss next game (1 IP)" or "Roll to treat (1 IP + adjustments)" options
- Disabled state with reason when influence is insufficient

---

## Data Models

### Member model additions (FEAT-6)

```typescript
export interface Member {
  // ... all existing fields unchanged ...
  spells?: string[]                          // optional; spell IDs from CHANNELING_SPELLS
  spellImprovements?: Record<string, number> // optional; spellId → improvement count (0–2)
}
```

No database migration is needed — Dexie.js stores the full object and missing optional fields default to `undefined` on read.

### PostMatchData additions (FEAT-4 wanderer XP)

No model change required. The wanderer's XP entry in `xpGained` uses the wanderer ID as `memberId`. The post-match page already handles XP display generically.

### ActiveMatchState (FEAT-4)

No structural change. The wanderer is represented as a `MemberMatchState` with `role: "wanderer"` and `memberId` equal to the wanderer's ID string.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Minor special rule cap

*For any* hero with N minor special rules (where N ≥ 0) and M major special rules (where M ≥ 0), the special rule contribution to their rating SHALL equal `min(N * 5, 10) + M * 5`, excluding any heroic action labels.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

### Property 2: Rating calculator consistency

*For any* hero member with any combination of stats, equipment, and special rules, `calcMemberRating` in `src/utils/rating.ts` and `calcMemberRating` in `src/services/calculator/ratingCalculator.ts` SHALL produce the same result.

**Validates: Requirements 1.8**

### Property 3: Injury outcome label is always human-readable

*For any* injury outcome type string in the known set (`arm_wound`, `leg_wound`, `broken_honour`, `missing_next_game`, `dead`, `full_recovery`, `protection_by_valar`, `wounds_of_a_hero`, `warrior_dead`, `warrior_injured`, `warrior_full_recovery`, `warrior_lesson_learned`), the label function SHALL return a string that contains no underscores and begins with an uppercase letter.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Stats validation rejects out-of-range values

*For any* stat field and any integer value strictly outside the field's `[min, max]` range, `validateForm` SHALL return a non-empty error for that field.

**Validates: Requirements 4.1, 4.2, 4.7**

### Property 5: Stats validation accepts in-range values

*For any* complete set of stat values where every value is within its field's `[min, max]` range, `validateForm` SHALL return an empty errors object (no blocking errors).

**Validates: Requirements 4.3**

### Property 6: Stats validation warns on threshold violations

*For any* stat field with a non-null `warnBelow` threshold and any value V where `min ≤ V < warnBelow`, `validateForm` SHALL return a warning for that field and no error.

*For any* stat field with a non-null `warnAbove` threshold and any value V where `warnAbove < V ≤ max`, `validateForm` SHALL return a warning for that field and no error.

**Validates: Requirements 4.4, 4.5**

### Property 7: Company size counter includes wanderer

*For any* company with or without a `wandererId`, the displayed member count X SHALL equal `company.members.length + (company.wandererId ? 1 : 0)`.

**Validates: Requirements 5.1, 5.2**

### Property 8: Promotion eligibility indicator threshold

*For any* member, the promotion-eligibility indicator SHALL be visible if and only if `member.experience >= 5`.

**Validates: Requirements 6.1, 6.3, 6.4**

### Property 9: Leader death cascade always produces a valid leader

*For any* company state where the leader is removed and at least one sergeant exists, the death cascade SHALL result in exactly one member having role `leader` after the cascade completes.

**Validates: Requirements 7.1, 7.2**

### Property 10: Wanderer rating contribution

*For any* company with a `wandererId`, `calcCompanyRating` SHALL return a value greater than or equal to the result it would return without the wanderer, with the difference equal to the wanderer's `pointsCost`.

**Validates: Requirements 9.1, 9.2**

### Property 11: Spell round-trip persistence

*For any* spell ID added to `member.spells`, saving and reloading the company from IndexedDB SHALL produce a member whose `spells` array contains that spell ID.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 12: Hero wargear pool is a superset of own-profile wargear

*For any* hero in a company, the wargear purchase pool available to that hero SHALL be a superset of the wargear available to the hero's own `baseUnitId` profile.

**Validates: Requirements 11.1, 11.2, 11.3**

---

## Error Handling

**BUG-1 (rating cap):** If `specialRules.json` does not contain an entry for a rule label stored on a member, the rule is treated as major (no cap). This is the safe default — it avoids under-counting.

**BUG-2 (D6 dialog):** If `workingCompany` is null when the dialog is acknowledged, the acknowledgment is a no-op. The dialog cannot be opened without a valid working company.

**FEAT-3 (death cascade):** If no eligible member exists to fill a vacant role, the cascade is skipped and a notification is shown. The company is saved in its current state (with the vacant role). This matches requirement 7.10.

**FEAT-4 (wanderer in match):** If `company.wandererId` references an ID not found in `wanderers.json`, the wanderer entry is silently omitted from the match roster. A console warning is logged.

**FEAT-5 (wanderer rating):** If the wanderer ID is not found in `wanderers.json`, the wanderer contributes 0 pts to the rating. No error is thrown.

**FEAT-6 (spells):** If `member.spells` is undefined (existing data), all spell-related UI sections are hidden. The `spellImprovements` field defaults to `{}` when undefined.

**FEAT-8 (injury treatment):** If `company.influence` drops below the treatment cost between the options dialog opening and the confirm action (e.g. concurrent save), the confirm handler re-checks the balance and shows an error if insufficient.

---

## Testing Strategy

### Unit tests (example-based)

- `injuryLabel` function: verify each of the 12 specific mappings and the fallback for an unknown type
- `validateForm`: verify error on empty input, error on non-numeric input, correct error messages for out-of-range values
- Company size counter: verify `X/Y` format with and without wanderer, verify warning colour at max
- Promotion indicator: verify chip appears at exactly 5 XP and is absent at 4 XP
- Wanderer match state construction: verify the synthetic `MemberMatchState` has correct M/W/F values from `wanderers.json`

### Property-based tests

The app uses TypeScript/Vitest. Property-based testing is implemented using **fast-check** (`npm install --save-dev fast-check`), configured to run a minimum of 100 iterations per property.

Each property test is tagged with a comment in the format:
`// Feature: battle-companies-fixes-and-features, Property N: <property text>`

**Property 1 — Minor special rule cap:**
Generate arbitrary heroes with random counts of minor rules, major rules, and heroic actions. Assert `min(minorCount * 5, 10) + majorCount * 5` equals the special rule contribution extracted from `calcMemberRating`.

**Property 2 — Rating calculator consistency:**
Generate arbitrary `Member` objects and `StoredBaseUnitStats`. Assert both calculators return the same value.

**Property 3 — Injury label human-readable:**
Generate arbitrary strings from the known outcome type set. Assert the label contains no underscores and starts with an uppercase letter.

**Property 4 — Stats validation rejects out-of-range:**
For each field in `STATS_ENTRY_FIELDS` and `MOUNT_STATS_ENTRY_FIELDS`, generate integers outside `[min, max]`. Assert `validateForm` returns an error for that field.

**Property 5 — Stats validation accepts in-range:**
Generate complete form value sets where every value is within bounds. Assert `validateForm` returns no errors.

**Property 6 — Stats validation warns on threshold:**
Generate values in the warn zones. Assert warnings are present and errors are absent.

**Property 7 — Company size counter:**
Generate companies with random member counts and random `wandererId` presence. Assert the counter equals `members.length + (wandererId ? 1 : 0)`.

**Property 8 — Promotion eligibility threshold:**
Generate members with random `experience` values. Assert the indicator is shown iff `experience >= 5`.

**Property 9 — Leader death cascade:**
Generate company states with a leader and 1+ sergeants. Simulate leader death. Assert exactly one member has role `leader` after cascade.

**Property 10 — Wanderer rating contribution:**
Generate companies with and without a wanderer. Assert the difference in rating equals the wanderer's `pointsCost` when present.

**Property 11 — Spell round-trip:**
Generate spell IDs from `CHANNELING_SPELLS`. Add to a member, save to mock DB, reload. Assert the spell ID is present.

**Property 12 — Hero wargear superset:**
Generate company definitions. Assert the expanded wargear pool for any hero is a superset of the hero's own profile wargear.
