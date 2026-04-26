# Implementation Plan: Battle Companies Fixes and Features

## Overview

Implement four bug fixes and eight features across the Battle Companies PWA. Each item is self-contained and can be implemented independently. The plan is ordered from lowest-risk (pure utility/data fixes) to highest-risk (complex UI flows), so early tasks validate the foundation before later tasks build on it.

## Tasks

- [ ] 1. BUG-1 — Fix minor special rule rating cap in both calculators
  - [ ] 1.1 Build `MINOR_RULE_LABELS` set in `src/utils/rating.ts`
    - Import `specialRulesData` from `src/data/specialRules.json`
    - Build `const MINOR_RULE_LABELS = new Set(specialRulesData.filter(r => r.minor).map(r => r.label))`
    - In `calcMemberRating`, split `countableSpecialRules` into `minorRules` and `majorRules` buckets
    - Replace `countableSpecialRules.length * 5` with `Math.min(minorRules.length * 5, 10) + majorRules.length * 5`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ] 1.2 Apply the same cap in `src/services/calculator/ratingCalculator.ts`
    - Import `specialRulesData` and build the same `MINOR_RULE_LABELS` set
    - Replace `member.specialRules.length * RATING_POINTS.specialRule` with the capped calculation
    - _Requirements: 1.8_

  - [ ]* 1.3 Write property test for minor special rule cap (Property 1)
    - **Property 1: Minor special rule cap**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
    - Generate heroes with arbitrary counts of minor rules, major rules, and heroic actions
    - Assert special rule contribution equals `min(minorCount * 5, 10) + majorCount * 5`

  - [ ]* 1.4 Write property test for rating calculator consistency (Property 2)
    - **Property 2: Rating calculator consistency**
    - **Validates: Requirements 1.8**
    - Generate arbitrary `Member` and `StoredBaseUnitStats` objects
    - Assert `calcMemberRating` in `rating.ts` and `ratingCalculator.ts` return the same value

- [ ] 2. BUG-3 — Fix match history injury outcome labels
  - [ ] 2.1 Replace `injuryLabel` in `HistoryMatchCard` with an explicit lookup map
    - Add `INJURY_OUTCOME_LABELS` constant inside `HistoryMatchCard` in `src/pages/CompanyDetailsPage.tsx`
    - Map all 12 known outcome types to human-readable strings (including `warrior_dead` → "Dead", `warrior_injured` → "Injured")
    - Keep the generic `replace(/_/g, ' ')` transform as a fallback for unknown types
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.2 Write property test for injury outcome label (Property 3)
    - **Property 3: Injury outcome label is always human-readable**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Generate strings from the known outcome type set
    - Assert each label contains no underscores and begins with an uppercase letter

- [ ] 3. BUG-4 — Disable Save button on validation errors in EditStatsPage
  - [ ] 3.1 Derive `hasErrors` and wire it to the Save button's `disabled` prop
    - In `src/pages/EditStatsPage.tsx`, add `const hasErrors = Object.keys(errors).length > 0`
    - Pass `disabled={hasErrors}` to the Save & Continue / Save & Finish `Button`
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

  - [ ] 3.2 Validate on every field change so the button state is live
    - In `handleFieldChange`, after updating `formValues`, call `validateForm` with the new values and update both `errors` and `warnings` state
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.8_

  - [ ]* 3.3 Write property test for stats validation rejects out-of-range (Property 4)
    - **Property 4: Stats validation rejects out-of-range values**
    - **Validates: Requirements 4.1, 4.2, 4.7**
    - For each field in `STATS_ENTRY_FIELDS` and `MOUNT_STATS_ENTRY_FIELDS`, generate integers outside `[min, max]`
    - Assert `validateForm` returns a non-empty error for that field

  - [ ]* 3.4 Write property test for stats validation accepts in-range (Property 5)
    - **Property 5: Stats validation accepts in-range values**
    - **Validates: Requirements 4.3**
    - Generate complete form value sets where every value is within bounds
    - Assert `validateForm` returns an empty errors object

  - [ ]* 3.5 Write property test for stats validation warns on threshold (Property 6)
    - **Property 6: Stats validation warns on threshold violations**
    - **Validates: Requirements 4.4, 4.5**
    - Generate values in the `warnBelow` and `warnAbove` zones
    - Assert warnings are present and errors are absent

