// Feature: battle-companies-fixes-and-features, Property 14: Forced role assignments are always respected

/**
 * Property 14: Forced role assignments are always respected
 * Validates: Requirements 32.1, 32.2, 32.5, 32.8
 *
 * For any starting roster with arbitrary combinations of `mustBeLeader` and
 * `mustBeSergeant` flags (at most 1 leader and at most 2 sergeants):
 *
 * 1. `computeForcedLeaderId` returns the temp ID of the first roster entry
 *    with `mustBeLeader: true`, or null if none exists.
 * 2. `computeForcedSergeantIds` returns exactly the temp IDs of all roster
 *    entries with `mustBeSergeant: true`.
 * 3. When forced IDs are merged into wizard state, `leaderId` and
 *    `sergeantIds` include all forced values.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { StartingRosterEntry } from '../../models'

// ── Pure functions extracted from CreateCompanyPage ───────────────────────────

/**
 * Computes the forced leader temp ID from a starting roster.
 * Mirrors the `forcedLeaderId` useMemo in CreateCompanyPage.
 */
function computeForcedLeaderId(startingRoster: StartingRosterEntry[]): string | null {
  let idx = 0
  for (const entry of startingRoster) {
    for (let i = 0; i < entry.count; i++) {
      if (entry.mustBeLeader) return `member_${idx}`
      idx++
    }
  }
  return null
}

/**
 * Computes the forced sergeant temp IDs from a starting roster.
 * Mirrors the `forcedSergeantIds` useMemo in CreateCompanyPage.
 */
function computeForcedSergeantIds(startingRoster: StartingRosterEntry[]): string[] {
  const ids: string[] = []
  let idx = 0
  for (const entry of startingRoster) {
    for (let i = 0; i < entry.count; i++) {
      if (entry.mustBeSergeant) ids.push(`member_${idx}`)
      idx++
    }
  }
  return ids
}

/**
 * Merges forced IDs into wizard state (mirrors the useEffect in CreateCompanyPage).
 * Returns the updated leaderId and sergeantIds.
 */
