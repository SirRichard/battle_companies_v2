# Implementation Plan: Unhandled Company Data Fields

## Overview

Six data fields that are already parsed by the TypeScript models but never consumed by application logic will be fully wired up. The implementation follows a strict bottom-up order: models first, then pure helpers, then data fixes, then UI wiring, with property-based tests placed immediately after the logic they validate.

All new pure logic lives in `src/utils/companyRules.ts`. UI changes touch `src/models/index.ts`, `src/pages/CompanyDetailsPage.tsx` (StoreTab), `src/components/wizard/StepLeaderSelection.tsx`, `src/pages/MatchTrackingPage.tsx`, and `src/data/companies.json`.

## Tasks

- [x] 1. Extend TypeScript models in `src/models/index.ts`
  - Add the `UniqueWargearEntry` interface with fields: `equipmentId`, `label`, `influenceCost`, `rating: [number, number]`, and optional `allowedKeywords`, `heroOnly`, `limit`
  - Add `uniqueWargear?: UniqueWargearEntry[]` to `CompanyDefinition`
  - Add `allowedKeywords?: string[]` to `HeroUpgrade`
  - Add `heroRestrictions?: Array<{ allowedBaseUnitIds: string[] }>` to `CompanySpecialRule`
  - Add `count?: number` to the local `ReinforcementResult` interface inside `CompanyDetailsPage.tsx` (the `count` field on `ReinforcementEntry` already exists in the model; only the result interface needs updating)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2. Create `src/utils/companyRules.ts` — keyword and unique wargear helpers
  - Implement `getUnitKeywords(baseUnitId: string): string[]` — looks up `baseUnits.json`, returns `[]` if not found
  - Implement `unitMatchesKeywords(baseUnitId: string, allowedKeywords: string[]): boolean` — returns true if the unit has at least one keyword from the list
  - Implement `isUniqueWargearAtLimit(entry: UniqueWargearEntry, allMembers: Member[]): boolean` — counts members carrying `entry.equipmentId` and compares to `entry.limit`
  - Implement `getEligibleUniqueWargear(companyDef, member, allMembers): UniqueWargearEntry[]` — applies `heroOnly`, `allowedKeywords`, already-owned, and limit checks; returns `[]` when `companyDef.uniqueWargear` is absent
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [x] 2.1 Write property test: unique wargear keyword eligibility (Property 1)
    - **Property 1: Unique wargear keyword eligibility**
    - Generate a random hero member and a `UniqueWargearEntry` with a non-empty `allowedKeywords` array; assert `getEligibleUniqueWargear` includes the entry iff the hero's unit has at least one matching keyword
    - **Validates: Requirements 1.2, 1.3**

  - [x] 2.2 Write property test: unique wargear heroOnly exclusion (Property 2)
    - **Property 2: Unique wargear heroOnly exclusion**
    - Generate a random warrior member and a `UniqueWargearEntry` with `heroOnly: true`; assert the entry never appears in the result
    - **Validates: Requirements 1.4**

  - [x] 2.3 Write property test: unique wargear limit enforcement (Property 3)
    - **Property 3: Unique wargear limit enforcement**
    - Generate a member list where `count(equipmentId) >= limit` and a matching `UniqueWargearEntry`; assert the entry does not appear for any member
    - **Validates: Requirements 1.5**

  - [x] 2.4 Write property test: unique wargear already-owned exclusion (Property 4)
    - **Property 4: Unique wargear already-owned exclusion**
    - Generate a hero whose `equipment` already contains the `equipmentId`; assert the entry does not appear
    - **Validates: Requirements 1.7**

- [x] 3. Add hero upgrade and hero restriction helpers to `src/utils/companyRules.ts`
  - Implement `getEligibleHeroUpgrades(companyDef, member): HeroUpgrade[]` — preserves existing `baseUnitIds` filtering and adds `allowedKeywords` filtering; excludes upgrades already in `member.equipment`
  - Implement `getHeroAllowedBaseUnitIds(companyDef): string[] | null` — returns the `allowedBaseUnitIds` from the first `heroRestrictions` rule found, or `null` if none exists
  - Implement `isEligibleForHeroRole(baseUnitId, companyDef): boolean` — returns true when `getHeroAllowedBaseUnitIds` is null (no restriction) or when `baseUnitId` is in the list
  - _Requirements: 3.1, 3.2, 3.5, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.1 Write property test: hero restrictions eligibility (Property 7)
    - **Property 7: Hero restrictions eligibility**
    - Generate a random `CompanyDefinition` with a `heroRestrictions` rule and a random `baseUnitId`; assert `isEligibleForHeroRole` returns true iff the id is in `allowedBaseUnitIds`
    - **Validates: Requirements 3.1, 3.2, 3.5**

  - [x] 3.2 Write property test: hero upgrade keyword filtering (Property 10)
    - **Property 10: Hero upgrade keyword filtering**
    - Generate a random hero and a `HeroUpgrade` with a non-empty `allowedKeywords` array; assert `getEligibleHeroUpgrades` includes the upgrade iff the hero's unit has at least one matching keyword (and the hero hasn't already purchased it)
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

