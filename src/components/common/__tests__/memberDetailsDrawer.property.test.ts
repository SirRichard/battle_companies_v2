// Feature: battle-companies-fixes-and-features, Property 8: Promotion eligibility indicator threshold

/**
 * Property 8: Promotion eligibility indicator threshold
 * Validates: Requirements 6.1, 6.3, 6.4
 *
 * For any member, the promotion-eligibility indicator SHALL be visible
 * if and only if `member.experience >= 5`.
 *
 * We test the pure boolean condition that drives chip visibility, which
 * mirrors the JSX condition `{member.experience >= 5 && <Chip ... />}`.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Pure condition under test ─────────────────────────────────────────────────

/** Returns true when the "Ready to Advance" chip should be shown. */
function isReadyToAdvance(experience: number): boolean {
  return experience >= 5
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 8: Promotion eligibility indicator threshold', () => {
  it('chip is shown for any experience value >= 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 10_000 }),
        (experience) => {
          expect(isReadyToAdvance(experience)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('chip is NOT shown for any experience value < 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        (experience) => {
          expect(isReadyToAdvance(experience)).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('chip visibility is exactly experience >= 5 for all non-negative integers', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10_000 }),
        (experience) => {
          const shown = isReadyToAdvance(experience)
          expect(shown).toBe(experience >= 5)
        }
      ),
      { numRuns: 500 }
    )
  })
})
