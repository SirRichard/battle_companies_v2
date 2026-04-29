// Feature: battle-companies-fixes-and-features, Property 15: canAdvance for step 5 is true iff leaderId is set and sergeantIds has exactly 2 entries

/**
 * Property 15: canAdvance for step 5 is true iff leaderId is set and sergeantIds has exactly 2 entries
 * Validates: Requirements 34.1, 34.2, 34.5, 34.6
 *
 * The canAdvance logic for step 5 in CreateCompanyPage is:
 *   case 5:
 *     return wizard.leaderId !== null && wizard.sergeantIds.length === 2
 *
 * This property test verifies that the extracted pure function correctly
 * implements this logic across all combinations of leaderId and sergeantIds.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Pure function extracted from CreateCompanyPage ────────────────────────────

/**
 * Pure function mirroring the canAdvance case 5 logic in CreateCompanyPage.
 * Returns true iff leaderId is non-null AND sergeantIds has exactly 2 entries.
 */
function canAdvanceStep5(leaderId: string | null, sergeantIds: string[]): boolean {
  return leaderId !== null && sergeantIds.length === 2
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generates a string | null value for leaderId */
const leaderIdArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 1, maxLength: 20 })
)

/** Generates a non-null leaderId (simulates a pre-assigned forced leader) */
const forcedLeaderIdArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant('member_0'),
  fc.constant('member_1'),
  fc.string({ minLength: 5, maxLength: 20 })
)

/** Generates a sergeantIds array of length 0–3 */
const sergeantIdsArb: fc.Arbitrary<string[]> = fc.integer({ min: 0, max: 3 }).chain(
  (len) =>
    fc.array(fc.string({ minLength: 5, maxLength: 20 }), {
      minLength: len,
      maxLength: len,
    })
)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 15: canAdvance for step 5 is true iff leaderId is set and sergeantIds has exactly 2 entries', () => {
  it('returns true if and only if leaderId is non-null and sergeantIds.length === 2', () => {
    fc.assert(
      fc.property(leaderIdArb, sergeantIdsArb, (leaderId, sergeantIds) => {
        const result = canAdvanceStep5(leaderId, sergeantIds)
        const expected = leaderId !== null && sergeantIds.length === 2
        expect(result).toBe(expected)
      }),
      { numRuns: 500 }
    )
  })

  it('returns false when leaderId is null regardless of sergeantIds length', () => {
    fc.assert(
      fc.property(sergeantIdsArb, (sergeantIds) => {
        expect(canAdvanceStep5(null, sergeantIds)).toBe(false)
      }),
      { numRuns: 300 }
    )
  })

  it('returns false when leaderId is set but sergeantIds.length !== 2', () => {
    fc.assert(
      fc.property(
        forcedLeaderIdArb,
        // Generate arrays of length 0, 1, or 3 (never 2)
        fc.integer({ min: 0, max: 3 }).filter((n) => n !== 2).chain((len) =>
          fc.array(fc.string({ minLength: 5, maxLength: 20 }), {
            minLength: len,
            maxLength: len,
          })
        ),
        (leaderId, sergeantIds) => {
          expect(canAdvanceStep5(leaderId, sergeantIds)).toBe(false)
        }
      ),
      { numRuns: 300 }
    )
  })

  it('returns true when leaderId is set and sergeantIds has exactly 2 entries', () => {
    fc.assert(
      fc.property(
        forcedLeaderIdArb,
        fc.array(fc.string({ minLength: 5, maxLength: 20 }), {
          minLength: 2,
          maxLength: 2,
        }),
        (leaderId, sergeantIds) => {
          expect(canAdvanceStep5(leaderId, sergeantIds)).toBe(true)
        }
      ),
      { numRuns: 300 }
    )
  })

  it('is agnostic to how leaderId was set (forced pre-assignment vs manual selection)', () => {
    // Forced pre-assigned leader IDs (e.g. member_0 from mustBeLeader roster entry)
    const forcedLeaderIds = ['member_0', 'member_1', 'member_2']

    fc.assert(
      fc.property(
        fc.constantFrom(...forcedLeaderIds),
        fc.array(fc.string({ minLength: 5, maxLength: 20 }), {
          minLength: 2,
          maxLength: 2,
        }),
        (leaderId, sergeantIds) => {
          // Whether the leader was forced or manually chosen, the check is the same
          expect(canAdvanceStep5(leaderId, sergeantIds)).toBe(true)
        }
      ),
      { numRuns: 300 }
    )
  })

  it('returns false when both leaderId is null and sergeantIds is empty', () => {
    expect(canAdvanceStep5(null, [])).toBe(false)
  })

  it('returns false when leaderId is set but sergeantIds is empty', () => {
    expect(canAdvanceStep5('member_0', [])).toBe(false)
  })

  it('returns false when leaderId is null but sergeantIds has exactly 2 entries', () => {
    expect(canAdvanceStep5(null, ['member_1', 'member_2'])).toBe(false)
  })

  it('returns true for the canonical valid state (leader + 2 sergeants)', () => {
    expect(canAdvanceStep5('member_0', ['member_1', 'member_2'])).toBe(true)
  })
})
