# Implementation Plan: Battle Companies Fixes and Features

## Overview

Implement four bug fixes and eight features across the Battle Companies PWA. Each item is self-contained and can be implemented independently. The plan is ordered from lowest-risk (pure utility/data fixes) to highest-risk (complex UI flows), so early tasks validate the foundation before later tasks build on it.

## Tasks

- [x] 1. BUG-1 — Fix minor special rule rating cap in both calculators
  - [x] 1.1 Build `MINOR_RULE_LABELS` set in `src/utils/rating.ts`
    - Import `specialRulesData` from `src/data/specialRules.json`
    - Build `const MINOR_RULE_LABELS = new Set(specialRulesData.filter(r => r.minor).map(r => r.label))`
    - In `calcMemberRating`, split `countableSpecialRules` into `minorRules` and `majorRules` buckets
    - Replace `countableSpecialRules.length * 5` with `Math.min(minorRules.length * 5, 10) + majorRules.length * 5`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 1.2 Apply the same cap in `src/services/calculator/ratingCalculator.ts`
    - Import `specialRulesData` and build the same `MINOR_RULE_LABELS` set
    - Replace `member.specialRules.length * RATING_POINTS.specialRule` with the capped calculation
    - _Requirements: 1.8_

  - [x] 1.3 Write property test for minor special rule cap (Property 1)
    - **Property 1: Minor special rule cap**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
    - Generate heroes with arbitrary counts of minor rules, major rules, and heroic actions
    - Assert special rule contribution equals `min(minorCount * 5, 10) + majorCount * 5`

  - [x] 1.4 Write property test for rating calculator consistency (Property 2)
    - **Property 2: Rating calculator consistency**
    - **Validates: Requirements 1.8**
    - Generate arbitrary `Member` and `StoredBaseUnitStats` objects
    - Assert `calcMemberRating` in `rating.ts` and `ratingCalculator.ts` return the same value

- [x] 2. BUG-3 — Fix match history injury outcome labels
  - [x] 2.1 Replace `injuryLabel` in `HistoryMatchCard` with an explicit lookup map
    - Add `INJURY_OUTCOME_LABELS` constant inside `HistoryMatchCard` in `src/pages/CompanyDetailsPage.tsx`
    - Map all 12 known outcome types to human-readable strings (including `warrior_dead` → "Dead", `warrior_injured` → "Injured")
    - Keep the generic `replace(/_/g, ' ')` transform as a fallback for unknown types
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Write property test for injury outcome label (Property 3)
    - **Property 3: Injury outcome label is always human-readable**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Generate strings from the known outcome type set
    - Assert each label contains no underscores and begins with an uppercase letter

- [x] 3. BUG-4 — Disable Save button on validation errors in EditStatsPage
  - [x] 3.1 Derive `hasErrors` and wire it to the Save button's `disabled` prop
    - In `src/pages/EditStatsPage.tsx`, add `const hasErrors = Object.keys(errors).length > 0`
    - Pass `disabled={hasErrors}` to the Save & Continue / Save & Finish `Button`
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

  - [x] 3.2 Validate on every field change so the button state is live
    - In `handleFieldChange`, after updating `formValues`, call `validateForm` with the new values and update both `errors` and `warnings` state
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.8_

  - [x] 3.3 Write property test for stats validation rejects out-of-range (Property 4)
    - **Property 4: Stats validation rejects out-of-range values**
    - **Validates: Requirements 4.1, 4.2, 4.7**
    - For each field in `STATS_ENTRY_FIELDS` and `MOUNT_STATS_ENTRY_FIELDS`, generate integers outside `[min, max]`
    - Assert `validateForm` returns a non-empty error for that field

  - [x] 3.4 Write property test for stats validation accepts in-range (Property 5)
    - **Property 5: Stats validation accepts in-range values**
    - **Validates: Requirements 4.3**
    - Generate complete form value sets where every value is within bounds
    - Assert `validateForm` returns an empty errors object

  - [x] 3.5 Write property test for stats validation warns on threshold (Property 6)
    - **Property 6: Stats validation warns on threshold violations**
    - **Validates: Requirements 4.4, 4.5**
    - Generate values in the `warnBelow` and `warnAbove` zones
    - Assert warnings are present and errors are absent

- [x] 4. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 5. BUG-2 — Show animated D6 roll for "Wounds of a Hero"
  - [x] 5.1 Add `woundsOfHeroDialog` state and pause injury processing on this outcome
    - In `src/pages/PostMatchSummaryPage.tsx`, add state:
      ```typescript
      const [woundsOfHeroDialog, setWoundsOfHeroDialog] = useState<{
        memberName: string; d6Roll: number; bonusInfluence: number
      } | null>(null)
      ```
    - In `applyInjuryAndAdvance`, when `outcomeToApply.type === 'wounds_of_a_hero'`, instead of immediately calling `setBonusInfluence`, set `woundsOfHeroDialog` with the pre-rolled D6 value and `bonusInfluence` from the outcome, then return early (do not advance to next casualty yet)
    - _Requirements: 2.1, 2.5_

  - [x] 5.2 Render the `woundsOfHeroDialog` with `AnimatedDice` and an Acknowledge button
    - Add a `Dialog` that opens when `woundsOfHeroDialog !== null`
    - Render `<AnimatedDice value={woundsOfHeroDialog.d6Roll} faces={6} />` inside the dialog
    - Display the bonus influence amount once the die settles
    - On "Acknowledge", apply `setBonusInfluence(prev => prev + woundsOfHeroDialog.bonusInfluence)`, close the dialog, and call `advanceInjuryIndex` for the current member
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 6. FEAT-2 — "Ready to Advance" chip in MemberDetailsDrawer
  - [x] 6.1 Add promotion eligibility chip near the XP bar
    - In `src/components/common/MemberDetailsDrawer.tsx`, locate the XP `LinearProgress` section
    - Immediately after the progress bar, render:
      ```tsx
      {member.experience >= 5 && (
        <Chip label="Ready to Advance" size="small" sx={{ mt: 0.75, fontSize: '0.65rem', background: 'rgba(201,168,76,0.15)', color: 'primary.main', border: '1px solid', borderColor: 'primary.main' }} />
      )}
      ```
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.2 Write property test for promotion eligibility threshold (Property 8)
    - **Property 8: Promotion eligibility indicator threshold**
    - **Validates: Requirements 6.1, 6.3, 6.4**
    - Generate members with random `experience` values
    - Assert the chip is shown if and only if `experience >= 5`