- [ ] 4. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 5. BUG-2 — Show animated D6 roll for "Wounds of a Hero"
  - [ ] 5.1 Add `woundsOfHeroDialog` state and pause injury processing on this outcome
    - In `src/pages/PostMatchSummaryPage.tsx`, add state:
      ```typescript
      const [woundsOfHeroDialog, setWoundsOfHeroDialog] = useState<{
        memberName: string; d6Roll: number; bonusInfluence: number
      } | null>(null)
      ```
    - In `applyInjuryAndAdvance`, when `outcomeToApply.type === 'wounds_of_a_hero'`, instead of immediately calling `setBonusInfluence`, set `woundsOfHeroDialog` with the pre-rolled D6 value and `bonusInfluence` from the outcome, then return early (do not advance to next casualty yet)
    - _Requirements: 2.1, 2.5_

  - [ ] 5.2 Render the `woundsOfHeroDialog` with `AnimatedDice` and an Acknowledge button
    - Add a `Dialog` that opens when `woundsOfHeroDialog !== null`
    - Render `<AnimatedDice value={woundsOfHeroDialog.d6Roll} faces={6} />` inside the dialog
    - Display the bonus influence amount once the die settles
    - On "Acknowledge", apply `setBonusInfluence(prev => prev + woundsOfHeroDialog.bonusInfluence)`, close the dialog, and call `advanceInjuryIndex` for the current member
    - _Requirements: 2.2, 2.3, 2.4_

- [ ] 6. FEAT-2 — "Ready to Advance" chip in MemberDetailsDrawer
  - [ ] 6.1 Add promotion eligibility chip near the XP bar
    - In `src/components/common/MemberDetailsDrawer.tsx`, locate the XP `LinearProgress` section
    - Immediately after the progress bar, render:
      ```tsx
      {member.experience >= 5 && (
        <Chip label="Ready to Advance" size="small" sx={{ mt: 0.75, fontSize: '0.65rem', background: 'rgba(201,168,76,0.15)', color: 'primary.main', border: '1px solid', borderColor: 'primary.main' }} />
      )}
      ```
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.2 Write property test for promotion eligibility threshold (Property 8)
    - **Property 8: Promotion eligibility indicator threshold**
    - **Validates: Requirements 6.1, 6.3, 6.4**
    - Generate members with random `experience` values
    - Assert the chip is shown if and only if `experience >= 5`

- [ ] 7. FEAT-1 — Company size counter "X/Y members" on Roster tab
  - [ ] 7.1 Replace the raw Members stat bar entry with an X/Y counter
    - In `src/pages/CompanyDetailsPage.tsx`, compute:
      ```typescript
      const wandererCount = company.wandererId ? 1 : 0
      const totalMembers = company.members.length + wandererCount
      const maxSize = companyDef?.maxCompanySize ?? 15
      const isAtMax = totalMembers >= maxSize
      ```
    - Replace `{ label: 'Members', value: \`${company.members.length}\` }` with `{ label: 'Members', value: \`${totalMembers}/${maxSize}\`, atMax: isAtMax }`
    - Apply `color: 'warning.main'` to the value `Typography` when `isAtMax` is true
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 7.2 Write property test for company size counter (Property 7)
    - **Property 7: Company size counter includes wanderer**
    - **Validates: Requirements 5.1, 5.2**
    - Generate companies with random member counts and random `wandererId` presence
    - Assert the counter X equals `members.length + (wandererId ? 1 : 0)`

- [ ] 8. FEAT-5 — Include wanderer rating in `calcCompanyRating`
  - [ ] 8.1 Add optional `wanderer` parameter to `calcCompanyRating` in `src/utils/rating.ts`
    - Add `wanderer?: { pointsCost: number }` as a third parameter
    - Add `const wandererTotal = wanderer ? wanderer.pointsCost : 0` and include it in the return value
    - _Requirements: 9.1, 9.2, 9.4_

  - [ ] 8.2 Pass wanderer data from `CompanyDetailsPage` and `MatchSetupPage`
    - In `src/pages/CompanyDetailsPage.tsx`, import `wanderersData` (already imported), resolve the wanderer by `company.wandererId`, and pass `{ pointsCost: wanderer.pointsCost }` to `calcCompanyRating`
    - Apply the same change in `src/pages/MatchSetupPage.tsx` where `calcCompanyRating` is called
    - _Requirements: 9.3, 9.5_

  - [ ]* 8.3 Write property test for wanderer rating contribution (Property 10)
    - **Property 10: Wanderer rating contribution**
    - **Validates: Requirements 9.1, 9.2**
    - Generate companies with and without a wanderer
    - Assert the difference in rating equals the wanderer's `pointsCost` when present, and zero when absent

