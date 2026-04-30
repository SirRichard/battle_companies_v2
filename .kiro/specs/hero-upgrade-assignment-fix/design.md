# Hero Upgrade Assignment Fix — Bugfix Design

## Overview

Two related bugs exist in the hero upgrade flow:

1. **`MemberDetailsDrawer` displays the wrong upgrades.** The "Hero Upgrades" section calls `getEligibleHeroUpgrades()`, which returns upgrades the hero does *not yet own* (i.e. upgrades still available to earn). This makes unearned upgrades appear as if the hero already possesses them.

2. **`PostMatchSummaryPage` has no hero upgrade swap UI.** When a hero reaches an advancement threshold, the player has no way to swap their rolled promotion result for a Company-Specific Hero Upgrade. The swap path and the `applyHeroAdv` code path for it are both missing.

The fix is targeted to these two surfaces only. `companyFactory.ts` and `getEligibleHeroUpgrades()` are already correct and require no changes.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the display bug — a hero member is rendered in `MemberDetailsDrawer` and the "Hero Upgrades" section shows upgrades whose IDs are *not* in `member.equipment`.
- **Property (P)**: The desired behavior — the "Company Hero Upgrades" section SHALL display only upgrades whose IDs are already present in `member.equipment`.
- **Preservation**: All existing behavior unrelated to the hero upgrade display and swap flow must remain unchanged.
- **`getEligibleHeroUpgrades(companyDef, member)`**: Function in `src/utils/companyRules.ts` that returns upgrades the hero can still earn (not yet in `member.equipment`, passes `baseUnitIds` and `allowedKeywords` filters). Already correct — not modified.
- **`member.equipment`**: The `string[]` array on a `Member` that stores both wargear IDs and hero upgrade IDs. An upgrade is "owned" when its `id` is present in this array.
- **`companyDef.heroUpgrade`**: The `HeroUpgrade[]` array on a `CompanyDefinition` listing all possible Company-Specific Hero Upgrades for that company.
- **`applyHeroAdv`**: The function in `PostMatchSummaryPage.tsx` that applies a hero's chosen advancement result to the member. Needs a new code path for the hero upgrade swap.
- **`HeroAdvancementCard`**: The component in `PostMatchSummaryPage.tsx` that renders the hero's two advancement options (A and B). Needs an additional "Swap for Company Hero Upgrade" option when eligible upgrades exist.

## Bug Details

### Bug Condition

The display bug manifests when `MemberDetailsDrawer` renders the "Hero Upgrades" section for a hero member. The section calls `getEligibleHeroUpgrades(companyDef, member)` — which intentionally excludes already-owned upgrades — and then displays the result as if those are the hero's current upgrades. This inverts the intended semantics: the section shows what the hero *can still earn*, not what they *already have*.

**Formal Specification:**

```
FUNCTION isBugCondition(member, companyDef)
  INPUT: member of type Member, companyDef of type CompanyDefinition
  OUTPUT: boolean

  ownedUpgradeIds ← member.equipment ∩ { u.id | u ∈ companyDef.heroUpgrade }
  displayedUpgrades ← getEligibleHeroUpgrades(companyDef, member)

  // Bug fires when the section shows upgrades the hero does NOT own
  RETURN displayedUpgrades.length > 0
         AND displayedUpgrades.some(u => NOT member.equipment.includes(u.id))
END FUNCTION
```

### Examples

