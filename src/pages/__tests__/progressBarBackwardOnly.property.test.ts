// Feature: wizard-progress-bar-navigation, Property 1: Backward-only navigation

/**
 * Property 1: Backward-only navigation
 * Validates: Requirements 1.1, 1.4, 1.5
 *
 * ∀ wizard state w, ∀ targetStep t:
 *   handleProgressBarClick(t) causes wizard.step = t
 *   ONLY IF t < w.step AND t ∈ w.visitedSteps
 *   OTHERWISE wizard.step is unchanged
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { WizardState } from '../../models'

// ── Pure version of handleProgressBarClick logic ──────────────────────────────

/**
 * Pure function that mirrors the handleProgressBarClick logic from
 * CreateCompanyPage. Returns the new state and whether the step changed.
 */
function applyProgressBarClick(
  state: WizardState,
  targetStep: number
): { newState: WizardState; stepChanged: boolean } {
  // Guard conditions
  if (targetStep >= state.step) return { newState: state, stepChanged: false }
  if (!state.visitedSteps.includes(targetStep)) return { newState: state, stepChanged: false }

  // Apply downstream resets
  const next = { ...state }
  if (targetStep <= 0) {
    next.factionId = null
    next.companyTypeId = null
    next.variantId = null
    next.memberNames = {}
    next.leaderId = null
    next.sergeantIds = []
    next.heroPaths = {}
    next.heroSpellChoices = {}
  } else if (targetStep <= 1) {
    next.companyTypeId = null
    next.variantId = null
    next.memberNames = {}
    next.leaderId = null
    next.sergeantIds = []
    next.heroPaths = {}
    next.heroSpellChoices = {}
  } else if (targetStep <= 2) {
    next.variantId = null
    next.memberNames = {}
    next.leaderId = null
    next.sergeantIds = []
    next.heroPaths = {}
    next.heroSpellChoices = {}
  }

  // go(targetStep) sets step and records visited
  next.step = targetStep
  if (!next.visitedSteps.includes(targetStep)) {
    next.visitedSteps = [...next.visitedSteps, targetStep]
  }

  return { newState: next, stepChanged: true }
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

describe('Property 1: Backward-only navigation — handleProgressBarClick', () => {
  /**
   * Property 1a: When targetStep >= state.step, wizard.step is unchanged
   * Validates: Requirements 1.4, 1.5
   */
  it('does NOT change wizard.step when targetStep >= state.step (forward/same-step guard)', () => {
    fc.assert(
      fc.property(
        wizardStateArb,
        fc.integer({ min: 0, max: 7 }),
        (state, targetStep) => {
          // Only test the case where targetStep >= state.step
          fc.pre(targetStep >= state.step)

          const { newState, stepChanged } = applyProgressBarClick(state, targetStep)

          expect(stepChanged).toBe(false)
          expect(newState.step).toBe(state.step)
        }
      ),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 1b: When targetStep is not in visitedSteps, wizard.step is unchanged
   * Validates: Requirements 1.4, 1.5
   */
  it('does NOT change wizard.step when targetStep is not in visitedSteps', () => {
    fc.assert(
      fc.property(
        wizardStateArb,
        fc.integer({ min: 0, max: 7 }),
        (state, targetStep) => {
          // Only test the case where targetStep < state.step but NOT in visitedSteps
          fc.pre(targetStep < state.step)
          fc.pre(!state.visitedSteps.includes(targetStep))

          const { newState, stepChanged } = applyProgressBarClick(state, targetStep)

          expect(stepChanged).toBe(false)
          expect(newState.step).toBe(state.step)
        }
      ),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 1c: When targetStep < state.step AND targetStep ∈ visitedSteps,
   * wizard.step === targetStep
   * Validates: Requirements 1.1
   */
  it('changes wizard.step to targetStep when targetStep < state.step AND targetStep ∈ visitedSteps', () => {
    fc.assert(
      fc.property(
        wizardStateArb,
        (state) => {
          // Pick a valid target from the visited steps that is strictly less than current step
          const validTargets = state.visitedSteps.filter((s) => s < state.step)
          fc.pre(validTargets.length > 0)

          // Use the first valid target for determinism
          const targetStep = validTargets[0]

          const { newState, stepChanged } = applyProgressBarClick(state, targetStep)

          expect(stepChanged).toBe(true)
          expect(newState.step).toBe(targetStep)
        }
      ),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 1d: The step only changes when BOTH conditions are met:
   *   - targetStep < state.step
   *   - targetStep ∈ visitedSteps
   * Validates: Requirements 1.1, 1.4, 1.5
   */
  it('step changes if and only if BOTH guard conditions are satisfied', () => {
    fc.assert(
      fc.property(
        wizardStateArb,
        fc.integer({ min: 0, max: 7 }),
        (state, targetStep) => {
          const { newState, stepChanged } = applyProgressBarClick(state, targetStep)

          const bothConditionsMet =
            targetStep < state.step && state.visitedSteps.includes(targetStep)

          if (bothConditionsMet) {
            expect(stepChanged).toBe(true)
            expect(newState.step).toBe(targetStep)
          } else {
            expect(stepChanged).toBe(false)
            expect(newState.step).toBe(state.step)
          }
        }
      ),
      { numRuns: 2000 }
    )
  })

  /**
   * Additional: clicking the active step (targetStep === state.step) is a no-op
   * Validates: Requirements 1.4
   */
  it('is a no-op when targetStep equals the current step', () => {
    fc.assert(
      fc.property(wizardStateArb, (state) => {
        const { newState, stepChanged } = applyProgressBarClick(state, state.step)

        expect(stepChanged).toBe(false)
        expect(newState.step).toBe(state.step)
      }),
      { numRuns: 500 }
    )
  })

  /**
   * Additional: clicking a future step (targetStep > state.step) is a no-op
   * Validates: Requirements 1.5
   */
  it('is a no-op when targetStep is greater than the current step', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }).chain((currentStep) =>
          fc.integer({ min: currentStep + 1, max: 7 }).map((targetStep) => ({
            state: {
              step: currentStep,
              visitedSteps: [0, currentStep],
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
            } satisfies WizardState,
            targetStep,
          }))
        ),
        ({ state, targetStep }) => {
          const { newState, stepChanged } = applyProgressBarClick(state, targetStep)

          expect(stepChanged).toBe(false)
          expect(newState.step).toBe(state.step)
        }
      ),
      { numRuns: 500 }
    )
  })
})