- [ ] 9. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 10. FEAT-6 — Persist spells on Member model
  - [ ] 10.1 Add `spells` and `spellImprovements` optional fields to the `Member` interface
    - In `src/models/index.ts`, add to `Member`:
      ```typescript
      spells?: string[]
      spellImprovements?: Record<string, number>
      ```
    - _Requirements: 10.1, 10.4, 10.7_

  - [ ] 10.2 Write starting spell to `member.spells` in `companyFactory.ts`
    - In `src/services/company/companyFactory.ts`, when creating a hero on Path of Channeling (`heroSpellChoices[tempId]` is set), assign `member.spells = [heroSpellChoices[tempId]]`
    - _Requirements: 10.2_

  - [ ] 10.3 Handle `magical_power` and `improve_casting_value` results in `PostMatchSummaryPage`
    - In `src/pages/PostMatchSummaryPage.tsx`, in the hero advancement apply logic, when the chosen result type is `magical_power`, append the chosen spell ID to `member.spells`
    - When the result type is `improve_casting_value`, increment `member.spellImprovements[spellId]` (capped at 2)
    - _Requirements: 10.3, 10.4_

  - [ ] 10.4 Display spells in `MemberDetailsDrawer`
    - In `src/components/common/MemberDetailsDrawer.tsx`, add a "Magical Powers" section rendered when `member.spells?.length > 0`
    - Display each spell's label (looked up from `CHANNELING_SPELLS` or `paths.json` spell entries) and its effective casting value (base minus improvement count)
    - _Requirements: 10.5, 10.6_

  - [ ]* 10.5 Write property test for spell round-trip persistence (Property 11)
    - **Property 11: Spell round-trip persistence**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - Generate spell IDs; add to a member, save to mock DB, reload
    - Assert the spell ID is present in the reloaded member's `spells` array

- [ ] 11. FEAT-4 — Wanderer in match tracking roster
  - [ ] 11.1 Create synthetic `MemberMatchState` for the wanderer at match setup
    - In `src/pages/MatchSetupPage.tsx`, in `handleStart`, after building `activeMembers`, check `company.wandererId`
    - If set, look up the wanderer in `wanderersData`, create a `MemberMatchState` with `memberId: company.wandererId`, `role: 'wanderer'`, and M/W/F values from the wanderer profile, and append it to `match.members`
    - If the wanderer ID is not found in `wanderersData`, log a console warning and skip
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 8.9_

  - [ ] 11.2 Ensure `MatchTrackingPage` renders the wanderer card correctly
    - In `src/pages/MatchTrackingPage.tsx`, update `ROLE_ORDER` to include `wanderer: 2.5` (or append after `hero_in_making`) so the wanderer sorts after heroes-in-making
    - The wanderer's `memberId` is the wanderer ID string, not a UUID — `company.members.find(m => m.id === mm.memberId)` will return `undefined`; guard `statIncreases` and `statDecreases` with `?? {}` (already done in the existing code)
    - _Requirements: 8.3, 8.4, 8.7_

  - [ ] 11.3 Include wanderer XP in post-match data but do not apply to `company.members`
    - In `src/pages/MatchTrackingPage.tsx`, in `handleEndMatch`, the wanderer entry is already included in `xpGained` via `match.members.map(...)` — verify the wanderer's `memberId` is not in `company.members`, so `updatedMembers` naturally excludes it
    - _Requirements: 8.8, 8.9_

