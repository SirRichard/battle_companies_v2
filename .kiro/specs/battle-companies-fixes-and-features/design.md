# Design Document — Battle Companies Fixes and Features

## Overview

This document covers the technical design for all 29 items in the Battle Companies companion app spec. The app is a React + TypeScript + MUI + Dexie.js PWA that manages MESBG Battle Companies campaigns with all data stored locally via IndexedDB.

The changes span the rating calculator, post-match flow, match tracking, company roster display, member details drawer, stats entry form, store/armoury tab, company creation wizard, and toolkit assignment. Each item is self-contained and can be implemented independently.

**Bugs addressed (Requirements 1–4, 13, 14, 16, 20, 29):**
- Req 1 (BUG-1): Minor special rules not capped in hero rating calculation
- Req 2 (BUG-2): "Wounds of a Hero" D6 roll not shown to the user
- Req 3 (BUG-3): Match history injury outcomes shown as raw type strings
- Req 4 (BUG-4): Stats entry form does not enforce min/max range validation
- Req 13 (BUG-FIX): Injury treatment does not update MemberDetailsDrawer in real time
- Req 14 (BUG-FIX + FEAT): Gold step member ordering and hero classification incorrect
- Req 16 (BUG-FIX): Store tab unit selector not sorted correctly
- Req 20 (BUG-FIX): Hero advancement card state not reset between heroes
- Req 29 (BUG-FIX): "Missing Next Game" injury not auto-cleared after a completed match

**Features addressed (Requirements 5–12, 15, 17–19, 21–28):**
- Req 5 (FEAT-1): Company size counter on the Roster tab
- Req 6 (FEAT-2): Promotion eligibility indicator in MemberDetailsDrawer
- Req 7 (FEAT-3): Leader/Sergeant death cascade in PostMatchSummaryPage
- Req 8 (FEAT-4): Wanderer shown in match tracking roster
- Req 9 (FEAT-5): Wanderer rating included in company rating
- Req 10 (FEAT-6): Spells/Magical Powers persisted on the Member model
- Req 11 (FEAT-7): Hero wargear accessibility expanded to all company profiles
- Req 12 (FEAT-8): Injury treatment accessible from the Store/Armoury tab
- Req 15 (FEAT): Remove non-armour weapons from hero wargear in MemberDetailsDrawer
- Req 17 (FEAT): Show rank and equipped wargear in ToolkitAssignmentPage member selector
- Req 18 (FEAT): Toolkit items on MatchTrackingPage with consumable usage tracking
- Req 19 (FEAT): PathCardSelector in PostMatchSummaryPage for heroic path selection
- Req 21 (FEAT): Start Match button available from all tabs in CompanyDetailsPage
- Req 22 (NEW-1): Against the Odds — wanderer selection in PostMatchSummaryPage
- Req 23 (NEW-2): Consumable toolkit items — remove on use in MatchTrackingPage
- Req 24 (NEW-3): Hero progression roll of 5 — apply both results automatically
- Req 25 (NEW-4): Injury treatment — prompt to use IP after D6 roll
- Req 26 (NEW-5): Store tab — capitalize Leader/Sergeant titles and fix "Hero in the Making" label
- Req 27 (NEW-6): Roster tab — warriors show only loadout choices
- Req 28 (NEW-7): Store > Wargear tab — hide wargear type label, keep bow limit

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

All 29 items fit within this existing architecture. No new layers or services are required.

**Patterns introduced by Requirements 13–29:**

- **Reactive member derivation (Req 13):** `CompanyDetailsPage` replaces the `selectedMember` snapshot state with a `selectedMemberId` string. The member object is derived reactively from the live `companies` array, so any `saveCompany` call automatically propagates to the open drawer without a close/reopen cycle.

- **Injury treatment state machine (Req 12, 25):** The hero injury treatment flow is structured as an explicit multi-stage state machine (`options → rolling → ip_prompt → confirm`). The `InjuryTreatmentPanel` sub-component encapsulates this machine so it can be reused in both `MemberDetailsDrawer` and `StoreTab` without logic divergence.

- **Auto-clear transform at save time (Req 29):** Rather than adding new UI or user interaction, the `missing_next_game` auto-clear is applied as a pure transform on `workingCompany` immediately before the final `saveCompany` call in `PostMatchSummaryPage`. This keeps the pattern simple and side-effect-free.

- **Roll-5 detection in hero advancement (Req 24):** `HeroAdvancementCard` detects `rollA === 5 || rollB === 5` at render time and switches to a "both results apply" mode, bypassing the A/B choice UI and presenting sub-choice pickers for each result in sequence.

- **Wanderer ATO sub-step (Req 22):** The Influence step in `PostMatchSummaryPage` gains a conditional sub-step that opens a wanderer selection dialog when `postMatchData.atoBonuses.includes('wanderer')` and the selection has not yet been resolved. The selected wanderer ID is written to `workingCompany.wandererId` and persisted with the final company save.

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

### Member model additions (FEAT-6 / Req 10)

```typescript
export interface Member {
  // ... all existing fields unchanged ...
  spells?: string[]                          // optional; spell IDs from CHANNELING_SPELLS
  spellImprovements?: Record<string, number> // optional; spellId → improvement count (0–2)
}
```

Both fields are optional for backward compatibility with existing persisted data. No database migration is needed — Dexie.js stores the full object and missing optional fields default to `undefined` on read.

### MemberMatchState additions (Req 18 / Req 23)

```typescript
export interface MemberMatchState {
  // ... all existing fields unchanged ...
  usedToolkitItems?: string[]  // optional; itemIds of consumable items marked as used during the match
}
```

This field is optional for backward compatibility. It defaults to `[]` when absent. It is used by both Req 18 (display used state) and Req 23 (gate the "Remove" button on used consumable items).

### PostMatchData (FEAT-4 wanderer XP / Req 8)

No model change required. The wanderer's XP entry in `xpGained` uses the wanderer ID as `memberId`. The post-match page already handles XP display generically.

### ActiveMatchState (FEAT-4 / Req 8)

No structural change. The wanderer is represented as a `MemberMatchState` with `role: "wanderer"` and `memberId` equal to the wanderer's ID string.

### Req 29 (auto-clear `missing_next_game`)

No model change. The auto-clear is a pure transform applied to `workingCompany.members` at save time — no new fields are added.

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

**Req 1 / BUG-1 (rating cap):** If `specialRules.json` does not contain an entry for a rule label stored on a member, the rule is treated as major (no cap). This is the safe default — it avoids under-counting.

**Req 2 / BUG-2 (D6 dialog):** If `workingCompany` is null when the dialog is acknowledged, the acknowledgment is a no-op. The dialog cannot be opened without a valid working company.

**Req 3 / BUG-3 (injury labels):** If an injury outcome type is not found in `INJURY_OUTCOME_LABELS`, the fallback humaniser (`replace(/_/g, ' ')` + title-case) is applied. No error is thrown.

**Req 4 / BUG-4 (stats validation):** If a stat input is empty or non-numeric, `validateForm` treats it as invalid and the Save button remains disabled. No error is thrown to the user — the inline error message is sufficient.

**Req 7 / FEAT-3 (death cascade):** If no eligible member exists to fill a vacant role, the cascade is skipped and a notification is shown. The company is saved in its current state (with the vacant role). This matches requirement 7.10.

**Req 8 / FEAT-4 (wanderer in match):** If `company.wandererId` references an ID not found in `wanderers.json`, the wanderer entry is silently omitted from the match roster. A console warning is logged.

**Req 9 / FEAT-5 (wanderer rating):** If the wanderer ID is not found in `wanderers.json`, the wanderer contributes 0 pts to the rating. No error is thrown.

**Req 10 / FEAT-6 (spells):** If `member.spells` is undefined (existing data), all spell-related UI sections are hidden. The `spellImprovements` field defaults to `{}` when undefined.

**Req 12 / FEAT-8 (injury treatment from Store):** If `company.influence` drops below the treatment cost between the options dialog opening and the confirm action (e.g. concurrent save), the confirm handler re-checks the balance and shows an error if insufficient.

**Req 13 (real-time drawer update):** If `selectedMemberId` refers to a member that no longer exists in `company.members` (e.g. deleted during cascade), the derived `selectedMember` is `null` and the drawer closes gracefully.

**Req 14 (gold step ordering):** If `leaderId` is null or does not match any hero in the roster, the first hero in the array is treated as the leader for labelling purposes. No error is thrown.

**Req 18 (toolkit items):** If `wargear.json` or `equipment.json` does not contain an entry for a toolkit item ID, `isConsumable` returns `false` (safe default — the item is treated as non-consumable and shown as a plain chip).

**Req 22 (wanderer ATO selection):** If the user dismisses the wanderer selection dialog without choosing, `company.wandererId` is left unchanged. If `wanderers.json` is empty (should not occur), the dialog renders an empty list and the user can only dismiss.

**Req 23 (consumable item removal):** If `setMatch` is called with a null previous state, the update is a no-op. The "Remove" button is only rendered when the item is already in `usedToolkitItems`, so the state is always valid before removal.

**Req 24 (roll-5 progression):** If both `resultA` and `resultB` require sub-choices and the user has not completed all choices, the "Apply" button remains disabled. No partial application occurs.

**Req 25 (IP prompt after roll):** If `company.influence` is 0 when the IP prompt is shown, the "Spend IP" option is disabled with a reason message. The user can still accept the rolled result without spending IP.

**Req 29 (auto-clear `missing_next_game`):** If `workingCompany` is null at save time, the existing null-guard prevents the save. No additional error handling is needed. If no members have `missing_next_game`, the filter is a no-op and the save proceeds normally.

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


---

### Requirement 13: Injury Treatment Real-Time Update in MemberDetailsDrawer (BUG-FIX)

**Affected files:** `src/components/common/MemberDetailsDrawer.tsx`