- [x] 7. FEAT-1 — Company size counter "X/Y members" on Roster tab
  - [x] 7.1 Replace the raw Members stat bar entry with an X/Y counter
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

  - [x] 7.2 Write property test for company size counter (Property 7)
    - **Property 7: Company size counter includes wanderer**
    - **Validates: Requirements 5.1, 5.2**
    - Generate companies with random member counts and random `wandererId` presence
    - Assert the counter X equals `members.length + (wandererId ? 1 : 0)`

- [x] 8. FEAT-5 — Include wanderer rating in `calcCompanyRating`
  - [x] 8.1 Add optional `wanderer` parameter to `calcCompanyRating` in `src/utils/rating.ts`
    - Add `wanderer?: { pointsCost: number }` as a third parameter
    - Add `const wandererTotal = wanderer ? wanderer.pointsCost : 0` and include it in the return value
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 8.2 Pass wanderer data from `CompanyDetailsPage` and `MatchSetupPage`
    - In `src/pages/CompanyDetailsPage.tsx`, import `wanderersData` (already imported), resolve the wanderer by `company.wandererId`, and pass `{ pointsCost: wanderer.pointsCost }` to `calcCompanyRating`
    - Apply the same change in `src/pages/MatchSetupPage.tsx` where `calcCompanyRating` is called
    - _Requirements: 9.3, 9.5_

  - [x] 8.3 Write property test for wanderer rating contribution (Property 10)
    - **Property 10: Wanderer rating contribution**
    - **Validates: Requirements 9.1, 9.2**
    - Generate companies with and without a wanderer
    - Assert the difference in rating equals the wanderer's `pointsCost` when present, and zero when absent

- [x] 9. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 10. FEAT-6 — Persist spells on Member model
  - [x] 10.1 Add `spells` and `spellImprovements` optional fields to the `Member` interface
    - In `src/models/index.ts`, add to `Member`:
      ```typescript
      spells?: string[]
      spellImprovements?: Record<string, number>
      ```
    - _Requirements: 10.1, 10.4, 10.7_

  - [x] 10.2 Write starting spell to `member.spells` in `companyFactory.ts`
    - In `src/services/company/companyFactory.ts`, when creating a hero on Path of Channeling (`heroSpellChoices[tempId]` is set), assign `member.spells = [heroSpellChoices[tempId]]`
    - _Requirements: 10.2_

  - [x] 10.3 Handle `magical_power` and `improve_casting_value` results in `PostMatchSummaryPage`
    - In `src/pages/PostMatchSummaryPage.tsx`, in the hero advancement apply logic, when the chosen result type is `magical_power`, append the chosen spell ID to `member.spells`
    - When the result type is `improve_casting_value`, increment `member.spellImprovements[spellId]` (capped at 2)
    - _Requirements: 10.3, 10.4_

  - [x] 10.4 Display spells in `MemberDetailsDrawer`
    - In `src/components/common/MemberDetailsDrawer.tsx`, add a "Magical Powers" section rendered when `member.spells?.length > 0`
    - Display each spell's label (looked up from `CHANNELING_SPELLS` or `paths.json` spell entries) and its effective casting value (base minus improvement count)
    - _Requirements: 10.5, 10.6_

  - [x] 10.5 Write property test for spell round-trip persistence (Property 11)
    - **Property 11: Spell round-trip persistence**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - Generate spell IDs; add to a member, save to mock DB, reload
    - Assert the spell ID is present in the reloaded member's `spells` array

- [x] 11. FEAT-4 — Wanderer in match tracking roster
  - [x] 11.1 Create synthetic `MemberMatchState` for the wanderer at match setup
    - In `src/pages/MatchSetupPage.tsx`, in `handleStart`, after building `activeMembers`, check `company.wandererId`
    - If set, look up the wanderer in `wanderersData`, create a `MemberMatchState` with `memberId: company.wandererId`, `role: 'wanderer'`, and M/W/F values from the wanderer profile, and append it to `match.members`
    - If the wanderer ID is not found in `wanderersData`, log a console warning and skip
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 8.9_

  - [x] 11.2 Ensure `MatchTrackingPage` renders the wanderer card correctly
    - In `src/pages/MatchTrackingPage.tsx`, update `ROLE_ORDER` to include `wanderer: 2.5` (or append after `hero_in_making`) so the wanderer sorts after heroes-in-making
    - The wanderer's `memberId` is the wanderer ID string, not a UUID — `company.members.find(m => m.id === mm.memberId)` will return `undefined`; guard `statIncreases` and `statDecreases` with `?? {}` (already done in the existing code)
    - _Requirements: 8.3, 8.4, 8.7_

  - [x] 11.3 Include wanderer XP in post-match data but do not apply to `company.members`
    - In `src/pages/MatchTrackingPage.tsx`, in `handleEndMatch`, the wanderer entry is already included in `xpGained` via `match.members.map(...)` — verify the wanderer's `memberId` is not in `company.members`, so `updatedMembers` naturally excludes it
    - _Requirements: 8.8, 8.9_

