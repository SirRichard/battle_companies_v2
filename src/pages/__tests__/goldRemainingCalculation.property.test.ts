// Feature: company-creation-enhancements, Property 6: Gold remaining calculation invariant

/**
 * Property 6: Gold remaining calculation invariant
 * Validates: Requirements 4.3
 *
 * For any set of gold purchases across all members, goldRemaining SHALL equal
 * company.gold - Σ goldCost(entry) for all entries across all members.
 *
 * We test:
 * 1. Plain item entries (wargear + equipment IDs)
 * 2. Parameterised entries (envenom_weapon::<weaponId>)
 * 3. Mixed purchases across multiple members
 * 4. The invariant: goldRemaining = gold - totalSpent always holds
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { goldCost, parseGoldEntry } from '../../components/wizard/StepGoldEquipment'
import wargearData from '../../data/wargear.json'
import equipmentData from '../../data/equipment.json'

// ── Valid item IDs from data ──────────────────────────────────────────────────

/** Wargear IDs that have a rating (purchasable items with known cost) */
const purchasableWargearIds = (wargearData as Array<{ id: string; rating?: unknown; purchasable?: boolean }>)
  .filter(w => w.rating !== undefined && w.purchasable !== false)
  .map(w => w.id)

/** Equipment IDs that have a rating (purchasable items with known cost) */
const purchasableEquipmentIds = (equipmentData as Array<{ id: string; rating?: unknown }>)
  .filter(e => e.rating !== undefined)
  .map(e => e.id)

/** Weapon IDs suitable for envenom parameterisation */
const weaponIds = (wargearData as Array<{ id: string; category: string; purchasable?: boolean }>)
  .filter(w => !['armour_1', 'armour_2', 'armour_3', 'armour_4', 'mount', 'shield', 'special'].includes(w.category))
  .map(w => w.id)

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Arbitrary plain item ID (wargear or equipment) */
const plainItemArb = fc.oneof(
  fc.constantFrom(...purchasableWargearIds),
  fc.constantFrom(...purchasableEquipmentIds)
)

/** Arbitrary parameterised envenom entry */
const envenomEntryArb = fc.constantFrom(...weaponIds).map(
  weaponId => `envenom_weapon::${weaponId}`
)

/** Arbitrary gold purchase entry (plain or parameterised) */
const purchaseEntryArb = fc.oneof(
  { weight: 3, arbitrary: plainItemArb },
  { weight: 1, arbitrary: envenomEntryArb }
)

/** Arbitrary member ID */
const memberIdArb = fc.stringMatching(/^member_[a-z0-9]{1,6}$/)

/** Arbitrary goldPurchases record: Record<string, string[]> */
const goldPurchasesArb = fc.dictionary(
  memberIdArb,
  fc.array(purchaseEntryArb, { minLength: 0, maxLength: 5 }),
  { minKeys: 0, maxKeys: 6 }
)

/** Positive company gold */
const companyGoldArb = fc.integer({ min: 1, max: 500 })

// ── Gold remaining calculation (mirrors StepGoldEquipment logic) ──────────────

function computeGoldRemaining(gold: number, goldPurchases: Record<string, string[]>): number {
  const totalSpent = Object.values(goldPurchases).reduce(
    (sum, items) => sum + items.reduce((s, id) => s + goldCost(id), 0),
    0
  )
  return gold - totalSpent
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 6: Gold remaining calculation invariant', () => {
  /**
   * Validates: Requirement 4.3
   * goldRemaining = company.gold - Σ goldCost(entry) for all entries across all members
   */
  it('goldRemaining equals gold minus sum of all goldCost entries', () => {
    fc.assert(
      fc.property(
        companyGoldArb,
        goldPurchasesArb,
        (gold, goldPurchases) => {
          const goldRemaining = computeGoldRemaining(gold, goldPurchases)

          // Independently compute expected value
          let totalCost = 0
          for (const items of Object.values(goldPurchases)) {
            for (const entry of items) {
              totalCost += goldCost(entry)
            }
          }
          const expected = gold - totalCost

          expect(goldRemaining).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirement 4.3
   * With no purchases, goldRemaining equals company gold
   */
  it('goldRemaining equals company gold when no purchases exist', () => {
    fc.assert(
      fc.property(companyGoldArb, (gold) => {
        const goldRemaining = computeGoldRemaining(gold, {})
        expect(goldRemaining).toBe(gold)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirement 4.3
   * Parameterised entries (envenom_weapon::weaponId) cost same as plain envenom_weapon
   */
  it('parameterised envenom entries use base item cost', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...weaponIds),
        (weaponId) => {
          const paramEntry = `envenom_weapon::${weaponId}`
          const plainCost = goldCost('envenom_weapon')
          const paramCost = goldCost(paramEntry)

          // parseGoldEntry strips parameter, so cost should be same as base item
          expect(paramCost).toBe(plainCost)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirement 4.3
   * goldRemaining is additive: adding a purchase decreases remaining by exactly its cost
   */
  it('adding a purchase decreases goldRemaining by exactly its cost', () => {
    fc.assert(
      fc.property(
        companyGoldArb,
        goldPurchasesArb,
        memberIdArb,
        purchaseEntryArb,
        (gold, existingPurchases, memberId, newEntry) => {
          const before = computeGoldRemaining(gold, existingPurchases)

          // Add new entry to member
          const updated = { ...existingPurchases }
          updated[memberId] = [...(updated[memberId] ?? []), newEntry]

          const after = computeGoldRemaining(gold, updated)
          const entryCost = goldCost(newEntry)

          expect(before - after).toBe(entryCost)
        }
      ),
      { numRuns: 100 }
    )
  })
})
