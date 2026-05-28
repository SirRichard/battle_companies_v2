// Feature: buyback-tab, Property 2: Removal entry correctness

/**
 * Property 2: Removal entry correctness
 * Validates: Requirements 1.2, 1.3, 1.4
 *
 * For any member and any item (wargear, equipment, or envenom_weapon),
 * calling appendRemoval SHALL produce an entry containing the correct
 * memberId, memberName, itemId, itemType, a valid ISO 8601 timestamp,
 * and — for envenom_weapon only — the poisonedWeaponId matching the
 * associated weapon parameter.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { appendRemoval } from '../removalLog'
import type { RemovalEntry } from '../../models'

// ── UUID v4 regex ─────────────────────────────────────────────────────────────

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ── ISO 8601 validation ───────────────────────────────────────────────────────

function isValidIso8601(s: string): boolean {
  const d = new Date(s)
  return !isNaN(d.getTime()) && d.toISOString() === s
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const arbMemberId = fc.uuid()
const arbMemberName = fc.string({ minLength: 1, maxLength: 30 })
const arbItemId = fc.string({ minLength: 1, maxLength: 40 })
const arbItemType = fc.constantFrom<'wargear' | 'equipment'>('wargear', 'equipment')
const arbIsoTimestamp = fc
  .integer({
    min: new Date('2020-01-01T00:00:00.000Z').getTime(),
    max: new Date('2030-12-31T23:59:59.999Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString())

/** Arbitrary for a non-envenom removal entry (without id) */
const arbNonEnvenomEntry = fc.record({
  memberId: arbMemberId,
  memberName: arbMemberName,
  itemId: arbItemId,
  itemType: arbItemType,
  removedAt: arbIsoTimestamp,
})

/** Arbitrary for an envenom_weapon removal entry (without id) */
const arbEnvenomEntry = fc.record({
  memberId: arbMemberId,
  memberName: arbMemberName,
  itemId: fc.constant('envenom_weapon'),
  itemType: fc.constant<'equipment'>('equipment'),
  removedAt: arbIsoTimestamp,
  poisonedWeaponId: fc.string({ minLength: 1, maxLength: 40 }),
})

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 2: Removal entry correctness', () => {
  it('appended entry has valid UUID id and all fields match input (non-envenom)', () => {
    fc.assert(
      fc.property(arbNonEnvenomEntry, (input) => {
        const result = appendRemoval([], input)

        expect(result).toHaveLength(1)
        const entry = result[0]

        // Valid UUID v4
        expect(entry.id).toMatch(UUID_V4_REGEX)

        // Fields match input
        expect(entry.memberId).toBe(input.memberId)
        expect(entry.memberName).toBe(input.memberName)
        expect(entry.itemId).toBe(input.itemId)
        expect(entry.itemType).toBe(input.itemType)
        expect(entry.removedAt).toBe(input.removedAt)
        expect(isValidIso8601(entry.removedAt)).toBe(true)

        // No poisonedWeaponId for non-envenom entries
        expect(entry.poisonedWeaponId).toBeUndefined()
      }),
      { numRuns: 200 }
    )
  })

  it('appended envenom_weapon entry preserves poisonedWeaponId', () => {
    fc.assert(
      fc.property(arbEnvenomEntry, (input) => {
        const result = appendRemoval([], input)

        expect(result).toHaveLength(1)
        const entry = result[0]

        // Valid UUID v4
        expect(entry.id).toMatch(UUID_V4_REGEX)

        // Fields match input
        expect(entry.memberId).toBe(input.memberId)
        expect(entry.memberName).toBe(input.memberName)
        expect(entry.itemId).toBe('envenom_weapon')
        expect(entry.itemType).toBe('equipment')
        expect(entry.removedAt).toBe(input.removedAt)
        expect(isValidIso8601(entry.removedAt)).toBe(true)

        // poisonedWeaponId preserved
        expect(entry.poisonedWeaponId).toBe(input.poisonedWeaponId)
      }),
      { numRuns: 200 }
    )
  })
})
