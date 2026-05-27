/**
 * Property-based tests for src/utils/proceedButtonLabel.ts
 * Feature: ato-kit-enhancements
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getProceedButtonLabel } from '../proceedButtonLabel'
import type { AtoBonusType } from '../../models/match'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const allBonusTypes: AtoBonusType[] = [
  'influence',
  'experience',
  'reroll',
  'toolkit',
  'wanderer',
  'ambush',
]

/** Generate a random subset of AtoBonusType values */
const arbAtoBonuses: fc.Arbitrary<AtoBonusType[]> = fc.subarray(allBonusTypes)

/** Generate a random subset that always includes 'wanderer' */
const arbAtoBonusesWithWanderer: fc.Arbitrary<AtoBonusType[]> = fc
  .subarray(allBonusTypes.filter((b) => b !== 'wanderer'))
  .map((bonuses) => [...bonuses, 'wanderer'])

/** Generate a random subset that never includes 'wanderer' */
const arbAtoBonusesWithoutWanderer: fc.Arbitrary<AtoBonusType[]> = fc.subarray(
  allBonusTypes.filter((b) => b !== 'wanderer')
)

// ─────────────────────────────────────────────────────────────────────────────
// Property 7: Proceed button label determined by wanderer bonus presence
// Validates: Requirements 4.1, 4.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature: ato-kit-enhancements, Property 7: Proceed button label determined by wanderer bonus presence
 *
 * **Validates: Requirements 4.1, 4.2**
 *
 * For any atoBonuses array, if it includes 'wanderer' then the proceed button
 * label should be "Next: Choose Wanderer →", otherwise it should be "Begin Battle".
 *
 * Strategy:
 * 1. Generate random AtoBonusType arrays with and without 'wanderer'
 * 2. Verify label matches expected value based on wanderer presence
 */
describe('Feature: ato-kit-enhancements, Property 7: Proceed button label determined by wanderer bonus presence', () => {
  it('returns "Next: Choose Wanderer →" when atoBonuses includes wanderer', () => {
    fc.assert(
      fc.property(arbAtoBonusesWithWanderer, (atoBonuses) => {
        const label = getProceedButtonLabel(atoBonuses)
        expect(label).toBe('Next: Choose Wanderer →')
      }),
      { numRuns: 100 }
    )
  })

  it('returns "Begin Battle" when atoBonuses does not include wanderer', () => {
    fc.assert(
      fc.property(arbAtoBonusesWithoutWanderer, (atoBonuses) => {
        const label = getProceedButtonLabel(atoBonuses)
        expect(label).toBe('Begin Battle')
      }),
      { numRuns: 100 }
    )
  })

  it('label is always one of the two valid values for any random atoBonuses array', () => {
    fc.assert(
      fc.property(arbAtoBonuses, (atoBonuses) => {
        const label = getProceedButtonLabel(atoBonuses)
        expect(['Next: Choose Wanderer →', 'Begin Battle']).toContain(label)
      }),
      { numRuns: 100 }
    )
  })

  it('label is determined solely by wanderer presence regardless of other bonuses', () => {
    fc.assert(
      fc.property(arbAtoBonuses, (atoBonuses) => {
        const label = getProceedButtonLabel(atoBonuses)
        const hasWanderer = atoBonuses.includes('wanderer')

        if (hasWanderer) {
          expect(label).toBe('Next: Choose Wanderer →')
        } else {
          expect(label).toBe('Begin Battle')
        }
      }),
      { numRuns: 100 }
    )
  })
})