- [x] 4. Add reinforcement substitution and break point helpers to `src/utils/companyRules.ts`
  - Implement `getApplicableSubstitution(companyDef, finalRoll)` — searches all `companySpecialRules` for a `reinforcementSubstitution` array and returns the first entry whose `appliesTo` includes `finalRoll`, or `null`
  - Implement `calcBreakPoint(companyDef, startingMemberCount): number` — looks for a `breaking_point` rule, reads `parameters.breakPointPercentage`, validates it is a number in `(0, 1]`, falls back to `0.5` with `console.warn` on invalid input, returns `Math.floor(count * percentage)`
  - Implement `isCompanyBroken(breakPoint, activeMemberCount): boolean` — returns `activeMemberCount <= breakPoint`
  - _Requirements: 2.1, 6.1, 6.2, 6.3, 6.5_

  - [x] 4.1 Write property test: substitution prompt visibility (Property 6)
    - **Property 6: Substitution prompt visibility**
    - Generate a random `CompanyDefinition` with a `reinforcementSubstitution` rule and a random roll number; assert `getApplicableSubstitution` returns non-null iff the roll is in `appliesTo`
    - **Validates: Requirements 2.1**

  - [x] 4.2 Write property test: break point calculation correctness (Property 11)
    - **Property 11: Break point calculation correctness**
    - Generate random `startingMemberCount` (1–30) and random `breakPointPercentage` (valid or invalid); assert `calcBreakPoint` returns the correct floored value or falls back to 50% for invalid inputs
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 4.3 Write property test: broken state detection (Property 12)
    - **Property 12: Broken state detection**
    - Generate random `breakPoint` and `activeMemberCount`; assert `isCompanyBroken` returns true iff `activeMemberCount <= breakPoint`
    - **Validates: Requirements 6.5**

- [x] 5. Checkpoint — ensure all helper tests pass
  - Run `vitest --run src/utils/__tests__/companyRules.property.test.ts` and confirm all property tests pass; ask the user if any questions arise.

- [x] 6. Fix `companies.json` — add `breakPointPercentage` to Muster of Isengard
  - In `src/data/companies.json`, locate the Muster of Isengard company's `breaking_point` special rule and add `"parameters": { "breakPointPercentage": 0.66 }` to it
  - _Requirements: 6.2_

- [x] 7. Wire unique wargear into `StoreTab` in `CompanyDetailsPage.tsx`
  - Import `getEligibleUniqueWargear` from `src/utils/companyRules.ts`
  - In the wargear section, after building the `filtered` global wargear list, call `getEligibleUniqueWargear(companyDef, selectedMember, company.members)` and append the results
  - Render each `UniqueWargearEntry` using the same row component as global wargear, sourcing `label` and `influenceCost` from the entry directly
  - The purchase handler calls the existing `handleBuyWargear(selectedMember.id, entry.equipmentId, entry.influenceCost)` — no changes to that function are needed
  - Display `label` and `influenceCost` in the same visual style as global wargear items (Requirement 1.8)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 7.1 Write property test: unique wargear purchase state change (Property 5)
    - **Property 5: Unique wargear purchase state change**
    - Generate a random eligible hero, a random `UniqueWargearEntry`, and a company with sufficient IP; assert that after the purchase `influence` decreases by exactly `influenceCost` and `equipment` contains `equipmentId`
    - **Validates: Requirements 1.6**

