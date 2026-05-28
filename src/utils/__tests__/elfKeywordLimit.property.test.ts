/**
 * Property-based test for Elf keyword percentage limit enforcement.
 * Feature: company-special-rules-enforcement, Property 5: Elf Keyword Percentage Limit
 *
 * Validates: Requirements 3.1, 3.3
 *
 * For any roster of Helm's Deep and any candidate Elf-keyword reinforcement,
 * the limit check SHALL return true (blocked) if and only if the count of
 * members with "elf" keyword (including the candidate) would exceed 33% of
 * the total company size (including the candidate).
 *
 * The implementation uses integer math: elfCount * 3 > totalSize means blocked.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { wouldExceedElfLimit } from '../limitCheckers'
import type { LimitCheckContext } from '../limitCheckers'
import baseUnitsData from '../../data/baseUnits.json'

// ── Real unit data ────────────────────────────────────────────────────────────

interface BaseUnitEntry {
  id: string
  keywords: string[]
  baseWargear: string[]
}

const BASE_UNITS = baseUnitsData as BaseUnitEntry[]

// Units with "elf" keyword
const ELF_UNIT_IDS = BASE_UNITS.filter((u) => u.keywords.includes('elf')).map((u) => u.id)

// Units without "elf" keyword (non-elf)
const NON_ELF_UNIT_IDS = BASE_UNITS.filter((u) => !u.keywords.includes('elf')).map((u) => u.id)

// Build baseUnitsMap for LimitCheckContext
const BASE_UNITS_MAP: Record<string, { baseWargear: string[]; keywords: string[] }> =
  BASE_UNITS.reduce<Record<string, { baseWargear: string[]; keywords: string[] }>>(
    (acc, u) => {
      acc[u.id] = {
        baseWargear: u.baseWargear ?? [],
        keywords: u.keywords ?? [],
      }
      return acc
    },
    {}
  )

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Arbitrary: pick a real elf baseUnitId */
const elfUnitIdArb = fc.constantFrom(...ELF_UNIT_IDS)

/** Arbitrary: pick a real non-elf baseUnitId */
const nonElfUnitIdArb = fc.constantFrom(...NON_ELF_UNIT_IDS)

/** Arbitrary: pick any real baseUnitId (elf or non-elf) */
const anyUnitIdArb = fc.constantFrom(...BASE_UNITS.map((u) => u.id))

/** Arbitrary: a roster member (minimal shape for limit checking) */
const memberArb = anyUnitIdArb.map((baseUnitId) => ({
  baseUnitId,
  equipment: [] as string[],
}))