- [x] 12. FEAT-3 — Leader/Sergeant death cascade in PostMatchSummaryPage
  - [x] 12.1 Add cascade state and helper to `PostMatchSummaryPage`
    - In `src/pages/PostMatchSummaryPage.tsx`, add:
      ```typescript
      const [cascadeDialog, setCascadeDialog] = useState<{
        type: 'leader' | 'sergeant'
        candidates: Array<{ memberId: string; memberName: string; xp: number; rating: number }>
      } | null>(null)
      const [cascadeSummary, setCascadeSummary] = useState<string | null>(null)
      ```
    - _Requirements: 7.1, 7.8_

  - [x] 12.2 Implement cascade trigger in `applyInjuryAndAdvance`
    - After a member is confirmed dead and removed from `workingCompany.members`, check the dead member's role
    - If `role === 'leader'`: find surviving sergeants, sort by XP desc then rating desc; if one candidate auto-promote, if multiple tied prompt via `cascadeDialog`, if none notify user
    - If `role === 'sergeant'` and surviving sergeants < 2: find `hero_in_making` members sorted by XP/rating; if found auto-promote best to sergeant; if none find warriors sorted by XP/rating and auto-promote best to `hero_in_making` + sergeant, then open `pathSelectMember` for path selection
    - If no eligible member exists, set `cascadeSummary` with a notification and skip
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.10_

  - [x] 12.3 Render `cascadeDialog` for tie-breaking and `cascadeSummary` alert
    - Add a `Dialog` that opens when `cascadeDialog !== null`, listing candidates with their XP and rating; on selection, apply the role change to `workingCompany` and close the dialog
    - Render `cascadeSummary` as a dismissible `Alert` or `Snackbar` before the user proceeds
    - Reuse the existing `pathSelectMember` state and `applyHeroPath` function for warrior→hero cascade path selection
    - _Requirements: 7.2, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 12.4 Write property test for leader death cascade (Property 9)
    - **Property 9: Leader death cascade always produces a valid leader**
    - **Validates: Requirements 7.1, 7.2**
    - Generate company states with a leader and 1+ sergeants; simulate leader death
    - Assert exactly one member has role `leader` after cascade completes

- [x] 13. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 14. FEAT-7 — Expand hero wargear pool to all company profiles
  - [x] 14.1 Implement `getAllCompanyProfileIds` helper in `CompanyDetailsPage`
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

  - [x] 14.2 Use the expanded profile set to build the hero wargear purchase pool in `StoreTab`
    - In the `StoreTab` wargear section, replace the single-profile wargear lookup with a union of wargear from all `getAllCompanyProfileIds` profiles
    - De-duplicate the resulting wargear list before rendering
    - Continue applying the existing A+W cost rules and already-owned filtering
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 14.3 Write property test for hero wargear superset (Property 12)
    - **Property 12: Hero wargear pool is a superset of own-profile wargear**
    - **Validates: Requirements 11.1, 11.2, 11.3**
    - Generate company definitions; assert the expanded pool for any hero is a superset of the hero's own profile wargear

- [x] 15. FEAT-8 — Injury treatment accessible from Store tab
  - [x] 15.1 Extract `InjuryTreatmentPanel` sub-component from `MemberDetailsDrawer`
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

  - [x] 15.2 Add "Injury Treatment" section to `StoreTab`
    - In `StoreTab` in `src/pages/CompanyDetailsPage.tsx`, add a new section (alongside existing sections like `'reinforcements'`, `'wargear'`, etc.)
    - List all members with treatable injuries (warriors with `missing_next_game`; heroes with `arm_wound`, `leg_wound`, or `broken_honour`)
    - For each injured member, render `InjuryTreatmentPanel` (or inline treatment UI)
    - When no members have treatable injuries, display "No injuries require treatment"
    - Show current influence balance and cost of each treatment option; disable options when influence is insufficient
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 16. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 17. REQ-21 — Start Match FAB visible from all tabs
  - In `src/pages/CompanyDetailsPage.tsx`, remove the `{activeTab === 0 && (` condition wrapping the Start Match `Fab` and its closing `)}` so the FAB renders regardless of the active tab
  - The FAB already uses `position: 'fixed'` so no layout changes are needed
  - _Requirements: 21.1, 21.2, 21.3_

