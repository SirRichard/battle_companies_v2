// Feature: company-special-rules-enforcement, Property 2: Hero Promotion Equipment Carry-Over Filtering

/**
 * Property 2: Hero Promotion Equipment Carry-Over Filtering
 * Validates: Requirements 1.2, 1.3
 *
 * For any member undergoing a heroPromotionOnly profile swap with an
 * equipmentCarryOver list, the resulting member's equipment SHALL contain
 * only items that were both present in the original equipment AND listed
 * in equipmentCarryOver. All other equipment (including armour) SHALL be
 * discarded.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyHeroPromotionSwap } from '../advancement'
import type { Member, CompanyDefinition, CompanyAdvancement } from '../../models'

// ── Constants ─────────────────────────────────────────────────────────────────

const FROM_UNIT_ID = 'ranger_of_arnor'
const TO_UNIT_ID = 'ranger_of_the_north'

// Realistic equipment pool for generating member equipment
const ALL_EQUIPMENT = [
  'spear',
  'sword',
  'shield',
  'bow',
  'armour',
  'heavy_armour',
  'dagger',
  'throwing_spears',
  'lance',
  'two_handed_weapon',
  'mace',
  'axe',
  'staff',
]

// ── Generators ────────────────────────────────────────────────────────────────

// Generate a non-empty subset of ALL_EQUIPMENT for equipmentCarryOver list
const arbCarryOverList = fc
  .subarray(ALL_EQUIPMENT, { minLength: 1, maxLength: 5 })

// Generate member equipment as a non-empty subset of ALL_EQUIPMENT
const arbMemberEquipment = fc
  .subarray(ALL_EQUIPMENT, { minLength: 1, maxLength: 8 })

// Generate a minimal Member with matching baseUnitId and random equipment
const arbMatchingMember = arbMemberEquipment.map(
  (equipment): Member => ({
    id: 'test-member-1',
    name: 'Test Ranger',
    baseUnitId: FROM_UNIT_ID,
    role: 'warrior',
    equipment,
    experience: 8,
    lifetimeExperience: 8,
    injuries: [],
    specialRules: [],
    statIncreases: {},
    statDecreases: {},
  })
)

// Generate a CompanyDefinition with a heroPromotionOnly advancement using given carryOver
function buildCompanyDef(equipmentCarryOver: string[]): CompanyDefinition {
  const advancement: CompanyAdvancement = {
    fromBaseUnitId: FROM_UNIT_ID,
    toBaseUnitId: TO_UNIT_ID,
    heroPromotion: true,
    heroPromotionOnly: true,
    equipmentCarryOver,
  }

  return {
    id: 'arnor',
    label: 'Arnor',
    factionId: 'arnor',
    reinforcementCost: 3,
    maxCompanySize: 15,
    gold: 0,
    flavorTexts: [],
    companySpecialRules: [],
    startingRoster: [],
    advancements: [advancement],
    reinforcementTable: [],
    heroUpgrade: [],
  }
}

// ── Property Tests ────────────────────────────────────────────────────────────

describe('Property 2: Hero Promotion Equipment Carry-Over Filtering', () => {
  it('resulting equipment contains only items present in BOTH original equipment AND equipmentCarryOver', () => {
    fc.assert(
      fc.property(
        arbMatchingMember,
        arbCarryOverList,
        (member, carryOverList) => {
          const companyDef = buildCompanyDef(carryOverList)
          const result = applyHeroPromotionSwap(member, companyDef)

          // Must match since baseUnitId === fromBaseUnitId
          expect(result).not.toBeNull()

          // Every item in result equipment must be in both original AND carryOver
          for (const item of result!.equipment) {
            expect(member.equipment).toContain(item)
            expect(carryOverList).toContain(item)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('all items in original equipment that are also in equipmentCarryOver are preserved', () => {
    fc.assert(
      fc.property(
        arbMatchingMember,
        arbCarryOverList,
        (member, carryOverList) => {
          const companyDef = buildCompanyDef(carryOverList)
          const result = applyHeroPromotionSwap(member, companyDef)

          expect(result).not.toBeNull()

          // Every item that is in both original equipment AND carryOver must appear in result
          const expectedItems = member.equipment.filter((eq) =>
            carryOverList.includes(eq)
          )
          for (const item of expectedItems) {
            expect(result!.equipment).toContain(item)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('items NOT in equipmentCarryOver are discarded (including armour)', () => {
    fc.assert(
      fc.property(
        arbMatchingMember,
        arbCarryOverList,
        (member, carryOverList) => {
          const companyDef = buildCompanyDef(carryOverList)
          const result = applyHeroPromotionSwap(member, companyDef)

          expect(result).not.toBeNull()

          // Items not in carryOver must not appear in result
          const discardedItems = member.equipment.filter(
            (eq) => !carryOverList.includes(eq)
          )
          for (const item of discardedItems) {
            expect(result!.equipment).not.toContain(item)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result equipment is exactly the intersection of original equipment and equipmentCarryOver', () => {
    fc.assert(
      fc.property(
        arbMatchingMember,
        arbCarryOverList,
        (member, carryOverList) => {
          const companyDef = buildCompanyDef(carryOverList)
          const result = applyHeroPromotionSwap(member, companyDef)

          expect(result).not.toBeNull()

          const expectedEquipment = member.equipment.filter((eq) =>
            carryOverList.includes(eq)
          )

          expect(result!.equipment).toEqual(expectedEquipment)
        }
      ),
      { numRuns: 100 }
    )
  })
})