- **Shire hero with no upgrades owned**: `member.equipment` contains no hero upgrade IDs. `getEligibleHeroUpgrades` returns `[of_a_party_sort, ...]`. The section currently shows these as if the hero has them. **Expected**: section should be hidden (no owned upgrades).
- **Shire hero who owns `of_a_party_sort`**: `member.equipment` includes `"of_a_party_sort"`. `getEligibleHeroUpgrades` returns the remaining upgrades (excluding the owned one). The section currently shows the remaining unowned upgrades. **Expected**: section shows only `of_a_party_sort`.
- **Hero who owns all upgrades**: `getEligibleHeroUpgrades` returns `[]`. The section is currently hidden (coincidentally correct). **Expected**: section shows all owned upgrades.
- **Company with no `heroUpgrade` entries**: `companyDef.heroUpgrade` is `[]`. Section is hidden in both old and new behavior. No change.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `getEligibleHeroUpgrades()` in `src/utils/companyRules.ts` must not be modified — it is used correctly in `PostMatchSummaryPage` to determine swap eligibility.
- `companyFactory.ts` / `buildStartingMembers` must not be modified — it already creates heroes with no hero upgrade IDs in `equipment`.
- All warrior advancement flows (stat increases, promotions, hero-in-making) must continue to work without interference.
- All existing hero advancement flows (stat increases, special rules, spells, heroic actions) must continue to work without interference.
- Mouse/touch interactions with `MemberDetailsDrawer` unrelated to the hero upgrades section must be unaffected.
- The `PostMatchSummaryPage` injury step, influence step, and done step must be unaffected.
- Loading a company from the database must continue to correctly read hero upgrade IDs from `member.equipment`.

**Scope:**
All inputs that do NOT involve the hero upgrades display section in `MemberDetailsDrawer` or the hero advancement swap flow in `PostMatchSummaryPage` should be completely unaffected by this fix. This includes:
- Warrior members (no hero upgrades section rendered for them)
- Heroes in companies with no `heroUpgrade` entries
- All non-hero-upgrade equipment display in `MemberDetailsDrawer`
- All non-hero-upgrade advancement types in `PostMatchSummaryPage`

## Hypothesized Root Cause

### Bug 1 — MemberDetailsDrawer shows wrong upgrades

The root cause is a semantic mismatch in the function call. The developer used `getEligibleHeroUpgrades()` (which returns upgrades *not yet owned*) where the intent was to show upgrades *already owned*. The fix is to replace the call with a filter over `companyDef.heroUpgrade` that checks `member.equipment.includes(upgrade.id)`.

### Bug 2 — PostMatchSummaryPage missing swap UI

The root cause is a missing feature: the hero upgrade swap option was never implemented. `HeroAdvancementCard` only renders the two path-roll options (A and B). `applyHeroAdv` has no branch for applying a hero upgrade. Both need to be added.

Possible sub-causes for why it was missed:
1. **UI gap**: `HeroAdvancementCard` was built before hero upgrades were designed, so no swap option was added.
2. **Apply gap**: `applyHeroAdv` has no `'hero_upgrade'` code path — adding the upgrade ID to `member.equipment` is not handled.
3. **Eligibility check gap**: No call to `getEligibleHeroUpgrades` exists in the progression flow to determine whether to show the swap option.

## Correctness Properties

Property 1: Bug Condition — Hero Upgrades Display Shows Only Owned Upgrades

_For any_ hero member where the bug condition holds (the "Hero Upgrades" section is rendered), the fixed `MemberDetailsDrawer` SHALL display only upgrades whose IDs are present in `member.equipment`, and SHALL NOT display any upgrade whose ID is absent from `member.equipment`.

**Validates: Requirements 2.1, 2.2, 3.3**

Property 2: Preservation — Non-Hero-Upgrade Behavior Unchanged

_For any_ input that does NOT involve the hero upgrades display section or the hero upgrade swap flow (warrior members, heroes in companies without `heroUpgrade` entries, all other advancement types), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.4, 3.5**

## Fix Implementation

### Changes Required

#### File 1: `src/components/common/MemberDetailsDrawer.tsx`

**Section**: Hero Upgrades block (~lines 1062–1105)

**Specific Changes**:

