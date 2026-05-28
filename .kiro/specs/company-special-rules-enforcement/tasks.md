# Implementation Plan: Company Special Rules Enforcement

## Overview

Implement enforcement logic for nine company special rules across eight companies. The work is organized into: extracting limit-checking utilities, extending data models and JSON, implementing each rule category (profile swap, ratio constraints, limit exemptions, auto-promotion, conditional substitution, roster overrides), and wiring everything into the existing Reinforcement Engine, Progression Engine, and Limit Checker systems.

## Tasks

- [x] 1. Extract limit checker utilities and extend data models
  - [x] 1.1 Create `src/utils/limitCheckers.ts` with extracted and new limit functions
    - Extract `countBowMembers`, `countCavalryMembers`, `countThrowingMembers` from CompanyDetailsPage into pure functions
    - Add `countMembersByKeyword(ctx, keyword)` for keyword-based counting
    - Add `wouldExceedDwarfDaleRatio(ctx, newMembers)` returning boolean
    - Add `wouldExceedElfLimit(ctx, newMembers)` returning boolean (33% threshold)
    - Add `getEffectiveRosterSlots(members, companyDef)` for roster slot overrides
    - Add `getThrowingExemptions(companyDef)` reading `throwingExemptions` from special rules
    - Define `LimitCheckContext` interface
    - _Requirements: 2.1, 2.4, 3.1, 3.3, 4.1, 4.2, 4.3, 9.1, 9.2, 9.5_

  - [x] 1.2 Extend `CompanySpecialRule` interface in `src/models/index.ts`
    - Add `throwingExemptions?: string[]`
    - Add `unitRosterOverrides?: Array<{ baseUnitId: string; rosterSlots: number; bowLimitCount: number }>`
    - Add `substitution?: { unitId: string; condition: { unitSlain: string }; replacesAnyRoll?: boolean; minRoll: number; limit: number; heroRoleOptions: string[] }`
    - Add `vaultWardenConfig?: { pairBaseUnitIds: string[]; overflowBehavior: string; replacementSubstitution: boolean }`
    - _Requirements: 4.2, 6.5, 8.4, 9.5_

  - [x] 1.3 Update `companies.json` with structured rule data
    - Add `throwingExemptions: ["whip"]` to Sharkey's Rogues `whips` rule
    - Add `limitExemptions: { bow: ["khandish_horseman"] }` to Grand Army of the South `khandish_horsemen` rule
    - Add `vaultWardenConfig` to Durin's Folk `vault_wardens` rule
    - Verify Mirkwood `dark_union` already has `unitRosterOverrides` and The Shire `led_by_the_ranger` already has `substitution`
    - _Requirements: 4.2, 7.2, 7.3, 8.4_

- [x] 2. Implement equipment limit exemptions
  - [x] 2.1 Implement throwing weapon exemption logic in `src/utils/limitCheckers.ts`
    - Read `throwingExemptions` from company special rules
    - Exclude members whose only throwing-category equipment is in the exemptions list
    - Follow same pattern as existing `limitExemptions.bow` and `limitExemptions.cavalry`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.2 Write property test for whip throwing exemption
    - **Property 6: Whip Throwing Exemption**
    - **Validates: Requirements 4.1**
    - File: `src/utils/__tests__/whipThrowingExemption.property.test.ts`

  - [x] 2.3 Implement Khandish Horsemen bow limit exemption in `src/utils/limitCheckers.ts`
    - Read `limitExemptions.bow` from company special rules
    - Exclude members with matching `baseUnitId` from bow count
    - _Requirements: 7.1, 7.2_

  - [x] 2.4 Write property test for Khandish Horsemen bow exemption
    - **Property 9: Khandish Horsemen Bow Exemption**
    - **Validates: Requirements 7.1, 7.2**
    - File: `src/utils/__tests__/khandishHorsemenBowExemption.property.test.ts`

