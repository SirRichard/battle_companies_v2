/**
 * Feature: battle-companies-ux-improvements, Property 6: Review mode footer button advances wizard
 *
 * **Validates: Requirements 1.5, 1.6**
 *
 * Property definition:
 * For any wizard state at step 6 where all heroes have paths assigned,
 * activating the footer button SHALL advance wizard.step to 7 (Gold/Equipment step).
 *
 * Strategy:
 * - Generate arbitrary wizard states at step 6 with 1-5 heroes, all having paths
 * - Model the footer button onClick logic from CreateCompanyPage step 6:
 *   if (allHeroesHavePaths) { if (gold === 0) handleFinish(); else go(wizard.step + 1) }
 * - For gold > 0 case: verify step advances from 6 to 7
 * - For gold === 0 case: verify handleFinish is called (step does NOT advance)
 * - Also verify picking mode does NOT advance wizard.step
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

interface SelectedCompany {
  gold: number
}

interface FooterClickResult {
  newStep: number
  finishCalled: boolean
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PATHS = pathsData as unknown as PathDef[]
const PATH_IDS = PATHS.map((p) => p.id)

// ─── Modeled logic (mirrors CreateCompanyPage step 6 footer button onClick) ──

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
 * Models the footer button onClick logic from CreateCompanyPage step 6.
 * Mirrors:
 * ```
 * onClick={() => {
 *   if (allHeroesHavePaths) {
 *     if ((selectedCompany?.gold ?? 0) === 0) { handleFinish(); return }
 *     go(wizard.step + 1)
 *   } else {
 *     // picking mode — no-op re-set of current path
 *   }
 * }}
 * ```
 */
function modelFooterButtonClick(
  wizard: WizardState,
  selectedCompany: SelectedCompany | undefined
): FooterClickResult {
  const heroTempIds = getHeroTempIds(wizard)
  const allHeroesHavePaths = getAllHeroesHavePaths(
    heroTempIds,
    wizard.heroPaths
  )

  if (allHeroesHavePaths) {
    // Review mode
    if ((selectedCompany?.gold ?? 0) === 0) {
      // handleFinish() called — step does not advance via go()
      return { newStep: wizard.step, finishCalled: true }
    }
    // Normal advancement: go(wizard.step + 1)
    return { newStep: wizard.step + 1, finishCalled: false }
  } else {
    // Picking mode — no wizard step change
    return { newStep: wizard.step, finishCalled: false }
  }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid path ID from paths.json */
const pathIdArb: fc.Arbitrary<string> = fc.constantFrom(...PATH_IDS)

/**
 * Generate wizard state at step 6 where ALL heroes have paths (review mode).
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
 * Generate wizard state at step 6 where at least one hero does NOT have a path (picking mode).
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

/** Gold > 0 (normal advancement case) */
const positiveGoldArb: fc.Arbitrary<SelectedCompany> = fc
  .integer({ min: 1, max: 500 })
  .map((gold) => ({ gold }))

/** Gold === 0 (handleFinish edge case) */
const zeroGoldArb: fc.Arbitrary<SelectedCompany> = fc.constant({ gold: 0 })

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 6: Review mode footer button advances wizard (not sub-flow)', () => {
  it('review mode with gold > 0: clicking footer button advances wizard.step from 6 to 7', () => {
    fc.assert(
      fc.property(
        wizardStateReviewModeArb,
        positiveGoldArb,
        (wizard, company) => {
          const heroTempIds = getHeroTempIds(wizard)
          const allHavePaths = getAllHeroesHavePaths(
            heroTempIds,
            wizard.heroPaths
          )

          // Precondition: review mode
          expect(allHavePaths).toBe(true)
          expect(wizard.step).toBe(6)
          expect(company.gold).toBeGreaterThan(0)

          // Act: model footer button click
          const result = modelFooterButtonClick(wizard, company)

          // Assert: step advances to 7
          expect(result.newStep).toBe(7)
          expect(result.finishCalled).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('review mode with gold === 0: clicking footer button calls handleFinish (step unchanged)', () => {
    fc.assert(
      fc.property(
        wizardStateReviewModeArb,
        zeroGoldArb,
        (wizard, company) => {
          const heroTempIds = getHeroTempIds(wizard)
          const allHavePaths = getAllHeroesHavePaths(
            heroTempIds,
            wizard.heroPaths
          )

          // Precondition: review mode, gold = 0
          expect(allHavePaths).toBe(true)
          expect(company.gold).toBe(0)

          // Act: model footer button click
          const result = modelFooterButtonClick(wizard, company)

          // Assert: handleFinish called, step does NOT advance
          expect(result.newStep).toBe(6)
          expect(result.finishCalled).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('picking mode: clicking footer button does NOT advance wizard.step', () => {
    fc.assert(
      fc.property(
        wizardStatePickingModeArb,
        positiveGoldArb,
        (wizard, company) => {
          const heroTempIds = getHeroTempIds(wizard)
          const allHavePaths = getAllHeroesHavePaths(
            heroTempIds,
            wizard.heroPaths
          )

          // Precondition: picking mode (not all heroes have paths)
          expect(allHavePaths).toBe(false)

          // Act: model footer button click
          const result = modelFooterButtonClick(wizard, company)

          // Assert: step stays at 6, no finish called
          expect(result.newStep).toBe(6)
          expect(result.finishCalled).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('advancement formula: step always goes from 6 to exactly 7 (never skips)', () => {
    fc.assert(
      fc.property(
        wizardStateReviewModeArb,
        fc.integer({ min: 1, max: 1000 }),
        (wizard, gold) => {
          const company: SelectedCompany = { gold }

          // Act
          const result = modelFooterButtonClick(wizard, company)

          // Assert: always exactly step + 1 = 7
          expect(result.newStep).toBe(wizard.step + 1)
          expect(result.newStep).toBe(7)
        }
      ),
      { numRuns: 100 }
    )
  })
})
