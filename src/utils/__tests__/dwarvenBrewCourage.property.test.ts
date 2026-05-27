/**
 * Property-based tests for src/utils/dwarvenBrew.ts
 * Feature: ato-kit-enhancements
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  getDwarvenBrewCourageBonus,
  dwarvenBrewIntelligenceTestPasses,
} from '../dwarvenBrew'
import type { ToolkitItem } from '../../models/match'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbMemberId = fc.uuid()

const arbNonBrewItemId = fc.string({ minLength: 1, maxLength: 20 }).filter(
  (s) => s !== 'dwarven_brew'
)

const arbToolkitItemNonBrew: fc.Arbitrary<ToolkitItem> = fc.record({
  memberId: arbMemberId,
  itemId: arbNonBrewItemId,
})

const arbToolkitItemBrew: fc.Arbitrary<ToolkitItem> = arbMemberId.map(
  (memberId) => ({ memberId, itemId: 'dwarven_brew' })
)

/** Toolkit items array guaranteed to contain at least one dwarven_brew */
const arbToolkitWithBrew: fc.Arbitrary<ToolkitItem[]> = fc.tuple(
  fc.array(arbToolkitItemNonBrew, { maxLength: 8 }),
  arbToolkitItemBrew,
  fc.array(arbToolkitItemNonBrew, { maxLength: 8 })
).map(([before, brew, after]) => [...before, brew, ...after])

/** Toolkit items array guaranteed to contain NO dwarven_brew */
const arbToolkitWithoutBrew: fc.Arbitrary<ToolkitItem[]> = fc.array(
  arbToolkitItemNonBrew,
  { maxLength: 10 }
)

// ─────────────────────────────────────────────────────────────────────────────
// Property 3: Temporary dwarven_brew applies +1 courage to all members
// Validates: Requirements 2.1, 2.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: ato-kit-enhancements, Property 3: Temporary dwarven_brew applies +1 courage to all members
 *
 * **Validates: Requirements 2.1, 2.2**
 *
 * For any toolkitItems containing dwarven_brew, getDwarvenBrewCourageBonus returns 1.
 */