- [x] 18. REQ-20 — Reset hero/warrior advancement card state on each promotion
  - In `src/pages/PostMatchSummaryPage.tsx`, add `key={currentHero.memberId}` (or equivalent identifier) to the active `HeroAdvancementCard` render so React remounts the component — and resets all internal state — whenever the current hero changes
  - Apply the same `key` fix to `WarriorProgressionCard` for consistency
  - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [x] 19. REQ-16 — Sort members in Store tab unit selectors
  - In `src/pages/CompanyDetailsPage.tsx` inside `StoreTab`, add a `sortMembersForStore` helper that orders members using the existing `ROLE_ORDER` map (leader → sergeant → hero_in_making → warrior) with alphabetical tiebreak within each role
  - Apply `sortMembersForStore` to the member selector for wargear and equipment purchases (all members sorted)
  - Apply `sortMembersForStore` to the creatures member selector, filtering to heroes only before sorting
  - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 20. REQ-13 — Injury treatment real-time update in MemberDetailsDrawer
  - [x] 20.1 Replace `selectedMember` snapshot state with a reactive `selectedMemberId` in `CompanyDetailsPage`
    - In `src/pages/CompanyDetailsPage.tsx`, replace `const [selectedMember, setSelectedMember] = useState<Member | null>(null)` with `const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)`
    - Derive `const selectedMember = selectedMemberId ? company.members.find(m => m.id === selectedMemberId) ?? null : null`
    - Update all `setSelectedMember(member)` call sites to `setSelectedMemberId(member.id)` and `setSelectedMember(null)` to `setSelectedMemberId(null)`
    - Update the `handleRename` callback to no longer call `setSelectedMember(...)` (the derived value updates automatically)
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 20.2 Generalise `missing_next_game` treatment to a no-roll path for both heroes and warriors
    - In `src/components/common/MemberDetailsDrawer.tsx`, update the treatment options dialog to detect `missing_next_game` injuries and always present a single "Remove (1 IP)" option regardless of member role
    - Rename or generalise the `remove_warrior` treatment type to `remove_missing` and apply it to both heroes and warriors with `missing_next_game`
    - Ensure the roll/miss options are only shown for hero-specific injuries (`arm_wound`, `leg_wound`, `broken_honour`)
    - In `handleTreatConfirm`, handle `remove_missing` by filtering `missing_next_game` from `member.injuries` and deducting 1 IP, then calling `onSaveCompany`
    - _Requirements: 13.5, 13.6_

- [x] 21. REQ-17 — Show rank and equipped wargear in ToolkitAssignmentPage member selector
  - In `src/pages/ToolkitAssignmentPage.tsx`, add a `rankLabel(role: string): string` helper that maps `leader` → "Leader", `sergeant` → "Sergeant", `hero_in_making` → "Hero in the Making", `warrior` → "Warrior"
  - Add a `memberWargear(member: Member): string` helper that returns the union of `baseEquipment` (from `baseUnits.json`) and `member.equipment`, joined as a comma-separated string of human-readable labels
  - Replace the plain `{m.name}` content inside each `MenuItem` with a two-line compact layout: line 1 shows `{m.name}` and `rankLabel(m.role)` (e.g. "Aragorn · Leader"), line 2 shows the wargear string in a smaller, muted style
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [x] 22. REQ-15 — Remove non-armour weapons from hero wargear in MemberDetailsDrawer
  - [x] 22.1 Add wargear edit mode state and "Edit" / "Done" buttons
    - In `src/components/common/MemberDetailsDrawer.tsx`, add `const [wargearEditMode, setWargearEditMode] = useState(false)` and `const [removeConfirmItem, setRemoveConfirmItem] = useState<string | null>(null)`
    - In the wargear section header (heroes only), render an "Edit" `Button` that sets `wargearEditMode = true` and a "Done" `Button` (visible when `wargearEditMode` is true) that sets it back to `false`
    - _Requirements: 15.1, 15.6, 15.7_

  - [x] 22.2 Render "×" remove buttons on removable wargear items in edit mode
    - When `wargearEditMode` is true, render an `IconButton` with "×" on each item in `member.equipment` that is NOT in the member's `baseEquipment` AND whose `category` in `wargear.json` is NOT `'armour'`
    - Tapping "×" sets `removeConfirmItem` to that item's ID
    - _Requirements: 15.2, 15.5_

  - [x] 22.3 Confirm and apply wargear removal
    - Render a `ConfirmDialog` that opens when `removeConfirmItem !== null`, identifying the item by its human-readable label
    - On confirm: filter `member.equipment` to remove the item, build an updated company, call `onSaveCompany`, and reset `removeConfirmItem`
    - On cancel: reset `removeConfirmItem` only
    - _Requirements: 15.3, 15.4_

- [x] 23. REQ-19 — PathCardSelector in PostMatchSummaryPage path selection dialog
  - In `src/pages/PostMatchSummaryPage.tsx`, locate the path selection dialog rendered when `pathSelectMember !== null` (used for newly promoted heroes)
  - Replace the existing plain list of path option buttons with the `PathCardSelector` component (already used in `StepPathSelection`)
  - Wrap `PathCardSelector` in a `Dialog` with `fullWidth maxWidth="sm"` if not already in one
  - Pass `baseStats` from `getStatsForUnit(pathSelectMember.baseUnitId)?.stats` to `PathCardSelector`
  - Wire `selectedPathId` and `onSelect` to the existing path selection state and `applyHeroPath` handler
  - Keep the existing spell selection step for Path of Channeling unchanged
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 24. REQ-18 — Toolkit items on MatchTrackingPage with consumable usage tracking
  - [x] 24.1 Add `usedToolkitItems` to `MemberMatchState` and add `isConsumable` helper
    - In `src/models/match.ts`, add `usedToolkitItems?: string[]` to the `MemberMatchState` interface
    - In `src/pages/MatchTrackingPage.tsx`, add an `isConsumable(itemId: string): boolean` helper that looks up the item in `wargear.json` (and `equipment.json` if needed) and returns the `consumable` flag (defaulting to `false` if absent)
    - _Requirements: 18.3, 18.5, 18.7_

  - [x] 24.2 Render toolkit section in `MemberMatchCard` and wire "Use" button
    - Add `toolkitItems: ToolkitItem[]` as a prop to `MemberMatchCard`
    - In the card body, if the member has assigned toolkit items (filter `toolkitItems` by `memberId`), render a "Toolkit" section listing each item
    - Consumable items: render a "Use" `Button`; on press call `updateMember(mm.memberId, { usedToolkitItems: [...(mm.usedToolkitItems ?? []), item.itemId] })`; render with strikethrough styling when the item ID is in `mm.usedToolkitItems`
    - Non-consumable items: render as a plain `Chip` with no interaction
    - When a member has no assigned toolkit items, render nothing for this section
    - Pass `toolkitItems={match.toolkitItems}` from the parent `MatchTrackingPage` to each `MemberMatchCard`
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.6_

