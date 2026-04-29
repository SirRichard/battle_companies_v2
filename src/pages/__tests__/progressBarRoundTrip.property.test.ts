// Feature: wizard-progress-bar-navigation, Property 5: Round-trip navigation

/**
 * Property 5: Round-trip navigation
 * Validates: Requirements 2.3
 *
 * ∀ wizard state w at step S, ∀ targetStep t where t < S AND t ∈ w.visitedSteps:
 *   navigate back to t via progress bar, then advance forward to S without changes:
 *     wizard.step === S AND all selections made at steps t+1..S are intact
 *   (only valid when t > 2, since steps 0–2 trigger downstream resets)
 *
 * Key insight: when targetStep >= 3, handleProgressBarClick applies NO downstream
 * resets. So navigating back to step 3, 4, 5, or 6 and then forward again leaves
 * all state intact.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { WizardState } from '../../models'

// ── Pure helper functions ─────────────────────────────────────────────────────

/**
 * Pure version of handleProgressBarClick (no resets for targetStep >= 3).
 * Returns null if the click is a no-op (guard conditions not met).
 */
function applyProgressBarClick(
  state: WizardState,
  targetStep: number
): WizardState | null {
  if (targetStep >= state.step) return null
  if (!state.visitedSteps.includes(targetStep)) return null

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
  // Steps 3–6: no resets

  next.step = targetStep
  if (!next.visitedSteps.includes(targetStep)) {
    next.visitedSteps = [...next.visitedSteps, targetStep]
  }
  return next
}

/**
 * Pure version of go() — just advances step and records visited.
 */
function applyGo(state: WizardState, nextStep: number): WizardState {
  const next = { ...state, step: nextStep }
  if (!next.visitedSteps.includes(nextStep)) {
    next.visitedSteps = [...next.visitedSteps, nextStep]
  }
  return next
}

/**
 * Simulate a round trip: navigate back to targetStep, then forward to originalStep.
 * Returns the final state after the round trip.
 */
function simulateRoundTrip(
  state: WizardState,
  targetStep: number
): WizardState | null {
  // Step 1: Navigate back via progress bar click
  const afterBack = applyProgressBarClick(state, targetStep)
  if (afterBack === null) return null

  // Step 2: Navigate forward step-by-step back to the original step
  let current = afterBack
  for (let s = targetStep + 1; s <= state.step; s++) {
    current = applyGo(current, s)
  }

  return current
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generates a non-empty string (for names, IDs) */
const nonEmptyStringArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 })

/** Generates a non-empty Record<string, string> */
const stringRecordArb: fc.Arbitrary<Record<string, string>> = fc
  .array(fc.tuple(nonEmptyStringArb, nonEmptyStringArb), { minLength: 1, maxLength: 3 })
  .map((pairs) => Object.fromEntries(pairs))

/** Generates a non-empty Record<string, string[]> */
const stringArrayRecordArb: fc.Arbitrary<Record<string, string[]>> = fc
  .array(
    fc.tuple(
      nonEmptyStringArb,
      fc.array(nonEmptyStringArb, { minLength: 1, maxLength: 3 })
    ),
    { minLength: 1, maxLength: 3 }
  )
  .map((pairs) => Object.fromEntries(pairs))

/**
 * Generates a fully-populated wizard state at step S (4–7) with a targetStep t
 * in range [3, S-1]. visitedSteps includes 0, 1, 2, 3, and all steps up to S.
 */