describe('Feature: ato-kit-enhancements, Property 3: Temporary dwarven_brew applies +1 courage to all members', () => {
  it('getDwarvenBrewCourageBonus returns 1 when toolkitItems contains dwarven_brew', () => {
    fc.assert(
      fc.property(
        arbToolkitWithBrew,
        fc.boolean(),
        (toolkitItems, permanentBrewUsed) => {
          // Regardless of permanentBrewUsed flag, if temporary brew present → bonus is 1
          const bonus = getDwarvenBrewCourageBonus(toolkitItems, permanentBrewUsed)
          expect(bonus).toBe(1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('bonus is always exactly 1, never more, even with multiple dwarven_brew items', () => {
    fc.assert(
      fc.property(
        fc.array(arbToolkitItemBrew, { minLength: 2, maxLength: 5 }),
        fc.array(arbToolkitItemNonBrew, { maxLength: 5 }),
        (brews, others) => {
          const toolkitItems = [...brews, ...others]
          const bonus = getDwarvenBrewCourageBonus(toolkitItems, false)
          expect(bonus).toBe(1)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 4: Permanent dwarven_brew does not auto-apply courage bonus
// Validates: Requirements 2.4
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: ato-kit-enhancements, Property 4: Permanent dwarven_brew does not auto-apply courage bonus
 *
 * **Validates: Requirements 2.4**
 *
 * For any member with dwarven_brew in ownedEquipment but no temporary dwarven_brew
 * in toolkitItems and permanentBrewUsed=false, getDwarvenBrewCourageBonus returns 0.
 */
describe('Feature: ato-kit-enhancements, Property 4: Permanent dwarven_brew does not auto-apply courage bonus', () => {
  it('getDwarvenBrewCourageBonus returns 0 when no temporary brew and permanentBrewUsed is false', () => {
    fc.assert(
      fc.property(
        arbToolkitWithoutBrew,
        (toolkitItems) => {
          const bonus = getDwarvenBrewCourageBonus(toolkitItems, false)
          expect(bonus).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('empty toolkitItems with permanentBrewUsed=false yields 0 bonus', () => {
    fc.assert(
      fc.property(
        fc.constant([] as ToolkitItem[]),
        () => {
          const bonus = getDwarvenBrewCourageBonus([], false)
          expect(bonus).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 8: Intelligence test determines retention (roll >= stat → pass)
// Validates: Requirements 5.5, 5.6
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: ato-kit-enhancements, Property 8: Intelligence test determines retention (roll >= stat → pass)
 *
 * **Validates: Requirements 5.5, 5.6**
 *
 * dwarvenBrewIntelligenceTestPasses(roll, stat) returns true iff roll >= stat.
 */
describe('Feature: ato-kit-enhancements, Property 8: Intelligence test determines retention (roll >= stat → pass)', () => {
  it('returns true when roll >= intelligenceStat', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 6 }),
        (roll, stat) => {
          fc.pre(roll >= stat)
          expect(dwarvenBrewIntelligenceTestPasses(roll, stat)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns false when roll < intelligenceStat', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 6 }),
        (roll, stat) => {
          fc.pre(roll < stat)
          expect(dwarvenBrewIntelligenceTestPasses(roll, stat)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result is equivalent to roll >= stat for any integer inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (roll, stat) => {
          const result = dwarvenBrewIntelligenceTestPasses(roll, stat)
          expect(result).toBe(roll >= stat)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 9: Permanent elected use applies same +1 courage bonus as temporary
// Validates: Requirements 5.2, 5.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: ato-kit-enhancements, Property 9: Permanent elected use applies same +1 courage bonus as temporary
 *
 * **Validates: Requirements 5.2, 5.3**
 *
 * When permanentBrewUsed=true, getDwarvenBrewCourageBonus returns 1 regardless of toolkitItems.
 */
describe('Feature: ato-kit-enhancements, Property 9: Permanent elected use applies same +1 courage bonus as temporary', () => {
  it('getDwarvenBrewCourageBonus returns 1 when permanentBrewUsed is true, regardless of toolkitItems', () => {
    fc.assert(
      fc.property(
        fc.oneof(arbToolkitWithBrew, arbToolkitWithoutBrew),
        (toolkitItems) => {
          const bonus = getDwarvenBrewCourageBonus(toolkitItems, true)
          expect(bonus).toBe(1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('permanent elected bonus equals temporary bonus (both are 1)', () => {
    fc.assert(
      fc.property(
        arbToolkitWithBrew,
        (toolkitItemsWithBrew) => {
          const temporaryBonus = getDwarvenBrewCourageBonus(toolkitItemsWithBrew, false)
          const permanentBonus = getDwarvenBrewCourageBonus([], true)
          expect(temporaryBonus).toBe(permanentBonus)
          expect(temporaryBonus).toBe(1)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 10: Declining permanent use applies no bonus and retains item
// Validates: Requirements 5.7
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: ato-kit-enhancements, Property 10: Declining permanent use applies no bonus and retains item
 *
 * **Validates: Requirements 5.7**
 *
 * When permanentBrewUsed=false and no temporary brew in toolkitItems,
 * getDwarvenBrewCourageBonus returns 0.
 */
describe('Feature: ato-kit-enhancements, Property 10: Declining permanent use applies no bonus and retains item', () => {
  it('getDwarvenBrewCourageBonus returns 0 when permanentBrewUsed=false and no temporary brew', () => {
    fc.assert(
      fc.property(
        arbToolkitWithoutBrew,
        (toolkitItems) => {
          const bonus = getDwarvenBrewCourageBonus(toolkitItems, false)
          expect(bonus).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('declining use means bonus is strictly 0 for any non-brew toolkit configuration', () => {
    fc.assert(
      fc.property(
        fc.array(arbToolkitItemNonBrew, { minLength: 0, maxLength: 15 }),
        (toolkitItems) => {
          const bonus = getDwarvenBrewCourageBonus(toolkitItems, false)
          expect(bonus).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