- [x] 25. REQ-14 — Gold step ordering and hero classification in company creation wizard
  - [x] 25.1 Add `leaderId` prop and sort function to `StepGoldEquipment`
    - In `src/components/wizard/StepGoldEquipment.tsx`, add `leaderId: string | null` to the `Props` interface
    - Add a `sortMembersForGold` function: leader first (matching `leaderId`), then remaining heroes alphabetically, then warriors alphabetically
    - Apply `sortMembersForGold` to the `members` array before rendering the member list
    - Fix the hero classification label: the member whose `tempId === leaderId` is "Leader"; all other heroes are "Sergeant"
    - Pass `leaderId` from `CreateCompanyPage` (the wizard) when rendering `StepGoldEquipment`
    - _Requirements: 14.1, 14.2_

  - [x] 25.2 Add per-hero tabs: Wargear, Equipment, Creatures
    - For hero members in `StepGoldEquipment`, replace the flat wargear list with three tabs: "Wargear", "Equipment", "Creatures"
    - "Wargear" tab: existing wargear purchase UI (items with `category` not `'equipment'`)
    - "Equipment" tab: items with `category === 'equipment'` from the accessible pool
    - "Creatures" tab: source from `creatures.json`, filtered to creatures available to the hero's company (by `companyTypeId`); store creature purchases in `goldPurchases[tempId]` alongside wargear
    - For warrior members, show only "Wargear" and "Equipment" tabs (no Creatures tab)
    - _Requirements: 14.3, 14.4, 14.5, 14.6_

- [x] 26. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 27. NEW-1 — Against the Odds wanderer selection in PostMatchSummaryPage
  - [x] 27.1 Add wanderer selection dialog state and trigger
    - In `src/pages/PostMatchSummaryPage.tsx`, add:
      ```typescript
      const [wandererSelectOpen, setWandererSelectOpen] = useState(false)
      const [wandererSelectDone, setWandererSelectDone] = useState(false)
      ```
    - In the Influence step render, when `postMatchData.atoBonuses.includes('wanderer') && !wandererSelectDone`, render a "Choose Wanderer" button or auto-open the dialog
    - _Requirements: 22.1, 22.4_

  - [x] 27.2 Render wanderer selection dialog with list from `wanderers.json`
    - Add a `Dialog` that opens when `wandererSelectOpen` is true
    - List all wanderers from `wanderersData` with label, influence cost, and M/W/F stats
    - Pre-select `workingCompany.wandererId` if already set
    - On confirm: call `setWorkingCompany(prev => prev ? { ...prev, wandererId: selectedId } : prev)`, set `wandererSelectDone = true`, close dialog
    - On dismiss: close dialog without changing `wandererId`
    - _Requirements: 22.2, 22.3, 22.4, 22.5_

  - [x] 27.3 Ensure wanderer is saved with the company at end of post-match flow
    - The existing `saveCompany(workingCompany)` call at the end of the post-match flow already persists all `workingCompany` fields including `wandererId` — verify this covers the wanderer selection
    - _Requirements: 22.2, 22.6_

- [x] 28. NEW-2 — Consumable toolkit item removal in MatchTrackingPage
  - [x] 28.1 Add `onRemoveToolkitItem` prop to `MemberMatchCard` and wire removal handler
    - In `src/pages/MatchTrackingPage.tsx`, add handler:
      ```typescript
      const handleRemoveToolkitItem = (memberId: string, itemId: string) => {
        setMatch(prev => prev ? {
          ...prev,
          toolkitItems: prev.toolkitItems.filter(
            t => !(t.memberId === memberId && t.itemId === itemId)
          ),
        } : prev)
      }
      ```
    - Add `onRemoveToolkitItem: (itemId: string) => void` to `CardProps`
    - Pass `onRemoveToolkitItem={(itemId) => handleRemoveToolkitItem(mm.memberId, itemId)}` to each `MemberMatchCard`
    - _Requirements: 23.2, 23.6_

  - [x] 28.2 Render "Remove" button on used consumable items in `MemberMatchCard`
    - In the toolkit section of `MemberMatchCard`, for consumable items where `isUsed` is true, render a "Remove" `Button` (small, outlined, error colour) alongside the strikethrough label
    - On press: call `onRemoveToolkitItem(item.itemId)`
    - Unused consumable items continue to show only the "Use" button (no "Remove")
    - _Requirements: 23.1, 23.3, 23.4_

