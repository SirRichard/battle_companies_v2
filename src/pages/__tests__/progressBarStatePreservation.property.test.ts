// Feature: wizard-progress-bar-navigation, Property 4: State preservation on backward navigation

/**
 * Property 4: State preservation on backward navigation
 * Validates: Requirements 2.1, 2.2
 *
 * ∀ wizard state w at step S, ∀ targetStep t where t < S AND t ∈ w.visitedSteps:
 *   after handleProgressBarClick(t):
 *     - fields belonging to steps > t that are NOT downstream of t are unchanged
 *     - fields downstream of t (per the reset rules) are reset to null/empty
 *
 * Reset rules:
 *   targetStep <= 0: reset factionId, companyTypeId, variantId, memberNames, leaderId, sergeantIds, heroPaths, heroSpellChoices
 *   targetStep <= 1: reset companyTypeId, variantId, memberNames, leaderId, sergeantIds, heroPaths, heroSpellChoices
 *   targetStep <= 2: reset variantId, memberNames, leaderId, sergeantIds, heroPaths, heroSpellChoices
 *   targetStep >= 3: no resets
 *
 * Fields NOT reset (preserved regardless of targetStep):
 *   - alignment (step 0 selection — preserved even when jumping to step 0)
 *   - factionId (preserved when targetStep >= 1)
 *   - companyTypeId (preserved when targetStep >= 2)
 *   - companyName (never reset)
 *   - goldPurchases (never reset)
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { WizardState } from '../../models'

// ── Pure version of handleProgressBarClick logic ──────────────────────────────

/**
 * Pure function that mirrors the handleProgressBarClick logic from
 * CreateCompanyPage. Returns the new state after applying resets.
 */
function applyProgressBarClick(
  state: WizardState,
  targetStep: number
): WizardState | null {
  // Guard conditions — return null to indicate no-op
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

  // go(targetStep) sets step
  next.step = targetStep
  if (!next.visitedSteps.includes(targetStep)) {
    next.visitedSteps = [...next.visitedSteps, targetStep]
  }

  return next
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
    fc.tuple(nonEmptyStringArb, fc.array(nonEmptyStringArb, { minLength: 1, maxLength: 3 })),
    { minLength: 1, maxLength: 3 }
  )
  .map((pairs) => Object.fromEntries(pairs))

/**
 * Generates a fully-populated WizardState at a step >= 3 (so all fields have values).
 * visitedSteps includes 0, 1, 2, 3 and the current step.
 */