1. **Replace `getEligibleHeroUpgrades` call with owned-upgrade filter**: Instead of calling `getEligibleHeroUpgrades(companyDef, member)` (which returns upgrades the hero does NOT have), filter `companyDef.heroUpgrade` to only those whose `id` is in `member.equipment`:
   ```ts
   const ownedUpgrades = companyDef.heroUpgrade.filter((u) =>
     member.equipment.includes(u.id)
   )
   ```

2. **Guard on `ownedUpgrades.length === 0`**: If the hero owns no upgrades, return `null` (section hidden). This matches the current guard but now uses the correct data.

3. **Rename section label**: Change `"Hero Upgrades"` to `"Company Hero Upgrades"` to distinguish owned upgrades from the eligible-to-earn list.

4. **Remove the `getEligibleHeroUpgrades` import** from this file if it is no longer used elsewhere in the file.

---

#### File 2: `src/pages/PostMatchSummaryPage.tsx`

**Section A**: `HeroAdvancementCard` component (~line 2621+)

**Specific Changes**:

1. **Add `eligibleHeroUpgrades` prop**: Pass the result of `getEligibleHeroUpgrades(companyDef, member)` into `HeroAdvancementCard` so it knows whether to show the swap option.

2. **Add `onApplyHeroUpgrade` callback prop**: A new callback `(upgradeId: string) => void` that the card calls when the player selects a hero upgrade swap.

3. **Render swap option**: When `eligibleHeroUpgrades.length > 0`, render an additional selectable option below the A/B results: "Swap for Company Hero Upgrade" with a list of eligible upgrades. Selecting one calls `onApplyHeroUpgrade(upgrade.id)`.

**Section B**: `applyHeroAdv` / new `applyHeroUpgradeSwap` function (~line 1154+)

**Specific Changes**:

1. **Add `applyHeroUpgradeSwap` function**: A new handler that, given a `memberId` and `upgradeId`, adds the `upgradeId` to `member.equipment` (if not already present) and marks the hero's advancement record as done:
   ```ts
   const applyHeroUpgradeSwap = (memberId: string, upgradeId: string) => {
     setWorkingCompany((prev) => {
       if (!prev) return prev
       return {
         ...prev,
         members: prev.members.map((m) => {
           if (m.id !== memberId) return m
           if (m.equipment.includes(upgradeId)) return m
           return { ...m, equipment: [...m.equipment, upgradeId] }
         }),
       }
     })
     // Mark hero advancement record as done (same pattern as applyHeroAdv)
     setHeroAdvRecords((prev) =>
       prev.map((r) => (r.memberId === memberId ? { ...r, done: true } : r))
     )
     subtractAdvancementXpForHero(memberId)
   }
   ```

2. **Wire `onApplyHeroUpgrade`** in the `HeroAdvancementCard` usage site to call `applyHeroUpgradeSwap`.

3. **Import `getEligibleHeroUpgrades`** at the top of `PostMatchSummaryPage.tsx` and compute eligible upgrades per hero when rendering `HeroAdvancementCard`.

---

#### No changes to:
- `src/utils/companyRules.ts` — `getEligibleHeroUpgrades` is already correct
- `src/services/company/companyFactory.ts` — already creates heroes with no hero upgrade IDs

## Testing Strategy

### Validation Approach

The testing strategy follows the bug condition methodology: first write tests that surface the bug on unfixed code (exploration), then write tests that capture preserved behavior (preservation), then implement the fix and verify both sets of tests pass.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the display bug BEFORE implementing the fix. Confirm the root cause: `MemberDetailsDrawer` renders unowned upgrades in the "Hero Upgrades" section.

**Test Plan**: Write a property-based test that constructs a hero member with a known set of owned upgrades (a subset of `companyDef.heroUpgrade`), renders the relevant logic from `MemberDetailsDrawer`, and asserts that only owned upgrades are shown. Run on UNFIXED code — expect FAILURE.