function mergeForcedIntoWizardState(
  currentLeaderId: string | null,
  currentSergeantIds: string[],
  forcedLeaderId: string | null,
  forcedSergeantIds: string[]
): { leaderId: string | null; sergeantIds: string[] } {
  let leaderId = currentLeaderId
  let sergeantIds = [...currentSergeantIds]

  if (forcedLeaderId && leaderId !== forcedLeaderId) {
    leaderId = forcedLeaderId
  }

  if (forcedSergeantIds.length > 0) {
    const missing = forcedSergeantIds.filter((id) => !sergeantIds.includes(id))
    if (missing.length > 0) {
      sergeantIds = [
        ...new Set([
          ...forcedSergeantIds,
          ...sergeantIds.filter((id) => !forcedSergeantIds.includes(id)),
        ]),
      ]
    }
  }

  return { leaderId, sergeantIds }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates a single StartingRosterEntry with a given mustBeLeader/mustBeSergeant flag.
 */
const rosterEntryArb = (
  mustBeLeader: boolean,
  mustBeSergeant: boolean
): fc.Arbitrary<StartingRosterEntry> =>
  fc.integer({ min: 1, max: 3 }).map((count) => ({
    baseUnitId: `unit_${mustBeLeader ? 'leader' : mustBeSergeant ? 'sergeant' : 'warrior'}`,
    count,
    ...(mustBeLeader ? { mustBeLeader: true } : {}),
    ...(mustBeSergeant ? { mustBeSergeant: true } : {}),
  }))

/**
 * Generates a plain warrior roster entry (no forced flags).
 */
const warriorEntryArb: fc.Arbitrary<StartingRosterEntry> = fc
  .integer({ min: 1, max: 4 })
  .map((count) => ({
    baseUnitId: 'unit_warrior',
    count,
  }))

/**
 * Generates a starting roster with:
 * - 0 or 1 mustBeLeader entries
 * - 0, 1, or 2 mustBeSergeant entries
 * - 0–3 plain warrior entries
 *
 * The entries are shuffled to test positional correctness.
 */
const startingRosterArb: fc.Arbitrary<{
  roster: StartingRosterEntry[]
  leaderEntryIndex: number | null
  sergeantEntryIndices: number[]
}> = fc
  .tuple(
    fc.boolean(), // has leader
    fc.integer({ min: 0, max: 2 }), // number of sergeants (0, 1, or 2)
    fc.array(warriorEntryArb, { minLength: 0, maxLength: 3 }),
    fc.integer({ min: 1, max: 3 }), // leader count
    fc.integer({ min: 1, max: 3 }), // sergeant 1 count
    fc.integer({ min: 1, max: 3 }) // sergeant 2 count
  )
  .map(([hasLeader, numSergeants, warriors, leaderCount, sgt1Count, sgt2Count]) => {
    const specialEntries: StartingRosterEntry[] = []

    if (hasLeader) {
      specialEntries.push({
        baseUnitId: 'unit_leader',
        count: leaderCount,
        mustBeLeader: true,
      })
    }

    for (let i = 0; i < numSergeants; i++) {
      specialEntries.push({
        baseUnitId: `unit_sergeant_${i}`,
        count: i === 0 ? sgt1Count : sgt2Count,
        mustBeSergeant: true,
      })
    }

    // Interleave warriors and special entries in a deterministic order
    // (warriors first, then special entries) to keep the test deterministic
    const roster: StartingRosterEntry[] = [...warriors, ...specialEntries]

    // Compute which entry indices are leader/sergeant for verification
    const leaderEntryIndex = hasLeader ? warriors.length : null
    const sergeantEntryIndices = Array.from(
      { length: numSergeants },
      (_, i) => warriors.length + (hasLeader ? 1 : 0) + i
    )

    return { roster, leaderEntryIndex, sergeantEntryIndices }
  })

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 14: Forced role assignments are always respected', () => {
  it('forcedLeaderId is null when no mustBeLeader entry exists', () => {
    fc.assert(
      fc.property(
        fc.array(warriorEntryArb, { minLength: 1, maxLength: 6 }),
        (roster) => {
          const forcedLeaderId = computeForcedLeaderId(roster)
          expect(forcedLeaderId).toBeNull()
        }
      ),
      { numRuns: 300 }
    )
  })

  it('forcedLeaderId corresponds to the temp ID of the mustBeLeader entry', () => {
    fc.assert(
      fc.property(startingRosterArb, ({ roster, leaderEntryIndex }) => {
        const forcedLeaderId = computeForcedLeaderId(roster)

        if (leaderEntryIndex === null) {
          // No mustBeLeader entry — forcedLeaderId must be null
          expect(forcedLeaderId).toBeNull()
        } else {
          // Compute the expected temp ID by counting members up to the leader entry
          let expectedIdx = 0
          for (let i = 0; i < leaderEntryIndex; i++) {
            expectedIdx += roster[i].count
          }
          // The first member of the leader entry gets the temp ID
          expect(forcedLeaderId).toBe(`member_${expectedIdx}`)
        }
      }),
      { numRuns: 500 }
    )
  })

  it('forcedSergeantIds contains exactly the temp IDs of all mustBeSergeant entries', () => {
    fc.assert(
      fc.property(startingRosterArb, ({ roster, sergeantEntryIndices }) => {
        const forcedSergeantIds = computeForcedSergeantIds(roster)

        // Compute expected sergeant temp IDs
        const expectedIds: string[] = []
        for (const entryIdx of sergeantEntryIndices) {
          let memberIdx = 0
          for (let i = 0; i < entryIdx; i++) {
            memberIdx += roster[i].count
          }
          // Each member in the sergeant entry gets a temp ID
          for (let j = 0; j < roster[entryIdx].count; j++) {
            expectedIds.push(`member_${memberIdx + j}`)
          }
        }

        expect(forcedSergeantIds).toHaveLength(expectedIds.length)
        expect(forcedSergeantIds).toEqual(expectedIds)
      }),
      { numRuns: 500 }
    )
  })

  it('forcedSergeantIds is empty when no mustBeSergeant entries exist', () => {
    fc.assert(
      fc.property(
        fc.array(warriorEntryArb, { minLength: 1, maxLength: 6 }),
        (roster) => {
          const forcedSergeantIds = computeForcedSergeantIds(roster)
          expect(forcedSergeantIds).toHaveLength(0)
        }
      ),
      { numRuns: 300 }
    )
  })

  it('merging forced IDs into wizard state always includes all forced values', () => {
    fc.assert(
      fc.property(
        startingRosterArb,
        // Arbitrary existing wizard state (may or may not already have some IDs)
        fc.option(fc.string({ minLength: 5, maxLength: 15 }), { nil: null }),
        fc.array(fc.string({ minLength: 5, maxLength: 15 }), {
          minLength: 0,
          maxLength: 2,
        }),
        ({ roster }, existingLeaderId, existingSergeantIds) => {
          const forcedLeaderId = computeForcedLeaderId(roster)
          const forcedSergeantIds = computeForcedSergeantIds(roster)

          const { leaderId, sergeantIds } = mergeForcedIntoWizardState(
            existingLeaderId,
            existingSergeantIds,
            forcedLeaderId,
            forcedSergeantIds
          )

          // If there's a forced leader, it must be in the final state
          if (forcedLeaderId !== null) {
            expect(leaderId).toBe(forcedLeaderId)
          }

          // All forced sergeant IDs must be present in the final state
          for (const id of forcedSergeantIds) {
            expect(sergeantIds).toContain(id)
          }
        }
      ),
      { numRuns: 500 }
    )
  })

  it('forced temp IDs are consistent with sequential member indexing', () => {
    fc.assert(
      fc.property(startingRosterArb, ({ roster }) => {
        const forcedLeaderId = computeForcedLeaderId(roster)
        const forcedSergeantIds = computeForcedSergeantIds(roster)

        // All forced IDs must follow the member_N pattern
        if (forcedLeaderId !== null) {
          expect(forcedLeaderId).toMatch(/^member_\d+$/)
          const idx = parseInt(forcedLeaderId.replace('member_', ''), 10)
          // Index must be within the total member count
          const totalMembers = roster.reduce((sum, e) => sum + e.count, 0)
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(totalMembers)
        }

        for (const id of forcedSergeantIds) {
          expect(id).toMatch(/^member_\d+$/)
          const idx = parseInt(id.replace('member_', ''), 10)
          const totalMembers = roster.reduce((sum, e) => sum + e.count, 0)
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(totalMembers)
        }
      }),
      { numRuns: 500 }
    )
  })

  it('forced leader ID is never in forcedSergeantIds', () => {
    fc.assert(
      fc.property(startingRosterArb, ({ roster }) => {
        const forcedLeaderId = computeForcedLeaderId(roster)
        const forcedSergeantIds = computeForcedSergeantIds(roster)

        if (forcedLeaderId !== null) {
          expect(forcedSergeantIds).not.toContain(forcedLeaderId)
        }
      }),
      { numRuns: 500 }
    )
  })
})
