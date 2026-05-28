// Feature: member-detail-enhancements, Property 4: Shield Mutual Exclusivity

/**
 * Property 4: Shield Mutual Exclusivity
 * Validates: Requirements 4.1, 4.2
 *
 * For any member, if ownedEquipment contains small_shield, then isShieldExclusive
 * SHALL return true for every wargear item with category "shield"; and symmetrically,
 * if equipment contains any wargear with category "shield", then isShieldExclusive
 * SHALL return true for small_shield.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { isShieldExclusive } from '../shieldExclusivity'
import wargearData from '../../data/wargear.json'

// ── Data setup ────────────────────────────────────────────────────────────────

interface WargearEntry {
  id: string
  label: string
  category: string
}

const WARGEAR = wargearData as WargearEntry[]

const SHIELD_CATEGORY_IDS = WARGEAR.filter((w) => w.category === 'shield').map((w) => w.id)
const NON_SHIELD_IDS = WARGEAR.filter((w) => w.category !== 'shield').map((w) => w.id)

const SMALL_SHIELD_ID = 'small_shield'

// ── Generators ────────────────────────────────────────────────────────────────

// Arbitrary shield-category wargear ID
const arbShieldItem = fc.constantFrom(...SHIELD_CATEGORY_IDS)

// Arbitrary non-shield wargear ID (excludes small_shield since it's equipment, not wargear)
const arbNonShieldItem = fc.constantFrom(...NON_SHIELD_IDS)

// Arbitrary subset of non-shield wargear for filler equipment
const arbNonShieldEquipment = fc.array(arbNonShieldItem, { minLength: 0, maxLength: 5 })

// Arbitrary subset of non-shield owned equipment (random equipment IDs that aren't small_shield)
const arbNonShieldOwnedEquipment = fc.array(
  fc.constantFrom('rope', 'torch', 'horn', 'war_drum', 'torching_brand'),
  { minLength: 0, maxLength: 4 }
)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 4: Shield Mutual Exclusivity', () => {
  it('small_shield in ownedEquipment → isShieldExclusive returns true for any shield-category wargear', () => {
    fc.assert(
      fc.property(
        arbShieldItem,
        arbNonShieldEquipment,
        arbNonShieldOwnedEquipment,
        (shieldItem, otherEquipment, otherOwned) => {
          // Member owns small_shield (plus possibly other non-shield owned equipment)
          const memberOwnedEquipment = [SMALL_SHIELD_ID, ...otherOwned]
          // Member may have other non-shield equipment
          const memberEquipment = otherEquipment

          const result = isShieldExclusive(shieldItem, memberEquipment, memberOwnedEquipment)
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('shield-category wargear in equipment → isShieldExclusive returns true for small_shield', () => {
    fc.assert(
      fc.property(
        arbShieldItem,
        arbNonShieldEquipment,
        arbNonShieldOwnedEquipment,
        (shieldItem, otherEquipment, otherOwned) => {
          // Member has a shield-category wargear in their equipment
          const memberEquipment = [shieldItem, ...otherEquipment]
          // Member does NOT own small_shield in ownedEquipment
          const memberOwnedEquipment = otherOwned

          const result = isShieldExclusive(SMALL_SHIELD_ID, memberEquipment, memberOwnedEquipment)
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('non-shield items do not trigger exclusivity when member owns small_shield', () => {
    fc.assert(
      fc.property(
        arbNonShieldItem,
        arbNonShieldEquipment,
        arbNonShieldOwnedEquipment,
        (nonShieldItem, otherEquipment, otherOwned) => {
          // Member owns small_shield
          const memberOwnedEquipment = [SMALL_SHIELD_ID, ...otherOwned]
          const memberEquipment = otherEquipment

          const result = isShieldExclusive(nonShieldItem, memberEquipment, memberOwnedEquipment)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('small_shield does not trigger exclusivity when no shield-category wargear in equipment', () => {
    fc.assert(
      fc.property(
        arbNonShieldEquipment,
        arbNonShieldOwnedEquipment,
        (nonShieldEquipment, otherOwned) => {
          // Member has no shield-category wargear in equipment
          const memberEquipment = nonShieldEquipment
          // Member does not own small_shield
          const memberOwnedEquipment = otherOwned

          const result = isShieldExclusive(SMALL_SHIELD_ID, memberEquipment, memberOwnedEquipment)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
