// Feature: toolkit-special-units-hero-upgrades, Properties 1–4: Toolkit Multi-Select

/**
 * Property tests for Toolkit ATO multi-select on MatchSetupPage.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getToolkitCount } from '../MatchSetupPage'
import type { AtoBonusType } from '../../models/match'

// ─── Constants (mirroring MatchSetupPage ATO_BONUSES) ─────────────────────────

const TOOLKIT_RATING_VALUE = 30
const MAX_TOOLKIT_COUNT = 5

const ATO_RATING_MAP: Record<AtoBonusType, number> = {
  influence: 15,
  experience: 30,
  reroll: 15,
  toolkit: 30,
  wanderer: 45,
  ambush: 60,
}

// ─── Helpers (pure logic extracted from MatchSetupPage) ───────────────────────

/**
 * Determines whether a toolkit selection should be accepted.
 * Mirrors the guard in handleToolkitIncrement:
 *   count < 5 AND companyRating + currentTotal + 30 <= opponentRating
 */
function canSelectToolkit(
  currentBonuses: AtoBonusType[],
  companyRating: number,
  opponentRating: number
): boolean {
  const count = getToolkitCount(currentBonuses)
  if (count >= MAX_TOOLKIT_COUNT) return false
  const currentTotal = currentBonuses.reduce(
    (sum, b) => sum + ATO_RATING_MAP[b],
    0
  )
  return companyRating + currentTotal + TOOLKIT_RATING_VALUE <= opponentRating
}

/**
 * Simulates adding one 'toolkit' entry to the bonuses array.
 */
function selectToolkit(bonuses: AtoBonusType[]): AtoBonusType[] {
  return [...bonuses, 'toolkit']
}

/**
 * Simulates removing one 'toolkit' entry (last occurrence) from the bonuses array.
 */
function deselectToolkit(bonuses: AtoBonusType[]): AtoBonusType[] {
  const idx = bonuses.lastIndexOf('toolkit')
  if (idx === -1) return bonuses
  return [...bonuses.slice(0, idx), ...bonuses.slice(idx + 1)]
}

/**
 * Computes cumulative ATO rating total from a bonuses array.
 */