const roundTripArb: fc.Arbitrary<{ state: WizardState; targetStep: number }> = fc
  .integer({ min: 4, max: 7 })
  .chain((currentStep) =>
    fc.integer({ min: 3, max: currentStep - 1 }).chain((targetStep) =>
      fc
        .record({
          alignment: fc.constantFrom('good' as const, 'evil' as const),
          factionId: nonEmptyStringArb,
          companyTypeId: nonEmptyStringArb,
          variantId: nonEmptyStringArb,
          companyName: nonEmptyStringArb,
          memberNames: stringRecordArb,
          leaderId: nonEmptyStringArb,
          sergeantIds: fc.array(nonEmptyStringArb, { minLength: 1, maxLength: 3 }),
          heroPaths: stringRecordArb,
          heroSpellChoices: stringRecordArb,
          goldPurchases: stringArrayRecordArb,
        })
        .map((fields) => ({
          state: {
            step: currentStep,
            // visitedSteps includes all steps from 0 to currentStep (no skips in this scenario)
            visitedSteps: Array.from({ length: currentStep + 1 }, (_, i) => i),
            ...fields,
          } satisfies WizardState,
          targetStep,
        }))
    )
  )

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 5: Round-trip navigation (targetStep >= 3, no downstream resets)', () => {
  /**
   * Property 5a: Round-trip restores the original step
   * After navigating back to t and forward to S, wizard.step === S
   * Validates: Requirements 2.3
   */
  it('round-trip restores the original step', () => {
    fc.assert(
      fc.property(roundTripArb, ({ state, targetStep }) => {
        const finalState = simulateRoundTrip(state, targetStep)
        expect(finalState).not.toBeNull()
        if (!finalState) return

        expect(finalState.step).toBe(state.step)
      }),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 5b: Round-trip preserves all state when targetStep >= 3
   * After back-then-forward navigation, all fields are identical to the original state.
   * Fields checked: alignment, factionId, companyTypeId, variantId, companyName,
   *   memberNames, leaderId, sergeantIds, heroPaths, heroSpellChoices, goldPurchases
   * Validates: Requirements 2.3
   */
  it('round-trip preserves all state fields when targetStep >= 3', () => {
    fc.assert(
      fc.property(roundTripArb, ({ state, targetStep }) => {
        const finalState = simulateRoundTrip(state, targetStep)
        expect(finalState).not.toBeNull()
        if (!finalState) return

        // All data fields must be identical to the original state
        expect(finalState.alignment).toBe(state.alignment)
        expect(finalState.factionId).toBe(state.factionId)
        expect(finalState.companyTypeId).toBe(state.companyTypeId)
        expect(finalState.variantId).toBe(state.variantId)
        expect(finalState.companyName).toBe(state.companyName)
        expect(finalState.memberNames).toEqual(state.memberNames)
        expect(finalState.leaderId).toBe(state.leaderId)
        expect(finalState.sergeantIds).toEqual(state.sergeantIds)
        expect(finalState.heroPaths).toEqual(state.heroPaths)
        expect(finalState.heroSpellChoices).toEqual(state.heroSpellChoices)
        expect(finalState.goldPurchases).toEqual(state.goldPurchases)
      }),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 5c: Round-trip preserves visitedSteps (no new entries added)
   * After the round trip, visitedSteps contains the same entries as before
   * (since all steps were already visited, no new entries should be added).
   * Validates: Requirements 2.3
   */
  it('round-trip preserves visitedSteps — no new entries added when all steps already visited', () => {
    fc.assert(
      fc.property(roundTripArb, ({ state, targetStep }) => {
        const finalState = simulateRoundTrip(state, targetStep)
        expect(finalState).not.toBeNull()
        if (!finalState) return

        // All steps in the original visitedSteps should still be present
        for (const step of state.visitedSteps) {
          expect(finalState.visitedSteps).toContain(step)
        }

        // No new steps should have been added (since all steps up to S were already visited)
        expect(finalState.visitedSteps.length).toBe(state.visitedSteps.length)
      }),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 5d: Round-trip is idempotent — doing it twice yields the same result
   * Navigating back and forward multiple times should not accumulate state changes.
   * Validates: Requirements 2.3
   */
  it('round-trip is idempotent — repeating the round trip yields the same state', () => {
    fc.assert(
      fc.property(roundTripArb, ({ state, targetStep }) => {
        const afterFirstTrip = simulateRoundTrip(state, targetStep)
        expect(afterFirstTrip).not.toBeNull()
        if (!afterFirstTrip) return

        const afterSecondTrip = simulateRoundTrip(afterFirstTrip, targetStep)
        expect(afterSecondTrip).not.toBeNull()
        if (!afterSecondTrip) return

        // Both trips should yield the same final state
        expect(afterSecondTrip.step).toBe(afterFirstTrip.step)
        expect(afterSecondTrip.alignment).toBe(afterFirstTrip.alignment)
        expect(afterSecondTrip.factionId).toBe(afterFirstTrip.factionId)
        expect(afterSecondTrip.companyTypeId).toBe(afterFirstTrip.companyTypeId)
        expect(afterSecondTrip.variantId).toBe(afterFirstTrip.variantId)
        expect(afterSecondTrip.companyName).toBe(afterFirstTrip.companyName)
        expect(afterSecondTrip.memberNames).toEqual(afterFirstTrip.memberNames)
        expect(afterSecondTrip.leaderId).toBe(afterFirstTrip.leaderId)
        expect(afterSecondTrip.sergeantIds).toEqual(afterFirstTrip.sergeantIds)
        expect(afterSecondTrip.heroPaths).toEqual(afterFirstTrip.heroPaths)
        expect(afterSecondTrip.heroSpellChoices).toEqual(afterFirstTrip.heroSpellChoices)
        expect(afterSecondTrip.goldPurchases).toEqual(afterFirstTrip.goldPurchases)
      }),
      { numRuns: 500 }
    )
  })
})