**Test Cases**:
1. **Hero with no owned upgrades**: `member.equipment` contains no hero upgrade IDs. Assert the section is empty / hidden. (Will FAIL on unfixed code — currently shows eligible upgrades.)
2. **Hero with one owned upgrade out of many**: Assert only the owned upgrade appears. (Will FAIL on unfixed code — currently shows the unowned ones.)
3. **Hero who owns all upgrades**: Assert all upgrades appear. (May coincidentally pass on unfixed code since `getEligibleHeroUpgrades` returns `[]`.)

**Expected Counterexamples**:
- A hero with `equipment = []` causes the section to display upgrades they don't own.
- Possible root cause confirmed: `getEligibleHeroUpgrades` is called instead of filtering by `member.equipment.includes`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed `MemberDetailsDrawer` logic produces the expected behavior.

**Pseudocode:**
```
FOR ALL (member, companyDef) WHERE isBugCondition(member, companyDef) DO
  displayedUpgrades ← getOwnedHeroUpgrades_fixed(companyDef, member)
  ASSERT displayedUpgrades.every(u => member.equipment.includes(u.id))
  ASSERT displayedUpgrades.length === ownedCount(member, companyDef)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL (member, companyDef) WHERE NOT isBugCondition(member, companyDef) DO
  // e.g. warrior members, companies with no heroUpgrade entries
  ASSERT fixed_behavior(member, companyDef) = original_behavior(member, companyDef)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many member/company combinations automatically
- It catches edge cases (warriors, empty `heroUpgrade` arrays, heroes with all upgrades owned)
- It provides strong guarantees that non-hero-upgrade display is unchanged

**Test Plan**: Observe behavior on UNFIXED code for warrior members and heroes in companies without `heroUpgrade` entries, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Warrior member preservation**: Verify the hero upgrades section is never rendered for warriors — unchanged before and after fix.
2. **Company with no `heroUpgrade` entries**: Verify the section is hidden — unchanged before and after fix.
3. **`getEligibleHeroUpgrades` output preservation**: Verify the function's return value is unchanged for any input — it is not modified by the fix.
4. **Hero upgrade swap result**: After `applyHeroUpgradeSwap(memberId, upgradeId)`, assert `upgradeId ∈ member.equipment` and `getEligibleHeroUpgrades` no longer returns that upgrade for the member.

### Unit Tests

- Test the owned-upgrade filter logic: given a member with specific equipment IDs, assert the correct subset of `companyDef.heroUpgrade` is returned.
- Test `applyHeroUpgradeSwap`: given a member and an upgrade ID, assert the ID is added to `equipment` exactly once.
- Test idempotency: calling `applyHeroUpgradeSwap` twice with the same upgrade ID does not duplicate the ID in `equipment`.
- Test that `HeroAdvancementCard` renders the swap option when `eligibleHeroUpgrades.length > 0` and hides it when `length === 0`.

### Property-Based Tests

- **Property 1 (Bug Condition)**: For any hero member and company definition, the owned-upgrade filter returns only upgrades whose IDs are in `member.equipment`.
- **Property 2 (Preservation)**: For any member/company pair where `isBugCondition` is false (warrior, no heroUpgrade entries, or hero who owns all upgrades), the display behavior is identical before and after the fix.
- **Swap idempotency property**: For any hero member and eligible upgrade, applying the swap once and then checking `getEligibleHeroUpgrades` never returns that upgrade again.

### Integration Tests

- Full flow: create a Shire company, advance a hero to an upgrade threshold in `PostMatchSummaryPage`, select the swap option, verify the upgrade ID appears in `member.equipment` and the `MemberDetailsDrawer` now shows it under "Company Hero Upgrades".
- Regression: verify that after the fix, a newly created hero's `MemberDetailsDrawer` shows an empty / hidden "Company Hero Upgrades" section (no upgrades owned at creation).
- Regression: verify that all existing hero advancement types (stat increase, special rule, spell, heroic action) continue to work correctly after the `PostMatchSummaryPage` changes.
