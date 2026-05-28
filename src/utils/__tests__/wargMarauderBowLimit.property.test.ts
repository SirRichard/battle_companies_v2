// Feature: company-special-rules-enforcement, Property 13: Warg Marauder Bow Limit Count Override

/**
 * Property-based tests for Warg Marauder bow limit count override.
 *
 * **Validates: Requirements 9.2**
 *
 * For any Mirkwood roster containing Warg Marauder members, each Warg Marauder
 * SHALL count as `bowLimitCount` (1) toward the bow limit, regardless of actual
 * bow equipment on the model.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { countBowMembers } from '../limitCheckers'
import type { LimitCheckContext } from '../limitCheckers'
import type { CompanyDefinition, CompanySpecialRule } from '../../models'

// ─── Test Data ───────────────────────────────────────────────────────────────

/** Wargear category map */
const wargearCategoryMap: Record<string, string> = {
  short_bow: 'bow',
  orc_bow: 'bow',
  elf_bow: 'bow',
  armour: 'armour',
  shield: 'shield',
  sword: 'hand_weapon',
  spear: 'spear',
  dagger: 'hand_weapon',
}

/** Base units map with warg_marauder and generic units */
const baseUnitsMap: Record<string, { baseWargear: string[]; keywords: string[] }> = {
  warg_marauder: { baseWargear: ['orc_bow'], keywords: [] },
  moria_goblin_warrior: { baseWargear: [], keywords: [] },
  generic_archer: { baseWargear: ['short_bow'], keywords: [] },
  generic_warrior: { baseWargear: [], keywords: [] },
}

/** Mirkwood company def with dark_union rule and unitRosterOverrides */
function makeMirkwoodCompanyDef(): CompanyDefinition {
  return {
    id: 'mirkwood',
    label: 'Mirkwood',
    factionId: 'moria',
    reinforcementCost: 3,
    maxCompanySize: 15,
    gold: 0,
    flavorTexts: [],
    companySpecialRules: [
      {
        id: 'dark_union',
        label: 'Dark Union',
        description:
          'A Warg Marauder takes up 3 slots of the Battle Company Roster, but only counts as a single model towards the Company\'s Bow Limit.',
        unitRosterOverrides: [
          {
            baseUnitId: 'warg_marauder',
            rosterSlots: 3,
            bowLimitCount: 1,
          },
        ],
      } as CompanySpecialRule,
    ],
    startingRoster: [],
    advancements: [],
    reinforcementTable: [],
    heroUpgrade: [],
  } as CompanyDefinition
}

/** Company def WITHOUT roster overrides (no dark_union rule) */
function makeCompanyDefWithoutOverride(): CompanyDefinition {
  return {
    id: 'some_other_company',
    label: 'Some Other Company',
    factionId: 'moria',
    reinforcementCost: 3,
    maxCompanySize: 15,
    gold: 0,
    flavorTexts: [],
    companySpecialRules: [],
    startingRoster: [],
    advancements: [],
    reinforcementTable: [],
    heroUpgrade: [],
  } as CompanyDefinition
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary: number of warg marauders (1-5) */
const arbMarauderCount = fc.integer({ min: 1, max: 5 })

/** Arbitrary: number of non-override bow-equipped members (0-5) */
const arbOtherBowCount = fc.integer({ min: 0, max: 5 })

/** Arbitrary: number of non-bow members (0-5) */
const arbNonBowCount = fc.integer({ min: 0, max: 5 })

/** Arbitrary: extra equipment for warg marauder (may or may not include bows) */
const arbMarauderExtraEquipment = fc.array(
  fc.constantFrom('orc_bow', 'short_bow', 'elf_bow', 'armour', 'shield', 'sword', 'dagger'),
  { minLength: 0, maxLength: 3 }
)

/** Build a roster with specified counts */
function buildRoster(
  marauderCount: number,
  otherBowCount: number,
  nonBowCount: number,
  marauderEquipments: string[][]
): Array<{ baseUnitId: string; equipment: string[] }> {
  const members: Array<{ baseUnitId: string; equipment: string[] }> = []

  for (let i = 0; i < marauderCount; i++) {
    members.push({
      baseUnitId: 'warg_marauder',
      equipment: marauderEquipments[i % marauderEquipments.length] ?? [],
    })
  }

  for (let i = 0; i < otherBowCount; i++) {
    members.push({
      baseUnitId: 'generic_archer',
      equipment: [],
    })
  }

  for (let i = 0; i < nonBowCount; i++) {
    members.push({
      baseUnitId: 'generic_warrior',
      equipment: ['sword'],
    })
  }

  return members
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: company-special-rules-enforcement, Property 13: Warg Marauder Bow Limit Count Override', () => {
  it('each Warg Marauder counts as bowLimitCount (1) toward bow limit when override is present', () => {
    fc.assert(
      fc.property(
        arbMarauderCount,
        arbOtherBowCount,
        arbNonBowCount,
        fc.array(arbMarauderExtraEquipment, { minLength: 1, maxLength: 5 }),
        (marauderCount, otherBowCount, nonBowCount, marauderEquipments) => {
          const members = buildRoster(
            marauderCount,
            otherBowCount,
            nonBowCount,
            marauderEquipments
          )

          const ctx: LimitCheckContext = {
            members,
            companyDef: makeMirkwoodCompanyDef(),
            baseUnitsMap,
            wargearCategoryMap,
          }

          const bowCount = countBowMembers(ctx)

          // Each warg marauder contributes exactly bowLimitCount (1),
          // plus other bow-equipped members counted normally
          expect(bowCount).toBe(marauderCount * 1 + otherBowCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Warg Marauder bow count override applies regardless of actual bow equipment', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.array(
          fc.constantFrom('orc_bow', 'short_bow', 'elf_bow'),
          { minLength: 0, maxLength: 4 }
        ),
        (marauderCount, extraBows) => {
          // Give warg marauders varying amounts of bow equipment
          const members: Array<{ baseUnitId: string; equipment: string[] }> = []
          for (let i = 0; i < marauderCount; i++) {
            members.push({
              baseUnitId: 'warg_marauder',
              equipment: extraBows,
            })
          }

          const ctx: LimitCheckContext = {
            members,
            companyDef: makeMirkwoodCompanyDef(),
            baseUnitsMap,
            wargearCategoryMap,
          }

          const bowCount = countBowMembers(ctx)

          // Regardless of how many bows, each marauder counts as exactly 1
          expect(bowCount).toBe(marauderCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('without override, Warg Marauders with bow equipment are counted normally', () => {
    fc.assert(
      fc.property(
        arbMarauderCount,
        arbOtherBowCount,
        arbNonBowCount,
        (marauderCount, otherBowCount, nonBowCount) => {
          const members = buildRoster(
            marauderCount,
            otherBowCount,
            nonBowCount,
            [[]] // no extra equipment; baseWargear has orc_bow
          )

          const ctx: LimitCheckContext = {
            members,
            companyDef: makeCompanyDefWithoutOverride(),
            baseUnitsMap,
            wargearCategoryMap,
          }

          const bowCount = countBowMembers(ctx)

          // Without override, warg_marauder has orc_bow in baseWargear → counted as 1 each normally
          // Same as other bow members
          expect(bowCount).toBe(marauderCount + otherBowCount)
        }
      ),
      { numRuns: 100 }
    )
  })
})
