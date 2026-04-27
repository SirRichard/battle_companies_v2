// Feature: battle-companies-fixes-and-features, Property 9: Leader death cascade always produces a valid leader

/**
 * Property 9: Leader death cascade always produces a valid leader
 * Validates: Requirements 7.1, 7.2
 *
 * For any company state where the leader is removed and at least one sergeant
 * exists, the death cascade SHALL result in exactly one member having role
 * `leader` after the cascade completes.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { Member } from '../../models'
import { calcMemberRating } from '../../utils/rating'

// ── Pure cascade logic (mirrors PostMatchSummaryPage implementation) ──────────

type CascadeCandidate = {
  memberId: string
  memberName: string
  xp: number
  rating: number
}

type CascadeResult =
  | { type: 'auto_promote'; memberId: string }
  | { type: 'tie'; candidates: CascadeCandidate[] }
  | { type: 'no_candidates' }

/**
 * Pure function that computes the leader death cascade result.
 * Returns the cascade action without mutating any state.
 */
function computeLeaderCascade(
  survivors: Member[],
  getStatsForUnit: (id: string) => undefined
): CascadeResult {
  const sergeants = survivors
    .filter((m) => m.role === 'sergeant')
    .sort((a, b) => {
      if (b.experience !== a.experience) return b.experience - a.experience
      const rA = calcMemberRating(a, getStatsForUnit(a.baseUnitId))
      const rB = calcMemberRating(b, getStatsForUnit(b.baseUnitId))
      return rB - rA
    })

  if (sergeants.length === 0) {
    return { type: 'no_candidates' }
  }

  const best = sergeants[0]
  const tied = sergeants.filter(
    (s) =>
      s.experience === best.experience &&
      calcMemberRating(s, getStatsForUnit(s.baseUnitId)) ===
        calcMemberRating(best, getStatsForUnit(best.baseUnitId))
  )

  if (tied.length === 1) {
    return { type: 'auto_promote', memberId: best.id }
  }

  return {
    type: 'tie',
    candidates: tied.map((s) => ({
      memberId: s.id,
      memberName: s.name,
      xp: s.experience,
      rating: calcMemberRating(s, getStatsForUnit(s.baseUnitId)),
    })),
  }
}

/**
 * Apply the cascade result to produce the final member list.
 * For ties, we simulate the user picking the first candidate.
 */
function applyLeaderCascade(
  survivors: Member[],
  cascade: CascadeResult
): Member[] {
  if (cascade.type === 'no_candidates') {
    return survivors
  }
  if (cascade.type === 'auto_promote') {
    return survivors.map((m) =>
      m.id === cascade.memberId ? { ...m, role: 'leader' as const } : m
    )
  }
  // tie: pick first candidate (simulates user choice)
  const chosen = cascade.candidates[0]
  return survivors.map((m) =>
    m.id === chosen.memberId ? { ...m, role: 'leader' as const } : m
  )
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const noStats = (_id: string) => undefined

/** Build a minimal Member with the given role and XP */
function makeMember(
  id: string,
  role: Member['role'],
  xp: number = 0
): Member {
  return {
    id,
    name: `Member ${id}`,
    baseUnitId: '__nonexistent__',
    role,
    equipment: [],
    experience: xp,
    lifetimeExperience: xp,
    injuries: [],
    specialRules: [],
    heroStats: role !== 'warrior' ? { might: 1, will: 1, fate: 1 } : undefined,
    statIncreases: {},
    statDecreases: {},
  }
}

/** Arbitrary: a company with exactly one leader and 1–4 sergeants */
const companyWithLeaderAndSergeants = fc
  .tuple(
    // Number of sergeants: 1–4
    fc.integer({ min: 1, max: 4 }),
    // XP values for each sergeant (0–20)
    fc.array(fc.integer({ min: 0, max: 20 }), { minLength: 4, maxLength: 4 })
  )
  .map(([numSergeants, xpValues]) => {
    const leader = makeMember('leader-1', 'leader', 10)
    const sergeants = Array.from({ length: numSergeants }, (_, i) =>
      makeMember(`sergeant-${i + 1}`, 'sergeant', xpValues[i])
    )
    return { leader, sergeants }
  })

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 9: Leader death cascade always produces a valid leader', () => {
  it('exactly one member has role leader after cascade when sergeants exist', () => {
    fc.assert(
      fc.property(companyWithLeaderAndSergeants, ({ leader, sergeants }) => {
        // Simulate leader death: survivors are all members except the leader
        const survivors: Member[] = [...sergeants]

        // Compute and apply cascade
        const cascade = computeLeaderCascade(survivors, noStats)
        const finalMembers = applyLeaderCascade(survivors, cascade)

        // Assert exactly one leader
        const leaders = finalMembers.filter((m) => m.role === 'leader')
        expect(leaders).toHaveLength(1)
      }),
      { numRuns: 500 }
    )
  })

  it('the promoted leader was previously a sergeant', () => {
    fc.assert(
      fc.property(companyWithLeaderAndSergeants, ({ leader, sergeants }) => {
        const survivors: Member[] = [...sergeants]
        const cascade = computeLeaderCascade(survivors, noStats)
        const finalMembers = applyLeaderCascade(survivors, cascade)

        const newLeader = finalMembers.find((m) => m.role === 'leader')
        expect(newLeader).toBeDefined()

        // The new leader must have been a sergeant before the cascade
        const wasSergeant = sergeants.some((s) => s.id === newLeader!.id)
        expect(wasSergeant).toBe(true)
      }),
      { numRuns: 500 }
    )
  })

  it('cascade returns no_candidates when no sergeants exist', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 20 }), { minLength: 0, maxLength: 3 }),
        (xpValues) => {
          // Only warriors survive (no sergeants)
          const survivors: Member[] = xpValues.map((xp, i) =>
            makeMember(`warrior-${i}`, 'warrior', xp)
          )
          const cascade = computeLeaderCascade(survivors, noStats)
          expect(cascade.type).toBe('no_candidates')
        }
      ),
      { numRuns: 200 }
    )
  })

  it('auto-promotes the sergeant with highest XP when unambiguous', () => {
    fc.assert(
      fc.property(
        // Generate 2–4 sergeants with distinct XP values
        fc.uniqueArray(fc.integer({ min: 0, max: 50 }), {
          minLength: 2,
          maxLength: 4,
        }),
        (xpValues) => {
          const sergeants = xpValues.map((xp, i) =>
            makeMember(`sergeant-${i}`, 'sergeant', xp)
          )
          const cascade = computeLeaderCascade(sergeants, noStats)

          if (cascade.type === 'auto_promote') {
            // The promoted member must have the highest XP
            const maxXp = Math.max(...xpValues)
            const promoted = sergeants.find((s) => s.id === cascade.memberId)
            expect(promoted?.experience).toBe(maxXp)
          }
          // If tie, that's also valid — just verify it's not no_candidates
          expect(cascade.type).not.toBe('no_candidates')
        }
      ),
      { numRuns: 300 }
    )
  })
})
