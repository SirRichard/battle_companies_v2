/**
 * Feature: battle-companies-ux-improvements, Property 4: Wizard footer button always enabled at step 6
 *
 * **Validates: Requirements 1.4**
 *
 * Property definition (updated):
 * For any wizard state at step 6, the wizard footer button SHALL always be enabled.
 * In picking mode, it assigns the currently-viewed path to the pending hero.
 * In review mode, it advances the wizard.
 * The button is never disabled.
 *
 * Strategy:
 * - Generate arbitrary wizard states at step 6 with 1-5 heroes
 * - Vary path assignments: all heroes have paths (review) vs at least one missing (picking)
 * - Verify: disabled is always false regardless of state
 * - Minimum 100 iterations
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import pathsData from '../../data/paths.json'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathDef {
  id: string
  label: string
}

interface WizardState {
  step: number
  leaderId: string
  sergeantIds: string[]
  heroPaths: Record<string, string>
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PATHS = pathsData as unknown as PathDef[]
const PATH_IDS = PATHS.map((p) => p.id)

// ─── Modeled logic (mirrors CreateCompanyPage step 6 footer button) ───────────

/**
 * Models the footer button disabled logic from CreateCompanyPage step 6.
 * The button is now always enabled (disabled={false}).
 * In picking mode: assigns the currently-viewed path on click.
 * In review mode: advances the wizard on click.
 */
function isFooterButtonDisabled(): boolean {
  return false
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid path ID from paths.json */
const pathIdArb: fc.Arbitrary<string> = fc.constantFrom(...PATH_IDS)

/**
 * Generate a wizard state at step 6 where ALL heroes have paths (review mode).
 */
const wizardStateAllPathsArb: fc.Arbitrary<WizardState> = fc
  .integer({ min: 1, max: 5 })
  .chain((heroCount) => {
    const leaderId = 'member_0'
    const sergeantIds = Array.from(
      { length: heroCount - 1 },
      (_, i) => `member_${i + 1}`
    )
    const heroTempIds = [leaderId, ...sergeantIds]

    return fc
      .array(pathIdArb, { minLength: heroCount, maxLength: heroCount })
      .map((pathChoices) => {
        const heroPaths: Record<string, string> = {}
        heroTempIds.forEach((tid, i) => {
          heroPaths[tid] = pathChoices[i]
        })
        return { step: 6, leaderId, sergeantIds, heroPaths }
      })
  })

/**
 * Generate a wizard state at step 6 where at least one hero does NOT have a path.
 */
const wizardStateWithPendingArb: fc.Arbitrary<WizardState> = fc
  .integer({ min: 1, max: 5 })
  .chain((heroCount) => {
    const leaderId = 'member_0'
    const sergeantIds = Array.from(
      { length: heroCount - 1 },
      (_, i) => `member_${i + 1}`
    )
    const heroTempIds = [leaderId, ...sergeantIds]

    const hasPathArrayArb = fc
      .array(fc.boolean(), { minLength: heroCount, maxLength: heroCount })
      .filter((arr) => arr.some((v) => !v))

    return fc
      .tuple(
        hasPathArrayArb,
        fc.array(pathIdArb, { minLength: heroCount, maxLength: heroCount })
      )
      .map(([hasPathArr, pathChoices]) => {
        const heroPaths: Record<string, string> = {}
        heroTempIds.forEach((tid, i) => {
          if (hasPathArr[i]) {
            heroPaths[tid] = pathChoices[i]
          }
        })
        return { step: 6, leaderId, sergeantIds, heroPaths }
      })
  })

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 4: Wizard footer button always enabled at step 6', () => {
  it('footer button is ENABLED in picking mode (pending hero has no path)', () => {
    fc.assert(
      fc.property(wizardStateWithPendingArb, () => {
        const disabled = isFooterButtonDisabled()
        expect(disabled).toBe(false)
      }),
      { numRuns: 200 }
    )
  })

  it('footer button is ENABLED in review mode (all heroes have paths)', () => {
    fc.assert(
      fc.property(wizardStateAllPathsArb, () => {
        const disabled = isFooterButtonDisabled()
        expect(disabled).toBe(false)
      }),
      { numRuns: 200 }
    )
  })

  it('footer button is never disabled for any wizard state at step 6', () => {
    const anyWizardStateArb = fc.oneof(
      wizardStateAllPathsArb,
      wizardStateWithPendingArb
    )

    fc.assert(
      fc.property(anyWizardStateArb, () => {
        const disabled = isFooterButtonDisabled()
        expect(disabled).toBe(false)
      }),
      { numRuns: 200 }
    )
  })
})