- [x] 29. NEW-3 — Hero progression roll of 5 applies both results automatically
  - [x] 29.1 Auto-set `chosen` and populate `bonusRoll` when roll is 5 in `HeroAdvancementCard`
    - In `src/pages/PostMatchSummaryPage.tsx`, in `HeroAdvancementCard`, detect `record.rollA === 5 || record.rollB === 5`
    - When detected, skip the A/B choice UI entirely; instead render a "Roll of 5 — both results apply" banner
    - Display sub-choice pickers for both `resultA`/`resultB` (or `resultA` + `bonusRoll`) in sequence
    - The "Apply" button is enabled once all required sub-choices for both results are made
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

  - [x] 29.2 Apply both results in the `onApply` callback when roll is 5
    - In the `onApply` handler within `PostMatchSummaryPage`, when `isRoll5` is true, apply both the roll-5 result and the other result to the working company member
    - Mark the hero's `HeroAdvRecord` as `done` after both results are applied
    - _Requirements: 24.5, 24.6_

- [x] 30. NEW-4 — Injury treatment IP prompt after D6 roll in MemberDetailsDrawer
  - [x] 30.1 Add treatment stage state to the injury treatment flow
    - In `src/components/common/MemberDetailsDrawer.tsx`, add treatment stage tracking:
      ```typescript
      type TreatStage = 'options' | 'rolling' | 'ip_prompt' | 'confirm'
      const [treatStage, setTreatStage] = useState<TreatStage>('options')
      const [rolledValue, setRolledValue] = useState<number | null>(null)
      ```
    - After the animated D6 settles in the roll-to-treat path, transition to `'ip_prompt'` stage instead of immediately applying the result
    - _Requirements: 25.1, 25.2_

  - [x] 30.2 Render IP prompt dialog after roll result is shown
    - In the `'ip_prompt'` stage, display:
      - The rolled value and its meaning (success/failure text)
      - Current IP balance (`company.influence`)
      - "Spend IP" button (disabled if insufficient IP) with cost shown
      - "Accept Result" button
    - On "Spend IP": deduct IP, apply improved outcome, close dialog
    - On "Accept Result": apply rolled outcome without IP deduction, close dialog
    - _Requirements: 25.2, 25.3, 25.4, 25.5, 25.6, 25.7_

- [x] 31. NEW-5 — Capitalize role labels in Store tab
  - In `src/pages/CompanyDetailsPage.tsx` within `StoreTab`, audit all locations where `member.role` is rendered as a visible label (member selectors, `MenuItem` content, inline role chips)
  - Replace any raw `member.role` string display with `roleLabel(member.role)` (the helper already defined at the top of `CompanyDetailsPage.tsx`)
  - Ensure `hero_in_making` renders as "Hero in the Making", `leader` as "Leader", `sergeant` as "Sergeant"
  - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5_

- [x] 32. NEW-6 — Warriors show only loadout choices on Roster tab
  - In `src/pages/CompanyDetailsPage.tsx` within `MemberRow`, update the wargear display logic for warriors:
    ```typescript
    if (!isHero) {
      const baseUnit = BASE_UNITS_RAW.find(u => u.id === member.baseUnitId)
      const allOptionEquipment = baseUnit?.equipmentOptions?.options.flatMap(
        (o: { equipment: string[] }) => o.equipment
      ) ?? []
      const loadoutChoices = (member.equipment ?? []).filter(e =>
        allOptionEquipment.includes(e)
      )
      // Render only loadoutChoices as chips (may be empty)
    }
    ```
  - For heroes, leave the existing `displayWargear` logic (base equipment + purchased equipment) unchanged
  - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5_

- [x] 33. NEW-7 — Hide wargear type label in Store Wargear tab, keep bow limit
  - In `src/pages/CompanyDetailsPage.tsx` within `StoreTab`'s wargear sub-tab rendering, locate the `Typography` or element that renders the wargear item's `type` or `category` field as a label beneath the item name
  - Remove that element (or set it to not render)
  - Verify the bow limit check and its warning/disabled state are NOT removed — only the generic type label is hidden
  - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5_

- [x] 34. NEW-8 — Auto-clear "Missing Next Game" injury on post-match save
  - In `src/pages/PostMatchSummaryPage.tsx`, locate the final `saveCompany(workingCompany)` call (the one that runs just before navigating away from the post-match flow)
  - Before calling `saveCompany`, build a cleaned company object:
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
  - Replace the existing `saveCompany(workingCompany)` call with `saveCompany(companyToSave)`
  - No new state, dialogs, or user interaction is required
  - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6_

- [x] 35. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests require `fast-check` (`npm install --save-dev fast-check`)
- Each property test file should be tagged: `// Feature: battle-companies-fixes-and-features, Property N: <text>`
- Tasks 1–3 (BUG-1, BUG-3, BUG-4) are pure logic/UI fixes with no state dependencies — implement first
- FEAT-3 (task 12) is the most complex item; it builds on the existing `pathSelectMember` / `applyHeroPath` flow already in `PostMatchSummaryPage`
- No database migrations are needed — all new `Member` fields (`spells`, `spellImprovements`) are optional
- Task 34 (Req 29) is the simplest remaining task — a single save-time filter with no UI changes

