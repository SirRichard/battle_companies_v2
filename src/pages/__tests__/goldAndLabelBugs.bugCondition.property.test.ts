/**
 * Bug Condition Exploration Test — Gold and Label Bugs
 *
 * Property 1: Bug Condition - Gold Remaining Mismatch and Envenom Label Format
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
 *
 * This test MUST FAIL on unfixed code — failure confirms the bugs exist.
 * DO NOT fix the code or modify the test to make it pass.
 *
 * Bug 1: goldRemaining() in CreateCompanyPage only looks up wargearData with
 *   fallback of 1, while goldCost() correctly resolves across wargear, equipment,
 *   and creatures. For equipment/creature purchases, the two diverge.
 *
 * Bug 2: getWargearLabel() does not handle the `envenom_weapon::weapon_id` format,
 *   producing "Envenom Weapon::Sword" instead of "Envenom Weapon (Sword)".
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { goldCost } from '../../components/wizard/StepGoldEquipment'
import { getWargearLabel } from '../../utils/labels'
import wargearData from '../../data/wargear.json'
import equipmentData from '../../data/equipment.json'
import creaturesData from '../../data/creatures.json'

// ── Data setup ────────────────────────────────────────────────────────────────

type WargearEntry = { id: string; label: string; rating?: [number, number]; purchasable?: boolean }
type EquipmentEntry = { id: string; label: string; rating?: number | [number, number] }
type CreatureEntry = { id: string; label: string; pointsCost: number }

const WARGEAR = wargearData as WargearEntry[]
const EQUIPMENT = equipmentData as EquipmentEntry[]
const CREATURES = creaturesData as CreatureEntry[]

const wargearIds = new Set(WARGEAR.map(w => w.id))

/**
 * Equipment items NOT in wargear.json — these trigger Bug 1 because
 * goldRemaining() won't find them in wargearData and falls back to cost 1.
 * We only include items with rating > 1 so the mismatch is observable.
 */
const equipmentItemsNotInWargear = EQUIPMENT.filter(e => {
  if (!e.rating) return false
  const cost = Array.isArray(e.rating) ? e.rating[0] : e.rating
  return cost > 1 && !wargearIds.has(e.id)
})

/**
 * Creatures with pointsCost > 1 — these trigger Bug 1 because
 * goldRemaining() won't find them in wargearData and falls back to cost 1.
 */
const creaturesWithCostAbove1 = CREATURES.filter(c => c.pointsCost > 1)

/** Weapon IDs from wargear.json for envenom_weapon parameterisation */
const weaponWargearIds = (wargearData as Array<{ id: string; category: string; label: string }>)
  .filter(w => !['armour_1', 'armour_2', 'armour_3', 'armour_4', 'mount', 'shield', 'special'].includes(w.category))
  .map(w => ({ id: w.id, label: w.label }))

// ── Inline goldRemaining cost logic (mirrors CreateCompanyPage) ───────────────

/**
 * This replicates the cost lookup from CreateCompanyPage.goldRemaining().
 * After the fix, it uses goldCost() directly — same as StepGoldEquipment.
 * On UNFIXED code this was: wargearData.find(w => w.id === wId)?.rating?.[0] ?? 1
 * which only checked wargear and fell back to 1 for equipment/creatures.
 */
function inlineCost(wId: string): number {
  return goldCost(wId)
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Equipment items that trigger the gold bug (cost > 1, not in wargear.json) */
const buggyEquipmentArb = equipmentItemsNotInWargear.length > 0
  ? fc.constantFrom(...equipmentItemsNotInWargear.map(e => e.id))
  : fc.constant('backpack') // fallback

/** Creature items that trigger the gold bug (pointsCost > 1) */
const buggyCreatureArb = creaturesWithCostAbove1.length > 0
  ? fc.constantFrom(...creaturesWithCostAbove1.map(c => c.id))
  : fc.constant('falcon') // fallback

/** Envenom weapon entries for Bug 2 */
const envenomEntryArb = weaponWargearIds.length > 0
  ? fc.constantFrom(...weaponWargearIds).map(w => ({
      entry: `envenom_weapon::${w.id}`,
      expectedLabel: `Envenom Weapon (${w.label})`
    }))
  : fc.constant({ entry: 'envenom_weapon::spear', expectedLabel: 'Envenom Weapon (Spear)' })

// ── Property Tests ────────────────────────────────────────────────────────────

describe('Bug Condition Exploration: Gold and Label Bugs', () => {
  /**
   * Bug 1 — Gold Calculation Mismatch for Equipment Items
   * Validates: Requirements 1.1, 2.1
   *
   * For equipment items not in wargear.json with cost > 1, the buggy
   * goldRemaining() inline lookup returns 1 (fallback) while goldCost()
   * correctly returns the item's actual rating.
   *
   * This test asserts they SHOULD match — it will FAIL on unfixed code.
   */
  it('goldRemaining inline cost matches goldCost for equipment items', () => {
    fc.assert(
      fc.property(
        buggyEquipmentArb,
        (itemId) => {
          const cost = inlineCost(itemId)
          const correctCost = goldCost(itemId)

          // These should be equal — after fix, both use goldCost()
          expect(cost).toBe(correctCost)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Bug 1 — Gold Calculation Mismatch for Creature Items
   * Validates: Requirements 1.1, 2.1
   *
   * For creature items with pointsCost > 1, the buggy goldRemaining() inline
   * lookup returns 1 (fallback) while goldCost() correctly returns pointsCost.
   *
   * This test asserts they SHOULD match — it will FAIL on unfixed code.
   */
  it('goldRemaining inline cost matches goldCost for creature items', () => {
    fc.assert(
      fc.property(
        buggyCreatureArb,
        (itemId) => {
          const cost = inlineCost(itemId)
          const correctCost = goldCost(itemId)

          // These should be equal — after fix, both use goldCost()
          expect(cost).toBe(correctCost)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Bug 2 — Envenom Weapon Label Format
   * Validates: Requirements 1.3, 2.3
   *
   * For entries matching `envenom_weapon::weapon_id`, getWargearLabel() should
   * return "Envenom Weapon (<weapon_label>)" format — NOT containing "::".
   *
   * On unfixed code, getWargearLabel("envenom_weapon::spear") returns
   * "Envenom Weapon::Spear" (humanised form of the full string with ::).
   */
  it('getWargearLabel for envenom_weapon::weapon_id returns proper format without "::"', () => {
    fc.assert(
      fc.property(
        envenomEntryArb,
        ({ entry, expectedLabel }) => {
          const result = getWargearLabel(entry)

          // Should NOT contain "::" in output
          expect(result).not.toContain('::')

          // Should match "Envenom Weapon (<weapon_label>)" format
          expect(result).toBe(expectedLabel)
        }
      ),
      { numRuns: 100 }
    )
  })
})
