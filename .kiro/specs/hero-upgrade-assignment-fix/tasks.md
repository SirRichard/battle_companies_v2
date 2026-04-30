# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Hero Upgrades Display Shows Unowned Upgrades
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate that `MemberDetailsDrawer` renders upgrades the hero does NOT own
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — a hero member whose `equipment` contains no hero upgrade IDs, rendered against a company definition that has at least one `heroUpgrade` entry
  - Create `src/components/common/__tests__/heroUpgradeDisplay.bugCondition.property.test.ts`
  - Import `getEligibleHeroUpgrades` from `src/utils/companyRules` and `companyDef.heroUpgrade` from companies data
  - Construct a hero member with `equipment = []` (no owned upgrades) and a `companyDef` with at least one `heroUpgrade` entry (e.g. The Shire)
  - Simulate the current (buggy) `MemberDetailsDrawer` logic: call `getEligibleHeroUpgrades(companyDef, member)` and treat the result as "displayed upgrades"
  - Assert that every displayed upgrade ID is present in `member.equipment` — this assertion WILL FAIL because `getEligibleHeroUpgrades` returns unowned upgrades
  - Also assert: hero with one owned upgrade out of many shows only that upgrade (will FAIL — current code shows the unowned ones)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g. "hero with equipment=[] causes section to display ['of_a_party_sort', ...] which are not in equipment")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Hero-Upgrade Display Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create `src/components/common/__tests__/heroUpgradeDisplay.preservation.property.test.ts`
  - **Observe on UNFIXED code**:
    - Warrior member: hero upgrades section is never rendered (no `isHero` check passes) — observe this returns `null` / empty
    - Hero in a company with `companyDef.heroUpgrade = []`: `getEligibleHeroUpgrades` returns `[]`, section is hidden — observe this is already correct
    - Hero who owns ALL upgrades: `getEligibleHeroUpgrades` returns `[]` (all filtered out as already owned), section is hidden — observe this is coincidentally correct
    - `getEligibleHeroUpgrades` output: for any member/companyDef pair, the function's return value is stable and unchanged
  - Write property-based tests capturing these observed behaviors:
    - For all warrior members (role !== 'hero' / role !== 'leader' / role !== 'sergeant'), the hero upgrades section logic produces no upgrades to display
    - For all hero members in companies where `companyDef.heroUpgrade.length === 0`, the section is hidden
    - For all hero members who own every upgrade in `companyDef.heroUpgrade`, `getEligibleHeroUpgrades` returns `[]`
    - `getEligibleHeroUpgrades` continues to filter by `baseUnitIds` and `allowedKeywords` correctly for any input
  - Verify all tests PASS on UNFIXED code before proceeding
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 3. Fix hero upgrade display and swap flow

  - [x] 3.1 Fix `MemberDetailsDrawer` — show only owned hero upgrades
    - File: `src/components/common/MemberDetailsDrawer.tsx`
    - Replace the `getEligibleHeroUpgrades(companyDef, member)` call in the "Hero Upgrades" block with an owned-upgrade filter:
      ```ts
      const ownedUpgrades = companyDef.heroUpgrade.filter((u) =>
        member.equipment.includes(u.id)
      )
      ```
    - Guard on `ownedUpgrades.length === 0`: return `null` (section hidden) when the hero owns no upgrades
    - Rename the section label from `"Hero Upgrades"` to `"Company Hero Upgrades"` to distinguish owned upgrades from the eligible-to-earn list
    - Remove the `getEligibleHeroUpgrades` import from this file if it is no longer used elsewhere in the file
    - _Bug_Condition: isBugCondition(member, companyDef) where member.equipment contains no hero upgrade IDs and companyDef.heroUpgrade.length > 0_
    - _Expected_Behavior: displayedUpgrades.every(u => member.equipment.includes(u.id)) AND displayedUpgrades.length === ownedCount(member, companyDef)_
    - _Preservation: warrior members and heroes in companies with no heroUpgrade entries must continue to show no hero upgrades section_
    - _Requirements: 2.1, 2.2, 3.3_

  - [x] 3.2 Add `applyHeroUpgradeSwap` handler in `PostMatchSummaryPage`
    - File: `src/pages/PostMatchSummaryPage.tsx`
    - Import `getEligibleHeroUpgrades` from `src/utils/companyRules`
    - Add `applyHeroUpgradeSwap(memberId: string, upgradeId: string)` function that:
      - Adds `upgradeId` to `member.equipment` (only if not already present — idempotent)
      - Marks the hero's advancement record as done via `setHeroAdvRecords`
      - Calls `subtractAdvancementXpForHero(memberId)` (same pattern as `applyHeroAdv`)
    - _Bug_Condition: hero reaches advancement threshold but no swap UI or apply path exists_
    - _Expected_Behavior: after applyHeroUpgradeSwap(memberId, upgradeId), upgradeId ∈ member.equipment and getEligibleHeroUpgrades no longer returns that upgrade for the member_
    - _Preservation: all existing applyHeroAdv code paths (stat increase, special rule, spell, heroic action) must remain unchanged_
    - _Requirements: 2.3, 2.4, 2.5, 3.1_

  - [x] 3.3 Add swap option UI to `HeroAdvancementCard`
    - File: `src/pages/PostMatchSummaryPage.tsx`
    - Add `eligibleHeroUpgrades: HeroUpgrade[]` prop to `HeroAdvancementCard`
    - Add `onApplyHeroUpgrade: (upgradeId: string) => void` callback prop
    - When `eligibleHeroUpgrades.length > 0`, render an additional selectable option below the A/B results: "Swap for Company Hero Upgrade" with a list of eligible upgrades; selecting one calls `onApplyHeroUpgrade(upgrade.id)`
    - At the `HeroAdvancementCard` usage site, compute `getEligibleHeroUpgrades(companyDef, member)` per hero and pass it as `eligibleHeroUpgrades`; wire `onApplyHeroUpgrade` to call `applyHeroUpgradeSwap`
    - _Requirements: 2.3, 2.4_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Hero Upgrades Display Shows Only Owned Upgrades
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (only owned upgrades displayed)
    - Run `src/components/common/__tests__/heroUpgradeDisplay.bugCondition.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms the display bug is fixed)
    - _Requirements: 2.1, 2.2, 3.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Hero-Upgrade Display Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `src/components/common/__tests__/heroUpgradeDisplay.preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in warrior display, empty heroUpgrade companies, and getEligibleHeroUpgrades behavior)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full test suite and confirm all tests pass
  - Verify the bug condition exploration test (task 1) now passes after the fix
  - Verify the preservation tests (task 2) still pass
  - Confirm no regressions in warrior advancement, hero stat/rule/spell/heroic-action advancement, injury step, influence step, and done step
  - Ask the user if any questions arise