- [x] 36. BUG — Fix StepMemberNames bottom bar overlap
  - [x] 36.1 Add bottom padding to the wizard scroll container for step 4
    - In `src/pages/CreateCompanyPage.tsx`, locate the `Box` that wraps the step content (the `flex: 1` scrollable area with `px` and `py` padding)
    - Add `pb: { xs: 10, sm: 10 }` (or a value matching the bottom action bar height, typically ~72–80px) to that `Box`'s `sx` prop so the last TextField is never hidden behind the bar
    - Alternatively, if the bottom action bar height is defined as a constant, reference that constant for the padding value
    - Verify the fix only affects the scroll container and does not change the visual appearance of any other step
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5_

- [x] 37. FEAT — The Last Alliance variant roster selection
  - [x] 37.1 Add `variantId` field to `WizardState`
    - In `src/models/index.ts`, add `variantId: string | null` to the `WizardState` interface
    - In `src/pages/CreateCompanyPage.tsx`, add `variantId: null` to `INITIAL_WIZARD`
    - In `selectCompany`, reset `variantId: null` alongside the other resets
    - _Requirements: 31.4_

  - [x] 37.2 Detect variant-eligible companies in StepCompany and show variant roster in expandable details
    - In `src/components/wizard/StepCompany.tsx`, update the "Starting Roster" section in the expandable details panel:
      - Compute `visibleVariants = company.variants?.filter(v => !v.isDefault && (!v.visibleFromFactions || v.visibleFromFactions.includes(factionId))) ?? []`
      - If `visibleVariants.length > 0`, render the default roster under a "Standard Roster" sub-heading, then render each visible variant's `startingRoster` under a sub-heading matching `variant.label`
      - If no visible variants exist, render the roster as before (no sub-heading)
    - _Requirements: 31.7, 31.8_

  - [x] 37.3 Add variant selection step in the wizard after company selection
    - In `src/pages/CreateCompanyPage.tsx`, in `renderStep` for step 2 (StepCompany), after the user selects a company, check whether the selected company has any variants with `visibleFromFactions` that include `wizard.factionId`
    - If such variants exist and `wizard.variantId === null`, render an inline variant picker (two cards: standard and Númenórean) below the company list, or as a follow-up prompt within step 2 before the user can advance to step 3
    - When the user picks a variant, call `setWizard(w => ({ ...w, variantId: selectedVariantId }))` and allow advancing
    - When no eligible variants exist (or the company is selected from a non-Gondor faction), set `variantId` to the default variant's `id` automatically and allow advancing as before
    - Update `canAdvance()` for step 2: if the selected company has eligible variants, require `wizard.variantId !== null` in addition to `wizard.companyTypeId !== null`
    - _Requirements: 31.1, 31.2, 31.3, 31.6_

  - [x] 37.4 Use variant roster in `createCompany` and downstream wizard steps
    - In `src/services/company/companyFactory.ts`, update `createCompany` to accept an optional `variantId` parameter
    - When `variantId` is provided and matches a non-default variant on the company definition, use that variant's `startingRoster` (and `reinforcementTable` if present) instead of the company-level defaults
    - In `src/pages/CreateCompanyPage.tsx`, pass `wizard.variantId` to `createCompany`
    - Update `tempMemberIds` derivation: when a non-default variant is active, call `generateTempMemberIds` with the variant's `startingRoster` instead of the company's default roster
    - _Requirements: 31.2, 31.5_

  - [x] 37.5 Write property test for variant roster selection (Property 13)
    - **Property 13: Variant roster is used when variantId matches a non-default variant**
    - **Validates: Requirements 31.2, 31.5**
    - For The Last Alliance company definition, generate `variantId` values from `['last_alliance_standard', 'last_alliance_numenorean']`
    - Assert that when `variantId === 'last_alliance_numenorean'`, the created company's members are derived from the Númenórean `startingRoster` (6 Warriors of Númenór with shield), not the default roster (Rivendell Warriors + Warriors of Númenór)
    - Assert that when `variantId === 'last_alliance_standard'` or `null`, the default roster is used

