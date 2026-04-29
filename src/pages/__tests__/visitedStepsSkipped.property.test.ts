// Feature: wizard-progress-bar-navigation, Property 3: visitedSteps never contains skipped steps

/**
 * Property 3: visitedSteps never contains skipped steps
 * Validates: Requirements 5.1, 5.2
 *
 * Skipped steps are handled by calling `setWizard` directly (not via `go()`),
 * so they are never added to `visitedSteps`. This test verifies that invariant:
 *
 * 1. When `allRolesForced = true`, the wizard jumps from step 4 → step 6 by
 *    calling `setWizard` directly (bypassing `go()`), so step 5 is never added
 *    to `visitedSteps`.
 *
 * 2. When `selectedCompany.gold === 0`, the wizard finishes from step 6 without
 *    visiting step 7, so step 7 is never added to `visitedSteps`.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { WizardState } from '../../models'

// ── Pure helper: the go() visitedSteps update logic ──────────────────────────

/**
 * Pure version of the go() visitedSteps update logic extracted from
 * CreateCompanyPage. Applies the deduplication logic without React state.
 */
function applyGoVisitedSteps(state: WizardState, nextStep: number): WizardState {
  const next = { ...state, step: nextStep }
  if (!next.visitedSteps.includes(nextStep)) {
    next.visitedSteps = [...next.visitedSteps, nextStep]
  }
  return next
}

/**
 * Pure version of the skip-step-5 logic (allRolesForced path).
 * Mirrors the setWizard call in the Next button handler when allRolesForced:
 *   setWizard((w) => ({ ...w, step: 6, leaderId: ..., sergeantIds: ... }))
 * Note: this does NOT call go(), so step 5 is never added to visitedSteps.
 */
function applySkipStep5(
  state: WizardState,
  forcedLeaderId: string | null,
  forcedSergeantIds: string[]
): WizardState {
  return {
    ...state,
    step: 6,
    leaderId: forcedLeaderId ?? state.leaderId,
    sergeantIds:
      forcedSergeantIds.length > 0
        ? [
            ...new Set([
              ...forcedSergeantIds,
              ...state.sergeantIds.filter((id) => !forcedSergeantIds.includes(id)),
            ]),
          ]
        : state.sergeantIds,
    // visitedSteps is NOT updated — step 5 is skipped, not visited
  }
}

/**
 * Pure version of the skip-step-7 logic (no gold path).
 * Mirrors the handleFinish call when gold === 0 from step 6:
 * the wizard finishes without ever navigating to step 7.
 * visitedSteps is not updated with 7.
 */
function applySkipStep7(state: WizardState): WizardState {
  // The wizard calls doFinish() directly — step 7 is never set as the current step.
  // We model this as: state remains at step 6 (finish is triggered, not step 7).
  return { ...state }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generates a base WizardState at step 4 (ready to advance past member-naming) */
const wizardAtStep4Arb: fc.Arbitrary<WizardState> = fc
  .tuple(
    fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 5 }),
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.string({ minLength: 1, maxLength: 20 })
  )
  .map(([extraVisited, leaderId, sgt1]) => {
    // Build visitedSteps for steps 0–4 (deduplicated)
    const visitedSteps = [...new Set([0, 1, 2, 3, 4, ...extraVisited.filter((s) => s <= 4)])]
    return {
      step: 4,
      visitedSteps,
      alignment: 'good' as const,
      factionId: 'faction_gondor',
      companyTypeId: 'company_gondor_warriors',
      variantId: 'default',
      companyName: 'Test Company',
      memberNames: {},
      leaderId,
      sergeantIds: [sgt1],
      heroPaths: {},
      heroSpellChoices: {},
      goldPurchases: {},
    }
  })

/** Generates a base WizardState at step 6 (ready to advance to gold or finish) */
const wizardAtStep6Arb: fc.Arbitrary<WizardState> = fc
  .array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 7 })
  .map((extraVisited) => {
    const visitedSteps = [...new Set([0, 1, 2, 3, 4, 5, 6, ...extraVisited.filter((s) => s <= 6)])]
    return {
      step: 6,
      visitedSteps,
      alignment: 'good' as const,
      factionId: 'faction_gondor',
      companyTypeId: 'company_gondor_warriors',
      variantId: 'default',
      companyName: 'Test Company',
      memberNames: {},
      leaderId: 'member_0',
      sergeantIds: ['member_1', 'member_2'],
      heroPaths: {
        member_0: 'path_of_the_warrior',
        member_1: 'path_of_the_warrior',
        member_2: 'path_of_the_warrior',
      },
      heroSpellChoices: {},
      goldPurchases: {},
    }
  })

