// Feature: company-special-rules-enforcement, Property 10: Vault Warden Overflow Handling

/**
 * Property-based tests for Vault Warden overflow handling.
 *
 * **Validates: Requirements 8.1**
 *
 * For any Durin's Folk roster where adding a Vault Warden Team pair would
 * cause the member count to exceed `maxCompanySize`, the system SHALL flag
 * the overflow condition as true, enabling alternative special chart selection.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── Pure Function Under Test ────────────────────────────────────────────────

/**
 * Determines whether adding a Vault Warden Team pair would overflow
 * the company's maximum size.
 *
 * @param currentMemberCount - Current number of members in the roster
 * @param pairSize - Number of members added by a Vault Warden Team (2)
 * @param maxCompanySize - Maximum allowed company size (12 for Durin's Folk)
 * @returns true if adding the pair would exceed maxCompanySize
 */
export function isVaultWardenOverflow(
  currentMemberCount: number,
  pairSize: number,
  maxCompanySize: number
): boolean {
  return currentMemberCount + pairSize > maxCompanySize
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Durin's Folk max company size */
const DURINS_FOLK_MAX_COMPANY_SIZE = 12

/** Vault Warden Team always adds a pair of 2 members */
const VAULT_WARDEN_PAIR_SIZE = 2

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary: current member count (1 to maxCompanySize, realistic range) */
const arbCurrentMemberCount = fc.integer({ min: 1, max: DURINS_FOLK_MAX_COMPANY_SIZE })

/** Arbitrary: member count that guarantees overflow (11 or 12) */
const arbOverflowMemberCount = fc.integer({
  min: DURINS_FOLK_MAX_COMPANY_SIZE - VAULT_WARDEN_PAIR_SIZE + 1,
  max: DURINS_FOLK_MAX_COMPANY_SIZE,
})

/** Arbitrary: member count that guarantees no overflow (1 to 10) */
const arbNoOverflowMemberCount = fc.integer({
  min: 1,
  max: DURINS_FOLK_MAX_COMPANY_SIZE - VAULT_WARDEN_PAIR_SIZE,
})

/** Arbitrary: generic max company size for generalized tests */
const arbMaxCompanySize = fc.integer({ min: 2, max: 20 })

/** Arbitrary: generic pair size */
const arbPairSize = fc.integer({ min: 1, max: 4 })

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: company-special-rules-enforcement, Property 10: Vault Warden Overflow Handling', () => {
  it('flags overflow when adding pair would exceed maxCompanySize', () => {
    fc.assert(
      fc.property(arbOverflowMemberCount, (currentCount) => {
        const result = isVaultWardenOverflow(
          currentCount,
          VAULT_WARDEN_PAIR_SIZE,
          DURINS_FOLK_MAX_COMPANY_SIZE
        )

        expect(result).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('does not flag overflow when adding pair stays within maxCompanySize', () => {
    fc.assert(
      fc.property(arbNoOverflowMemberCount, (currentCount) => {
        const result = isVaultWardenOverflow(
          currentCount,
          VAULT_WARDEN_PAIR_SIZE,
          DURINS_FOLK_MAX_COMPANY_SIZE
        )

        expect(result).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('overflow is true if and only if currentMemberCount + pairSize > maxCompanySize', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        arbPairSize,
        arbMaxCompanySize,
        (currentCount, pairSize, maxSize) => {
          const result = isVaultWardenOverflow(currentCount, pairSize, maxSize)
          const expected = currentCount + pairSize > maxSize

          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('at exactly maxCompanySize - pairSize, no overflow occurs (boundary)', () => {
    fc.assert(
      fc.property(arbMaxCompanySize, arbPairSize, (maxSize, pairSize) => {
        fc.pre(maxSize >= pairSize) // only valid when max >= pair
        const boundaryCount = maxSize - pairSize

        const result = isVaultWardenOverflow(boundaryCount, pairSize, maxSize)

        expect(result).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('at exactly maxCompanySize - pairSize + 1, overflow occurs (boundary)', () => {
    fc.assert(
      fc.property(arbMaxCompanySize, arbPairSize, (maxSize, pairSize) => {
        fc.pre(maxSize >= pairSize) // only valid when max >= pair
        const overBoundaryCount = maxSize - pairSize + 1

        const result = isVaultWardenOverflow(overBoundaryCount, pairSize, maxSize)

        expect(result).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})
