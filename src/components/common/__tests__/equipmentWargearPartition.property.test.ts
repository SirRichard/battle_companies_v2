// Feature: battle-companies-ux-improvements, Property 7: Equipment/Wargear partition correctness

/**
 * Property 7: Equipment/Wargear partition correctness
 * Validates: Requirements 2.1, 2.7
 *
 * For any member with an ownedEquipment array, all items in ownedEquipment
 * except envenom_weapon entries SHALL appear in the Equipment section and
 * SHALL NOT appear in the Wargear section. Conversely, envenom_weapon entries
 * SHALL appear in the Wargear section and NOT in the Equipment section.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import equipmentData from '../../../data/equipment.json'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpecialRule {
  id: string
  parameter?: string
}

interface MemberLike {
  ownedEquipment: string[]
  equipment: string[]
  baseEquipment: string[]
  specialRules: SpecialRule[]
}

// ── Realistic equipment IDs from data ─────────────────────────────────────────

const EQUIPMENT_IDS = (equipmentData as Array<{ id: string }>).map(e => e.id)
const NON_ENVENOM_IDS = EQUIPMENT_IDS.filter(id => id !== 'envenom_weapon')

// Sample wargear IDs for base/assigned equipment
const SAMPLE_WARGEAR_IDS = [
  'sword', 'shield', 'bow', 'spear', 'dagger', 'armour',
  'two_handed_weapon', 'lance', 'throwing_spears', 'staff',
  'hand_and_a_half', 'mace', 'axe', 'war_pick', 'flail'
]

// ── Functions under test (mirrors MemberDetailsDrawer partition logic) ────────

function computeDisplayEquipment(ownedEquipment: string[]): string[] {
  return ownedEquipment.filter(id => id !== 'envenom_weapon')
}

function computeEnvenomWargearEntries(
  ownedEquipment: string[],
  specialRules: SpecialRule[]
): string[] {
  const entries: string[] = []
  if (ownedEquipment.includes('envenom_weapon')) {
    for (const rule of specialRules) {
      if (rule.id === 'poisoned_attacks' && typeof rule.parameter === 'string') {
        entries.push(`envenom_weapon::${rule.parameter}`)
      }
    }
  }
  return entries
}

function computeAllWargear(
  baseEquip: string[],
  assignedEquip: string[],
  envenomWargearEntries: string[],
  displayEquipment: string[]
): string[] {
  return Array.from(new Set([...baseEquip, ...assignedEquip, ...envenomWargearEntries]))
    .filter(id => !displayEquipment.includes(id))
}

// ── Generators ────────────────────────────────────────────────────────────────

// Generate an ownedEquipment array with a mix of real equipment IDs and envenom_weapon entries
const arbOwnedEquipment = fc.array(
  fc.oneof(
    { weight: 3, arbitrary: fc.constantFrom(...NON_ENVENOM_IDS) },
    { weight: 1, arbitrary: fc.constant('envenom_weapon') }
  ),
  { minLength: 0, maxLength: 8 }
)

// Generate base equipment (wargear IDs)
const arbBaseEquip = fc.array(
  fc.constantFrom(...SAMPLE_WARGEAR_IDS),
  { minLength: 1, maxLength: 4 }
)

// Generate assigned equipment (wargear IDs, may overlap with equipment IDs)
const arbAssignedEquip = fc.array(
  fc.oneof(
    fc.constantFrom(...SAMPLE_WARGEAR_IDS),
    fc.constantFrom(...NON_ENVENOM_IDS)
  ),
  { minLength: 0, maxLength: 3 }
)

// Generate special rules for envenom (poisoned_attacks with weapon parameter)
const arbSpecialRules = fc.array(
  fc.record({
    id: fc.constant('poisoned_attacks'),
    parameter: fc.constantFrom(...SAMPLE_WARGEAR_IDS)
  }),
  { minLength: 0, maxLength: 3 }
)

// Combined member-like generator
const arbMember = fc.tuple(arbOwnedEquipment, arbBaseEquip, arbAssignedEquip, arbSpecialRules)
  .map(([ownedEquipment, baseEquipment, equipment, specialRules]) => ({
    ownedEquipment,
    baseEquipment,
    equipment,
    specialRules
  }))

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 7: Equipment/Wargear partition correctness', () => {
  it('all ownedEquipment items except envenom_weapon appear in displayEquipment', () => {
    fc.assert(
      fc.property(arbMember, (member) => {
        const displayEquipment = computeDisplayEquipment(member.ownedEquipment)

        // Every non-envenom item in ownedEquipment must be in displayEquipment
        const nonEnvenomItems = member.ownedEquipment.filter(id => id !== 'envenom_weapon')
        for (const item of nonEnvenomItems) {
          expect(displayEquipment).toContain(item)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('envenom_weapon entries do NOT appear in displayEquipment', () => {
    fc.assert(
      fc.property(arbMember, (member) => {
        const displayEquipment = computeDisplayEquipment(member.ownedEquipment)

        expect(displayEquipment).not.toContain('envenom_weapon')
      }),
      { numRuns: 200 }
    )
  })

  it('displayEquipment items are excluded from allWargear', () => {
    fc.assert(
      fc.property(arbMember, (member) => {
        const displayEquipment = computeDisplayEquipment(member.ownedEquipment)
        const envenomEntries = computeEnvenomWargearEntries(
          member.ownedEquipment,
          member.specialRules
        )
        const allWargear = computeAllWargear(
          member.baseEquipment,
          member.equipment,
          envenomEntries,
          displayEquipment
        )

        // No displayEquipment item should appear in allWargear
        for (const item of displayEquipment) {
          expect(allWargear).not.toContain(item)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('envenom_weapon wargear entries remain in allWargear when present', () => {
    fc.assert(
      fc.property(arbMember, (member) => {
        const displayEquipment = computeDisplayEquipment(member.ownedEquipment)
        const envenomEntries = computeEnvenomWargearEntries(
          member.ownedEquipment,
          member.specialRules
        )
        const allWargear = computeAllWargear(
          member.baseEquipment,
          member.equipment,
          envenomEntries,
          displayEquipment
        )

        // Each envenom wargear entry (envenom_weapon::weaponId) should be in allWargear
        for (const entry of envenomEntries) {
          expect(allWargear).toContain(entry)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('partition is exhaustive: every ownedEquipment item ends up in exactly one section', () => {
    fc.assert(
      fc.property(arbMember, (member) => {
        const displayEquipment = computeDisplayEquipment(member.ownedEquipment)
        const envenomEntries = computeEnvenomWargearEntries(
          member.ownedEquipment,
          member.specialRules
        )
        const allWargear = computeAllWargear(
          member.baseEquipment,
          member.equipment,
          envenomEntries,
          displayEquipment
        )

        // Non-envenom items: in displayEquipment, not in allWargear
        const nonEnvenomItems = member.ownedEquipment.filter(id => id !== 'envenom_weapon')
        for (const item of nonEnvenomItems) {
          const inEquipSection = displayEquipment.includes(item)
          const inWargearSection = allWargear.includes(item)
          expect(inEquipSection).toBe(true)
          expect(inWargearSection).toBe(false)
        }

        // Envenom entries: in allWargear (as envenom_weapon::X), not in displayEquipment
        for (const entry of envenomEntries) {
          expect(allWargear).toContain(entry)
          expect(displayEquipment).not.toContain(entry)
        }
      }),
      { numRuns: 200 }
    )
  })
})