/** Arbitrary: a roster of 0–14 members (Helm's Deep maxCompanySize is 15) */
const rosterArb = fc.array(memberArb, { minLength: 0, maxLength: 14 })

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a LimitCheckContext for Helm's Deep */
function buildHelmsDeepContext(
  members: Array<{ baseUnitId: string; equipment: string[] }>
): LimitCheckContext {
  return {
    members,
    companyDef: {
      id: 'helms_deep',
      label: "Helm's Deep",
      factionId: 'rohan',
      reinforcementCost: 2,
      maxCompanySize: 15,
      gold: 0,
      flavorTexts: [],
      companySpecialRules: [],
      startingRoster: [],
      advancements: [],
      reinforcementTable: [],
      heroUpgrade: [],
    },
    baseUnitsMap: BASE_UNITS_MAP,
    wargearCategoryMap: {},
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Property 5: Elf Keyword Percentage Limit
// Validates: Requirements 3.1, 3.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 5: Elf Keyword Percentage Limit', () => {
  it('returns true (blocked) iff elf count including candidate exceeds 33% of total size', () => {
    fc.assert(
      fc.property(
        // Existing roster of mixed units
        rosterArb,
        // Candidate: either elf or non-elf
        anyUnitIdArb,
        (roster, candidateUnitId) => {
          const ctx = buildHelmsDeepContext(roster)
          const newMembers = [{ baseUnitId: candidateUnitId }]

          const result = wouldExceedElfLimit(ctx, newMembers)

          // Independently compute expected result
          const allBaseUnitIds = [
            ...roster.map((m) => m.baseUnitId),
            candidateUnitId,
          ]
          const totalSize = allBaseUnitIds.length

          let elfCount = 0
          for (const id of allBaseUnitIds) {
            const keywords = BASE_UNITS_MAP[id]?.keywords ?? []
            if (keywords.includes('elf')) elfCount++
          }

          // Integer math: blocked iff elfCount * 3 > totalSize
          const expectedBlocked = elfCount * 3 > totalSize

          expect(result).toBe(expectedBlocked)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('never blocks when candidate is non-elf and roster has no elves', () => {
    fc.assert(
      fc.property(
        // Roster of only non-elf units
        fc.array(
          nonElfUnitIdArb.map((id) => ({ baseUnitId: id, equipment: [] as string[] })),
          { minLength: 0, maxLength: 14 }
        ),
        // Candidate is non-elf
        nonElfUnitIdArb,
        (roster, candidateUnitId) => {
          const ctx = buildHelmsDeepContext(roster)
          const newMembers = [{ baseUnitId: candidateUnitId }]

          const result = wouldExceedElfLimit(ctx, newMembers)

          // No elves at all → elfCount = 0, 0 * 3 = 0 which is never > totalSize (≥1)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('always blocks when all members including candidate are elves and total > 1', () => {
    fc.assert(
      fc.property(
        // Roster of only elf units (at least 1 so total > 1 with candidate)
        fc.array(
          elfUnitIdArb.map((id) => ({ baseUnitId: id, equipment: [] as string[] })),
          { minLength: 1, maxLength: 14 }
        ),
        // Candidate is also elf
        elfUnitIdArb,
        (roster, candidateUnitId) => {
          const ctx = buildHelmsDeepContext(roster)
          const newMembers = [{ baseUnitId: candidateUnitId }]

          const result = wouldExceedElfLimit(ctx, newMembers)

          // All elves: elfCount = totalSize, so elfCount * 3 > totalSize
          // iff totalSize * 3 > totalSize iff totalSize > 0 (always true when total ≥ 2)
          const totalSize = roster.length + 1
          expect(result).toBe(totalSize * 3 > totalSize)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('boundary: exactly 33% (1 elf in 3 total) is not blocked', () => {
    fc.assert(
      fc.property(
        // Pick 2 non-elf members for roster
        fc.tuple(nonElfUnitIdArb, nonElfUnitIdArb),
        // Candidate is elf
        elfUnitIdArb,
        ([nonElf1, nonElf2], elfCandidate) => {
          const roster = [
            { baseUnitId: nonElf1, equipment: [] as string[] },
            { baseUnitId: nonElf2, equipment: [] as string[] },
          ]
          const ctx = buildHelmsDeepContext(roster)
          const newMembers = [{ baseUnitId: elfCandidate }]

          const result = wouldExceedElfLimit(ctx, newMembers)

          // 1 elf in 3 total: 1 * 3 = 3, 3 > 3 is false → not blocked
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('boundary: just over 33% (2 elves in 4 total) is blocked', () => {
    fc.assert(
      fc.property(
        // Roster: 1 elf + 2 non-elf
        fc.tuple(elfUnitIdArb, nonElfUnitIdArb, nonElfUnitIdArb),
        // Candidate is elf (making 2 elves in 4 total)
        elfUnitIdArb,
        ([existingElf, nonElf1, nonElf2], elfCandidate) => {
          const roster = [
            { baseUnitId: existingElf, equipment: [] as string[] },
            { baseUnitId: nonElf1, equipment: [] as string[] },
            { baseUnitId: nonElf2, equipment: [] as string[] },
          ]
          const ctx = buildHelmsDeepContext(roster)
          const newMembers = [{ baseUnitId: elfCandidate }]

          const result = wouldExceedElfLimit(ctx, newMembers)

          // 2 elves in 4 total: 2 * 3 = 6, 6 > 4 is true → blocked
          expect(result).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
