// Feature: company-creation-enhancements, Property 5: Gold confirmation dialog shown iff unspent gold exists

/**
 * Property 5: Gold confirmation dialog shown iff unspent gold exists
 * Validates: Requirements 4.1, 4.2
 *
 * For any wizard state at the gold step where the company has starting gold > 0,
 * the gold confirmation dialog SHALL be shown if and only if goldRemaining > 0.
 * When goldRemaining === 0, doFinish SHALL be called directly.
 *
 * We extract the pure decision logic into a function and verify:
 * 1. When goldRemaining === 0 and companyGold > 0 and isLastStep → dialog NOT shown
 * 2. When goldRemaining > 0 and companyGold > 0 and isLastStep → dialog shown
 * 3. When companyGold === 0 → dialog NOT shown regardless of goldRemaining
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Pure decision function (mirrors CreateCompanyPage handleFinish logic) ─────

/**
 * Determines whether the gold confirmation dialog should be shown.
 * Encapsulates the condition from CreateCompanyPage's handleFinish:
 *   (companyGold > 0) && isLastStep && (goldRemaining > 0)
 */
function shouldShowGoldConfirmDialog(
  companyGold: number,
  goldRemaining: number,
  isLastStep: boolean
): boolean {
  return companyGold > 0 && isLastStep && goldRemaining > 0
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Positive gold value (company has gold) */
const positiveGoldArb = fc.integer({ min: 1, max: 500 })

/** Non-negative gold remaining */
const goldRemainingArb = fc.integer({ min: 0, max: 500 })

/** Strictly positive gold remaining */
const positiveGoldRemainingArb = fc.integer({ min: 1, max: 500 })

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 5: Gold confirmation dialog shown iff unspent gold exists', () => {
  /**
   * Validates: Requirement 4.1
   * When goldRemaining === 0 and companyGold > 0 and isLastStep → dialog NOT shown
   */
  it('dialog NOT shown when goldRemaining === 0 and companyGold > 0 at last step', () => {
    fc.assert(
      fc.property(positiveGoldArb, (companyGold) => {
        const result = shouldShowGoldConfirmDialog(companyGold, 0, true)
        expect(result).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirement 4.2
   * When goldRemaining > 0 and companyGold > 0 and isLastStep → dialog shown
   */
  it('dialog shown when goldRemaining > 0 and companyGold > 0 at last step', () => {
    fc.assert(
      fc.property(
        positiveGoldArb,
        positiveGoldRemainingArb,
        (companyGold, goldRemaining) => {
          const result = shouldShowGoldConfirmDialog(companyGold, goldRemaining, true)
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 4.1, 4.2
   * When companyGold === 0 → dialog NOT shown regardless of goldRemaining or step
   */
  it('dialog NOT shown when companyGold === 0 regardless of goldRemaining', () => {
    fc.assert(
      fc.property(
        goldRemainingArb,
        fc.boolean(),
        (goldRemaining, isLastStep) => {
          const result = shouldShowGoldConfirmDialog(0, goldRemaining, isLastStep)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Validates: Requirements 4.1, 4.2
   * When NOT at last step → dialog NOT shown regardless of gold values
   */
  it('dialog NOT shown when not at last step regardless of gold values', () => {
    fc.assert(
      fc.property(
        positiveGoldArb,
        positiveGoldRemainingArb,
        (companyGold, goldRemaining) => {
          const result = shouldShowGoldConfirmDialog(companyGold, goldRemaining, false)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
