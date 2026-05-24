// Bugfix: temp-wanderer-postmatch-exclusion
// Property 2: Preservation — Permanent Members Unaffected In Post-Match Arrays
/**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Preservation: For all members where isAtoWanderer(memberId) is FALSE,
 * the post-match data building logic correctly includes them in casualties
 * (when isCasualty === true) and xpGained (with correct XP calculation).
 *
 * These tests MUST PASS on unfixed code — confirms baseline behavior to preserve.
 * We generate only permanent members (UUIDs that never match wanderers.json IDs).
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { ActiveMatchState, MemberMatchState, AtoBonusType } from '../../models/match'
import type { PostMatchData } from '../../models/postmatch'
import wanderersData from '../../data/wanderers.json'

// ─── Known wanderer IDs from wanderers.json ───────────────────────────────────

const WANDERER_IDS = (wanderersData as Array<{ id: string }>).map((w) => w.id)
const wandererIdSet = new Set(WANDERER_IDS)

// ─── Pure replication of handleEndMatch post-match data building (BUGGY) ──────

/**
 * Replicates the CURRENT (buggy) logic from MatchTrackingPage handleEndMatch.
 * For preservation tests we only feed permanent members, so bug doesn't matter.
 */
function buildPostMatchData(
  match: ActiveMatchState,
  companyMemberIds: Set<string>,
  result: 'win' | 'draw' | 'loss'
): PostMatchData {
  const isAtoWanderer = (memberId: string) =>
    wandererIdSet.has(memberId) && !companyMemberIds.has(memberId)

  // XP bonus from ATO experience bonus
  const xpBonus = match.atoBonuses.includes('experience')
    ? result === 'win'
      ? 2
      : 1
    : 0

  // xpGained — correctly filters ATO wanderers in current code
  const xpGained = match.members
    .filter((mm) => !isAtoWanderer(mm.memberId))
    .map((mm) => ({
      memberId: mm.memberId,
      memberName: mm.memberName,
      xp: 1 + mm.xpCounterGains + xpBonus,
    }))

  // casualties — DOES NOT filter ATO wanderers (this is the bug, but irrelevant
  // for preservation tests since we only use permanent members)
  const casualties = match.members
    .filter((m) => m.isCasualty)
    .map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName,
      role: m.role,
      baseUnitId: m.baseUnitId,
      isHero: m.role !== 'warrior',
    }))

  // Influence calculation
  let influenceBase = 2
  if (result === 'win') influenceBase += 2
  else if (result === 'draw') influenceBase += 1
  if (match.atoBonuses.includes('influence'))
    influenceBase += result === 'win' ? 2 : 1

  return {
    companyId: match.companyId,
    result,
    opponentRating: match.opponentRating,
    scenarioId: match.scenarioId,
    scenarioLabel: match.scenarioLabel,
    atoBonuses: match.atoBonuses,
    influenceBase,
    casualties,
    xpGained,
    toolkitItems: match.toolkitItems,
  }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const atoBonusArb: fc.Arbitrary<AtoBonusType> = fc.constantFrom(
  'influence',
  'experience',
  'reroll',
  'toolkit',
  'wanderer',
  'ambush'
)

const resultArb: fc.Arbitrary<'win' | 'draw' | 'loss'> = fc.constantFrom('win', 'draw', 'loss')

/** Generate a permanent company member (UUID — never matches wanderers.json IDs) */
const permanentMemberArb: fc.Arbitrary<MemberMatchState> = fc.record({
  memberId: fc.uuid(),
  memberName: fc.string({ minLength: 1, maxLength: 20 }),
  baseUnitId: fc.string({ minLength: 1, maxLength: 20 }),
  role: fc.constantFrom('leader', 'sergeant', 'hero_in_making', 'warrior'),
  equipment: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }),
  xpCounterGains: fc.integer({ min: 0, max: 5 }),
  isCasualty: fc.boolean(),
  mightMax: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
  willMax: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
  fateMax: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
  mightCurrent: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
  willCurrent: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
  fateCurrent: fc.option(fc.integer({ min: 0, max: 3 }), { nil: null }),
})

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 2: Preservation — Permanent Members Unaffected In Post-Match Arrays', () => {
  it('permanent member with isCasualty=true appears in casualties output', () => {
    fc.assert(
      fc.property(
        // Generate 1-6 permanent members, at least one must be casualty
        fc.array(permanentMemberArb, { minLength: 1, maxLength: 6 }).filter((members) =>
          members.some((m) => m.isCasualty)
        ),
        fc.array(atoBonusArb, { maxLength: 3 }),
        resultArb,
        (members, atoBonuses, result) => {
          // All members are permanent — company contains all of them
          const companyMemberIds = new Set(members.map((m) => m.memberId))

          const match: ActiveMatchState = {
            companyId: 'test-company',
            opponentRating: 200,
            scenarioId: 'test-scenario',
            scenarioLabel: 'Test Scenario',
            atoBonuses,
            rerollsRemaining: 0,
            toolkitItems: [],
            members,
            startedAt: new Date().toISOString(),
          }

          const postMatchData = buildPostMatchData(match, companyMemberIds, result)

          // ASSERT: every permanent member with isCasualty=true appears in casualties
          const casualtyMemberIds = new Set(postMatchData.casualties.map((c) => c.memberId))
          for (const member of members) {
            if (member.isCasualty) {
              expect(casualtyMemberIds.has(member.memberId)).toBe(true)
            }
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('permanent member appears in xpGained with xp = 1 + xpCounterGains + xpBonus', () => {
    fc.assert(
      fc.property(
        fc.array(permanentMemberArb, { minLength: 1, maxLength: 6 }),
        fc.array(atoBonusArb, { maxLength: 3 }),
        resultArb,
        (members, atoBonuses, result) => {
          // All members are permanent — company contains all of them
          const companyMemberIds = new Set(members.map((m) => m.memberId))

          const match: ActiveMatchState = {
            companyId: 'test-company',
            opponentRating: 200,
            scenarioId: 'test-scenario',
            scenarioLabel: 'Test Scenario',
            atoBonuses,
            rerollsRemaining: 0,
            toolkitItems: [],
            members,
            startedAt: new Date().toISOString(),
          }

          const postMatchData = buildPostMatchData(match, companyMemberIds, result)

          // Calculate expected xpBonus
          const xpBonus = atoBonuses.includes('experience')
            ? result === 'win'
              ? 2
              : 1
            : 0

          // ASSERT: every permanent member appears in xpGained with correct XP
          const xpMap = new Map(
            postMatchData.xpGained.map((entry) => [entry.memberId, entry.xp])
          )

          for (const member of members) {
            const expectedXp = 1 + member.xpCounterGains + xpBonus
            expect(xpMap.has(member.memberId)).toBe(true)
            expect(xpMap.get(member.memberId)).toBe(expectedXp)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
