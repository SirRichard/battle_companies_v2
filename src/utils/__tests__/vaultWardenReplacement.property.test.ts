// Feature: company-special-rules-enforcement, Property 11: Vault Warden Replacement Substitution

/**
 * Property 11: Vault Warden Replacement Substitution
 * Validates: Requirements 8.2, 8.4
 *
 * For any Durin's Folk roster where the current count of vault warden members
 * is less than the expected count (based on pairs recruited × 2), the system
 * SHALL flag the replacement condition as true on any special chart roll.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Pure function under test ─────────────────────────────────────────────────

/**
 * Determines whether vault warden replacement substitution is available.
 *
 * @param currentVaultWardenCount - Number of living vault warden members
 * @param expectedVaultWardenCount - Expected count based on pairs recruited × 2
 * @param replacementSubstitution - Whether the rule enables replacement substitution
 * @returns true if replacement should be offered on any special chart roll
 */
export function isVaultWardenReplacementAvailable(
  currentVaultWardenCount: number,
  expectedVaultWardenCount: number,
  replacementSubstitution: boolean
): boolean {
  return (
    replacementSubstitution &&
    currentVaultWardenCount < expectedVaultWardenCount &&
    expectedVaultWardenCount > 0
  )
}

// ── Arbitraries ──────────────────────────────────────────────────────────────

/** Arbitrary: number of pairs recruited (1-5), giving expected count of pairs × 2 */
const arbPairsRecruited = fc.integer({ min: 1, max: 5 })

/** Arbitrary: current vault warden count (0-10) */
const arbCurrentCount = fc.integer({ min: 0, max: 10 })

// ── Property Tests ───────────────────────────────────────────────────────────

describe('Feature: company-special-rules-enforcement, Property 11: Vault Warden Replacement Substitution', () => {
  it('replacement is available when current count < expected count and replacementSubstitution is true', () => {
    fc.assert(
      fc.property(arbPairsRecruited, (pairsRecruited) => {
        const expectedCount = pairsRecruited * 2

        // Generate a current count strictly less than expected
        const currentCount = fc.sample(
          fc.integer({ min: 0, max: expectedCount - 1 }),
          1
        )[0]

        const result = isVaultWardenReplacementAvailable(
          currentCount,
          expectedCount,
          true
        )

        expect(result).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('replacement is NOT available when current count equals expected count', () => {
    fc.assert(
      fc.property(arbPairsRecruited, (pairsRecruited) => {
        const expectedCount = pairsRecruited * 2

        const result = isVaultWardenReplacementAvailable(
          expectedCount,
          expectedCount,
          true
        )

        expect(result).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('replacement is NOT available when current count exceeds expected count', () => {
    fc.assert(
      fc.property(
        arbPairsRecruited,
        fc.integer({ min: 1, max: 5 }),
        (pairsRecruited, extra) => {
          const expectedCount = pairsRecruited * 2
          const currentCount = expectedCount + extra

          const result = isVaultWardenReplacementAvailable(
            currentCount,
            expectedCount,
            true
          )

          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('replacement is NOT available when replacementSubstitution is false regardless of counts', () => {
    fc.assert(
      fc.property(
        arbCurrentCount,
        fc.integer({ min: 1, max: 10 }),
        (currentCount, expectedCount) => {
          const result = isVaultWardenReplacementAvailable(
            currentCount,
            expectedCount,
            false
          )

          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('replacement is NOT available when expected count is 0 (no pairs recruited)', () => {
    fc.assert(
      fc.property(arbCurrentCount, (currentCount) => {
        const result = isVaultWardenReplacementAvailable(currentCount, 0, true)

        expect(result).toBe(false)
      }),
      { numRuns: 100 }
    )
  })
})
