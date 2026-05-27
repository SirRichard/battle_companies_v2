/**
 * Preservation Property Tests — Gold and Label Bugs
 *
 * Property 2: Preservation - Plain Wargear Cost and Label Behavior
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * These tests MUST PASS on unfixed code — they establish baseline behavior
 * that must be preserved after the fix is applied.
 *
 * Observations:
 * - For all plain wargear IDs (no `::` separator), `getWargearLabel(id)` returns
 *   the label field from wargear.json
 * - For all plain wargear purchases (items found in wargear.json with rating),
 *   both the inline lookup in goldRemaining() and goldCost() use rating[0]
 * - Gold confirmation dialog triggers when goldRemaining > 0 and does not
 *   trigger when goldRemaining = 0
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { goldCost } from '../../components/wizard/StepGoldEquipment'
import { getWargearLabel } from '../../utils/labels'
import wargearData from '../../data/wargear.json'

// ── Data setup ────────────────────────────────────────────────────────────────

type WargearEntry = { id: string; label: string; rating?: [number, number]; purchasable?: boolean }

const WARGEAR = wargearData as WargearEntry[]

/** Plain wargear IDs — no `::` separator, exist in wargear.json */
const plainWargearIds = WARGEAR.map(w => w.id)

/** Purchasable wargear with rating — items where cost calculation applies */
const purchasableWargear = WARGEAR.filter(w => w.rating !== undefined && w.purchasable !== false)

// ── Inline goldRemaining cost logic (mirrors CreateCompanyPage) ───────────────

/**
 * Replicates the inline cost lookup from CreateCompanyPage.goldRemaining().
 * For items IN wargear.json, this correctly returns rating[0].
 */
function inlineCostLookup(wId: string): number {
  const wg = WARGEAR as Array<{ id: string; rating?: [number, number] }>
  const w = wg.find(x => x.id === wId)
  return w?.rating?.[0] ?? 1
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Arbitrary plain wargear ID from wargear.json */
const plainWargearIdArb = fc.constantFrom(...plainWargearIds)

/** Arbitrary purchasable wargear entry (has rating, not marked non-purchasable) */
const purchasableWargearArb = fc.constantFrom(...purchasableWargear)

/** Arbitrary non-empty subset of purchasable wargear IDs (for purchase sets) */
const wargearPurchaseSetArb = fc.uniqueArray(
  fc.constantFrom(...purchasableWargear.map(w => w.id)),
  { minLength: 1, maxLength: Math.min(8, purchasableWargear.length) }
)

/** Arbitrary gold value (company gold ranges from 0 to ~30 in practice) */
const goldArb = fc.integer({ min: 0, max: 50 })

// ── Property Tests ────────────────────────────────────────────────────────────

describe('Preservation: Plain Wargear Cost and Label Behavior', () => {
  /**
   * Property: For all plain wargear IDs (no :: separator, exist in wargear.json),
   * getWargearLabel(id) returns the label field from wargear.json.
   *
   * Validates: Requirements 3.3
   */
  it('getWargearLabel returns correct label for all plain wargear IDs', () => {
    fc.assert(
      fc.property(
        plainWargearIdArb,
        (wargearId) => {
          const result = getWargearLabel(wargearId)
          const expected = WARGEAR.find(w => w.id === wargearId)!.label

          expect(result).toBe(expected)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * Property: For all purchasable wargear items (found in wargear.json with rating),
   * the inline cost lookup (used by goldRemaining) matches goldCost() — both use rating[0].
   *
   * Validates: Requirements 3.1, 3.2
   */
  it('inline cost lookup matches goldCost for all purchasable wargear', () => {
    fc.assert(
      fc.property(
        purchasableWargearArb,
        (wargearEntry) => {
          const inlineCost = inlineCostLookup(wargearEntry.id)
          const correctCost = goldCost(wargearEntry.id)

          // Both should use rating[0] for items in wargear.json
          expect(inlineCost).toBe(correctCost)
          // And both should equal the actual rating[0]
          expect(inlineCost).toBe(wargearEntry.rating![0])
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * Property: Gold confirmation dialog condition is preserved for wargear-only purchases.
   * - When goldRemaining > 0 (gold not fully spent), dialog triggers
   * - When goldRemaining = 0 (gold fully spent), dialog does NOT trigger
   *
   * We simulate the condition: dialog shows when (company.gold - totalSpent) > 0
   *
   * Validates: Requirements 3.1, 3.2
   */
  it('gold confirmation dialog condition preserved for wargear-only purchases', () => {
    fc.assert(
      fc.property(
        goldArb,
        wargearPurchaseSetArb,
        (companyGold, purchasedIds) => {
          // Calculate total spent using inline lookup (goldRemaining style)
          const inlineSpent = purchasedIds.reduce(
            (sum, id) => sum + inlineCostLookup(id), 0
          )

          // Calculate total spent using goldCost (StepGoldEquipment style)
          const goldCostSpent = purchasedIds.reduce(
            (sum, id) => sum + goldCost(id), 0
          )

          // For wargear-only purchases, both calculations must agree
          expect(inlineSpent).toBe(goldCostSpent)

          // Therefore the dialog condition is consistent:
          const inlineRemaining = companyGold - inlineSpent
          const goldCostRemaining = companyGold - goldCostSpent
          const dialogTriggersInline = inlineRemaining > 0
          const dialogTriggersGoldCost = goldCostRemaining > 0

          expect(dialogTriggersInline).toBe(dialogTriggersGoldCost)
        }
      ),
      { numRuns: 200 }
    )
  })
})
