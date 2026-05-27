/**
 * Feature: battle-companies-ux-improvements, Property 3: Path sub-flow advances on selection
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property definition:
 * For any wizard state at step 6 with N heroes requiring paths, when onSelect(pathId)
 * is called for the current pending hero, the wizard state SHALL have
 * heroPaths[currentHero] = pathId and the next derived pendingHeroTempId SHALL be
 * the next hero without a path (or undefined if all heroes now have paths, triggering
 * review mode).
 *
 * Strategy:
 * - Generate arbitrary: number of heroes (1-5), which heroes already have paths, which path is selected
 * - Model the wizard state logic:
 *   - heroTempIds = [leaderId, ...sergeantIds]
 *   - pendingHeroTempId = heroTempIds.find(tid => !heroPaths[tid])
 *   - When onSelect(pathId) is called: heroPaths[pendingHeroTempId] = pathId
 *   - After update: new pendingHeroTempId = heroTempIds.find(tid => !updatedHeroPaths[tid])
 *   - If new pendingHeroTempId is undefined → review mode (all heroes have paths)
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

// ─── Modeled logic (mirrors CreateCompanyPage step 6) ─────────────────────────

/**
 * Derives heroTempIds from wizard state.
 * Mirrors: `const heroTempIds = [wizard.leaderId!, ...wizard.sergeantIds]`
 */
function getHeroTempIds(wizard: WizardState): string[] {
  return [wizard.leaderId, ...wizard.sergeantIds]
}

/**
 * Derives the pending hero (first hero without a path).
 * Mirrors: `heroTempIds.find(tid => !wizard.heroPaths[tid])`
 *
 * Note: In the real code, sorcerer path also checks for spell choice.
 * This property focuses on the path assignment sub-flow only (non-sorcerer paths).
 */
function getPendingHeroTempId(
  heroTempIds: string[],
  heroPaths: Record<string, string>
): string | undefined {
  return heroTempIds.find((tid) => !heroPaths[tid])
}

/**
 * Models the onSelect handler effect.
 * Mirrors: `setWizard(w => ({ ...w, heroPaths: { ...w.heroPaths, [pendingHeroTempId]: pathId } }))`
 */
