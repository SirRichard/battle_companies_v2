/**
 * Property-based tests for src/utils/removalLog.ts — groupRemovalLog
 * Feature: buyback-tab, Property 3: RemovalLog grouping and sorting
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { groupRemovalLog } from '../removalLog'
import type { RemovalEntry } from '../../models'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbItemType = fc.constantFrom<'wargear' | 'equipment'>('wargear', 'equipment')

// Generate ISO timestamps from integer milliseconds to avoid Invalid Date during shrinking
const arbIsoTimestamp = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-12-31T23:59:59Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString())

const arbMemberName = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0)

const arbRemovalEntry: fc.Arbitrary<RemovalEntry> = fc.record({
  id: fc.uuid(),
  memberId: fc.uuid(),
  memberName: arbMemberName,
  itemId: fc.string({ minLength: 1, maxLength: 30 }),
  itemType: arbItemType,
  removedAt: arbIsoTimestamp,
  poisonedWeaponId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 3: RemovalLog grouping and sorting
// Validates: Requirements 3.1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: buyback-tab, Property 3: RemovalLog grouping and sorting
 *
 * **Validates: Requirements 3.1**
 *
 * For any removalLog with arbitrary entries, `groupRemovalLog` SHALL return groups
 * ordered alphabetically by memberName (case-insensitive), and within each group
 * entries SHALL be ordered by `removedAt` descending (newest first). All entries
 * from the input appear in exactly one group with no loss or duplication.
 */
describe('Feature: buyback-tab, Property 3: RemovalLog grouping and sorting', () => {
  it('groups are in alphabetical order by memberName (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.array(arbRemovalEntry, { minLength: 0, maxLength: 50 }),
        (log) => {
          const result = groupRemovalLog(log)

          for (let i = 1; i < result.length; i++) {
            const cmp = result[i - 1].memberName.localeCompare(
              result[i].memberName,
              undefined,
              { sensitivity: 'base' }
            )
            expect(cmp).toBeLessThanOrEqual(0)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('within each group, entries are sorted by removedAt descending (newest first)', () => {
    fc.assert(
      fc.property(
        fc.array(arbRemovalEntry, { minLength: 0, maxLength: 50 }),
        (log) => {
          const result = groupRemovalLog(log)

          for (const group of result) {
            for (let i = 1; i < group.entries.length; i++) {
              const prev = group.entries[i - 1].removedAt
              const curr = group.entries[i].removedAt
              // descending: prev >= curr
              expect(prev >= curr).toBe(true)
            }
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('all entries from input appear in exactly one group (no loss or duplication)', () => {
    fc.assert(
      fc.property(
        fc.array(arbRemovalEntry, { minLength: 0, maxLength: 50 }),
        (log) => {
          const result = groupRemovalLog(log)

          // Collect all entry IDs from result
          const resultIds = result.flatMap((g) => g.entries.map((e) => e.id))
          const inputIds = log.map((e) => e.id)

          // Same count
          expect(resultIds.length).toBe(inputIds.length)

          // Same set of IDs (sorted for comparison)
          expect([...resultIds].sort()).toEqual([...inputIds].sort())
        }
      ),
      { numRuns: 200 }
    )
  })

  it('each group memberName matches all entries within that group', () => {
    fc.assert(
      fc.property(
        fc.array(arbRemovalEntry, { minLength: 1, maxLength: 50 }),
        (log) => {
          const result = groupRemovalLog(log)

          for (const group of result) {
            for (const entry of group.entries) {
              expect(entry.memberName).toBe(group.memberName)
            }
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
