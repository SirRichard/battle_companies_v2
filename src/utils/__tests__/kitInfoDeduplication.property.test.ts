/**
 * Property-based tests for kit info deduplication logic
 * Feature: ato-kit-enhancements, Property 1: Kit info deduplication preserves total count
 *
 * **Validates: Requirements 1.3**
 *
 * For any kit item list, the sum of displayed quantities in the info dialog
 * should equal the total number of items in the kit's items array, and each
 * unique item should appear exactly once.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── Pure deduplication logic (mirrors KitInfoDialog implementation) ──────────

/**
 * Deduplicates a kit items array into a Map of itemId → count.
 * This is the same logic used in KitInfoDialog within ToolkitAssignmentPage.
 */
function deduplicateKitItems(items: string[]): Map<string, number> {
  const itemCounts = new Map<string, number>()
  for (const itemId of items) {
    itemCounts.set(itemId, (itemCounts.get(itemId) ?? 0) + 1)
  }
  return itemCounts
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate item IDs */
const arbItemId = fc.string({ minLength: 1, maxLength: 20 })

/** Generate kit item arrays with potential duplicates */
const arbKitItems = fc.array(arbItemId, { minLength: 1, maxLength: 30 })

// ─────────────────────────────────────────────────────────────────────────────

describe('Feature: ato-kit-enhancements, Property 1: Kit info deduplication preserves total count', () => {
  it('sum of deduplicated counts equals original array length', () => {
    fc.assert(
      fc.property(arbKitItems, (items) => {
        const itemCounts = deduplicateKitItems(items)

        // Sum all counts
        let totalCount = 0
        for (const count of itemCounts.values()) {
          totalCount += count
        }

        expect(totalCount).toBe(items.length)
      }),
      { numRuns: 100 }
    )
  })

  it('each unique item appears exactly once in deduplicated map', () => {
    fc.assert(
      fc.property(arbKitItems, (items) => {
        const itemCounts = deduplicateKitItems(items)
        const uniqueItems = new Set(items)

        // Map keys should match unique items exactly
        expect(itemCounts.size).toBe(uniqueItems.size)

        // Every unique item should be a key in the map
        for (const itemId of uniqueItems) {
          expect(itemCounts.has(itemId)).toBe(true)
        }

        // Every key in the map should be in the original items
        for (const key of itemCounts.keys()) {
          expect(uniqueItems.has(key)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('each count matches actual occurrences in original array', () => {
    fc.assert(
      fc.property(arbKitItems, (items) => {
        const itemCounts = deduplicateKitItems(items)

        for (const [itemId, count] of itemCounts.entries()) {
          const actualCount = items.filter((id) => id === itemId).length
          expect(count).toBe(actualCount)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('deduplication of single-item arrays yields count of 1', () => {
    fc.assert(
      fc.property(arbItemId, (itemId) => {
        const itemCounts = deduplicateKitItems([itemId])

        expect(itemCounts.size).toBe(1)
        expect(itemCounts.get(itemId)).toBe(1)
      }),
      { numRuns: 100 }
    )
  })
})