function applyOnSelect(
  heroPaths: Record<string, string>,
  pendingHeroTempId: string,
  pathId: string
): Record<string, string> {
  return { ...heroPaths, [pendingHeroTempId]: pathId }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid path ID from paths.json */
const pathIdArb: fc.Arbitrary<string> = fc.constantFrom(...PATH_IDS)

/**
 * Generate a wizard state at step 6 with 1-5 heroes, where at least one hero
 * does NOT have a path yet (so pendingHeroTempId is defined).
 *
 * Structure:
 * - leaderId = "member_0"
 * - sergeantIds = ["member_1", ..., "member_{N-1}"] (0-4 sergeants, total heroes 1-5)
 * - heroPaths: some heroes may already have paths assigned, but at least one does not
 */
const wizardStateWithPendingArb: fc.Arbitrary<{
  wizard: WizardState
  selectedPathId: string
}> = fc
  .integer({ min: 1, max: 5 })
  .chain((heroCount) => {
    const leaderId = 'member_0'
    const sergeantIds = Array.from(
      { length: heroCount - 1 },
      (_, i) => `member_${i + 1}`
    )
    const heroTempIds = [leaderId, ...sergeantIds]

    // Generate a boolean array indicating which heroes already have paths.
    // At least one must be false (no path) so there's a pending hero.
    const hasPathArrayArb = fc
      .array(fc.boolean(), {
        minLength: heroCount,
        maxLength: heroCount,
      })
      .filter((arr) => arr.some((v) => !v)) // at least one hero without path

    return fc.tuple(hasPathArrayArb, fc.array(pathIdArb, { minLength: heroCount, maxLength: heroCount }), pathIdArb).map(
      ([hasPathArr, pathChoices, selectedPathId]) => {
        const heroPaths: Record<string, string> = {}
        heroTempIds.forEach((tid, i) => {
          if (hasPathArr[i]) {
            heroPaths[tid] = pathChoices[i]
          }
        })

        return {
          wizard: {
            step: 6,
            leaderId,
            sergeantIds,
            heroPaths,
          },
          selectedPathId,
        }
      }
    )
  })

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 3: Path sub-flow advances on selection (onSelect sets path and derived state advances)', () => {
  it('onSelect(pathId) sets heroPaths[currentHero] = pathId and pendingHeroTempId advances to next hero without path', () => {
    fc.assert(
      fc.property(wizardStateWithPendingArb, ({ wizard, selectedPathId }) => {
        const heroTempIds = getHeroTempIds(wizard)

        // Derive current pending hero
        const pendingBefore = getPendingHeroTempId(heroTempIds, wizard.heroPaths)
        expect(pendingBefore).toBeDefined()

        // Apply onSelect
        const updatedHeroPaths = applyOnSelect(
          wizard.heroPaths,
          pendingBefore!,
          selectedPathId
        )

        // Assertion 1: heroPaths[currentHero] === pathId
        expect(updatedHeroPaths[pendingBefore!]).toBe(selectedPathId)

        // Derive new pending hero after update
        const pendingAfter = getPendingHeroTempId(heroTempIds, updatedHeroPaths)

        // Assertion 2: new pending is the NEXT hero without a path (in order)
        const expectedNextPending = heroTempIds.find(
          (tid) => !updatedHeroPaths[tid]
        )
        expect(pendingAfter).toBe(expectedNextPending)

        // Assertion 3: if pendingAfter is undefined, all heroes have paths (review mode)
        if (pendingAfter === undefined) {
          heroTempIds.forEach((tid) => {
            expect(updatedHeroPaths[tid]).toBeDefined()
          })
        }

        // Assertion 4: pendingAfter is never the same hero we just assigned
        // (because that hero now has a path)
        if (pendingAfter !== undefined) {
          expect(pendingAfter).not.toBe(pendingBefore)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('when all heroes have paths after onSelect, review mode is triggered (pendingHeroTempId === undefined)', () => {
    // Generate state where exactly one hero is missing a path (the pending one)
    const singlePendingArb = fc
      .integer({ min: 1, max: 5 })
      .chain((heroCount) => {
        const leaderId = 'member_0'
        const sergeantIds = Array.from(
          { length: heroCount - 1 },
          (_, i) => `member_${i + 1}`
        )
        const heroTempIds = [leaderId, ...sergeantIds]

        // Pick which hero is the one without a path
        return fc
          .tuple(
            fc.integer({ min: 0, max: heroCount - 1 }),
            fc.array(pathIdArb, { minLength: heroCount, maxLength: heroCount }),
            pathIdArb
          )
          .map(([pendingIdx, pathChoices, selectedPathId]) => {
            const heroPaths: Record<string, string> = {}
            heroTempIds.forEach((tid, i) => {
              if (i !== pendingIdx) {
                heroPaths[tid] = pathChoices[i]
              }
            })
            return {
              wizard: {
                step: 6,
                leaderId,
                sergeantIds,
                heroPaths,
              } as WizardState,
              selectedPathId,
              heroTempIds,
              pendingIdx,
            }
          })
      })

    fc.assert(
      fc.property(singlePendingArb, ({ wizard, selectedPathId, heroTempIds, pendingIdx }) => {
        const pendingHero = heroTempIds[pendingIdx]

        // Verify this is indeed the pending hero
        expect(wizard.heroPaths[pendingHero]).toBeUndefined()

        // Apply onSelect
        const updatedHeroPaths = applyOnSelect(
          wizard.heroPaths,
          pendingHero,
          selectedPathId
        )

        // After assignment, all heroes should have paths
        const pendingAfter = getPendingHeroTempId(heroTempIds, updatedHeroPaths)
        expect(pendingAfter).toBeUndefined()

        // All heroes have paths → review mode
        heroTempIds.forEach((tid) => {
          expect(updatedHeroPaths[tid]).toBeTruthy()
        })
      }),
      { numRuns: 200 }
    )
  })

  it('pendingHeroTempId always returns the first hero (in order) without a path', () => {
    fc.assert(
      fc.property(wizardStateWithPendingArb, ({ wizard }) => {
        const heroTempIds = getHeroTempIds(wizard)
        const pending = getPendingHeroTempId(heroTempIds, wizard.heroPaths)

        // pending must be defined (guaranteed by generator)
        expect(pending).toBeDefined()

        // All heroes before pending in the list must have paths
        const pendingIndex = heroTempIds.indexOf(pending!)
        for (let i = 0; i < pendingIndex; i++) {
          expect(wizard.heroPaths[heroTempIds[i]]).toBeDefined()
        }

        // The pending hero itself must NOT have a path
        expect(wizard.heroPaths[pending!]).toBeUndefined()
      }),
      { numRuns: 100 }
    )
  })

  it('onSelect does not modify paths of other heroes', () => {
    fc.assert(
      fc.property(wizardStateWithPendingArb, ({ wizard, selectedPathId }) => {
        const heroTempIds = getHeroTempIds(wizard)
        const pendingBefore = getPendingHeroTempId(heroTempIds, wizard.heroPaths)

        const updatedHeroPaths = applyOnSelect(
          wizard.heroPaths,
          pendingBefore!,
          selectedPathId
        )

        // All other heroes' paths remain unchanged
        heroTempIds
          .filter((tid) => tid !== pendingBefore)
          .forEach((tid) => {
            expect(updatedHeroPaths[tid]).toBe(wizard.heroPaths[tid])
          })
      }),
      { numRuns: 100 }
    )
  })
})