- [ ] 12. FEAT-3 — Leader/Sergeant death cascade in PostMatchSummaryPage
  - [ ] 12.1 Add cascade state and helper to `PostMatchSummaryPage`
    - In `src/pages/PostMatchSummaryPage.tsx`, add:
      ```typescript
      const [cascadeDialog, setCascadeDialog] = useState<{
        type: 'leader' | 'sergeant'
        candidates: Array<{ memberId: string; memberName: string; xp: number; rating: number }>
      } | null>(null)
      const [cascadeSummary, setCascadeSummary] = useState<string | null>(null)
      ```
    - _Requirements: 7.1, 7.8_

  - [ ] 12.2 Implement cascade trigger in `applyInjuryAndAdvance`
    - After a member is confirmed dead and removed from `workingCompany.members`, check the dead member's role
    - If `role === 'leader'`: find surviving sergeants, sort by XP desc then rating desc; if one candidate auto-promote, if multiple tied prompt via `cascadeDialog`, if none notify user
    - If `role === 'sergeant'` and surviving sergeants < 2: find `hero_in_making` members sorted by XP/rating; if found auto-promote best to sergeant; if none find warriors sorted by XP/rating and auto-promote best to `hero_in_making` + sergeant, then open `pathSelectMember` for path selection
    - If no eligible member exists, set `cascadeSummary` with a notification and skip
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.10_

  - [ ] 12.3 Render `cascadeDialog` for tie-breaking and `cascadeSummary` alert
    - Add a `Dialog` that opens when `cascadeDialog !== null`, listing candidates with their XP and rating; on selection, apply the role change to `workingCompany` and close the dialog
    - Render `cascadeSummary` as a dismissible `Alert` or `Snackbar` before the user proceeds
    - Reuse the existing `pathSelectMember` state and `applyHeroPath` function for warrior→hero cascade path selection
    - _Requirements: 7.2, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [ ]* 12.4 Write property test for leader death cascade (Property 9)
    - **Property 9: Leader death cascade always produces a valid leader**
    - **Validates: Requirements 7.1, 7.2**
    - Generate company states with a leader and 1+ sergeants; simulate leader death
    - Assert exactly one member has role `leader` after cascade completes

- [ ] 13. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 14. FEAT-7 — Expand hero wargear pool to all company profiles
  - [ ] 14.1 Implement `getAllCompanyProfileIds` helper in `CompanyDetailsPage`
    - In `src/pages/CompanyDetailsPage.tsx`, add a pure function:
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
    - _Requirements: 11.1, 11.6_

  - [ ] 14.2 Use the expanded profile set to build the hero wargear purchase pool in `StoreTab`
    - In the `StoreTab` wargear section, replace the single-profile wargear lookup with a union of wargear from all `getAllCompanyProfileIds` profiles
    - De-duplicate the resulting wargear list before rendering
    - Continue applying the existing A+W cost rules and already-owned filtering
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 14.3 Write property test for hero wargear superset (Property 12)
    - **Property 12: Hero wargear pool is a superset of own-profile wargear**
    - **Validates: Requirements 11.1, 11.2, 11.3**
    - Generate company definitions; assert the expanded pool for any hero is a superset of the hero's own profile wargear

- [ ] 15. FEAT-8 — Injury treatment accessible from Store tab
  - [ ] 15.1 Extract `InjuryTreatmentPanel` sub-component from `MemberDetailsDrawer`
    - Create a new component `InjuryTreatmentPanel` (can be defined in `src/pages/CompanyDetailsPage.tsx` or a shared file) with props:
      ```typescript
      interface InjuryTreatmentPanelProps {
        member: Member
        company: Company
        onSaveCompany: (c: Company) => Promise<void>
      }
      ```
    - Move the treatment state machine (options dialog → roll dialog → confirm) from `MemberDetailsDrawer` into this component, or replicate it inline in `StoreTab`
    - _Requirements: 12.7_

  - [ ] 15.2 Add "Injury Treatment" section to `StoreTab`
    - In `StoreTab` in `src/pages/CompanyDetailsPage.tsx`, add a new section (alongside existing sections like `'reinforcements'`, `'wargear'`, etc.)
    - List all members with treatable injuries (warriors with `missing_next_game`; heroes with `arm_wound`, `leg_wound`, or `broken_honour`)
    - For each injured member, render `InjuryTreatmentPanel` (or inline treatment UI)
    - When no members have treatable injuries, display "No injuries require treatment"
    - Show current influence balance and cost of each treatment option; disable options when influence is insufficient
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ] 16. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests require `fast-check` (`npm install --save-dev fast-check`)
- Each property test file should be tagged: `// Feature: battle-companies-fixes-and-features, Property N: <text>`
- Tasks 1–3 (BUG-1, BUG-3, BUG-4) are pure logic/UI fixes with no state dependencies — implement first
- FEAT-3 (task 12) is the most complex item; it builds on the existing `pathSelectMember` / `applyHeroPath` flow already in `PostMatchSummaryPage`
- No database migrations are needed — all new `Member` fields (`spells`, `spellImprovements`) are optional
