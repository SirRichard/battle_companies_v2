// Feature: buyback-tab, Property 6: Capacity exceeded prevents restore

/**
 * Property 6: Capacity exceeded prevents restore
 * Validates: Requirements 4.6
 *
 * For any member whose current equipment load is at capacity,
 * attempting to restore an equipment item that would exceed the limit
 * SHALL return a capacity error and leave both the member's arrays
 * and the removalLog unchanged.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { restoreEntry } from '../removalLog'
import type { Member, RemovalEntry } from '../../models'

// ── Constants ─────────────────────────────────────────────────────────────────

// Real equipment IDs from equipment.json
const LARGE_EQUIPMENT_IDS = [
  'backpack',
  'barding',
  'company_drum',
  'company_standard',
  'dwarven_brew',
  'mountain_boots',
  'torching_brand',
  'traps_snares',
  'trophy_pelt',
] as const

const SMALL_EQUIPMENT_IDS = [
  'badge_of_courage',
  'climbing_ropes',
  'company_horn',
  'company_instrument',
  'concealing_cloak',
  'envenom_weapon',
  'healing_herbs',
  'small_shield',
  'lucky_talisman',
  'map',
  'ring_of_warding',
  'scroll_of_courage',
  'scroll_of_hidden_paths',
  'seeing_stone',
  'wondrous_cram',
  'woodland_belt',
] as const

// Non-backpack large items (for "at capacity without backpack" scenario)
const NON_BACKPACK_LARGE = LARGE_EQUIPMENT_IDS.filter((id) => id !== 'backpack')

// ── Generators ────────────────────────────────────────────────────────────────

const arbIsoTimestamp = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-01-01T00:00:00Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString())

const arbMemberId = fc.uuid()
const arbMemberName = fc.string({ minLength: 1, maxLength: 20 })

/**
 * Generate a member at capacity WITHOUT backpack:
 * 1 large item + 1 small item (max without backpack)
 */
const arbMemberAtCapacityNoBackpack: fc.Arbitrary<Member> = fc
  .record({
    id: arbMemberId,
    name: arbMemberName,
    largeItem: fc.constantFrom(...NON_BACKPACK_LARGE),
    smallItem: fc.constantFrom(...SMALL_EQUIPMENT_IDS),
  })
  .map(({ id, name, largeItem, smallItem }) => ({
    id,
    name,
    baseUnitId: 'gondor_warrior',
    role: 'warrior' as const,
    equipment: ['sword'],
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: [],
    statIncreases: {},
    statDecreases: {},
    ownedEquipment: [largeItem, smallItem],
  }))

/**
 * Generate a member at capacity WITH backpack:
 * backpack (large) + 4 small items (max with backpack)
 */
const arbMemberAtCapacityWithBackpack: fc.Arbitrary<Member> = fc
  .record({
    id: arbMemberId,
    name: arbMemberName,
    small1: fc.constantFrom(...SMALL_EQUIPMENT_IDS),
    small2: fc.constantFrom(...SMALL_EQUIPMENT_IDS),
    small3: fc.constantFrom(...SMALL_EQUIPMENT_IDS),
    small4: fc.constantFrom(...SMALL_EQUIPMENT_IDS),
  })
  .map(({ id, name, small1, small2, small3, small4 }) => ({
    id,
    name,
    baseUnitId: 'gondor_warrior',
    role: 'warrior' as const,
    equipment: ['sword'],
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: [],
    statIncreases: {},
    statDecreases: {},
    ownedEquipment: ['backpack', small1, small2, small3, small4],
  }))

/** Either capacity scenario */
const arbMemberAtCapacity: fc.Arbitrary<Member> = fc.oneof(
  arbMemberAtCapacityNoBackpack,
  arbMemberAtCapacityWithBackpack
)

/**
 * Generate an equipment item that would exceed capacity for the given member.
 * - If member has no backpack: any small or large item exceeds capacity
 * - If member has backpack (4 small full): any small item exceeds capacity
 *   (large also exceeds since backpack already occupies the large slot)
 */
const arbExceedingItemId = (member: Member): fc.Arbitrary<string> => {
  const hasBackpack = (member.ownedEquipment ?? []).includes('backpack')
  if (hasBackpack) {
    // Both large and small exceed: large slot taken by backpack, 4 small slots full
    return fc.constantFrom(
      ...SMALL_EQUIPMENT_IDS.filter((id) => id !== 'envenom_weapon'),
      ...NON_BACKPACK_LARGE
    )
  }
  // No backpack: 1 large + 1 small already owned, both sizes exceed
  return fc.constantFrom(
    ...SMALL_EQUIPMENT_IDS.filter((id) => id !== 'envenom_weapon'),
    ...NON_BACKPACK_LARGE
  )
}

/**
 * Generate a removal entry for an equipment item that would exceed capacity.
 */
const arbCapacityExceededScenario = arbMemberAtCapacity.chain((member) =>
  fc
    .record({
      entryId: fc.uuid(),
      itemId: arbExceedingItemId(member),
      removedAt: arbIsoTimestamp,
    })
    .map(({ entryId, itemId, removedAt }) => ({
      member,
      entry: {
        id: entryId,
        memberId: member.id,
        memberName: member.name,
        itemId,
        itemType: 'equipment' as const,
        removedAt,
        poisonedWeaponId: undefined,
      } as RemovalEntry,
    }))
)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 6: Capacity exceeded prevents restore', () => {
  it('returns capacity_exceeded error when member equipment is at capacity', () => {
    fc.assert(
      fc.property(arbCapacityExceededScenario, ({ member, entry }) => {
        const log: RemovalEntry[] = [entry]
        const members: Member[] = [member]

        const result = restoreEntry(log, entry.id, members)

        expect(result).toHaveProperty('error', 'capacity_exceeded')
      }),
      { numRuns: 200 }
    )
  })

  it('member arrays remain unchanged after capacity exceeded error', () => {
    fc.assert(
      fc.property(arbCapacityExceededScenario, ({ member, entry }) => {
        const log: RemovalEntry[] = [entry]
        const members: Member[] = [member]

        // Snapshot before
        const equipmentBefore = [...member.equipment]
        const ownedBefore = [...(member.ownedEquipment ?? [])]
        const specialRulesBefore = [...member.specialRules]

        restoreEntry(log, entry.id, members)

        // Member arrays unchanged (original objects not mutated)
        expect(members[0].equipment).toEqual(equipmentBefore)
        expect(members[0].ownedEquipment).toEqual(ownedBefore)
        expect(members[0].specialRules).toEqual(specialRulesBefore)
      }),
      { numRuns: 200 }
    )
  })

  it('removalLog remains unchanged after capacity exceeded error', () => {
    fc.assert(
      fc.property(arbCapacityExceededScenario, ({ member, entry }) => {
        const log: RemovalEntry[] = [entry]
        const members: Member[] = [member]

        // Snapshot log before
        const logBefore = [...log]

        const result = restoreEntry(log, entry.id, members)

        // Log not mutated
        expect(log).toEqual(logBefore)
        // Result is error, not a new log
        expect(result).toHaveProperty('error', 'capacity_exceeded')
      }),
      { numRuns: 200 }
    )
  })
})