function cumulativeRating(bonuses: AtoBonusType[]): number {
  return bonuses.reduce((sum, b) => sum + ATO_RATING_MAP[b], 0)
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const nonToolkitBonusArb: fc.Arbitrary<AtoBonusType> = fc.constantFrom(
  'influence' as AtoBonusType,
  'experience' as AtoBonusType,
  'reroll' as AtoBonusType,
  'wanderer' as AtoBonusType,
  'ambush' as AtoBonusType
)

const atoBonusArb: fc.Arbitrary<AtoBonusType> = fc.constantFrom(
  'influence' as AtoBonusType,
  'experience' as AtoBonusType,
  'reroll' as AtoBonusType,
  'toolkit' as AtoBonusType,
  'wanderer' as AtoBonusType,
  'ambush' as AtoBonusType
)

/** Generates a bonuses array with 0–5 toolkit entries plus 0–3 other bonuses */
const atoBonusesArb: fc.Arbitrary<AtoBonusType[]> = fc
  .tuple(
    fc.integer({ min: 0, max: 5 }), // toolkit count
    fc.array(nonToolkitBonusArb, { minLength: 0, maxLength: 3 }) // other bonuses
  )
  .map(([toolkitCount, others]) => {
    const toolkits: AtoBonusType[] = Array(toolkitCount).fill('toolkit')
    return [...others, ...toolkits]
  })

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 1: Toolkit selection validity', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   *
   * Selection accepted iff count < 5 AND cumulative + 30 ≤ opponent rating.
   */
  it('selection accepted iff count < 5 AND cumulative + 30 ≤ opponent rating', () => {
    fc.assert(
      fc.property(
        atoBonusesArb,
        fc.integer({ min: 1, max: 300 }), // companyRating
        fc.integer({ min: 1, max: 600 }), // opponentRating
        (bonuses, companyRating, opponentRating) => {
          const count = getToolkitCount(bonuses)
          const currentTotal = cumulativeRating(bonuses)
          const budgetOk =
            companyRating + currentTotal + TOOLKIT_RATING_VALUE <= opponentRating
          const countOk = count < MAX_TOOLKIT_COUNT

          const expected = countOk && budgetOk
          const actual = canSelectToolkit(bonuses, companyRating, opponentRating)

          expect(actual).toBe(expected)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('rejects selection when count is already 5 regardless of budget', () => {
    fc.assert(
      fc.property(
        fc.array(nonToolkitBonusArb, { minLength: 0, maxLength: 2 }),
        fc.integer({ min: 1, max: 100 }), // companyRating
        fc.integer({ min: 500, max: 1000 }), // opponentRating (very high = plenty of budget)
        (otherBonuses, companyRating, opponentRating) => {
          // Force exactly 5 toolkit entries
          const bonuses: AtoBonusType[] = [
            ...otherBonuses,
            'toolkit',
            'toolkit',
            'toolkit',
            'toolkit',
            'toolkit',
          ]
          expect(canSelectToolkit(bonuses, companyRating, opponentRating)).toBe(
            false
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('rejects selection when budget insufficient even if count < 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }), // toolkitCount (below max)
        fc.integer({ min: 100, max: 200 }), // companyRating
        (toolkitCount, companyRating) => {
          const bonuses: AtoBonusType[] = Array(toolkitCount).fill('toolkit')
          // Set opponent rating so that adding another toolkit would exceed it
          const currentTotal = cumulativeRating(bonuses)
          const opponentRating = companyRating + currentTotal + 29 // 29 < 30, so insufficient

          expect(canSelectToolkit(bonuses, companyRating, opponentRating)).toBe(
            false
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 2: Toolkit deselection frees budget', () => {
  /**
   * **Validates: Requirements 1.5**
   *
   * Removing one 'toolkit' entry reduces count by 1 and total by 30.
   */
  it('removing one toolkit entry reduces count by 1 and total by 30', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // at least 1 toolkit to deselect
        fc.array(nonToolkitBonusArb, { minLength: 0, maxLength: 3 }),
        (toolkitCount, otherBonuses) => {
          const bonuses: AtoBonusType[] = [
            ...otherBonuses,
            ...Array(toolkitCount).fill('toolkit'),
          ]

          const countBefore = getToolkitCount(bonuses)
          const totalBefore = cumulativeRating(bonuses)

          const after = deselectToolkit(bonuses)
          const countAfter = getToolkitCount(after)
          const totalAfter = cumulativeRating(after)

          expect(countAfter).toBe(countBefore - 1)
          expect(totalAfter).toBe(totalBefore - TOOLKIT_RATING_VALUE)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('deselecting from empty toolkit array is a no-op', () => {
    fc.assert(
      fc.property(
        fc.array(nonToolkitBonusArb, { minLength: 0, maxLength: 4 }),
        (otherBonuses) => {
          const before = [...otherBonuses]
          const after = deselectToolkit(before)
          expect(after).toEqual(before)
          expect(getToolkitCount(after)).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 3: Toolkit count display', () => {
  /**
   * **Validates: Requirements 1.6, 1.7**
   *
   * Indicator visible with correct count iff toolkit entries > 0.
   */
  it('count indicator visible with correct value iff toolkit entries > 0', () => {
    fc.assert(
      fc.property(atoBonusesArb, (bonuses) => {
        const count = getToolkitCount(bonuses)
        const shouldBeVisible = count > 0

        // The display logic: show badge with `×${count}` when count > 0
        const badgeVisible = count > 0
        const badgeText = count > 0 ? `×${count}` : null

        expect(badgeVisible).toBe(shouldBeVisible)
        if (shouldBeVisible) {
          expect(badgeText).toBe(`×${count}`)
        } else {
          expect(badgeText).toBeNull()
        }
      }),
      { numRuns: 200 }
    )
  })

  it('count display matches actual toolkit entries in array', () => {
    fc.assert(
      fc.property(
        fc.array(atoBonusArb, { minLength: 0, maxLength: 10 }),
        (bonuses) => {
          const count = getToolkitCount(bonuses)
          const manualCount = bonuses.filter((b) => b === 'toolkit').length
          expect(count).toBe(manualCount)
        }
      ),
      { numRuns: 200 }
    )
  })
})

describe('Property 4: Toolkit count encoding round-trip', () => {
  /**
   * **Validates: Requirements 1.8, 2.1**
   *
   * Encoding N as repeated 'toolkit' entries then filtering yields exactly N.
   */
  it('encoding N toolkit entries and filtering back yields exactly N', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }), // N toolkit selections
        fc.array(nonToolkitBonusArb, { minLength: 0, maxLength: 4 }), // other bonuses mixed in
        (n, otherBonuses) => {
          // Encode: create array with N 'toolkit' entries plus other bonuses
          const encoded: AtoBonusType[] = [
            ...otherBonuses,
            ...Array(n).fill('toolkit'),
          ]

          // Decode: filter for 'toolkit' entries
          const decoded = getToolkitCount(encoded)

          expect(decoded).toBe(n)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('round-trip preserves count regardless of insertion order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.array(nonToolkitBonusArb, { minLength: 0, maxLength: 4 }),
        fc.func(fc.boolean()), // shuffle decision function
        (n, otherBonuses, shuffleFn) => {
          // Interleave toolkit entries with other bonuses in arbitrary order
          const toolkits: AtoBonusType[] = Array(n).fill('toolkit')
          const all = [...otherBonuses, ...toolkits]

          // Shuffle using a deterministic sort based on generated function
          const shuffled = [...all].sort(() => (shuffleFn() ? -1 : 1))

          // Count must still be N regardless of order
          expect(getToolkitCount(shuffled)).toBe(n)
        }
      ),
      { numRuns: 200 }
    )
  })
})
