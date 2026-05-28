// Feature: buyback-tab, Property 4: Restore places item in correct array by type

/**
 * Property 4: Restore places item in correct array by type
 * Validates: Requirements 4.1, 4.2, 4.3
 *
 * For any valid removal entry where the member exists and capacity is not exceeded:
 * - Restoring a "wargear" entry SHALL add the itemId to member.equipment
 * - Restoring an "equipment" entry SHALL add the itemId to member.ownedEquipment
 * - Restoring an envenom_weapon entry SHALL add "envenom_weapon" to member.ownedEquipment
 *   AND add a poisoned_attacks special rule with the stored weapon parameter
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { restoreEntry } from '../removalLog'
import type { Member, RemovalEntry } from '../../models'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'member-1',
    name: 'Test Member',
    baseUnitId: 'base-unit-1',
    role: 'warrior',
    equipment: [],
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: [],
    statIncreases: {},
    statDecreases: {},
    ownedEquipment: [],
    ...overrides,
  }
}

function makeRemovalEntry(overrides: Partial<RemovalEntry> = {}): RemovalEntry {
  return {
    id: 'entry-1',
    memberId: 'member-1',
    memberName: 'Test Member',
    itemId: 'sword',
    itemType: 'wargear',
    removedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const arbMemberId = fc.uuid()
const arbMemberName = fc.string({ minLength: 1, maxLength: 30 })
const arbItemId = fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s !== 'envenom_weapon')
const arbEntryId = fc.uuid()
const arbIsoTimestamp = fc
  .integer({
    min: new Date('2020-01-01T00:00:00.000Z').getTime(),
    max: new Date('2030-12-31T23:59:59.999Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString())

/** Generate a wargear restore scenario: member exists, entry in log */
const arbWargearScenario = fc.record({
  memberId: arbMemberId,
  memberName: arbMemberName,
  entryId: arbEntryId,
  itemId: arbItemId,
  removedAt: arbIsoTimestamp,
}).map(({ memberId, memberName, entryId, itemId, removedAt }) => {
  const member = makeMember({ id: memberId, name: memberName, equipment: [] })
  const entry = makeRemovalEntry({
    id: entryId,
    memberId,
    memberName,
    itemId,
    itemType: 'wargear',
    removedAt,
  })
  return { member, entry }
})

/** Generate an equipment restore scenario: member exists with empty ownedEquipment */
const arbEquipmentScenario = fc.record({
  memberId: arbMemberId,
  memberName: arbMemberName,
  entryId: arbEntryId,
  itemId: arbItemId,
  removedAt: arbIsoTimestamp,
}).map(({ memberId, memberName, entryId, itemId, removedAt }) => {
  const member = makeMember({ id: memberId, name: memberName, ownedEquipment: [] })
  const entry = makeRemovalEntry({
    id: entryId,
    memberId,
    memberName,
    itemId,
    itemType: 'equipment',
    removedAt,
  })
  return { member, entry }
})

/** Generate an envenom_weapon restore scenario */
const arbEnvenomScenario = fc.record({
  memberId: arbMemberId,
  memberName: arbMemberName,
  entryId: arbEntryId,
  poisonedWeaponId: fc.string({ minLength: 1, maxLength: 40 }),
  removedAt: arbIsoTimestamp,
}).map(({ memberId, memberName, entryId, poisonedWeaponId, removedAt }) => {
  const member = makeMember({ id: memberId, name: memberName, ownedEquipment: [], specialRules: [] })
  const entry = makeRemovalEntry({
    id: entryId,
    memberId,
    memberName,
    itemId: 'envenom_weapon',
    itemType: 'equipment',
    removedAt,
    poisonedWeaponId,
  })
  return { member, entry, poisonedWeaponId }
})

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 4: Restore places item in correct array by type', () => {
  it('restoring wargear entry adds itemId to member.equipment', () => {
    fc.assert(
      fc.property(arbWargearScenario, ({ member, entry }) => {
        const result = restoreEntry([entry], entry.id, [member])

        // Should succeed
        expect(result).not.toHaveProperty('error')
        const { members } = result as { members: Member[]; log: RemovalEntry[] }

        const restored = members[0]
        expect(restored.equipment).toContain(entry.itemId)
      }),
      { numRuns: 200 }
    )
  })

  it('restoring equipment entry adds itemId to member.ownedEquipment', () => {
    fc.assert(
      fc.property(arbEquipmentScenario, ({ member, entry }) => {
        const result = restoreEntry([entry], entry.id, [member])

        // Should succeed
        expect(result).not.toHaveProperty('error')
        const { members } = result as { members: Member[]; log: RemovalEntry[] }

        const restored = members[0]
        expect(restored.ownedEquipment).toContain(entry.itemId)
      }),
      { numRuns: 200 }
    )
  })

  it('restoring envenom_weapon adds to ownedEquipment and adds poisoned_attacks special rule', () => {
    fc.assert(
      fc.property(arbEnvenomScenario, ({ member, entry, poisonedWeaponId }) => {
        const result = restoreEntry([entry], entry.id, [member])

        // Should succeed
        expect(result).not.toHaveProperty('error')
        const { members } = result as { members: Member[]; log: RemovalEntry[] }

        const restored = members[0]

        // envenom_weapon added to ownedEquipment
        expect(restored.ownedEquipment).toContain('envenom_weapon')

        // poisoned_attacks special rule added with correct weapon parameter
        const poisonRule = restored.specialRules.find(
          (r) => typeof r === 'object' && r.id === 'poisoned_attacks'
        )
        expect(poisonRule).toBeDefined()
        expect(poisonRule).toEqual({ id: 'poisoned_attacks', parameter: poisonedWeaponId })
      }),
      { numRuns: 200 }
    )
  })
})