**Current behaviour:** The drawer receives `member` and `company` as props from the parent (`CompanyDetailsPage`). When `handleTreatConfirm` calls `onSaveCompany`, the DB is updated and the parent re-renders with the new company, but the `selectedMember` state in the parent still holds the old member snapshot. The drawer therefore continues to display the stale injury list until the user closes and reopens it.

Additionally, the current treatment flow for `missing_next_game` on heroes routes through the `roll_hero` or `miss_hero` path rather than the simpler no-roll path that warriors use. Requirement 13.5–13.6 mandates that `missing_next_game` is always cleared by spending 1 IP with no roll, for both heroes and warriors.

**Fix — real-time update:**

The root cause is that `selectedMember` in `CompanyDetailsPage` is a snapshot. After `onSaveCompany` resolves, the parent's `companies` array is updated via context, but `selectedMember` is not refreshed. The fix is to derive the displayed member from the live `companies` array rather than holding a stale snapshot.

In `CompanyDetailsPage`, replace the `selectedMember` state with a `selectedMemberId` state. The member object passed to `MemberDetailsDrawer` is then derived reactively:

```typescript
const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
const selectedMember = selectedMemberId
  ? company.members.find((m) => m.id === selectedMemberId) ?? null
  : null
```

This means every time `saveCompany` updates the context, the drawer automatically receives the fresh member object with the updated injury list and the updated influence balance — no close/reopen required.

**Fix — `missing_next_game` no-roll path:**

In `MemberDetailsDrawer`, the treatment options dialog must detect `missing_next_game` injuries and always offer the no-roll "spend 1 IP to clear" option, regardless of whether the member is a hero or warrior. The existing `remove_warrior` treatment type already implements this logic; it should be renamed or generalised to `remove_missing` and applied to both roles.

```typescript
// Pseudocode for the updated treatment type dispatch
if (treatType === 'remove_missing') {
  // 1 IP: remove missing_next_game from any member (hero or warrior)
  const updated = {
    ...company,
    influence: influence - 1,
    members: company.members.map((m) =>
      m.id !== member.id ? m : {
        ...m,
        injuries: m.injuries.filter(i => i.type !== 'missing_next_game'),
      }
    ),
  }
  await onSaveCompany(updated)
}
```

The treatment options dialog should present `missing_next_game` as a single "Remove (1 IP)" option for all members, and only show the roll/miss options for hero-specific injuries (`arm_wound`, `leg_wound`, `broken_honour`).

---

### Requirement 14: Gold Step Ordering and Hero Classification in Company Creation Wizard (BUG-FIX + FEAT)

**Affected files:** `src/components/wizard/StepGoldEquipment.tsx`

**Current behaviour:**

1. Members are rendered in the order they appear in the `members` prop, which is the raw wizard roster order — not sorted by role.
2. The hero classification label uses `member.tempId === members.find(m => m.isHero)?.tempId` to detect the leader. This is fragile: it finds the first hero in the unsorted array, which may not be the actual leader.
3. There are no tabs for heroes — all wargear options are shown in a flat list.
4. Creatures are not purchasable in this step.

**Fix — member ordering:**