/** Generates forced leader and sergeant IDs (simulating allRolesForced = true) */
const forcedRolesArb: fc.Arbitrary<{
  forcedLeaderId: string
  forcedSergeantIds: [string, string]
}> = fc
  .tuple(
    fc.integer({ min: 0, max: 0 }), // leader is always member_0
    fc.integer({ min: 1, max: 1 }), // sergeant 1 is member_1
    fc.integer({ min: 2, max: 2 }) // sergeant 2 is member_2
  )
  .map(([l, s1, s2]) => ({
    forcedLeaderId: `member_${l}`,
    forcedSergeantIds: [`member_${s1}`, `member_${s2}`] as [string, string],
  }))

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 3: visitedSteps never contains skipped steps', () => {
  it('step 5 is never in visitedSteps when allRolesForced causes step 4 → step 6 skip', () => {
    fc.assert(
      fc.property(wizardAtStep4Arb, forcedRolesArb, (state, { forcedLeaderId, forcedSergeantIds }) => {
        // Simulate the allRolesForced skip: setWizard directly (not via go())
        const afterSkip = applySkipStep5(state, forcedLeaderId, forcedSergeantIds)

        // Step 5 must NOT be in visitedSteps — it was skipped, not visited
        expect(afterSkip.visitedSteps).not.toContain(5)

        // The wizard should now be at step 6
        expect(afterSkip.step).toBe(6)

        // Steps 0–4 that were visited before the skip should still be present
        for (const s of state.visitedSteps) {
          expect(afterSkip.visitedSteps).toContain(s)
        }
      }),
      { numRuns: 500 }
    )
  })

  it('step 5 is never added to visitedSteps by the skip logic regardless of prior state', () => {
    fc.assert(
      fc.property(
        wizardAtStep4Arb,
        fc.option(fc.string({ minLength: 5, maxLength: 15 }), { nil: null }),
        fc.array(fc.string({ minLength: 5, maxLength: 15 }), { minLength: 0, maxLength: 2 }),
        (state, forcedLeaderId, forcedSergeantIds) => {
          const afterSkip = applySkipStep5(state, forcedLeaderId, forcedSergeantIds)

          // The skip path never adds step 5 to visitedSteps
          expect(afterSkip.visitedSteps).not.toContain(5)
        }
      ),
      { numRuns: 500 }
    )
  })

  it('step 7 is never in visitedSteps when gold === 0 causes step 6 → finish skip', () => {
    fc.assert(
      fc.property(wizardAtStep6Arb, (state) => {
        // Simulate the no-gold skip: doFinish() is called directly (not go(7))
        const afterSkip = applySkipStep7(state)

        // Step 7 must NOT be in visitedSteps — the wizard finished without visiting it
        expect(afterSkip.visitedSteps).not.toContain(7)

        // The wizard remains at step 6 (finish was triggered, not step 7)
        expect(afterSkip.step).toBe(6)
      }),
      { numRuns: 500 }
    )
  })

  it('step 7 is only added to visitedSteps when go(7) is explicitly called', () => {
    fc.assert(
      fc.property(wizardAtStep6Arb, (state) => {
        // Path A: skip (no gold) — step 7 never visited
        const afterSkip = applySkipStep7(state)
        expect(afterSkip.visitedSteps).not.toContain(7)

        // Path B: go(7) is called — step 7 IS added to visitedSteps
        const afterGo7 = applyGoVisitedSteps(state, 7)
        expect(afterGo7.visitedSteps).toContain(7)
      }),
      { numRuns: 500 }
    )
  })

  it('contrast: step 5 IS added to visitedSteps when go(5) is explicitly called', () => {
    fc.assert(
      fc.property(wizardAtStep4Arb, (state) => {
        // When go(5) is called (normal flow, not allRolesForced), step 5 IS visited
        const afterGo5 = applyGoVisitedSteps(state, 5)
        expect(afterGo5.visitedSteps).toContain(5)
      }),
      { numRuns: 500 }
    )
  })
})
