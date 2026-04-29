// Feature: wizard-progress-bar-navigation, Property 6: visitedSteps is a subset of go()-called steps with no duplicates

/**
 * Property 6: visitedSteps is a subset of go()-called steps with no duplicates
 * Validates: Requirements 5.3
 *
 * For any sequence of go(n) calls:
 *   - visitedSteps ⊆ { n | go(n) was called }
 *   - visitedSteps contains no duplicates
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { WizardState } from '../../models'

// ── Pure version of the go() visitedSteps update logic ───────────────────────

/**
 * Pure version of the go() visitedSteps update logic extracted from
 * CreateCompanyPage. Applies the deduplication logic without React state.
 *
 * Mirrors:
 *   const next = { ...w, step: nextStep }
 *   if (!next.visitedSteps.includes(nextStep)) {
 *     next.visitedSteps = [...next.visitedSteps, nextStep]
 *   }
 */
function applyGoVisitedSteps(state: WizardState, nextStep: number): WizardState {
  const next = { ...state, step: nextStep }
  if (!next.visitedSteps.includes(nextStep)) {
    next.visitedSteps = [...next.visitedSteps, nextStep]
  }
  return next
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generates a valid wizard step index (0–7) */
const stepArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 7 })

/** Generates a sequence of step numbers to pass to go() */
const stepSequenceArb: fc.Arbitrary<number[]> = fc.array(stepArb, {
  minLength: 1,
  maxLength: 20,
})

/** Generates an initial WizardState with step 0 and visitedSteps: [0] */
const initialWizardArb: fc.Arbitrary<WizardState> = fc.constant({
  step: 0,
  visitedSteps: [0],
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
})

/** Generates an initial WizardState with arbitrary starting visitedSteps */
const wizardWithVisitedArb: fc.Arbitrary<WizardState> = fc
  .array(stepArb, { minLength: 0, maxLength: 4 })
  .map((extraSteps) => {
    const visitedSteps = [...new Set([0, ...extraSteps])]
    return {
      step: visitedSteps[visitedSteps.length - 1] ?? 0,
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
    }
  })

// ── Helper: apply a sequence of go() calls ───────────────────────────────────

function applyGoSequence(initial: WizardState, steps: number[]): WizardState {
  return steps.reduce((state, nextStep) => applyGoVisitedSteps(state, nextStep), initial)
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 6: visitedSteps is a subset of go()-called steps with no duplicates', () => {
  it('visitedSteps contains no duplicates after any sequence of go() calls', () => {
    fc.assert(
      fc.property(initialWizardArb, stepSequenceArb, (initial, steps) => {
        const finalState = applyGoSequence(initial, steps)

        // No duplicates: every entry appears exactly once
        const unique = new Set(finalState.visitedSteps)
        expect(finalState.visitedSteps).toHaveLength(unique.size)
      }),
      { numRuns: 1000 }
    )
  })

  it('every entry in visitedSteps was a step that was called via go()', () => {
    fc.assert(
      fc.property(initialWizardArb, stepSequenceArb, (initial, steps) => {
        const finalState = applyGoSequence(initial, steps)

        // The set of "called" steps includes the initial step (0) plus all steps passed to go()
        const calledSteps = new Set([initial.step, ...steps])

        for (const visitedStep of finalState.visitedSteps) {
          expect(calledSteps.has(visitedStep)).toBe(true)
        }
      }),
      { numRuns: 1000 }
    )
  })

  it('visitedSteps ⊆ { n | go(n) was called } — subset property', () => {
    fc.assert(
      fc.property(wizardWithVisitedArb, stepSequenceArb, (initial, steps) => {
        const finalState = applyGoSequence(initial, steps)

        // All steps that could legitimately be in visitedSteps:
        // initial visitedSteps ∪ steps passed to go()
        const legitimateSteps = new Set([...initial.visitedSteps, ...steps])

        for (const visitedStep of finalState.visitedSteps) {
          expect(legitimateSteps.has(visitedStep)).toBe(true)
        }
      }),
      { numRuns: 1000 }
    )
  })

  it('calling go(n) multiple times does not add n to visitedSteps more than once', () => {
    fc.assert(
      fc.property(
        initialWizardArb,
        stepArb,
        fc.integer({ min: 2, max: 10 }), // repeat count
        (initial, step, repeatCount) => {
          // Call go(step) repeatCount times
          const repeatedSteps = Array.from({ length: repeatCount }, () => step)
          const finalState = applyGoSequence(initial, repeatedSteps)

          // step should appear at most once in visitedSteps
          const occurrences = finalState.visitedSteps.filter((s) => s === step).length
          expect(occurrences).toBeLessThanOrEqual(1)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('visitedSteps grows monotonically — new steps are only appended, never removed', () => {
    fc.assert(
      fc.property(initialWizardArb, stepSequenceArb, (initial, steps) => {
        let state = initial

        for (const nextStep of steps) {
          const prevVisited = new Set(state.visitedSteps)
          state = applyGoVisitedSteps(state, nextStep)

          // All previously visited steps are still present
          for (const prev of prevVisited) {
            expect(state.visitedSteps).toContain(prev)
          }

          // visitedSteps either stayed the same size or grew by exactly 1
          const sizeDiff = state.visitedSteps.length - prevVisited.size
          expect(sizeDiff).toBeGreaterThanOrEqual(0)
          expect(sizeDiff).toBeLessThanOrEqual(1)
        }
      }),
      { numRuns: 500 }
    )
  })

  it('visitedSteps always contains the initial step (0)', () => {
    fc.assert(
      fc.property(initialWizardArb, stepSequenceArb, (initial, steps) => {
        const finalState = applyGoSequence(initial, steps)
        expect(finalState.visitedSteps).toContain(0)
      }),
      { numRuns: 500 }
    )
  })

  it('all entries in visitedSteps are valid step indices (0–7)', () => {
    fc.assert(
      fc.property(initialWizardArb, stepSequenceArb, (initial, steps) => {
        const finalState = applyGoSequence(initial, steps)

        for (const visitedStep of finalState.visitedSteps) {
          expect(visitedStep).toBeGreaterThanOrEqual(0)
          expect(visitedStep).toBeLessThanOrEqual(7)
        }
      }),
      { numRuns: 500 }
    )
  })
})