Add a sort function that orders: leader first (the single hero whose `tempId` matches the wizard's `leaderId`, or the first hero if not available), then remaining heroes alphabetically by name, then warriors alphabetically by name.

Since `StepGoldEquipment` receives a flat `members: RosterMember[]` prop without explicit role data beyond `isHero`, the wizard must pass a `leaderId` prop (the `tempId` of the designated leader) so the step can correctly identify and label the leader.

```typescript
// Updated Props
interface Props {
  gold: number
  members: RosterMember[]
  companyTypeId: string
  goldPurchases: Record<string, string[]>
  leaderId: string | null  // NEW: tempId of the leader
  onUpdate: (tempId: string, wargearIds: string[]) => void
}

function sortMembers(members: RosterMember[], leaderId: string | null): RosterMember[] {
  const heroes = members.filter(m => m.isHero)
  const warriors = members.filter(m => !m.isHero)
  const leader = heroes.find(h => h.tempId === leaderId) ?? heroes[0] ?? null
  const sergeants = heroes
    .filter(h => h.tempId !== leader?.tempId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const sortedWarriors = [...warriors].sort((a, b) => a.name.localeCompare(b.name))
  return [...(leader ? [leader] : []), ...sergeants, ...sortedWarriors]
}

function getMemberLabel(member: RosterMember, leaderId: string | null): string {
  if (!member.isHero) return 'Warrior'
  return member.tempId === leaderId ? 'Leader' : 'Sergeant'
}
```

**Fix — hero tabs (Wargear / Equipment / Creatures):**

For hero members, replace the flat wargear list with a tab bar containing three tabs: "Wargear", "Equipment", and "Creatures". Warriors show only "Wargear" and "Equipment" tabs.

Add local state `heroTab: Record<string, 'wargear' | 'equipment' | 'creatures'>` keyed by `tempId` to track the active tab per member.

The Equipment tab lists items from `equipment.json` that are purchasable for the hero's profile (using the same `getAccessible` logic but filtered to equipment items). The Creatures tab lists creatures from `creatures.json` filtered to those available to the company (using a `getAvailableCreatures(companyTypeId)` helper).

**Fix — creature purchases:**

Creature purchases are stored in the same `goldPurchases` structure: `goldPurchases[tempId]` may contain creature IDs alongside wargear IDs. The gold cost for a creature is sourced from `creatures.json[creature].pointsCost` (using `pointsCost` as the gold cost, consistent with how wargear uses `rating[0]`).

```typescript
// creatures.json entry shape (relevant fields)
interface CreatureEntry {
  id: string
  label: string
  pointsCost: number
  // companyIds?: string[]  — if present, filter by company
}

function getAvailableCreatures(companyTypeId: string): CreatureEntry[] {
  // Return creatures that are available to the given company type
  // If a creature has no companyIds restriction, it is universally available
  return creaturesData.filter(c =>
    !c.companyIds || c.companyIds.includes(companyTypeId)
  )
}
```

The `onUpdate` callback signature is unchanged — creature IDs are simply additional entries in the `string[]` array for that `tempId`.

---

### Requirement 15: Remove Non-Armour Weapons from Hero Wargear in MemberDetailsDrawer (FEAT)

**Affected files:** `src/components/common/MemberDetailsDrawer.tsx`

**Current behaviour:** The wargear section in the drawer is read-only. There is no mechanism to remove items from `member.equipment`.

**Design:**

Add an edit mode to the wargear section for heroes only. The mode is toggled by an "Edit" button that appears in the wargear section header. A "Done" button exits edit mode.

New state:

```typescript
const [wargearEditMode, setWargearEditMode] = useState(false)
const [removeConfirmItem, setRemoveConfirmItem] = useState<string | null>(null)
```

**Removable item classification:**

An item is removable if and only if:
1. It is present in `member.equipment` (not just in `baseEquipment` from `baseUnits.json`), AND
2. Its `category` in `wargear.json` is NOT `'armour'` (i.e. not `light_armour`, `armour`, `heavy_armour`, `dwarf_armour`, `heavy_dwarf_armour`).

Base equipment items (those in `getBaseEquipment(member.baseUnitId)`) are never removable regardless of category.

```typescript
const ARMOUR_CATEGORIES = new Set(['armour'])  // wargear.json category value

function isRemovable(itemId: string, member: Member): boolean {
  const baseEquip = getBaseEquipment(member.baseUnitId)
  if (baseEquip.includes(itemId)) return false
  const wgEntry = WARGEAR_RAW.find(w => w.id === itemId)
  if (wgEntry?.category === 'armour') return false
  return true
}
```

**Removal flow:**

1. User taps "Edit" → `wargearEditMode = true`
2. Each removable item shows an "×" `IconButton`
3. User taps "×" → `removeConfirmItem = itemId`
4. `ConfirmDialog` opens: "Remove [item label] from [member name]'s equipment?"
5. On confirm: filter `member.equipment`, call `onSaveCompany`
6. On cancel: `removeConfirmItem = null`
7. User taps "Done" → `wargearEditMode = false`

```typescript
const handleRemoveWargear = async (itemId: string) => {
  if (!member || !company || !onSaveCompany) return
  const updated: Company = {
    ...company,
    members: company.members.map(m =>
      m.id !== member.id ? m : {
        ...m,
        equipment: m.equipment.filter(e => e !== itemId),
      }
    ),
  }
  await onSaveCompany(updated)
  setRemoveConfirmItem(null)
}
```

Warriors: the "Edit" button is not rendered when `member.role === 'warrior'`.

---

### Requirement 16: Store Tab Unit Ordering (BUG-FIX)

**Affected files:** `src/pages/CompanyDetailsPage.tsx` (the `StoreTab` component)

**Current behaviour:** The member selector in `StoreTab` iterates `company.members` in insertion order, which is the order members were added to the company — not the canonical leader-first, sergeants-alpha, warriors-alpha order.

**Fix:**

Extract a shared sort utility (or reuse the existing `ROLE_ORDER` map already defined at the top of `CompanyDetailsPage.tsx`) and apply it to the member list before rendering the selector.

```typescript
function sortMembersForStore(members: Member[]): Member[] {
  return [...members].sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 3
    const rb = ROLE_ORDER[b.role] ?? 3
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name)
  })
}
```

For the **wargear and equipment** member selector: apply `sortMembersForStore` to `company.members`.

For the **creatures** member selector: filter to heroes only (`role !== 'warrior'`), then apply the same sort. If no heroes exist, render an empty state or hide the creatures tab.

This sort must be applied consistently in every `Select` / member picker within `StoreTab` — wargear purchases, equipment purchases, and creature purchases.

---

### Requirement 17: Show Rank and Equipped Wargear in ToolkitAssignmentPage Member Selector (FEAT)

**Affected files:** `src/pages/ToolkitAssignmentPage.tsx`

**Current behaviour:** The `Select` for item assignment renders `<MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>` — name only, no rank or wargear.

**Design:**

Replace the plain name `MenuItem` with a compact two-line layout:

```tsx
<MenuItem key={m.id} value={m.id}>
  <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {m.name}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.55, fontSize: '0.62rem' }}>
        {rankLabel(m.role)}
      </Typography>
    </Box>
    {memberWargear(m).length > 0 && (
      <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.6rem' }}>
        {memberWargear(m).map(getWargearLabel).join(', ')}
      </Typography>
    )}
  </Box>
</MenuItem>
```

Helper functions:

```typescript
function rankLabel(role: string): string {
  if (role === 'leader') return 'Leader'
  if (role === 'sergeant') return 'Sergeant'
  if (role === 'hero_in_making') return 'Hero in the Making'
  return 'Warrior'
}

function memberWargear(member: Member): string[] {
  const base = BASE_UNITS_RAW.find(u => u.id === member.baseUnitId)?.baseEquipment ?? []
  return Array.from(new Set([...base, ...(member.equipment ?? [])]))
}
```

The compact two-line format keeps the member name prominent on the first line and the rank + wargear on the second line in a smaller, muted style. On small screens the second line wraps gracefully.

---

### Requirement 18: Toolkit Items on MatchTrackingPage with Consumable Usage Tracking (FEAT)

**Affected files:** `src/pages/MatchTrackingPage.tsx`, `src/models/match.ts`

**Current behaviour:** `MemberMatchCard` renders stats, M/W/F, XP, and casualty toggle. Toolkit items assigned in `ToolkitAssignmentPage` are stored in `ActiveMatchState.toolkitItems` but are never displayed on the match card.

**Model change — `MemberMatchState`:**

Add a `usedToolkitItems` field to track which consumable items have been used:

```typescript
export interface MemberMatchState {
  // ... existing fields ...
  usedToolkitItems?: string[]  // itemIds of consumable items marked as used
}
```

This field is optional for backward compatibility. It defaults to `[]` when absent.

**Consumable flag:**

The consumable flag is sourced from `equipment.json` (field `consumable: true`) and `wargear.json`. Toolkit kit items are wargear IDs. A lookup function:

```typescript
const EQUIPMENT_RAW = equipmentData as Array<{ id: string; consumable?: boolean }>
const WARGEAR_CONSUMABLE = new Set(
  (wargearData as Array<{ id: string; consumable?: boolean }>)
    .filter(w => w.consumable)
    .map(w => w.id)
)
const EQUIPMENT_CONSUMABLE = new Set(
  EQUIPMENT_RAW.filter(e => e.consumable).map(e => e.id)
)

function isConsumable(itemId: string): boolean {
  return WARGEAR_CONSUMABLE.has(itemId) || EQUIPMENT_CONSUMABLE.has(itemId)
}
```

**`MemberMatchCard` changes:**

At the bottom of each card, after the XP/casualty row, render a "Toolkit" section if the member has assigned items:

```typescript
const assignedItems = match.toolkitItems.filter(t => t.memberId === mm.memberId)
if (assignedItems.length === 0) return null  // no section rendered

// For each item:
const isUsed = mm.usedToolkitItems?.includes(item.itemId) ?? false
const consumable = isConsumable(item.itemId)
```

Consumable items show a "Use" button. On press, `updateMember(mm.memberId, { usedToolkitItems: [...(mm.usedToolkitItems ?? []), item.itemId] })`. The item is then rendered with `textDecoration: 'line-through'` and reduced opacity.

Non-consumable items render as a plain `Chip` with no interactive controls.

The `updateMember` call persists the state to `ActiveMatchState` via the existing `saveActiveMatch` effect, so the used state survives page reload.

**`MatchTrackingPage` prop threading:**

`MemberMatchCard` needs access to `match.toolkitItems`. Pass it as a prop:

```typescript
interface CardProps {
  // ... existing ...
  toolkitItems: ToolkitItem[]
}
```

---

### Requirement 19: PathCardSelector in PostMatchSummaryPage for Heroic Path Selection (FEAT)

**Affected files:** `src/pages/PostMatchSummaryPage.tsx`

**Current behaviour:** The `PathSelectionDialog` sub-component renders a plain vertical list of path buttons. It does not use `PathCardSelector`.

**Design:**

Replace the plain list in `PathSelectionDialog` with `PathCardSelector`. The dialog wraps the selector in a `Dialog` with `fullWidth maxWidth="sm"`.

```typescript
// Updated PathSelectionDialog
function PathSelectionDialog({
  memberName,
  baseUnitId,
  equipment,
  onSelect,
}: {
  memberName: string
  baseUnitId: string
  equipment: string[]
  onSelect: (pathId: string) => void
}) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  const baseStats = getStatsForUnit(baseUnitId)?.stats

  return (
    <Dialog open fullWidth maxWidth="sm" PaperProps={{ sx: { /* existing styles */ } }}>
      <DialogTitle>Choose Heroic Path — {memberName}</DialogTitle>
      <DialogContent>
        <PathCardSelector
          selectedPathId={selectedPathId}
          onSelect={setSelectedPathId}
          baseStats={baseStats}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={!selectedPathId}
          onClick={() => selectedPathId && onSelect(selectedPathId)}
        >
          Confirm Path
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

`PathCardSelector` already accepts `baseStats` and uses it to compute concrete stat ceilings — passing the member's base stats satisfies requirement 19.4.

**Path of Channeling spell selection:**

The existing `applyHeroPath` function already checks `pathId === 'path_of_channeling'` and opens a spell selection dialog. This flow is unchanged — after the user confirms the path via `PathCardSelector`, `applyHeroPath` is called, which triggers the spell selection step if the chosen path is Channeling.

**Note on `getStatsForUnit` access:**

`PathSelectionDialog` is a sub-component defined inside `PostMatchSummaryPage`. It has access to `getStatsForUnit` from the outer scope via closure. No prop threading is needed.

---

### Requirement 20: Reset Selected Option After Each Hero Promotion in PostMatchSummaryPage (BUG-FIX)

**Affected files:** `src/pages/PostMatchSummaryPage.tsx`

**Current behaviour:** `HeroAdvancementCard` is a local component that holds its own `chosen`, `statChoice`, `optionChoice`, `minorRule`, `heroicAction`, `spellChoice`, and `improveSpellChoice` state. When `advanceProgression` moves to the next hero, a new `HeroAdvancementCard` is rendered for the new hero — React re-uses the component instance if the key is the same, which can cause stale state to persist.

**Root cause:** The `HeroAdvancementCard` rendered for `currentHero` uses `currentHero.memberId` as the implicit key (via the `key` prop on the parent map). However, the active card is rendered outside the `.filter(r => r.done).map(...)` loop — it is rendered directly as `{progPhase === 'heroes' && currentHero && !currentHero.done && <HeroAdvancementCard record={currentHero} ... />}`. If React reconciles this as the same component instance across hero changes, the internal state is not reset.

**Fix:**

Add an explicit `key` prop to the active `HeroAdvancementCard` that changes with each hero:

```tsx
{progPhase === 'heroes' && currentHero && !currentHero.done && (
  <HeroAdvancementCard
    key={currentHero.memberId}   // ← forces remount on hero change
    record={currentHero}
    member={workingCompany.members.find(m => m.id === currentHero.memberId)!}
    getStatsForUnit={getStatsForUnit}
    onApply={...}
  />
)}
```

By keying on `memberId`, React unmounts and remounts the card whenever the active hero changes. This guarantees all internal state (`chosen`, `statChoice`, etc.) resets to its initial value (`null`, `0`, `''`) for each new hero.

The same fix applies to `WarriorProgressionCard` for consistency:

```tsx
{progPhase === 'warriors' && currentWarrior && !currentWarrior.done && (
  <WarriorProgressionCard
    key={currentWarrior.memberId}  // ← forces remount on warrior change
    ...
  />
)}
```

---

### Requirement 21: Start Match Button Available from All Tabs in CompanyDetailsPage (FEAT)

**Affected files:** `src/pages/CompanyDetailsPage.tsx`

**Current behaviour:** The `Fab` for "Start Match" is rendered inside a conditional block:

```tsx
{activeTab === 0 && (
  <Fab ... onClick={() => navigate(`/companies/${company.id}/match/setup`)}>
    Start Match
  </Fab>
)}
```

This means the FAB is only visible when the Roster tab (index 0) is active.

**Fix:**

Remove the `activeTab === 0` condition so the FAB renders regardless of the active tab:

```tsx
<Fab
  variant="extended"
  size="medium"
  onClick={() => navigate(`/companies/${company.id}/match/setup`)}
  sx={{
    position: 'fixed',
    bottom: 24,
    right: 24,
    // ... existing styles unchanged ...
  }}
>
  <AddIcon sx={{ fontSize: '1.1rem' }} />
  Start Match
</Fab>
```

The FAB uses `position: 'fixed'` so it floats above all tab content without affecting layout. No other changes are needed — the navigation target and visual style remain identical across all tabs.

---

## Correctness Properties (continued)

### Property 13: `missing_next_game` treatment removes injury and deducts exactly 1 IP

*For any* member (hero or warrior) with a `missing_next_game` injury and `company.influence >= 1`, applying the no-roll treatment SHALL remove the `missing_next_game` injury from `member.injuries` and reduce `company.influence` by exactly 1.

**Validates: Requirements 13.5, 13.6**

### Property 14: Member sort order invariant

*For any* list of company members, the canonical sort (leader first, then sergeants alphabetically, then heroes-in-making alphabetically, then warriors alphabetically) SHALL produce a list where: all heroes precede all warriors; the leader (if present) is the first element; no warrior appears before any hero.

**Validates: Requirements 14.1, 16.1**

### Property 15: Hero classification labels are correct

*For any* sorted hero list with at least one hero, the first hero SHALL be labelled "Leader" and every subsequent hero SHALL be labelled "Sergeant".

**Validates: Requirements 14.2**

### Property 16: Creature purchases recorded in goldPurchases

*For any* creature purchase action in `StepGoldEquipment`, the creature ID SHALL appear in `goldPurchases[tempId]` after the purchase.

**Validates: Requirements 14.6**

### Property 17: Wargear removal excludes armour and base equipment

*For any* hero member, the set of removable wargear items SHALL be exactly `member.equipment` minus armour-category items minus base equipment items. No item outside this set SHALL have a remove button.

**Validates: Requirements 15.2, 15.5, 15.7**

### Property 18: Wargear removal persists correctly

*For any* non-armour, non-base-equipment item in `member.equipment`, confirming its removal SHALL result in that item being absent from `member.equipment` in the saved company.

**Validates: Requirements 15.4**

### Property 19: Creatures tab selector contains only heroes

*For any* company member list, the creatures tab member selector SHALL contain only members whose `role` is not `'warrior'`, ordered leader-first then alphabetically.

**Validates: Requirements 16.2**

### Property 20: Toolkit item section absent when no items assigned

*For any* member with no assigned toolkit items in `ActiveMatchState.toolkitItems`, the toolkit section SHALL NOT be rendered on that member's match card.

**Validates: Requirements 18.6**

### Property 21: Consumable toolkit item used-state round-trip

*For any* consumable toolkit item marked as used during a match, saving and reloading `ActiveMatchState` from IndexedDB SHALL preserve the item's used state in `MemberMatchState.usedToolkitItems`.

**Validates: Requirements 18.3, 18.7**

### Property 22: Hero advancement card resets between heroes

*For any* sequence of two or more hero advancements, after the first hero confirms their selection, the advancement card rendered for the second hero SHALL have `chosen = null` and all sub-choice fields at their default unselected values.

**Validates: Requirements 20.1, 20.2, 20.3**

### Property 23: Start Match FAB visible on all tabs

*For any* active tab index (0, 1, or 2) in `CompanyDetailsPage`, the Start Match FAB SHALL be present in the rendered output.

**Validates: Requirements 21.1, 21.2**

---

## Testing Strategy (additions for Requirements 13–21)

### Unit tests (example-based) — new items

- `missing_next_game` treatment: verify 1 IP deducted and injury removed for both hero and warrior
- `StepGoldEquipment` label assignment: verify leader gets "Leader", first sergeant gets "Sergeant"
- `StepGoldEquipment` creature tab: verify creatures from `creatures.json` appear in the Creatures tab for heroes
- `MemberDetailsDrawer` edit mode: verify Edit button appears for heroes, not for warriors
- `MemberDetailsDrawer` removal confirmation: verify `ConfirmDialog` opens with correct item label
- `ToolkitAssignmentPage` member selector: verify rank label and wargear appear in each `MenuItem`
- `PathSelectionDialog`: verify `PathCardSelector` is rendered instead of a plain list
- `PathSelectionDialog`: verify spell selection step follows Path of Channeling confirmation

### Property-based tests — new items

**Property 13 — `missing_next_game` treatment:**
Generate members with `missing_next_game` injury and companies with `influence >= 1`. Apply the no-roll treatment. Assert injury is removed and influence decreases by exactly 1.
`// Feature: battle-companies-fixes-and-features, Property 13: missing_next_game treatment removes injury and deducts exactly 1 IP`

**Property 14 — Member sort order:**
Generate random lists of members with varying roles and names. Apply `sortMembersForStore`. Assert: all heroes before warriors; leader is first; heroes within heroes are alphabetical (excluding leader); warriors are alphabetical.
`// Feature: battle-companies-fixes-and-features, Property 14: member sort order invariant`

**Property 15 — Hero classification labels:**
Generate sorted hero lists of length 1–10. Assert first hero label = "Leader", all others = "Sergeant".
`// Feature: battle-companies-fixes-and-features, Property 15: hero classification labels are correct`

**Property 16 — Creature purchase in goldPurchases:**
Generate creature IDs and tempIds. Simulate a creature purchase. Assert the creature ID appears in `goldPurchases[tempId]`.
`// Feature: battle-companies-fixes-and-features, Property 16: creature purchases recorded in goldPurchases`

**Property 17 — Wargear removal set:**
Generate hero members with random `equipment` arrays and random `baseUnitId` values. Compute the removable set. Assert it equals `equipment` minus armour items minus base equipment items.
`// Feature: battle-companies-fixes-and-features, Property 17: wargear removal excludes armour and base equipment`

**Property 18 — Wargear removal persistence:**
Generate hero members with non-armour, non-base equipment items. Simulate removal. Assert the item is absent from `member.equipment` in the saved company.
`// Feature: battle-companies-fixes-and-features, Property 18: wargear removal persists correctly`

**Property 19 — Creatures tab heroes only:**
Generate member lists with mixed roles. Apply the creatures tab filter + sort. Assert all results are non-warriors, leader is first, rest are alphabetical.
`// Feature: battle-companies-fixes-and-features, Property 19: creatures tab selector contains only heroes`

**Property 20 — Toolkit section absent with no items:**
Generate `MemberMatchState` objects with empty or absent `toolkitItems`. Assert no toolkit section is rendered.
`// Feature: battle-companies-fixes-and-features, Property 20: toolkit item section absent when no items assigned`

**Property 21 — Consumable used-state round-trip:**
Generate `ActiveMatchState` objects with consumable items marked as used. Save to mock IndexedDB, reload. Assert `usedToolkitItems` contains the same item IDs.
`// Feature: battle-companies-fixes-and-features, Property 21: consumable toolkit item used-state round-trip`

**Property 22 — Hero advancement card resets:**
Generate sequences of two or more `HeroAdvRecord` objects. Simulate confirming the first hero's advancement. Assert the card rendered for the second hero has `chosen = null` and all sub-choice fields at default.
`// Feature: battle-companies-fixes-and-features, Property 22: hero advancement card resets between heroes`

**Property 23 — Start Match FAB on all tabs:**
For each tab index in `[0, 1, 2]`, render `CompanyDetailsPage` with that tab active. Assert the Start Match FAB is present in the output.
`// Feature: battle-companies-fixes-and-features, Property 23: Start Match FAB visible on all tabs`

---

### Requirement 22: Against the Odds — Wanderer Selection (NEW-1)

**Affected files:** `src/pages/PostMatchSummaryPage.tsx`

**Current behaviour:** The "wanderer" ATO bonus is recorded in `postMatchData.atoBonuses` but there is no UI in `PostMatchSummaryPage` to let the user pick which wanderer to hire. The wanderer ID must already be set on `company.wandererId` before the match for FEAT-4 to work.

**Design:**

In the Influence step (or as a dedicated sub-step after Influence), detect when `postMatchData.atoBonuses.includes('wanderer')` and open a wanderer selection dialog. The dialog lists all entries from `wanderers.json` with their label, influence cost, and key stats (M/W/F and a few combat stats).

New state:

```typescript
const [wandererSelectOpen, setWandererSelectOpen] = useState(false)
const [wandererSelectDone, setWandererSelectDone] = useState(false)
```

The dialog is triggered automatically when the Influence step is reached and the wanderer ATO bonus is active and not yet resolved. On confirmation, the selected wanderer ID is written to `workingCompany.wandererId` and the company is saved.

```typescript
// On wanderer selection confirm
const handleWandererSelect = (wandererId: string) => {
  setWorkingCompany(prev => prev ? { ...prev, wandererId } : prev)
  setWandererSelectOpen(false)
  setWandererSelectDone(true)
}
```

The dialog renders a list of wanderer cards (or a simple radio-group list) showing:
- Wanderer label
- Influence cost
- M/W/F values
- A brief equipment/special rule summary

If `company.wandererId` is already set, the dialog pre-selects the current wanderer so the user can confirm or change it.

**Integration with FEAT-4:** Once `workingCompany.wandererId` is set and the company is saved, the next match setup will include the wanderer in the match roster via the existing `MatchSetupPage` logic (Requirement 8 / Task 11.1).

---

### Requirement 23: Consumable Toolkit Items — Remove on Use (NEW-2)

**Affected files:** `src/pages/MatchTrackingPage.tsx`

**Current behaviour:** When a consumable toolkit item is marked as used via the "Use" button, it is added to `mm.usedToolkitItems` and rendered with a strikethrough. However, the item remains in `ActiveMatchState.toolkitItems` and will reappear in future matches if the toolkit ATO bonus is selected again.

**Design:**

Add a "Remove" button that appears on consumable items that have already been marked as used. Tapping "Remove" removes the item from `ActiveMatchState.toolkitItems` entirely (not just from `usedToolkitItems`).

The removal is applied via `setMatch`:

```typescript
const handleRemoveToolkitItem = (memberId: string, itemId: string) => {
  setMatch(prev => {
    if (!prev) return prev
    return {
      ...prev,
      toolkitItems: prev.toolkitItems.filter(
        t => !(t.memberId === memberId && t.itemId === itemId)
      ),
    }
  })
}
```

In `MemberMatchCard`, the toolkit section renders:
- If item is consumable AND used: show strikethrough label + "Remove" button
- If item is consumable AND not used: show "Use" button (existing behaviour)
- If item is not consumable: show plain chip (existing behaviour)

The `onRemoveToolkitItem` callback is threaded from `MatchTrackingPage` down to `MemberMatchCard` as a new prop:

```typescript
interface CardProps {
  // ... existing ...
  onRemoveToolkitItem: (itemId: string) => void
}
```

Since `setMatch` triggers the existing `saveActiveMatch` effect, the removal is automatically persisted to IndexedDB.

---

### Requirement 24: Hero Progression Roll of 5 — Apply Both Results Automatically (NEW-3)

**Affected files:** `src/pages/PostMatchSummaryPage.tsx`

**Current behaviour:** When a hero rolls a 5 on their progression, the `HeroAdvRecord` is created with `rollA = 5` and `rollB = <other roll>`. The `bonusRoll` field is set to the result for the non-5 roll. However, the current UI still asks the user to choose between roll A and roll B — the user must manually select "A" (the 5) to trigger the bonus roll behaviour. The intent of a roll of 5 is that BOTH results are applied automatically.

**Design:**

When `rollA === 5 || rollB === 5`, the `HeroAdvRecord` should be initialised with `chosen` pre-set to the roll-5 side, and the `bonusRoll` should be populated with the result for the other roll. The UI should skip the A/B choice entirely and instead show both results simultaneously, prompting the user only for any sub-choices within each result.

**Changes to `HeroAdvancementCard`:**

Add a check at the top of the card: if `record.rollA === 5 || record.rollB === 5`, render a "Roll of 5 — Both Results Apply" banner and display both `resultA`/`resultB` (or `resultA` + `bonusRoll`) side by side or in sequence. The user only interacts with sub-choice pickers (stat choice, special rule choice, etc.) for each result.

The "Apply" button is enabled once all required sub-choices for both results have been made.

```typescript
// In HeroAdvancementCard, detect roll-5 scenario
const isRoll5 = record.rollA === 5 || record.rollB === 5
const roll5Result = record.rollA === 5 ? record.resultA : record.resultB
const otherResult = record.rollA === 5 ? record.resultB : record.resultA
```

**Changes to `onApply` handler:**

When `isRoll5` is true, the `onApply` callback receives both results to apply. The existing `bonusRoll` mechanism already supports this — the fix is to auto-set `chosen` to the roll-5 side and render both results without the A/B picker.

**UI copy:** Display a banner such as "Roll of 5 — both results apply automatically. Make any required choices below."

---

### Requirement 25: Injury Treatment — Prompt to Use IP After D6 Roll (NEW-4)

**Affected files:** `src/components/common/MemberDetailsDrawer.tsx`

**Current behaviour:** The injury treatment flow in `MemberDetailsDrawer` shows a treatment options dialog, then (for the roll path) shows an animated D6 roll, then applies the result. IP is deducted as part of the treatment confirmation but the flow does not clearly separate "see the roll result" from "decide whether to spend IP".

**Design:**

Restructure the hero injury treatment flow into three explicit stages:

1. **Options dialog** — user chooses "Roll to treat (1 IP)" or "Miss next game (1 IP)"
2. **Roll result dialog** — animated D6 is shown; once settled, display the result and offer an "Spend additional IP to improve?" prompt if applicable
3. **Confirm dialog** — user confirms the final outcome; IP is deducted at this point

The key change is stage 2: after the die settles, before applying the result, show the rolled value and ask the user if they want to spend IP. The IP deduction happens only when the user confirms in stage 3.

New state additions to the treatment flow:

```typescript
type TreatStage = 'options' | 'rolling' | 'ip_prompt' | 'confirm'
const [treatStage, setTreatStage] = useState<TreatStage>('options')
const [rolledValue, setRolledValue] = useState<number | null>(null)
```

**IP prompt content:**

After the roll, display:
- The rolled value and what it means (success/failure)
- Current IP balance
- "Spend 1 IP to reroll / improve" button (if applicable and IP available)
- "Accept result" button

The IP deduction is applied when the user taps "Accept result" or "Spend IP" — not before.

**Backward compatibility:** The `missing_next_game` no-roll path (Requirement 13) is unchanged — it remains a single-step "spend 1 IP to remove" action with no roll.

---

### Requirement 26: Store Tab — Capitalize Leader/Sergeant Titles and Fix "Hero in the Making" Label (NEW-5)

**Affected files:** `src/pages/CompanyDetailsPage.tsx` (the `StoreTab` component)

**Current behaviour:** The `StoreTab` member selectors display role labels using the raw `member.role` string (e.g. `hero_in_making`) or inconsistently capitalised strings. The existing `roleLabel` helper at the top of `CompanyDetailsPage.tsx` already maps roles to correct labels, but it may not be applied everywhere within `StoreTab`.

**Fix:**

Audit all locations within `StoreTab` where `member.role` is displayed as a label (member selectors, inline role chips, section headers). Replace any raw role string display with a call to the existing `roleLabel(member.role)` helper:

```typescript
function roleLabel(role: string): string {
  if (role === 'leader') return 'Leader'
  if (role === 'sergeant') return 'Sergeant'
  if (role === 'hero_in_making') return 'Hero in the Making'
  return ''
}
```

This is a purely cosmetic fix — no logic changes are required. The `roleLabel` function already exists in `CompanyDetailsPage.tsx`; it just needs to be consistently applied within `StoreTab`'s member display code.

---

### Requirement 27: Roster Tab — Warriors Show Only Loadout Choices (NEW-6)

**Affected files:** `src/pages/CompanyDetailsPage.tsx` (the `MemberRow` component)

**Current behaviour:** `MemberRow` renders wargear chips for all members (heroes and warriors) using:

```typescript
const displayWargear = Array.from(new Set([...baseEquip, ...(member.equipment ?? [])]))
```

This shows all base equipment plus any purchased equipment for every member, including warriors. For warriors this is noisy — the base equipment is always the same for a given profile and adds no useful information on the roster view.

**Design:**

For warriors, replace the full wargear display with only the warrior's "loadout choice" — the selected option from `equipmentOptions` in `baseUnits.json`, if any.

A warrior's loadout choice is the intersection of `member.equipment` with the options defined in `baseUnit.equipmentOptions`. If the warrior has no `equipmentOptions` or has not selected any option, no wargear chips are shown.

```typescript
// In MemberRow, for warriors only:
if (!isHero) {
  const baseUnit = BASE_UNITS_RAW.find(u => u.id === member.baseUnitId)
  const allOptionEquipment = baseUnit?.equipmentOptions?.options.flatMap(o => o.equipment) ?? []
  const loadoutChoices = (member.equipment ?? []).filter(e => allOptionEquipment.includes(e))
  // Render only loadoutChoices as chips
}
```

For heroes, the existing behaviour (base equipment + purchased equipment) is unchanged.

**Scope:** This change is limited to the `MemberRow` component in the Roster tab. `MemberDetailsDrawer`, `MatchTrackingPage`, `StoreTab`, and all other views continue to show the full wargear list.

---

### Requirement 28: Store > Wargear Tab — Hide Wargear Type Label, Keep Bow Limit (NEW-7)

**Affected files:** `src/pages/CompanyDetailsPage.tsx` (the `StoreTab` component, wargear sub-tab)

**Current behaviour:** The wargear purchase list in `StoreTab` displays each item's name and, beneath it, the wargear type/category string (e.g. "mount", "hand_weapon", "bow"). This category label is sourced from `wargear.json`'s `type` or `category` field.

**Fix:**

Remove the rendering of the wargear type/category label from each wargear item in the Wargear sub-tab. The item name and price remain; only the type label is hidden.

The bow limit check and its associated UI (warning text, disabled purchase button) must be preserved. The bow limit logic is independent of the type label display — it checks whether the item is a ranged weapon and whether the company has reached its bow limit. This logic remains unchanged; only the visual label is removed.

```typescript
// Before (pseudocode):
<Typography variant="caption">{item.type}</Typography>  // ← REMOVE THIS LINE

// After: item name + price only, plus bow limit warning if applicable
```

**Bow limit display:** When the bow limit is reached for a ranged weapon, the existing warning/disabled state continues to be shown. The bow limit indicator is not a "type label" — it is a functional constraint message and must remain visible.

---

## Correctness Properties (continued — Requirements 22–28)

### Property 24: Wanderer selection persists to company

*For any* wanderer ID selected via the ATO wanderer bonus flow, saving the working company SHALL result in `company.wandererId` equalling the selected wanderer ID.

**Validates: Requirements 22.2**

### Property 25: Consumable item removal clears from toolkitItems

*For any* consumable toolkit item that has been marked as used and then removed, the item SHALL be absent from `ActiveMatchState.toolkitItems` after the removal action.

**Validates: Requirements 23.2, 23.3, 23.6**

### Property 26: Roll-5 progression applies both results

*For any* hero advancement where `rollA === 5` or `rollB === 5`, the advancement SHALL apply both the roll-5 result and the other roll's result, and the hero's advancement record SHALL be marked done after both are applied.

**Validates: Requirements 24.1, 24.5, 24.6**

### Property 27: Warrior roster shows only loadout choices

*For any* warrior member, the wargear chips rendered in `MemberRow` SHALL be a subset of the warrior's `equipmentOptions` option equipment, and SHALL NOT include any item that is only in `baseEquipment` and not in any `equipmentOptions` option.

**Validates: Requirements 27.1, 27.2**

### Property 28: Wargear type label absent from Store wargear tab

*For any* wargear item rendered in the Store Wargear sub-tab, the rendered output SHALL NOT contain the raw `type` or `category` string from `wargear.json` as a visible label beneath the item name.

**Validates: Requirements 28.1, 28.4**

---

## Testing Strategy (additions for Requirements 22–28)

### Unit tests (example-based) — new items

- Wanderer selection dialog: verify all wanderers from `wanderers.json` appear in the list
- Wanderer selection: verify `company.wandererId` is updated on confirmation and unchanged on dismiss
- Toolkit item removal: verify item is absent from `toolkitItems` after removal
- Roll-5 progression: verify both results are applied when `rollA === 5`
- Warrior loadout display: verify only `equipmentOptions` items appear as chips for warriors
- Store wargear type label: verify no category string is rendered beneath item names

### Property-based tests — new items

**Property 24 — Wanderer selection persists:**
Generate wanderer IDs from `wanderers.json`. Simulate selection and save. Assert `company.wandererId` equals the selected ID.
`// Feature: battle-companies-fixes-and-features, Property 24: wanderer selection persists to company`

**Property 25 — Consumable item removal:**
Generate `ActiveMatchState` objects with consumable items in `toolkitItems` and those items in `usedToolkitItems`. Simulate removal. Assert the item is absent from `toolkitItems`.
`// Feature: battle-companies-fixes-and-features, Property 25: consumable item removal clears from toolkitItems`

**Property 26 — Roll-5 applies both results:**
Generate `HeroAdvRecord` objects where `rollA === 5` or `rollB === 5`. Assert both results are applied and the record is marked done.
`// Feature: battle-companies-fixes-and-features, Property 26: roll-5 progression applies both results`

**Property 27 — Warrior roster loadout only:**
Generate warrior members with random `equipment` arrays and `baseUnitId` values. Compute the displayed chips. Assert each chip corresponds to an item in the warrior's `equipmentOptions` options.
`// Feature: battle-companies-fixes-and-features, Property 27: warrior roster shows only loadout choices`

**Property 28 — Wargear type label absent:**
Generate wargear items with various `type`/`category` values. Render the Store wargear tab item. Assert the raw type/category string is not present as a visible label.
`// Feature: battle-companies-fixes-and-features, Property 28: wargear type label absent from Store wargear tab`

---

### Requirement 29: Auto-Clear "Missing Next Game" Injury After a Completed Match (BUG-FIX)

**Affected files:** `src/pages/PostMatchSummaryPage.tsx`

**Current behaviour:** `missing_next_game` injuries are only removed when the user manually spends 1 IP to treat them (via `MemberDetailsDrawer` or the Store tab injury treatment panel). Completing a match does not automatically clear the status, so a unit that was "missing next game" remains injured indefinitely unless the player remembers to treat it.

**Fix:**

In the final save step of `PostMatchSummaryPage` — the point where `saveCompany(workingCompany)` is called before navigating away — filter `missing_next_game` out of every member's `injuries` array before saving:

```typescript
const companyToSave: Company = {
  ...workingCompany,
  members: workingCompany.members.map(m => ({
    ...m,
    injuries: m.injuries.filter(i => i.type !== 'missing_next_game'),
  })),
}
await saveCompany(companyToSave)
```

This is a single-line change to the final save call. No new state, dialogs, or user interaction is required.

**Scope:** The clear applies to all members unconditionally — both heroes and warriors, and regardless of whether they were in the match roster. A member who was sitting out due to `missing_next_game` has now served their suspension and is available for the next game.

**Interaction with manual treatment (Requirement 13 / Task 20):** The manual IP-spend treatment path remains available. If a player spends IP mid-campaign to clear the injury early, the member's `injuries` array will already lack `missing_next_game` by the time the post-match save runs, so the filter is a no-op for that member.

**Error handling:** If `workingCompany` is null at save time (should not occur in normal flow), the existing null-guard already prevents the save. No additional error handling is needed.

---

### Property 29: Auto-clear removes only `missing_next_game` injuries

*For any* company member with a `missing_next_game` injury (and optionally other injuries), the post-match save SHALL produce a member whose `injuries` array does not contain `missing_next_game` and whose other injuries are unchanged.

**Validates: Requirements 29.1, 29.4**

---

## Testing Strategy (additions for Requirement 29)

### Unit tests (example-based)

- Post-match save: verify a member with only `missing_next_game` has an empty `injuries` array after save
- Post-match save: verify a member with `missing_next_game` + `arm_wound` retains `arm_wound` but loses `missing_next_game`
- Post-match save: verify a member with no injuries is unaffected

### Property-based tests

**Property 29 — Auto-clear `missing_next_game`:**
Generate company members with random injury arrays that may include `missing_next_game`. Simulate the post-match save transform. Assert `missing_next_game` is absent from every member's injuries in the saved company, and all other injury types are preserved.
`// Feature: battle-companies-fixes-and-features, Property 29: auto-clear removes only missing_next_game injuries`


---

### Requirement 30: StepMemberNames — Bottom Bar Overlap Fix (BUG-FIX)

**Affected files:** `src/pages/CreateCompanyPage.tsx` (the step content scroll container)

**Current behaviour:** The wizard's step content area is rendered inside a `Box` with `flex: 1, overflowX: 'hidden'`. The navigation footer is `position: 'sticky', bottom: 0`, which means it overlays the bottom of the scroll area. `StepMemberNames` renders a variable-length list of `TextField` components with no bottom padding, so on companies with many members (e.g. 7+) the last field scrolls behind the sticky footer and is permanently obscured.

**Fix:**

The scroll container in `CreateCompanyPage` wraps all step content. The simplest fix is to add a bottom padding to the step content `Box` that is at least as tall as the navigation footer. The footer is `py: 2` (16 px top + 16 px bottom) plus a `Button` with `minHeight: 44`, giving a total footer height of approximately 76 px. A `pb: 10` (80 px) on the content container provides sufficient clearance.

```tsx
// In CreateCompanyPage, the step content Box:
<Box
  sx={{
    flex: 1,
    px: { xs: 2, sm: 3 },
    py: 3,
    pb: { xs: 10, sm: 10 },   // ← ADD: ensures last field clears the sticky footer
    maxWidth: 600,
    width: '100%',
    mx: 'auto',
    overflowX: 'hidden',
  }}
>
```

This padding applies to all wizard steps, but is only visually noticeable on `StepMemberNames` (the only step with a long scrollable list). All other steps have short content that does not reach the bottom of the viewport, so the extra padding is invisible to the user on those steps.

**Scope:** Single-line `sx` change to the content `Box` in `CreateCompanyPage`. No changes to `StepMemberNames.tsx` itself.

**Why not fix in `StepMemberNames` directly:** Adding padding inside the step component would require every step component to know about the footer height. Fixing it at the container level is the correct architectural choice — the container owns the layout relationship with the sticky footer.

---

### Requirement 31: The Last Alliance — Variant Roster Selection for Gondor Faction (FEAT)

**Affected files:**
- `src/models/index.ts` (`WizardState`, `StartingRosterEntry`)
- `src/pages/CreateCompanyPage.tsx` (wizard navigation, `renderStep`, `canAdvance`, `createCompany` call)
- `src/components/wizard/StepCompany.tsx` (expandable details panel)
- `src/services/company/companyFactory.ts` (`createCompany`, `buildStartingMembers`)

**Current behaviour:** `StepCompany` shows all companies for the selected faction. When "The Last Alliance" is selected, the wizard proceeds directly to step 3 (Name) using the company-level `startingRoster`. There is no variant selection step. The `WizardState` has no `variantId` field. `createCompany` always uses `companyDef.startingRoster` and `companyDef.reinforcementTable`.

**Data shape:** `companies.json` already contains the variant definitions on `the_last_alliance`:

```json
"variants": [
  { "id": "last_alliance_standard", "label": "The Last Alliance", "isDefault": true },
  {
    "id": "last_alliance_numenorean",
    "label": "The Last Alliance (Númenórean)",
    "isDefault": false,
    "visibleFromFactions": ["gondor"],
    "startingRoster": [ { "baseUnitId": "warrior_of_numenor", "count": 6, "equipment": ["shield"] } ],
    "reinforcementTable": [ ... ]
  }
]
```

The `CompanyDefinition.variants` type already exists in `src/models/index.ts` with `startingRoster` and `reinforcementTable` optional fields.

**Model change — `WizardState`:**

```typescript
export interface WizardState {
  // ... existing fields ...
  variantId: string | null   // NEW: selected variant ID, or null for default
}
```

Add `variantId: null` to `INITIAL_WIZARD` in `CreateCompanyPage`.

**Model change — `StartingRosterEntry`:**

The `mustBeSergeant` flag is referenced in Requirements 32–33 but is not yet in the model. Add it alongside the existing `mustBeLeader`:

```typescript
export interface StartingRosterEntry {
  baseUnitId: string
  count: number
  equipment?: string[]
  mustBeLeader?: boolean
  mustBeSergeant?: boolean   // NEW
}
```

**Wizard navigation — new variant step (step 2.5):**

Rather than inserting a new numbered step into the `STEPS` array (which would shift all subsequent step indices and break `canAdvance`), the variant selection is implemented as a **sub-step within step 2** (Company selection). When the user selects a company that has variants visible from the current faction, the step 2 content transitions to a variant picker before the user can advance to step 3.

Concretely:

- `StepCompany` receives a new `variantId` prop and an `onVariantChange` callback.
- When `wizard.companyTypeId` is set and the selected company has variants with `visibleFromFactions` matching `wizard.factionId`, `StepCompany` renders a second panel below the company list: "Choose your variant".
- The variant picker is a simple radio-group list of variant cards (label + roster summary).
- `canAdvance()` for step 2 is updated: if the selected company has faction-visible variants, `variantId` must also be set.

```typescript
// Updated canAdvance for step 2:
case 2: {
  if (!wizard.companyTypeId) return false
  const company = COMPANIES.find(c => c.id === wizard.companyTypeId)
  const factionVariants = (company?.variants ?? []).filter(
    v => !v.isDefault && (v.visibleFromFactions ?? []).includes(wizard.factionId ?? '')
  )
  if (factionVariants.length > 0 && !wizard.variantId) return false
  return true
}
```

When `selectCompany` is called (company changes), `variantId` is reset to `null`.

**`StepCompany` expandable details panel:**

When `factionId === 'gondor'` and the company has a variant with `visibleFromFactions: ['gondor']`, the expandable details panel shows an additional "Númenórean Variant Roster" section below the standard "Starting Roster" section. This section lists the variant's `startingRoster` entries. It is only shown when `factionId` is in `visibleFromFactions`.

```tsx
// In StepCompany expandable details, after the standard roster:
{(company.variants ?? [])
  .filter(v => !v.isDefault && (v.visibleFromFactions ?? []).includes(factionId))
  .map(variant => (
    <Box key={variant.id} sx={{ mt: 2 }}>
      <Typography sx={{ /* section header style */ }}>
        {variant.label} — Starting Roster
      </Typography>
      {(variant.startingRoster ?? []).map((entry, ei) => (
        <Typography key={ei} variant="body2" sx={{ opacity: 0.7, lineHeight: 1.8 }}>
          ×{entry.count} {getUnitLabel(entry.baseUnitId)}
          {entry.equipment?.length > 0 && ` (${formatEquipment(entry.equipment)})`}
        </Typography>
      ))}
    </Box>
  ))
}
```

**`companyFactory.ts` — variant-aware roster resolution:**

`createCompany` receives the `WizardState` which now includes `variantId`. A helper resolves the effective roster:

```typescript
function resolveEffectiveRoster(
  companyDef: CompanyDefinition,
  variantId: string | null
): { startingRoster: StartingRosterEntry[]; reinforcementTable: ReinforcementEntry[] } {
  if (!variantId) {
    return {
      startingRoster: companyDef.startingRoster,
      reinforcementTable: companyDef.reinforcementTable,
    }
  }
  const variant = (companyDef.variants ?? []).find(v => v.id === variantId)
  return {
    startingRoster: variant?.startingRoster ?? companyDef.startingRoster,
    reinforcementTable: variant?.reinforcementTable ?? companyDef.reinforcementTable,
  }
}
```

`buildStartingMembers` is updated to accept the effective `startingRoster` directly (it already does — the roster is passed in). `createCompany` calls `resolveEffectiveRoster` and passes the result to `buildStartingMembers`:

```typescript
export function createCompany(
  wizardState: WizardState,
  companyDef: CompanyDefinition,
  heroPaths: Record<string, string> = {},
  heroSpellChoices: Record<string, string> = {}
): Company {
  const { startingRoster } = resolveEffectiveRoster(companyDef, wizardState.variantId ?? null)
  const members = buildStartingMembers(
    { ...companyDef, startingRoster },  // override startingRoster with variant's
    wizardState.memberNames,
    wizardState.leaderId!,
    wizardState.sergeantIds,
    heroPaths,
    heroSpellChoices,
    wizardState.goldPurchases ?? {}
  )
  // ... rest unchanged
}
```

**`generateTempMemberIds` and downstream steps:** All subsequent wizard steps (member names, leader selection, paths, gold) derive their member list from `companyDef.startingRoster`. These steps must receive the effective roster (with variant applied) rather than the raw `companyDef`. In `CreateCompanyPage`, a derived `effectiveCompanyDef` is computed:

```typescript
const effectiveCompanyDef = useMemo(() => {
  if (!selectedCompany || !wizard.variantId) return selectedCompany
  const { startingRoster, reinforcementTable } = resolveEffectiveRoster(
    selectedCompany, wizard.variantId
  )
  return { ...selectedCompany, startingRoster, reinforcementTable }
}, [selectedCompany, wizard.variantId])
```

All step renders that currently use `selectedCompany!` are updated to use `effectiveCompanyDef!`.

---

### Requirement 32: StepLeaderSelection — Enforce mustBeLeader / mustBeSergeant Constraints (FEAT)

**Affected files:**
- `src/components/wizard/StepLeaderSelection.tsx`
- `src/pages/CreateCompanyPage.tsx` (pre-population logic)
- `src/models/index.ts` (`StartingRosterEntry.mustBeSergeant` — added in Req 31 above)

**Current behaviour:** `StepLeaderSelection` renders all members as freely selectable. There is no concept of locked roles. The wizard's `leaderId` and `sergeantIds` start as `null` / `[]` when step 5 is first reached, regardless of whether the roster has `mustBeLeader` or `mustBeSergeant` entries.

**Pre-population logic in `CreateCompanyPage`:**

When the user advances to step 5 (or when the wizard is initialised with a company that has forced roles), the wizard state must be pre-populated with the forced assignments. This is done in the `selectCompany` handler and also when `effectiveCompanyDef` changes:

```typescript
function computeForcedRoles(companyDef: CompanyDefinition): {
  leaderId: string | null
  sergeantIds: string[]
} {
  let leaderId: string | null = null
  const sergeantIds: string[] = []
  let idx = 0
  for (const entry of companyDef.startingRoster) {
    for (let i = 0; i < entry.count; i++) {
      const tempId = `member_${idx}`
      if (entry.mustBeLeader) leaderId = tempId
      if (entry.mustBeSergeant) sergeantIds.push(tempId)
      idx++
    }
  }
  return { leaderId, sergeantIds }
}
```

This function is called whenever `effectiveCompanyDef` changes (i.e. when a company or variant is selected). The result is merged into `WizardState`:

```typescript
const selectCompany = (companyTypeId: string | null) => {
  const newDef = COMPANIES.find(c => c.id === companyTypeId) ?? null
  const forced = newDef ? computeForcedRoles(newDef) : { leaderId: null, sergeantIds: [] }
  setWizard(w => ({
    ...w,
    companyTypeId,
    variantId: null,
    memberNames: {},
    leaderId: forced.leaderId,
    sergeantIds: forced.sergeantIds,
    heroPaths: {},
    heroSpellChoices: {},
  }))
}
```

When a variant is selected (and `effectiveCompanyDef` changes), the forced roles are recomputed from the variant's `startingRoster`.

**`StepLeaderSelection` changes:**

The component receives two new props:

```typescript
interface Props {
  companyDef: CompanyDefinition
  memberNames: Record<string, string>
  leaderId: string | null
  sergeantIds: string[]
  onSelectLeader: (tempId: string) => void
  onToggleSergeant: (tempId: string) => void
  lockedLeaderId?: string | null      // NEW: tempId that must be leader
  lockedSergeantIds?: string[]        // NEW: tempIds that must be sergeants
}
```

The `lockedLeaderId` and `lockedSergeantIds` are derived from `computeForcedRoles(effectiveCompanyDef)` in `CreateCompanyPage` and passed down.

**Lock detection in `handleClick`:**

```typescript
const isLocked = (tempId: string): boolean => {
  if (lockedLeaderId && tempId === lockedLeaderId) return true
  if (lockedSergeantIds?.includes(tempId)) return true
  return false
}

const handleClick = (tempId: string) => {
  if (isLocked(tempId)) return  // locked members cannot be interacted with
  // ... existing click logic unchanged
}
```

**Visual lock indicator:**

Locked members display a `LockIcon` (MUI `@mui/icons-material/Lock`) in place of the role circle, and a "Required" `Chip` in place of the "Leader"/"Sergeant" chip. The card border and background use the same gold styling as a selected hero, but the hover state is suppressed (`cursor: 'default'`).

```tsx
{isLocked(member.tempId) ? (
  <LockIcon sx={{ fontSize: '0.9rem', color: 'primary.main', opacity: 0.7 }} />
) : (
  // existing role icon
)}

{isLocked(member.tempId) && (
  <Chip
    label="Required"
    size="small"
    icon={<LockIcon sx={{ fontSize: '0.65rem !important' }} />}
    sx={{
      height: 22,
      fontSize: '0.7rem',
      fontFamily: '"Cinzel", serif',
      bgcolor: 'rgba(200,164,90,0.1)',
      borderColor: 'rgba(200,164,90,0.4)',
      color: 'primary.main',
    }}
  />
)}
```

**Progress indicator:** The `HeroSlot` components for locked slots show as filled immediately (since the roles are pre-assigned). The "X more to select" counter only counts unfilled, non-locked slots.

---

### Requirement 33: Wizard — Skip StepLeaderSelection When All Roles Are Pre-Assigned (FEAT)

**Affected files:** `src/pages/CreateCompanyPage.tsx`

**Current behaviour:** The wizard always navigates step 4 → step 5 → step 6 in sequence. There is no skip logic.

**Design:**

A helper function determines whether all three hero slots are pre-assigned:

```typescript
function allRolesPreAssigned(companyDef: CompanyDefinition): boolean {
  const { leaderId, sergeantIds } = computeForcedRoles(companyDef)
  return leaderId !== null && sergeantIds.length >= 2
}
```

**Forward navigation (step 4 → Next):**

In the Next button's `onClick` handler and in the Enter key `useEffect`, when `wizard.step === 4` and `effectiveCompanyDef` has all roles pre-assigned, skip step 5 and go directly to step 6:

```typescript
// In the Next button onClick:
if (wizard.step === 4 && effectiveCompanyDef && allRolesPreAssigned(effectiveCompanyDef)) {
  go(6)  // skip step 5
  return
}
go(wizard.step + 1)
```

**Back navigation (step 6 → Back):**

In the Back button's `onClick` handler, when `wizard.step === 6` and all roles are pre-assigned, skip step 5 and go back to step 4:

```typescript
// In the Back button onClick:
const prevStep = wizard.step - 1
if (prevStep === 5 && effectiveCompanyDef && allRolesPreAssigned(effectiveCompanyDef)) {
  go(4)  // skip step 5 on back navigation too
  return
}
go(prevStep)
```

**Stepper visual state:**

The MUI `Stepper` uses `activeStep={wizard.step}`. When `wizard.step === 6` and step 5 was skipped, the stepper will show step 5 as "completed" (since `activeStep > 5`). This is the correct visual behaviour — no additional changes are needed to the stepper.

**`canAdvance` for step 5:**

When step 5 is skipped, `canAdvance()` for step 5 is never evaluated in the normal flow. However, if the user somehow reaches step 5 (e.g. via direct state manipulation), `canAdvance()` must still work correctly. Since the wizard state is pre-populated with `leaderId` and `sergeantIds` from `computeForcedRoles`, `canAdvance()` for step 5 (`wizard.leaderId !== null && wizard.sergeantIds.length === 2`) will return `true` immediately — no change needed.

**Boundary condition:** The skip only fires when `allRolesPreAssigned` returns `true` (all 3 slots filled). If only 1 or 2 slots are pre-assigned, the wizard shows step 5 normally, with the pre-assigned members locked and the remaining slots free for the user to fill.

---

### Requirement 34: StepLeaderSelection — Next Button Stale State Fix (BUG-FIX)

**Affected files:** `src/pages/CreateCompanyPage.tsx`

**Current behaviour:** `canAdvance` is defined as a plain function inside the component body:

```typescript
const canAdvance = (): boolean => {
  switch (wizard.step) {
    // ...
    case 5:
      return wizard.leaderId !== null && wizard.sergeantIds.length === 2
    // ...
  }
}
```

This function closes over `wizard` from the render scope. However, the Enter key `useEffect` captures `canAdvance` in its dependency array. If `canAdvance` is not stable (not wrapped in `useCallback`), the effect may hold a stale reference to the function that closed over an old `wizard` value. Similarly, the Next button's `disabled={!canAdvance()}` is evaluated at render time and is correct, but the Enter key handler may fire with a stale `canAdvance` that returns `false` even after the state has updated.

**Root cause:** The `useEffect` for the Enter key shortcut lists `canAdvance` in its dependency array. Because `canAdvance` is recreated on every render (it's a plain function, not `useCallback`), the effect re-registers on every render — which is correct in principle. However, if `canAdvance` is called inside the effect closure and the effect was registered before the latest state update propagated, the closure may read stale `wizard` values.

**Fix:**

Wrap `canAdvance` in `useCallback` with `wizard` as a dependency. This ensures the function always reads the current `wizard` state and the effect always has a fresh reference:

```typescript
const canAdvance = useCallback((): boolean => {
  switch (wizard.step) {
    case 0: return wizard.alignment !== null
    case 1: return wizard.factionId !== null
    case 2: {
      if (!wizard.companyTypeId) return false
      const company = COMPANIES.find(c => c.id === wizard.companyTypeId)
      const factionVariants = (company?.variants ?? []).filter(
        v => !v.isDefault && (v.visibleFromFactions ?? []).includes(wizard.factionId ?? '')
      )
      if (factionVariants.length > 0 && !wizard.variantId) return false
      return true
    }
    case 3: return wizard.companyName.trim().length > 0
    case 4: return true
    case 5: return wizard.leaderId !== null && wizard.sergeantIds.length === 2
    case 6: {
      const heroTempIds = [wizard.leaderId!, ...wizard.sergeantIds]
      return heroTempIds.every(tid => {
        const pathId = wizard.heroPaths[tid]
        if (!pathId) return false
        if (pathId === 'path_of_channeling' && !wizard.heroSpellChoices[tid]) return false
        return true
      })
    }
    case 7: return true
    default: return false
  }
}, [wizard])
```

The Enter key `useEffect` already lists `canAdvance` in its dependency array. With `canAdvance` now stable per `wizard` value, the effect will always call the version of `canAdvance` that closes over the latest `wizard` state.

**Next button:** The `disabled={!canAdvance()}` prop on the Next button is evaluated at render time and is already correct — it reads the current `wizard` via the render-scope closure. The `useCallback` fix primarily addresses the Enter key shortcut, but also makes the `canAdvance` reference stable for any future consumers.

**Pre-assigned roles interaction (Req 32 + 34):** When `mustBeLeader`/`mustBeSergeant` pre-population sets `wizard.leaderId` and `wizard.sergeantIds` before step 5 is rendered, `canAdvance()` for step 5 returns `true` immediately. Combined with the skip logic from Req 33, this means the Next button is never shown for step 5 in the fully-pre-assigned case — but if it were, it would be enabled from the first render.

---

## Correctness Properties (continued — Requirements 30–34)

### Property 30: Variant roster selection routes to correct startingRoster

*For any* company definition with one or more variants, when a variant is selected in the wizard, `createCompany` SHALL produce members whose `baseUnitId` values match the variant's `startingRoster` entries, not the company-level `startingRoster`.

**Validates: Requirements 31.2, 31.5**

### Property 31: Variant visibility is faction-gated

*For any* company variant with a non-empty `visibleFromFactions` array, the variant's roster SHALL only be displayed in `StepCompany`'s expandable details panel when `wizard.factionId` is included in `visibleFromFactions`.

**Validates: Requirements 31.7, 31.8**

### Property 32: Locked members cannot be deselected

*For any* starting roster with one or more `mustBeLeader` or `mustBeSergeant` entries, clicking a locked member's card in `StepLeaderSelection` SHALL leave `wizard.leaderId` and `wizard.sergeantIds` unchanged.

**Validates: Requirements 32.4**

### Property 33: Pre-assignment tempIds are consistent with generateTempMemberIds

*For any* company definition with `mustBeLeader` or `mustBeSergeant` entries, the `leaderId` and `sergeantIds` produced by `computeForcedRoles` SHALL reference `tempId` values that appear in the output of `generateTempMemberIds(companyDef)` at the correct positional indices.

**Validates: Requirements 32.5, 32.8**

### Property 34: Step 5 is skipped iff all three slots are pre-assigned

*For any* company definition, the wizard SHALL skip step 5 (both forward and backward) if and only if `computeForcedRoles` returns a non-null `leaderId` and exactly 2 `sergeantIds`. If fewer than 3 slots are pre-assigned, step 5 SHALL be shown.

**Validates: Requirements 33.1, 33.3, 33.4**

### Property 35: canAdvance at step 5 always reads current wizard state

*For any* sequence of `wizard.leaderId` and `wizard.sergeantIds` updates at step 5, `canAdvance()` SHALL return `true` if and only if `wizard.leaderId !== null && wizard.sergeantIds.length === 2`, evaluated against the most recently committed state — never a stale snapshot.

**Validates: Requirements 34.2, 34.3, 34.6**

---

## Error Handling (additions for Requirements 30–34)

**Req 30 (bottom padding):** No error conditions. The padding is a static CSS value. If the action bar height changes in future, the `pb: 10` constant should be updated to match.

**Req 31 (variant selection):** If `wizard.variantId` references a variant ID that no longer exists in `companyDef.variants` (e.g. stale sessionStorage draft), `resolveEffectiveRoster` falls back to the company-level `startingRoster`. No error is thrown. The wizard draft is cleared on company selection change, so this scenario is unlikely in practice.

**Req 31 (variant in factory):** If a variant's `startingRoster` is empty or undefined, `buildStartingMembers` receives an empty array and produces zero members. The wizard will show an empty member names step. This is a data authoring error and should be caught in data validation, not at runtime.

**Req 32 (pre-population):** If a `mustBeLeader` entry appears more than once in the roster (data error), `computeForcedRoles` will overwrite `leaderId` with the last matching `tempId`. The first occurrence is silently ignored. This is a data authoring error.

**Req 32 (locked click):** If `isLocked` returns `true` for a member and the user somehow triggers `handleClick` (e.g. via keyboard), the function returns early with no state change. No error is thrown.

**Req 33 (skip logic):** If `effectiveCompanyDef` is null when the Next button is clicked at step 4, the skip check is skipped and the wizard advances to step 5 normally. This cannot occur in practice because step 4 is only reachable after a company has been selected (step 2 requires `companyTypeId !== null`).

**Req 34 (stale closure):** The `useCallback` fix eliminates the stale closure risk. If `wizard` is somehow not in the dependency array (e.g. a future refactor removes it), the linter's `exhaustive-deps` rule will flag the omission.

---

## Testing Strategy (additions for Requirements 30–34)

### Unit tests (example-based) — new items

- `StepMemberNames` scroll container: verify the content `Box` has `pb` of at least 80 px (or equivalent `pb: 10` token) when rendered inside `CreateCompanyPage`
- `StepCompany` variant panel: verify the Númenórean variant roster section appears in the expandable details when `factionId === 'gondor'` and is absent when `factionId === 'elven_realms'`
- `canAdvance` step 2: verify it returns `false` when The Last Alliance is selected with `factionId === 'gondor'` and `variantId === null`, and `true` once a variant is selected
- `computeForcedRoles`: verify it returns the correct `leaderId` and `sergeantIds` for the Helm's Deep roster (1 `mustBeLeader` + 2 `mustBeSergeant`)
- `StepLeaderSelection` locked member: verify clicking a locked member does not change `leaderId` or `sergeantIds`
- `StepLeaderSelection` lock indicator: verify `LockIcon` and "Required" chip are rendered for locked members
- Wizard skip forward: verify advancing from step 4 with a fully-pre-assigned company goes to step 6
- Wizard skip back: verify going back from step 6 with a fully-pre-assigned company goes to step 4
- `canAdvance` step 5 with pre-assignment: verify it returns `true` immediately when `leaderId` and 2 `sergeantIds` are pre-populated
- Enter key shortcut: verify pressing Enter at step 5 with valid state advances the wizard

### Property-based tests — new items

**Property 30 — Variant roster in createCompany:**
Generate company definitions with variants that have non-empty `startingRoster` arrays. For each variant, call `createCompany` with `variantId` set to that variant's ID. Assert every member's `baseUnitId` matches an entry in the variant's `startingRoster`.
`// Feature: battle-companies-fixes-and-features, Property 30: variant roster selection routes to correct startingRoster`

**Property 31 — Variant visibility is faction-gated:**
Generate company variants with random `visibleFromFactions` arrays and random `factionId` values. Assert the variant roster section is rendered if and only if `factionId` is in `visibleFromFactions`.
`// Feature: battle-companies-fixes-and-features, Property 31: variant visibility is faction-gated`

**Property 32 — Locked members cannot be deselected:**
Generate starting rosters with random combinations of `mustBeLeader` and `mustBeSergeant` flags. Simulate click events on locked members. Assert `leaderId` and `sergeantIds` are unchanged after each click.
`// Feature: battle-companies-fixes-and-features, Property 32: locked members cannot be deselected`

**Property 33 — Pre-assignment tempIds consistent with generateTempMemberIds:**
Generate company definitions with `mustBeLeader`/`mustBeSergeant` entries at random positions. Assert `computeForcedRoles` returns `tempId` values that are present in `generateTempMemberIds(companyDef)` at the correct indices.
`// Feature: battle-companies-fixes-and-features, Property 33: pre-assignment tempIds are consistent with generateTempMemberIds`

**Property 34 — Step 5 skip iff all three slots pre-assigned:**
Generate company definitions with 0, 1, 2, or 3 pre-assigned slots. Assert the wizard skips step 5 (both forward and back) if and only if all 3 slots are pre-assigned.
`// Feature: battle-companies-fixes-and-features, Property 34: step 5 is skipped iff all three slots are pre-assigned`

**Property 35 — canAdvance reads current wizard state:**
Generate sequences of wizard state updates at step 5 (setting/clearing `leaderId` and `sergeantIds`). After each update, call `canAdvance()`. Assert the result equals `leaderId !== null && sergeantIds.length === 2` for the current state, never a prior state.
`// Feature: battle-companies-fixes-and-features, Property 35: canAdvance at step 5 always reads current wizard state`
