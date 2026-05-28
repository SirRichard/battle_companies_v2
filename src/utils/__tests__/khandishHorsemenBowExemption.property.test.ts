// Feature: company-special-rules-enforcement, Property 9: Khandish Horsemen Bow Exemption

/**
 * Property-based tests for Khandish Horsemen bow limit exemption.
 *
 * **Validates: Requirements 7.1, 7.2**
 *
 * For any roster in a company with `limitExemptions.bow` containing
 * `"khandish_horseman"`, members with `baseUnitId` of `khandish_horseman`
 * SHALL NOT be counted toward the bow limit total, regardless of their
 * bow equipment.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { countBowMembers } from '../limitCheckers'
import type { LimitCheckContext } from '../limitCheckers'
import type { CompanyDefinition, CompanySpecialRule } from '../../models'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** A bow-category equipment ID */
const BOW_ID = 'short_bow'

/** Wargear category map with bow entry */
const wargearCategoryMap: Record<string, string> = {
  short_bow: 'bow',
  elf_bow: 'bow',
  orc_bow: 'bow',
  armour: 'armour',
  shield: 'shield',
  sword: 'hand_weapon',
  spear: 'spear',
  whip: 'throwing',
}

/** Base units map with khandish_horseman and some generic units */
const baseUnitsMap: Record<string, { baseWargear: string[]; keywords: string[] }> = {
  khandish_horseman: { baseWargear: ['short_bow'], keywords: ['cavalry'] },
  easterling_warrior: { baseWargear: [], keywords: [] },
  khandish_king: { baseWargear: ['short_bow'], keywords: ['cavalry'] },
  generic_archer: { baseWargear: ['short_bow'], keywords: [] },
}

/** Company def with khandish_horsemen rule containing limitExemptions.bow */
function makeCompanyDefWithExemption(): CompanyDefinition {
  return {
    id: 'grand_army_of_the_south',
    label: 'Grand Army of the South',
    factionId: 'easterlings',
    reinforcementCost: 3,
    maxCompanySize: 15,
    gold: 0,
    flavorTexts: [],
    companySpecialRules: [
      {
        id: 'khandish_horsemen',
        title: 'Khandish Horsemen',
        description:
          'Khandish Horsemen in this Battle Company do not count towards your Bow Limit.',
        limitExemptions: {
          bow: ['khandish_horseman'],
        },
      } as CompanySpecialRule,
    ],
    startingRoster: [],
    advancements: [],
    reinforcementTable: [],
    heroUpgrade: [],
  } as CompanyDefinition
}

/** Company def WITHOUT bow exemption */
function makeCompanyDefWithoutExemption(): CompanyDefinition {
  return {
    id: 'some_other_company',
    label: 'Some Other Company',
    factionId: 'easterlings',
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

/** Arbitrary: number of khandish horsemen (1-5) */
const arbKhandishCount = fc.integer({ min: 1, max: 5 })

/** Arbitrary: number of non-exempt bow-equipped members (0-5) */
const arbOtherBowCount = fc.integer({ min: 0, max: 5 })

/** Arbitrary: number of non-bow members (0-5) */
const arbNonBowCount = fc.integer({ min: 0, max: 5 })

/** Arbitrary: random equipment for khandish horseman (always has bow via baseWargear, may have extra) */
const arbKhandishExtraEquipment = fc.array(
  fc.constantFrom('armour', 'shield', 'sword', 'spear', 'short_bow'),
  { minLength: 0, maxLength: 3 }
)

/** Build a roster with specified counts */
function buildRoster(
  khandishCount: number,
  otherBowCount: number,
  nonBowCount: number,
  khandishEquipments: string[][]
): Array<{ baseUnitId: string; equipment: string[] }> {
  const members: Array<{ baseUnitId: string; equipment: string[] }> = []

  // Add khandish horsemen with varying equipment
  for (let i = 0; i < khandishCount; i++) {
    members.push({
      baseUnitId: 'khandish_horseman',
      equipment: khandishEquipments[i % khandishEquipments.length] ?? [],
    })
  }

  // Add other bow-equipped members (not exempt)
  for (let i = 0; i < otherBowCount; i++) {
    members.push({
      baseUnitId: 'generic_archer',
      equipment: [],
    })
  }

  // Add non-bow members
  for (let i = 0; i < nonBowCount; i++) {
    members.push({
      baseUnitId: 'easterling_warrior',
      equipment: ['sword'],
    })
  }

  return members
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: company-special-rules-enforcement, Property 9: Khandish Horsemen Bow Exemption', () => {
  it('khandish_horseman members are NOT counted toward bow limit when exemption is present', () => {
    fc.assert(
      fc.property(
        arbKhandishCount,
        arbOtherBowCount,
        arbNonBowCount,
        fc.array(arbKhandishExtraEquipment, { minLength: 1, maxLength: 5 }),
        (khandishCount, otherBowCount, nonBowCount, khandishEquipments) => {
          const members = buildRoster(
            khandishCount,
            otherBowCount,
            nonBowCount,
            khandishEquipments
          )

          const ctx: LimitCheckContext = {
            members,
            companyDef: makeCompanyDefWithExemption(),
            baseUnitsMap,
            wargearCategoryMap,
          }

          const bowCount = countBowMembers(ctx)

          // Khandish horsemen should be excluded — only other bow members counted
          expect(bowCount).toBe(otherBowCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('khandish_horseman members ARE counted when no bow exemption exists', () => {
    fc.assert(
      fc.property(
        arbKhandishCount,
        arbOtherBowCount,
        arbNonBowCount,
        fc.array(arbKhandishExtraEquipment, { minLength: 1, maxLength: 5 }),
        (khandishCount, otherBowCount, nonBowCount, khandishEquipments) => {
          const members = buildRoster(
            khandishCount,
            otherBowCount,
            nonBowCount,
            khandishEquipments
          )

          const ctx: LimitCheckContext = {
            members,
            companyDef: makeCompanyDefWithoutExemption(),
            baseUnitsMap,
            wargearCategoryMap,
          }

          const bowCount = countBowMembers(ctx)

          // Without exemption, khandish horsemen have bow via baseWargear → counted
          expect(bowCount).toBe(khandishCount + otherBowCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('exemption applies regardless of extra bow equipment on khandish horseman', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.array(
          fc.constantFrom('short_bow', 'elf_bow', 'orc_bow'),
          { minLength: 0, maxLength: 3 }
        ),
        (khandishCount, extraBows) => {
          // Give khandish horsemen extra bow equipment
          const members: Array<{ baseUnitId: string; equipment: string[] }> = []
          for (let i = 0; i < khandishCount; i++) {
            members.push({
              baseUnitId: 'khandish_horseman',
              equipment: extraBows,
            })
          }

          const ctx: LimitCheckContext = {
            members,
            companyDef: makeCompanyDefWithExemption(),
            baseUnitsMap,
            wargearCategoryMap,
          }

          const bowCount = countBowMembers(ctx)

          // Even with multiple bows, khandish horsemen are exempt → 0
          expect(bowCount).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
