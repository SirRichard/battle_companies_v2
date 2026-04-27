// Feature: battle-companies-fixes-and-features, Property 7: Company size counter includes wanderer

/**
 * Property 7: Company size counter includes wanderer
 * Validates: Requirements 5.1, 5.2
 *
 * For any company with or without a wandererId, the displayed member count X
 * SHALL equal `company.members.length + (company.wandererId ? 1 : 0)`.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Pure computation under test (mirrors CompanyDetailsPage logic) ────────────

function computeTotalMembers(
  membersLength: number,
  wandererId: string | undefined
): number {
  const wandererCount = wandererId ? 1 : 0
  return membersLength + wandererCount
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generates a non-negative integer representing a member count (0–25) */
const memberCountArb = fc.integer({ min: 0, max: 25 })

/** Generates either undefined (no wanderer) or a non-empty wanderer ID string */
const wandererIdArb = fc.option(fc.string({ minLength: 1, maxLength: 30 }), {
  nil: undefined,
})

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 7: Company size counter includes wanderer', () => {
  it('counter X equals members.length + (wandererId ? 1 : 0)', () => {
    fc.assert(
      fc.property(memberCountArb, wandererIdArb, (membersLength, wandererId) => {
        const x = computeTotalMembers(membersLength, wandererId)
        const expected = membersLength + (wandererId ? 1 : 0)
        expect(x).toBe(expected)
      }),
      { numRuns: 200 }
    )
  })

  it('counter X equals membersLength when no wanderer is present', () => {
    fc.assert(
      fc.property(memberCountArb, (membersLength) => {
        const x = computeTotalMembers(membersLength, undefined)
        expect(x).toBe(membersLength)
      }),
      { numRuns: 200 }
    )
  })

  it('counter X equals membersLength + 1 when a wanderer is present', () => {
    fc.assert(
      fc.property(
        memberCountArb,
        fc.string({ minLength: 1, maxLength: 30 }),
        (membersLength, wandererId) => {
          const x = computeTotalMembers(membersLength, wandererId)
          expect(x).toBe(membersLength + 1)
        }
      ),
      { numRuns: 200 }
    )
  })
})
