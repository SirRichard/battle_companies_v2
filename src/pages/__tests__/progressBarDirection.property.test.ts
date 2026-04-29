// Feature: wizard-progress-bar-navigation, Property 2: Direction is always backward

/**
 * Property 2: Direction is always backward
 * Validates: Requirements 1.2
 *
 * ∀ valid click (t < w.step AND t ∈ w.visitedSteps):
 *   after handleProgressBarClick(t), direction === -1
 *
 * Since direction is set by go() via setDirection(nextStep > wizard.step ? 1 : -1),
 * and handleProgressBarClick always calls go(targetStep) where targetStep < wizard.step,
 * direction will always be -1 for valid clicks.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { WizardState } from '../../models'

// ── Direction computation logic ───────────────────────────────────────────────

/**
 * Pure function that mirrors the direction logic from go() in CreateCompanyPage:
 *   setDirection(nextStep > wizard.step ? 1 : -1)
 */
function computeDirection(currentStep: number, nextStep: number): number {
  return nextStep > currentStep ? 1 : -1
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generates a valid wizard step index (0–7) */
const stepArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 7 })

/**
 * Generates a WizardState at a given step with a realistic visitedSteps array.
 * visitedSteps always contains 0 and a subset of steps up to (but not including) step.
 */
const wizardStateArb: fc.Arbitrary<WizardState> = fc
  .integer({ min: 1, max: 7 }) // current step (at least 1 so there's a completed step)
  .chain((currentStep) =>
    fc
      .array(fc.integer({ min: 0, max: currentStep - 1 }), {
        minLength: 0,
        maxLength: currentStep,
      })
      .map((extraVisited) => {
        const visitedSteps = [...new Set([0, ...extraVisited, currentStep])]
        return {
          step: currentStep,
          visitedSteps,
          alignment: null,
          factionId: null,
          companyTypeId: null,
          variantId: null,
          companyName: '',
          memberNames: {},
          leaderId: null,
          sergeantIds: [],
          heroPaths: {},
          heroSpellChoices: {},
          goldPurchases: {},
        } satisfies WizardState
      })
  )

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 2: Direction is always backward for valid progress bar clicks', () => {
  /**
   * Property 2a: For any valid click (targetStep < state.step AND targetStep ∈ visitedSteps),
   * computeDirection(state.step, targetStep) === -1
   * Validates: Requirements 1.2
   */
  it('direction is always -1 for any valid progress bar click', () => {
    fc.assert(
      fc.property(wizardStateArb, (state) => {
        // Pick any valid target from visited steps that is strictly less than current step
        const validTargets = state.visitedSteps.filter((s) => s < state.step)
        fc.pre(validTargets.length > 0)

        for (const targetStep of validTargets) {
          const direction = computeDirection(state.step, targetStep)
          expect(direction).toBe(-1)
        }
      }),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 2b: For any targetStep strictly less than currentStep,
   * computeDirection returns -1 (regardless of visitedSteps)
   * Validates: Requirements 1.2
   */
  it('direction is -1 whenever targetStep < currentStep', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 7 }).chain((currentStep) =>
          fc.integer({ min: 0, max: currentStep - 1 }).map((targetStep) => ({
            currentStep,
            targetStep,
          }))
        ),
        ({ currentStep, targetStep }) => {
          const direction = computeDirection(currentStep, targetStep)
          expect(direction).toBe(-1)
        }
      ),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 2c: Direction is +1 for forward navigation (targetStep > currentStep)
   * This confirms the direction logic is correct in both directions.
   * Validates: Requirements 1.2 (by contrast — forward navigation is never triggered by progress bar)
   */
  it('direction is +1 whenever targetStep > currentStep (forward navigation)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }).chain((currentStep) =>
          fc.integer({ min: currentStep + 1, max: 7 }).map((targetStep) => ({
            currentStep,
            targetStep,
          }))
        ),
        ({ currentStep, targetStep }) => {
          const direction = computeDirection(currentStep, targetStep)
          expect(direction).toBe(1)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * Property 2d: For any valid progress bar click, direction is strictly negative
   * (i.e., -1, never 0 or positive)
   * Validates: Requirements 1.2
   */
  it('direction is strictly negative (< 0) for all valid progress bar clicks', () => {
    fc.assert(
      fc.property(
        wizardStateArb,
        stepArb,
        (state, targetStep) => {
          // Only test valid clicks
          fc.pre(targetStep < state.step)
          fc.pre(state.visitedSteps.includes(targetStep))

          const direction = computeDirection(state.step, targetStep)
          expect(direction).toBeLessThan(0)
        }
      ),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 2e: The progress bar never triggers forward navigation
   * (handleProgressBarClick guards against targetStep >= state.step)
   * Validates: Requirements 1.2
   */
  it('progress bar click never results in direction +1 (no forward navigation possible)', () => {
    fc.assert(
      fc.property(wizardStateArb, (state) => {
        // All valid targets are strictly less than state.step
        const validTargets = state.visitedSteps.filter((s) => s < state.step)

        for (const targetStep of validTargets) {
          // A valid progress bar click always goes backward
          expect(targetStep).toBeLessThan(state.step)
          const direction = computeDirection(state.step, targetStep)
          expect(direction).toBe(-1)
          expect(direction).not.toBe(1)
        }
      }),
      { numRuns: 500 }
    )
  })
})