- [x] 8. Wire hero upgrade keyword filtering into the hero upgrade render site
  - Import `getEligibleHeroUpgrades` from `src/utils/companyRules.ts`
  - Locate where `companyDef.heroUpgrade` is iterated to build the purchasable upgrade list (search `CompanyDetailsPage.tsx` and `MemberDetailsDrawer.tsx` for the render site)
  - Replace the raw `companyDef.heroUpgrade` array with the result of `getEligibleHeroUpgrades(companyDef, member)` at that render site
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Wire reinforcement substitution prompt into `StoreTab`
  - Import `getApplicableSubstitution` from `src/utils/companyRules.ts`
  - Add state: `const [substitutionDeclined, setSubstitutionDeclined] = useState(false)`; reset it alongside `rollResult` in `handleDismissRoll` and `handleRoll`
  - Derive `substitution` from `rollResult` and `companyDef` after each roll: `const substitution = rollResult && !specialPending ? getApplicableSubstitution(companyDef, rollResult.roll) : null`
  - When `substitution` is non-null and `!substitutionDeclined`, render a substitution prompt card above `ReinforcementResultCard` containing the `substitution.prompt` text, an "Accept" button, and a "Decline" button
  - "Accept" calls `handleAcceptSubstitution(substitution.baseUnitId)` which sets `rollResult` to `{ type: 'unit', roll: rollResult.roll, baseUnitId, equipment: [] }` and resets `substitutionDeclined`
  - "Decline" sets `substitutionDeclined = true`
  - Disable the "Accept" button (with an appropriate message) when the company is at max size or when the substitute unit would violate a composition limit — reuse the existing `wouldExceedBowLimit`, `wouldExceedThrowingLimit`, and `wouldExceedCavalryLimit` helpers
  - After accepting, the existing `confirmRecruitment` → `finaliseRecruitment` flow handles name entry and saving unchanged
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 10. Wire `count > 1` into the reinforcement roll flow in `StoreTab`
  - In `rollOnTable`, when `row.result === 'unit'`, pass `count: row.count ?? 1` through to the returned `ReinforcementResult`
  - In `confirmRecruitment`, when `finalResult.type === 'unit'` and `finalResult.count > 1`, push `count` copies of `{ baseUnitId, equipment }` into `candidates` instead of one (treat `count <= 0` as 1)
  - The existing size and composition limit checks already operate on the full `candidates` array — no changes needed there
  - In `ReinforcementResultCard` (or inline in the result display), show `×N` when `result.count > 1` so the player can see how many units will be recruited (Requirement 4.7)
  - The existing `finaliseRecruitment` function already opens one name field per candidate and saves all members in a single operation — no changes needed there
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 10.1 Write property test: multi-count recruitment size change (Property 8)
    - **Property 8: Multi-count recruitment size change**
    - Generate a random company with room for N more members and a `unit` result with `count = N ≥ 1`; assert that after recruitment `members.length` increases by exactly N and `influence` decreases by exactly `reinforcementCost` (once)
    - **Validates: Requirements 4.2, 4.6**

  - [x] 10.2 Write property test: multi-count size limit enforcement (Property 9)
    - **Property 9: Multi-count size limit enforcement**
    - Generate a random company where `members.length + N > maxCompanySize`; assert recruitment is blocked and `members.length` is unchanged
    - **Validates: Requirements 4.3**

- [x] 11. Wire hero restrictions into `StepLeaderSelection.tsx`
  - Add `heroAllowedBaseUnitIds?: string[] | null` to the `Props` interface (null = no restriction)
  - In the member rendering loop, compute `isRestricted = heroAllowedBaseUnitIds != null && !heroAllowedBaseUnitIds.includes(member.baseUnitId)`
  - A restricted member: cannot be clicked to assign a hero role (same as `isDisabled`), renders a `LockIcon` with `aria-label="Not eligible for hero role"`, and is visually dimmed (`opacity: 0.4`) — same visual treatment as slot-full ineligibility but with a distinct tooltip/aria-label
  - In `CreateCompanyPage.tsx`, derive `heroAllowedBaseUnitIds` via `useMemo(() => getHeroAllowedBaseUnitIds(companyDef), [companyDef])` and pass it as a prop to `StepLeaderSelection`
  - Import `getHeroAllowedBaseUnitIds` from `src/utils/companyRules.ts` in `CreateCompanyPage.tsx`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 12. Wire break point calculation into `MatchTrackingPage.tsx`
  - Import `calcBreakPoint` and `isCompanyBroken` from `src/utils/companyRules.ts`
  - Import `companiesData` and cast it as `CompanyDefinition[]`; derive `companyDef` from `company.companyTypeId`
  - Derive `startingMemberCount = match.members.length`, `breakPoint = companyDef ? calcBreakPoint(companyDef, startingMemberCount) : Math.floor(startingMemberCount / 2)`, `activeMemberCount = match.members.filter(m => !m.isCasualty).length`, and `isBroken = isCompanyBroken(breakPoint, activeMemberCount)`
  - Add a persistent break point banner below the reroll counter (or in its place when no rerolls are active) showing: `BREAK POINT  [activeMemberCount] / [startingMemberCount]  (threshold: [breakPoint])`
  - When `isBroken` is true, change the banner colour to `error.main` and display "BROKEN" in place of the threshold label
  - The banner is always visible during a match (not just when broken)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 13. Final checkpoint — ensure all tests pass and TypeScript compiles cleanly
  - Run `vitest --run` and confirm all tests pass
  - Run `tsc --noEmit` and confirm zero type errors
  - Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests go in `src/utils/__tests__/companyRules.property.test.ts`
- Each task references specific requirements for traceability
- Checkpoints (tasks 5 and 13) ensure incremental validation
- The `handleBuyWargear` function in `StoreTab` requires no changes — it already handles adding `equipmentId` to `member.equipment` and deducting IP
- The `finaliseRecruitment` function requires no changes for multi-count — it already iterates `nameDialog.members` and saves all in one operation
- Hero upgrade render site must be located at implementation time (search `CompanyDetailsPage.tsx` and `MemberDetailsDrawer.tsx` for `companyDef.heroUpgrade`)