- [x] 3. Implement keyword-based ratio constraints
  - [x] 3.1 Implement Dwarf-Dale ratio check in `src/utils/limitCheckers.ts`
    - Count members by "Dwarf" and "Dale" keywords using `baseUnits.json` lookups
    - Return true (blocked) when Dwarf count including candidate exceeds Dale count
    - _Requirements: 2.1, 2.4_

  - [x] 3.2 Write property test for Dwarf-Dale ratio enforcement
    - **Property 4: Dwarf-Dale Ratio Enforcement**
    - **Validates: Requirements 2.1, 2.4**
    - File: `src/utils/__tests__/dwarfDaleRatio.property.test.ts`

  - [x] 3.3 Implement Elf percentage limit check in `src/utils/limitCheckers.ts`
    - Count members by "Elf" keyword
    - Return true (blocked) when Elf count including candidate exceeds 33% of total size including candidate
    - _Requirements: 3.1, 3.3_

  - [x] 3.4 Write property test for Elf keyword percentage limit
    - **Property 5: Elf Keyword Percentage Limit**
    - **Validates: Requirements 3.1, 3.3**
    - File: `src/utils/__tests__/elfKeywordLimit.property.test.ts`

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement hero promotion profile swap
  - [x] 5.1 Create `applyHeroPromotionSwap` in `src/utils/advancement.ts`
    - Check if member's `baseUnitId` matches any `heroPromotionOnly` advancement's `fromBaseUnitId`
    - If match: swap `baseUnitId` to `toBaseUnitId`, filter equipment to `equipmentCarryOver` list only, set role to `hero_in_making`, grant heroStats `{might:1, will:1, fate:1}`
    - If no match: return null (caller falls back to standard `applyHeroInTheMaking`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 5.2 Write property test for hero promotion profile swap identity
    - **Property 1: Hero Promotion Profile Swap Identity**
    - **Validates: Requirements 1.1, 1.4**
    - File: `src/utils/__tests__/heroPromotionSwap.property.test.ts`

  - [x] 5.3 Write property test for hero promotion equipment carry-over filtering
    - **Property 2: Hero Promotion Equipment Carry-Over Filtering**
    - **Validates: Requirements 1.2, 1.3**
    - File: `src/utils/__tests__/heroPromotionEquipment.property.test.ts`

  - [x] 5.4 Write property test for non-matching units standard promotion
    - **Property 3: Non-Matching Units Get Standard Promotion**
    - **Validates: Requirements 1.5**
    - File: `src/utils/__tests__/heroPromotionStandard.property.test.ts`

  - [x] 5.5 Integrate profile swap into PostMatchSummaryPage progression flow
    - In warrior progression (roll 6 / hero_in_making), call `applyHeroPromotionSwap` first
    - If it returns a member, use that instead of standard `applyHeroInTheMaking`
    - If it returns null, fall back to existing `applyHeroInTheMaking` logic
    - _Requirements: 1.1, 1.4, 1.5_

- [x] 6. Implement Company of Heroes auto-promotion
  - [x] 6.1 Add auto-promotion logic to reinforcement confirmation flow in CompanyDetailsPage
    - After limit checks pass and member is confirmed, check for `company_of_heroes` rule
    - If present: set role to `hero_in_making`, grant heroStats `{might:1, will:1, fate:1}`
    - Trigger path selection for the newly promoted hero before finalizing
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.2 Write property test for Company of Heroes auto-promotion
    - **Property 7: Company of Heroes Auto-Promotion**
    - **Validates: Requirements 5.1**
    - File: `src/utils/__tests__/companyOfHeroesAutoPromotion.property.test.ts`

- [x] 7. Implement conditional substitutions
  - [x] 7.1 Implement Led By the Ranger substitution in CompanyDetailsPage
    - Check for `led_by_the_ranger` rule and no living `ranger_of_the_north` member
    - On any successful roll (≥ minRoll), offer substitution option in reinforcement result UI
    - If accepted: replace rolled result with Ranger of the North, prompt for Leader/Sergeant role assignment
    - If company already has living `ranger_of_the_north`, do not offer (limit of 1)
    - Read `substitution` field from rule data for `condition.unitSlain`, `minRoll`, `limit`, `heroRoleOptions`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.2 Write property test for Led By the Ranger substitution availability
    - **Property 8: Led By the Ranger Substitution Availability**
    - **Validates: Requirements 6.1, 6.4**
    - File: `src/utils/__tests__/ledByTheRangerSubstitution.property.test.ts`

  - [x] 7.3 Implement Vault Warden overflow and replacement substitution in CompanyDetailsPage
    - When Vault Warden Team recruitment would exceed `maxCompanySize`, allow choosing other special chart option
    - When existing Vault Warden member has been slain (count < expected), offer substitution on any special chart roll
    - If player declines substitution, proceed with original rolled result
    - Read `vaultWardenConfig` from rule data for `pairBaseUnitIds`, `overflowBehavior`, `replacementSubstitution`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 7.4 Write property test for Vault Warden overflow handling
    - **Property 10: Vault Warden Overflow Handling**
    - **Validates: Requirements 8.1**
    - File: `src/utils/__tests__/vaultWardenOverflow.property.test.ts`

  - [x] 7.5 Write property test for Vault Warden replacement substitution
    - **Property 11: Vault Warden Replacement Substitution**
    - **Validates: Requirements 8.2, 8.4**
    - File: `src/utils/__tests__/vaultWardenReplacement.property.test.ts`

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Warg Marauder roster and limit overrides
  - [x] 9.1 Implement roster slot override in `src/utils/limitCheckers.ts`
    - `getEffectiveRosterSlots` reads `unitRosterOverrides` from company special rules
    - Each Warg Marauder counts as `rosterSlots` (3) toward `maxCompanySize`
    - Non-override members count as 1 slot each
    - _Requirements: 9.1, 9.5_

  - [x] 9.2 Write property test for Warg Marauder roster slot override
    - **Property 12: Warg Marauder Roster Slot Override**
    - **Validates: Requirements 9.1**
    - File: `src/utils/__tests__/wargMarauderRosterSlots.property.test.ts`

  - [x] 9.3 Implement bow limit count override in `src/utils/limitCheckers.ts`
    - Each Warg Marauder counts as `bowLimitCount` (1) toward bow limit calculations
    - Override applies regardless of actual bow equipment on the model
    - _Requirements: 9.2_

  - [x] 9.4 Write property test for Warg Marauder bow limit count override
    - **Property 13: Warg Marauder Bow Limit Count Override**
    - **Validates: Requirements 9.2**
    - File: `src/utils/__tests__/wargMarauderBowLimit.property.test.ts`

  - [x] 9.5 Implement Warg Marauder warrior injury table routing in PostMatchSummaryPage
    - When processing Warg Marauder casualties, route to warrior injury table regardless of role
    - Single injury roll determines outcome for entire model
    - Read `unitRosterOverrides` to identify affected units
    - _Requirements: 9.4_

  - [x] 9.6 Write property test for Warg Marauder warrior injury table routing
    - **Property 14: Warg Marauder Warrior Injury Table Routing**
    - **Validates: Requirements 9.4**
    - File: `src/utils/__tests__/wargMarauderInjuryRouting.property.test.ts`

- [x] 10. Wire enforcement into Reinforcement Engine
  - [x] 10.1 Replace inline limit checks in CompanyDetailsPage with extracted `limitCheckers.ts` functions
    - Replace `company.members.length` checks with `getEffectiveRosterSlots()` for max size validation
    - Wire `countThrowingMembers` to use throwing exemptions
    - Wire `countBowMembers` to use bow limit exemptions and Warg Marauder bow count override
    - _Requirements: 4.1, 7.1, 9.1, 9.2_

  - [x] 10.2 Add Dwarf-Dale ratio and Elf limit checks to reinforcement confirmation flow
    - Call `wouldExceedDwarfDaleRatio` for Defenders of the North companies after existing limit checks
    - Call `wouldExceedElfLimit` for Helm's Deep companies after existing limit checks
    - Block confirmation and display warning on violation
    - Offer lower roll alternatives on Dwarf-Dale violation
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 10.3 Display adjusted roster slot total in company member count UI
    - Update member count display to reflect `getEffectiveRosterSlots` total
    - Show Warg Marauder as occupying 3 slots in the count
    - _Requirements: 9.3_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All limit checker functions are pure and extracted for testability
- The existing `companyRules.ts` utility already has keyword helpers (`getUnitKeywords`, `unitMatchesKeywords`) that can be reused

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.3", "3.1", "3.3", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.4", "3.2", "3.4", "5.2", "5.3", "5.4", "9.1", "9.3"] },
    { "id": 3, "tasks": ["5.5", "6.1", "9.2", "9.4", "9.5"] },
    { "id": 4, "tasks": ["6.2", "7.1", "7.3", "9.6"] },
    { "id": 5, "tasks": ["7.2", "7.4", "7.5", "10.1"] },
    { "id": 6, "tasks": ["10.2", "10.3"] }
  ]
}
```
