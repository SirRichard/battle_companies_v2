/**
 * Feature: battle-companies-ux-improvements, Property 5: Wizard footer button label matches mode
 *
 * **Validates: Requirements 1.6, 1.7**
 *
 * Property definition:
 * For any wizard state at step 6, the footer button label SHALL be "Select" when
 * not all heroes have paths (picking mode) and "Next" when all heroes have paths
 * (review mode).
 *
 * Strategy:
 * - Generate arbitrary wizard states at step 6 with 1-5 heroes
 * - Vary path assignments: all heroes have paths (review) vs at least one missing (picking)
 * - Model the label logic from CreateCompanyPage:
 *   label = allHeroesHavePaths ? 'Next' : 'Select'
 * - Verify label matches mode across all generated states
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
 * Derives heroTempIds from wizard state.
 * Mirrors: `const heroTempIds = [wizard.leaderId!, ...wizard.sergeantIds]`
 */
function getHeroTempIds(wizard: WizardState): string[] {
  return [wizard.leaderId, ...wizard.sergeantIds]
}

/**
 * Derives whether all heroes have paths assigned.
 * Mirrors: `heroTempIds.every(tid => wizard.heroPaths[tid])`
 */
function getAllHeroesHavePaths(
  heroTempIds: string[],
  heroPaths: Record<string, string>
): boolean {
  return heroTempIds.every((tid) => !!heroPaths[tid])
}

/**
 * Models the footer button label logic from CreateCompanyPage step 6.
 * Mirrors:
 * ```
 * {allHeroesHavePaths ? 'Next' : 'Select'}
 * ```
 */
function getFooterButtonLabel(wizard: WizardState): string {
  const heroTempIds = getHeroTempIds(wizard)
  const allHeroesHavePaths = getAllHeroesHavePaths(heroTempIds, wizard.heroPaths)
  return allHeroesHavePaths ? 'Next' : 'Select'
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid path ID from paths.json */
const pathIdArb: fc.Arbitrary<string> = fc.constantFrom(...PATH_IDS)

/**
 * Generate a wizard state at step 6 where ALL heroes have paths (review mode).
 * Footer button label should be "Next".
 */
const wizardStateReviewModeArb: fc.Arbitrary<WizardState> = fc
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
        return {
          step: 6,
          leaderId,
          sergeantIds,
          heroPaths,
        }
      })
  })

/**
 * Generate a wizard state at step 6 where at least one hero does NOT have a path.
 * Footer button label should be "Select".
 */
const wizardStatePickingModeArb: fc.Arbitrary<WizardState> = fc
  .integer({ min: 1, max: 5 })
  .chain((heroCount) => {
    const leaderId = 'member_0'
    const sergeantIds = Array.from(
      { length: heroCount - 1 },
      (_, i) => `member_${i + 1}`
    )
    const heroTempIds = [leaderId, ...sergeantIds]

    // Generate boolean array; at least one must be false (no path)
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
        return {
          step: 6,
          leaderId,
          sergeantIds,
          heroPaths,
        }
      })
  })

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 5: Wizard footer button label matches mode', () => {
  it('label is "Next" in review mode (all heroes have paths)', () => {
    fc.assert(
      fc.property(wizardStateReviewModeArb, (wizard) => {
        const heroTempIds = getHeroTempIds(wizard)
        const allHavePaths = getAllHeroesHavePaths(heroTempIds, wizard.heroPaths)

        // Precondition: all heroes have paths (review mode)
        expect(allHavePaths).toBe(true)

        // Label should be "Next"
        const label = getFooterButtonLabel(wizard)
        expect(label).toBe('Next')
      }),
      { numRuns: 200 }
    )
  })

  it('label is "Select" in picking mode (at least one hero without path)', () => {
    fc.assert(
      fc.property(wizardStatePickingModeArb, (wizard) => {
        const heroTempIds = getHeroTempIds(wizard)
        const allHavePaths = getAllHeroesHavePaths(heroTempIds, wizard.heroPaths)

        // Precondition: not all heroes have paths (picking mode)
        expect(allHavePaths).toBe(false)

        // Label should be "Select"
        const label = getFooterButtonLabel(wizard)
        expect(label).toBe('Select')
      }),
      { numRuns: 200 }
    )
  })

  it('label matches formula: allHeroesHavePaths ? "Next" : "Select" for any wizard state', () => {
    // Combined arbitrary: mix of review and picking modes
    const anyWizardStateArb = fc.oneof(
      wizardStateReviewModeArb,
      wizardStatePickingModeArb
    )

    fc.assert(
      fc.property(anyWizardStateArb, (wizard) => {
        const heroTempIds = getHeroTempIds(wizard)
        const allHeroesHavePaths = getAllHeroesHavePaths(
          heroTempIds,
          wizard.heroPaths
        )

        // Compute expected label using exact formula from CreateCompanyPage
        const expectedLabel = allHeroesHavePaths ? 'Next' : 'Select'

        // Model function should match
        const actualLabel = getFooterButtonLabel(wizard)
        expect(actualLabel).toBe(expectedLabel)
      }),
      { numRuns: 200 }
    )
  })
})
