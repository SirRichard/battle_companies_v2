// Feature: buyback-tab, Property 5: Successful restore removes entry from log

/**
 * Property 5: Successful restore removes entry from log
 * Validates: Requirements 4.4
 *
 * For any removalLog with N entries (N ≥ 1), after a successful restore
 * of one entry, the resulting log SHALL have exactly N-1 entries and
 * SHALL NOT contain the restored entry's ID.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { restoreEntry } from '../removalLog'
import type { Member, RemovalEntry } from '../../models'

// ── Generators ────────────────────────────────────────────────────────────────

const arbIsoTimestamp = fc
  .integer({
    min: new Date('2020-01-01T00:00:00.000Z').getTime(),
    max: new Date('2030-12-31T23:59:59.999Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString())

/** Generate a wargear-type removal entry with a given memberId */
function arbWargearEntry(memberId: string): fc.Arbitrary<RemovalEntry> {
  return fc.record({
    id: fc.uuid(),
    memberId: fc.constant(memberId),
    memberName: fc.string({ minLength: 1, maxLength: 20 }),
    itemId: fc.string({ minLength: 1, maxLength: 30 }),
    itemType: fc.constant<'wargear'>('wargear'),
    removedAt: arbIsoTimestamp,
    poisonedWeaponId: fc.constant(undefined),
  })
}

/** Generate a minimal Member with empty equipment (ensures restore succeeds) */
function makeMember(id: string): Member {
  return {
    id,
    name: 'Test Member',
    baseUnitId: 'base_unit_1',
    role: 'warrior',
    equipment: [],
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: [],
    statIncreases: {},
    statDecreases: {},
    ownedEquipment: [],
  }
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 5: Successful restore removes entry from log', () => {
  it('after successful restore, log has exactly N-1 entries', () => {
    fc.assert(
      fc.property(
        fc.uuid().chain((memberId) =>
          fc
            .array(arbWargearEntry(memberId), { minLength: 1, maxLength: 50 })
            .map((log) => ({ memberId, log }))
        ),
        ({ memberId, log }) => {
          const originalLength = log.length
          // Pick a random entry to restore (use first for determinism in property)
          const targetEntry = log[0]
          const members = [makeMember(memberId)]

          const result = restoreEntry(log, targetEntry.id, members)

          // Should succeed (member exists, no capacity issue for wargear)
          expect('log' in result).toBe(true)
          if (!('log' in result)) return

          expect(result.log.length).toBe(originalLength - 1)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('after successful restore, restored entry ID is no longer in log', () => {
    fc.assert(
      fc.property(
        fc.uuid().chain((memberId) =>
          fc
            .array(arbWargearEntry(memberId), { minLength: 1, maxLength: 50 })
            .map((log) => ({ memberId, log }))
        ),
        ({ memberId, log }) => {
          const targetEntry = log[0]
          const members = [makeMember(memberId)]

          const result = restoreEntry(log, targetEntry.id, members)

          expect('log' in result).toBe(true)
          if (!('log' in result)) return

          const remainingIds = result.log.map((e) => e.id)
          expect(remainingIds).not.toContain(targetEntry.id)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('after successful restore, all other entries remain unchanged', () => {
    fc.assert(
      fc.property(
        fc.uuid().chain((memberId) =>
          fc
            .array(arbWargearEntry(memberId), { minLength: 2, maxLength: 50 })
            .map((log) => ({ memberId, log }))
        ),
        ({ memberId, log }) => {
          const targetEntry = log[0]
          const members = [makeMember(memberId)]

          const result = restoreEntry(log, targetEntry.id, members)

          expect('log' in result).toBe(true)
          if (!('log' in result)) return

          // All entries except the restored one should still be present
          const expectedRemaining = log.filter((e) => e.id !== targetEntry.id)
          expect(result.log.length).toBe(expectedRemaining.length)

          for (const expected of expectedRemaining) {
            const found = result.log.find((e) => e.id === expected.id)
            expect(found).toBeDefined()
            expect(found!.memberId).toBe(expected.memberId)
            expect(found!.memberName).toBe(expected.memberName)
            expect(found!.itemId).toBe(expected.itemId)
            expect(found!.itemType).toBe(expected.itemType)
            expect(found!.removedAt).toBe(expected.removedAt)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