const populatedWizardArb: fc.Arbitrary<WizardState> = fc
  .integer({ min: 3, max: 7 })
  .chain((currentStep) =>
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
        step: currentStep,
        visitedSteps: [...new Set([0, 1, 2, 3, currentStep])],
        ...fields,
      } satisfies WizardState))
  )

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 4: State preservation on backward navigation', () => {
  /**
   * Property 4a: For targetStep === 0
   * - factionId, companyTypeId, variantId, memberNames, leaderId, sergeantIds,
   *   heroPaths, heroSpellChoices are all reset
   * - alignment and companyName are preserved
   * Validates: Requirements 2.1, 2.2
   */
  describe('targetStep === 0 (jumping to Alignment)', () => {
    it('resets all downstream fields when jumping to step 0', () => {
      fc.assert(
        fc.property(populatedWizardArb, (state) => {
          fc.pre(state.visitedSteps.includes(0))
          fc.pre(state.step > 0)

          const newState = applyProgressBarClick(state, 0)
          expect(newState).not.toBeNull()
          if (!newState) return

          // Fields that MUST be reset
          expect(newState.factionId).toBeNull()
          expect(newState.companyTypeId).toBeNull()
          expect(newState.variantId).toBeNull()
          expect(newState.memberNames).toEqual({})
          expect(newState.leaderId).toBeNull()
          expect(newState.sergeantIds).toEqual([])
          expect(newState.heroPaths).toEqual({})
          expect(newState.heroSpellChoices).toEqual({})
        }),
        { numRuns: 500 }
      )
    })

    it('preserves alignment and companyName when jumping to step 0', () => {
      fc.assert(
        fc.property(populatedWizardArb, (state) => {
          fc.pre(state.visitedSteps.includes(0))
          fc.pre(state.step > 0)

          const newState = applyProgressBarClick(state, 0)
          expect(newState).not.toBeNull()
          if (!newState) return

          // Fields that MUST be preserved
          expect(newState.alignment).toBe(state.alignment)
          expect(newState.companyName).toBe(state.companyName)
          expect(newState.goldPurchases).toEqual(state.goldPurchases)
        }),
        { numRuns: 500 }
      )
    })
  })

  /**
   * Property 4b: For targetStep === 1
   * - companyTypeId, variantId, memberNames, leaderId, sergeantIds,
   *   heroPaths, heroSpellChoices are reset
   * - alignment, factionId, companyName are preserved
   * Validates: Requirements 2.1, 2.2
   */
  describe('targetStep === 1 (jumping to Faction)', () => {
    it('resets downstream fields when jumping to step 1', () => {
      fc.assert(
        fc.property(populatedWizardArb, (state) => {
          fc.pre(state.visitedSteps.includes(1))
          fc.pre(state.step > 1)

          const newState = applyProgressBarClick(state, 1)
          expect(newState).not.toBeNull()
          if (!newState) return

          // Fields that MUST be reset
          expect(newState.companyTypeId).toBeNull()
          expect(newState.variantId).toBeNull()
          expect(newState.memberNames).toEqual({})
          expect(newState.leaderId).toBeNull()
          expect(newState.sergeantIds).toEqual([])
          expect(newState.heroPaths).toEqual({})
          expect(newState.heroSpellChoices).toEqual({})
        }),
        { numRuns: 500 }
      )
    })

    it('preserves alignment, factionId, and companyName when jumping to step 1', () => {
      fc.assert(
        fc.property(populatedWizardArb, (state) => {
          fc.pre(state.visitedSteps.includes(1))
          fc.pre(state.step > 1)

          const newState = applyProgressBarClick(state, 1)
          expect(newState).not.toBeNull()
          if (!newState) return

          // Fields that MUST be preserved
          expect(newState.alignment).toBe(state.alignment)
          expect(newState.factionId).toBe(state.factionId)
          expect(newState.companyName).toBe(state.companyName)
          expect(newState.goldPurchases).toEqual(state.goldPurchases)
        }),
        { numRuns: 500 }
      )
    })
  })

  /**
   * Property 4c: For targetStep === 2
   * - variantId, memberNames, leaderId, sergeantIds, heroPaths, heroSpellChoices are reset
   * - alignment, factionId, companyTypeId, companyName are preserved
   * Validates: Requirements 2.1, 2.2
   */
  describe('targetStep === 2 (jumping to Company)', () => {
    it('resets downstream fields when jumping to step 2', () => {
      fc.assert(
        fc.property(populatedWizardArb, (state) => {
          fc.pre(state.visitedSteps.includes(2))
          fc.pre(state.step > 2)

          const newState = applyProgressBarClick(state, 2)
          expect(newState).not.toBeNull()
          if (!newState) return

          // Fields that MUST be reset
          expect(newState.variantId).toBeNull()
          expect(newState.memberNames).toEqual({})
          expect(newState.leaderId).toBeNull()
          expect(newState.sergeantIds).toEqual([])
          expect(newState.heroPaths).toEqual({})
          expect(newState.heroSpellChoices).toEqual({})
        }),
        { numRuns: 500 }
      )
    })

    it('preserves alignment, factionId, companyTypeId, and companyName when jumping to step 2', () => {
      fc.assert(
        fc.property(populatedWizardArb, (state) => {
          fc.pre(state.visitedSteps.includes(2))
          fc.pre(state.step > 2)

          const newState = applyProgressBarClick(state, 2)
          expect(newState).not.toBeNull()
          if (!newState) return

          // Fields that MUST be preserved
          expect(newState.alignment).toBe(state.alignment)
          expect(newState.factionId).toBe(state.factionId)
          expect(newState.companyTypeId).toBe(state.companyTypeId)
          expect(newState.companyName).toBe(state.companyName)
          expect(newState.goldPurchases).toEqual(state.goldPurchases)
        }),
        { numRuns: 500 }
      )
    })
  })

  /**
   * Property 4d: For targetStep >= 3
   * - NO fields are reset (all preserved)
   * Validates: Requirements 2.1, 2.2
   */
  describe('targetStep >= 3 (jumping to Name, Members, Command, Paths)', () => {
    it('preserves ALL fields when jumping to step 3 or higher', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 7 }).chain((currentStep) =>
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
                    visitedSteps: [...new Set([0, 1, 2, 3, targetStep, currentStep])],
                    ...fields,
                  } satisfies WizardState,
                  targetStep,
                }))
            )
          ),
          ({ state, targetStep }) => {
            const newState = applyProgressBarClick(state, targetStep)
            expect(newState).not.toBeNull()
            if (!newState) return

            // ALL fields must be preserved — no resets for steps 3+
            expect(newState.alignment).toBe(state.alignment)
            expect(newState.factionId).toBe(state.factionId)
            expect(newState.companyTypeId).toBe(state.companyTypeId)
            expect(newState.variantId).toBe(state.variantId)
            expect(newState.companyName).toBe(state.companyName)
            expect(newState.memberNames).toEqual(state.memberNames)
            expect(newState.leaderId).toBe(state.leaderId)
            expect(newState.sergeantIds).toEqual(state.sergeantIds)
            expect(newState.heroPaths).toEqual(state.heroPaths)
            expect(newState.heroSpellChoices).toEqual(state.heroSpellChoices)
            expect(newState.goldPurchases).toEqual(state.goldPurchases)
          }
        ),
        { numRuns: 1000 }
      )
    })
  })

  /**
   * Property 4e: goldPurchases is NEVER reset regardless of targetStep
   * Validates: Requirements 2.1
   */
  it('goldPurchases is never reset for any valid backward navigation', () => {
    fc.assert(
      fc.property(
        populatedWizardArb,
        fc.integer({ min: 0, max: 7 }),
        (state, targetStep) => {
          fc.pre(targetStep < state.step)
          fc.pre(state.visitedSteps.includes(targetStep))

          const newState = applyProgressBarClick(state, targetStep)
          expect(newState).not.toBeNull()
          if (!newState) return

          expect(newState.goldPurchases).toEqual(state.goldPurchases)
        }
      ),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 4f: alignment is NEVER reset regardless of targetStep
   * (even when jumping to step 0, alignment is preserved so the user can see their choice)
   * Validates: Requirements 2.1
   */
  it('alignment is never reset for any valid backward navigation', () => {
    fc.assert(
      fc.property(
        populatedWizardArb,
        fc.integer({ min: 0, max: 7 }),
        (state, targetStep) => {
          fc.pre(targetStep < state.step)
          fc.pre(state.visitedSteps.includes(targetStep))

          const newState = applyProgressBarClick(state, targetStep)
          expect(newState).not.toBeNull()
          if (!newState) return

          expect(newState.alignment).toBe(state.alignment)
        }
      ),
      { numRuns: 1000 }
    )
  })

  /**
   * Property 4g: companyName is NEVER reset regardless of targetStep
   * Validates: Requirements 2.1
   */
  it('companyName is never reset for any valid backward navigation', () => {
    fc.assert(
      fc.property(
        populatedWizardArb,
        fc.integer({ min: 0, max: 7 }),
        (state, targetStep) => {
          fc.pre(targetStep < state.step)
          fc.pre(state.visitedSteps.includes(targetStep))

          const newState = applyProgressBarClick(state, targetStep)
          expect(newState).not.toBeNull()
          if (!newState) return

          expect(newState.companyName).toBe(state.companyName)
        }
      ),
      { numRuns: 1000 }
    )
  })
})
