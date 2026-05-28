// Feature: buyback-tab, Property 1: RemovalLog cap enforcement

/**
 * Property 1: RemovalLog cap enforcement
 * Validates: Requirements 1.1
 *
 * For any removalLog of any length (0–300), after calling appendRemoval,
 * the resulting log length SHALL be at most 200, and FIFO order is preserved
 * (oldest entries discarded first when over cap).
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { appendRemoval } from '../removalLog'
import type { RemovalEntry } from '../../models'

// ── Generators ────────────────────────────────────────────────────────────────

// Generate a valid ISO timestamp between 2020 and 2030
const arbIsoTimestamp = fc.integer({
  min: new Date('2020-01-01T00:00:00Z').getTime(),
  max: new Date('2030-01-01T00:00:00Z').getTime(),
}).map(ms => new Date(ms).toISOString())

const arbRemovalEntry: fc.Arbitrary<RemovalEntry> = fc.record({
  id: fc.uuid(),
  memberId: fc.uuid(),
  memberName: fc.string({ minLength: 1, maxLength: 20 }),
  itemId: fc.string({ minLength: 1, maxLength: 30 }),
  itemType: fc.constantFrom('wargear' as const, 'equipment' as const),
  removedAt: arbIsoTimestamp,
  poisonedWeaponId: fc.constant(undefined),
})

const arbLog = fc.array(arbRemovalEntry, { minLength: 0, maxLength: 300 })

const arbNewEntry: fc.Arbitrary<Omit<RemovalEntry, 'id'>> = fc.record({
  memberId: fc.uuid(),
  memberName: fc.string({ minLength: 1, maxLength: 20 }),
  itemId: fc.string({ minLength: 1, maxLength: 30 }),
  itemType: fc.constantFrom('wargear' as const, 'equipment' as const),
  removedAt: arbIsoTimestamp,
  poisonedWeaponId: fc.constant(undefined),
})

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 1: RemovalLog cap enforcement', () => {
  it('resulting log length is always ≤ 200 after appendRemoval', () => {
    fc.assert(
      fc.property(arbLog, arbNewEntry, (log, entry) => {
        const result = appendRemoval(log, entry)
        expect(result.length).toBeLessThanOrEqual(200)
      }),
      { numRuns: 200 }
    )
  })

  it('new entry is always present as last element in result', () => {
    fc.assert(
      fc.property(arbLog, arbNewEntry, (log, entry) => {
        const result = appendRemoval(log, entry)
        const lastEntry = result[result.length - 1]
        expect(lastEntry.memberId).toBe(entry.memberId)
        expect(lastEntry.memberName).toBe(entry.memberName)
        expect(lastEntry.itemId).toBe(entry.itemId)
        expect(lastEntry.itemType).toBe(entry.itemType)
        expect(lastEntry.removedAt).toBe(entry.removedAt)
      }),
      { numRuns: 200 }
    )
  })

  it('FIFO order preserved: when log exceeds cap, oldest entries are discarded', () => {
    fc.assert(
      fc.property(arbLog, arbNewEntry, (log, entry) => {
        const result = appendRemoval(log, entry)

        // If input log was already at or above 200, result should be exactly 200
        if (log.length >= 200) {
          expect(result.length).toBe(200)
        }

        // Verify FIFO: the retained entries from original log should be
        // the tail (newest) portion of the original log, in order
        const originalRetained = result.slice(0, result.length - 1) // exclude new entry
        const expectedRetained = log.slice(log.length - originalRetained.length)

        for (let i = 0; i < originalRetained.length; i++) {
          expect(originalRetained[i].id).toBe(expectedRetained[i].id)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('when log is below cap, all original entries are preserved', () => {
    fc.assert(
      fc.property(
        fc.array(arbRemovalEntry, { minLength: 0, maxLength: 199 }),
        arbNewEntry,
        (log, entry) => {
          const result = appendRemoval(log, entry)
          // All original entries should still be present
          expect(result.length).toBe(log.length + 1)
          for (let i = 0; i < log.length; i++) {
            expect(result[i].id).toBe(log[i].id)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