- [x] 38. FEAT — Enforce mustBeLeader / mustBeSergeant in StepLeaderSelection
  - [x] 38.1 Compute forced assignments from the starting roster in `CreateCompanyPage`
    - In `src/pages/CreateCompanyPage.tsx`, add a `useMemo` that derives forced leader/sergeant temp IDs from the selected company's `startingRoster`:
      ```typescript
      const forcedLeaderId = useMemo(() => {
        if (!selectedCompany) return null
        let idx = 0
        for (const entry of selectedCompany.startingRoster) {
          for (let i = 0; i < entry.count; i++) {
            if (entry.mustBeLeader) return `member_${idx}`
            idx++
          }
        }
        return null
      }, [selectedCompany])

      const forcedSergeantIds = useMemo(() => {
        if (!selectedCompany) return []
        const ids: string[] = []
        let idx = 0
        for (const entry of selectedCompany.startingRoster) {
          for (let i = 0; i < entry.count; i++) {
            if (entry.mustBeSergeant) ids.push(`member_${idx}`)
            idx++
          }
        }
        return ids
      }, [selectedCompany])
      ```
    - _Requirements: 32.8_

  - [x] 38.2 Pre-populate wizard state with forced assignments when entering step 5
    - In `src/pages/CreateCompanyPage.tsx`, add a `useEffect` that fires when `wizard.step === 5` and `selectedCompany` changes (or when step 5 is first entered):
      - If `forcedLeaderId` is set and `wizard.leaderId !== forcedLeaderId`, call `setWizard(w => ({ ...w, leaderId: forcedLeaderId }))`
      - For each ID in `forcedSergeantIds` not already in `wizard.sergeantIds`, merge them in: `setWizard(w => ({ ...w, sergeantIds: [...new Set([...forcedSergeantIds, ...w.sergeantIds.filter(id => !forcedSergeantIds.includes(id))])] }))`
    - This ensures `canAdvance()` for step 5 is immediately `true` when all roles are pre-assigned
    - _Requirements: 32.5, 34.2, 34.5_

  - [x] 38.3 Pass forced IDs to `StepLeaderSelection` and render locked indicators
    - Add `forcedLeaderId: string | null` and `forcedSergeantIds: string[]` props to `StepLeaderSelection` in `src/components/wizard/StepLeaderSelection.tsx`
    - In the member card render, detect `isLockedLeader = member.tempId === forcedLeaderId` and `isLockedSergeant = forcedSergeantIds.includes(member.tempId)`
    - When `isLockedLeader || isLockedSergeant`, render a lock icon (MUI `LockIcon`) or a "Required" `Chip` alongside the role badge, and set `cursor: 'default'` / skip the `onClick` handler for that card
    - The existing role badge ("Leader" / "Sergeant") should still appear; the lock indicator is additive
    - Pass `forcedLeaderId` and `forcedSergeantIds` from `CreateCompanyPage` when rendering `StepLeaderSelection`
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.6, 32.7_

  - [x] 38.4 Write property test for mustBeLeader / mustBeSergeant pre-assignment (Property 14)
    - **Property 14: Forced role assignments are always respected**
    - **Validates: Requirements 32.1, 32.2, 32.5, 32.8**
    - Generate company definitions with arbitrary combinations of `mustBeLeader` and `mustBeSergeant` flags (at most 1 leader and at most 2 sergeants)
    - Assert that `forcedLeaderId` always corresponds to the temp ID of the roster entry with `mustBeLeader: true` (if any)
    - Assert that `forcedSergeantIds` contains exactly the temp IDs of all roster entries with `mustBeSergeant: true`
    - Assert that when forced IDs are merged into wizard state, `leaderId` and `sergeantIds` include all forced values

- [x] 39. FEAT — Skip StepLeaderSelection when all roles are pre-assigned
  - [x] 39.1 Compute `allRolesForced` flag and wire step-skip logic into `go()`
    - In `src/pages/CreateCompanyPage.tsx`, add:
      ```typescript
      const allRolesForced = useMemo(
        () => !!forcedLeaderId && forcedSergeantIds.length >= 2,
        [forcedLeaderId, forcedSergeantIds]
      )
      ```
    - In the `go(nextStep)` function (or in the Next button's `onClick` handler), when navigating from step 4 to step 5 and `allRolesForced` is true, call `go(6)` instead of `go(5)` (skipping step 5)
    - When navigating back from step 6 and `allRolesForced` is true, call `go(4)` instead of `go(5)`
    - _Requirements: 33.1, 33.2, 33.3, 33.4_

  - [x] 39.2 Ensure wizard state is pre-populated before the skip
    - Before calling `go(6)` in the skip path, ensure `wizard.leaderId` and `wizard.sergeantIds` are already set to the forced values (this is guaranteed by task 38.2's `useEffect`, but add a synchronous fallback in the `go()` call site if needed)
    - _Requirements: 33.2_

  - [x] 39.3 Update Stepper to mark step 5 as complete when skipped
    - In `src/pages/CreateCompanyPage.tsx`, pass `completed` prop to the step 5 `<Step>` component when `allRolesForced && wizard.step > 5`:
      ```tsx
      <Step key="Command" completed={allRolesForced && wizard.step > 5}>
        <StepLabel>Command</StepLabel>
      </Step>
      ```
    - _Requirements: 33.5_

- [x] 40. BUG — Fix stale canAdvance closure for step 5 Next button
  - [x] 40.1 Refactor `canAdvance` to avoid stale closure in the Enter key `useEffect`
    - In `src/pages/CreateCompanyPage.tsx`, convert `canAdvance` from an inline function to a `useCallback` with `wizard` in its dependency array:
      ```typescript
      const canAdvance = useCallback((): boolean => {
        // ... existing switch logic unchanged ...
      }, [wizard, selectedCompany])
      ```
    - The Enter key `useEffect` already lists `canAdvance` as a dependency; with `useCallback` this will now correctly re-subscribe when wizard state changes
    - _Requirements: 34.3, 34.4_

  - [x] 40.2 Ensure the Next button reads live wizard state
    - Verify the Next button's `disabled` prop is derived directly from `canAdvance()` (called inline in the render, not from a stale cached value)
    - If `canAdvance()` is currently called inside a `useMemo` or cached elsewhere, move it to be called directly in the render expression: `disabled={!canAdvance()}`
    - _Requirements: 34.1, 34.2, 34.6_

  - [x] 40.3 Write property test for canAdvance step 5 correctness (Property 15)
    - **Property 15: canAdvance for step 5 is true iff leaderId is set and sergeantIds has exactly 2 entries**
    - **Validates: Requirements 34.1, 34.2, 34.5, 34.6**
    - Generate arbitrary `leaderId` values (`string | null`) and `sergeantIds` arrays of length 0–3
    - Assert `canAdvance()` returns `true` if and only if `leaderId !== null && sergeantIds.length === 2`
    - Include cases where `leaderId` is a forced pre-assigned value to confirm the check is agnostic to how the ID was set
