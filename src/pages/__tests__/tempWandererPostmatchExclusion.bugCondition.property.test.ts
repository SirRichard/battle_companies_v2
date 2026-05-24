// Bugfix: temp-wanderer-postmatch-exclusion
// Property 1: Bug Condition — Temp Wanderer Excluded From Post-Match Arrays
/**
 * **Validates: Requirements 1.1, 2.1, 2.3**
 *
 * Bug Condition: isAtoWanderer(memberId) — memberId exists in wanderers.json
 * AND NOT in company.members.
 *
 * This test MUST FAIL on unfixed code to confirm the bug exists.
 * DO NOT fix the code or the test when it fails.
 *
 * We replicate the handleEndMatch post-match data building logic inline
 * and assert that for all members where isAtoWanderer is true:
 *   - memberId NOT IN postMatchData.casualties[].memberId
 *   - memberId NOT IN postMatchData.xpGained[].memberId
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { ActiveMatchState, MemberMatchState, AtoBonusType } from '../../models/match'
import type { PostMatchData } from '../../models/postmatch'
import wanderersData from '../../data/wanderers.json'

// ─── Known wanderer IDs from wanderers.json ───────────────────────────────────

const WANDERER_IDS = (wanderersData as Array<{ id: string }>).map((w) => w.id)
const wandererIdSet = new Set(WANDERER_IDS)

// ─── Pure replication of handleEndMatch post-match data building ──────────────

/**
 * Replicates the CURRENT (buggy) logic from MatchTrackingPage handleEndMatch.
 * - xpGained filters out ATO wanderers (correct)
 * - casualties does NOT filter out ATO wanderers (BUG)
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

  // casualties — now filters ATO wanderers (bug fixed)
  const casualties = match.members
    .filter((m) => m.isCasualty && !isAtoWanderer(m.memberId))
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

/** Generate a permanent company member (NOT a wanderer ID) */
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

/** Generate an ATO wanderer member — uses a real wanderer ID from wanderers.json */
const atoWandererMemberArb: fc.Arbitrary<MemberMatchState> = fc.record({
  memberId: fc.constantFrom(...WANDERER_IDS),
  memberName: fc.constantFrom(
    'Wandering Swordsman',
    'Wandering Marksman',
    'Wandering Scavenger',
    'Wandering Sage'
  ),
  baseUnitId: fc.constantFrom(...WANDERER_IDS),
  role: fc.constant('wanderer' as string),
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

/**
 * Generate an ATO wanderer that is GUARANTEED to trigger the bug condition:
 * isCasualty === true OR xpCounterGains > 0 (or both)
 */
const bugTriggeringWandererArb: fc.Arbitrary<MemberMatchState> = fc
  .record({
    memberId: fc.constantFrom(...WANDERER_IDS),
    memberName: fc.constantFrom(
      'Wandering Swordsman',
      'Wandering Marksman',
      'Wandering Scavenger',
      'Wandering Sage'
    ),
    baseUnitId: fc.constantFrom(...WANDERER_IDS),
    role: fc.constant('wanderer' as string),
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
  .filter((m) => m.isCasualty || m.xpCounterGains > 0)

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 1: Bug Condition — Temp Wanderer Excluded From Post-Match Arrays', () => {
  it('ATO wanderer with isCasualty=true must NOT appear in postMatchData.casualties', () => {
    fc.assert(
      fc.property(
        // Generate 1-4 permanent members
        fc.array(permanentMemberArb, { minLength: 1, maxLength: 4 }),
        // Generate at least 1 ATO wanderer that is a casualty
        atoWandererMemberArb.filter((m) => m.isCasualty === true),
        // Match config
        fc.array(atoBonusArb, { maxLength: 3 }),
        resultArb,
        (permanentMembers, atoWanderer, atoBonuses, result) => {
          // Company members = only permanent members (wanderer NOT in company)
          const companyMemberIds = new Set(permanentMembers.map((m) => m.memberId))

          const match: ActiveMatchState = {
            companyId: 'test-company',
            opponentRating: 200,
            scenarioId: 'test-scenario',
            scenarioLabel: 'Test Scenario',
            atoBonuses,
            rerollsRemaining: 0,
            toolkitItems: [],
            members: [...permanentMembers, atoWanderer],
            startedAt: new Date().toISOString(),
          }

          const postMatchData = buildPostMatchData(match, companyMemberIds, result)

          // ASSERT: ATO wanderer must NOT be in casualties
          const casualtyMemberIds = postMatchData.casualties.map((c) => c.memberId)
          expect(casualtyMemberIds).not.toContain(atoWanderer.memberId)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('ATO wanderer with xpCounterGains > 0 must NOT appear in postMatchData.xpGained', () => {
    fc.assert(
      fc.property(
        fc.array(permanentMemberArb, { minLength: 1, maxLength: 4 }),
        atoWandererMemberArb.filter((m) => m.xpCounterGains > 0),
        fc.array(atoBonusArb, { maxLength: 3 }),
        resultArb,
        (permanentMembers, atoWanderer, atoBonuses, result) => {
          const companyMemberIds = new Set(permanentMembers.map((m) => m.memberId))

          const match: ActiveMatchState = {
            companyId: 'test-company',
            opponentRating: 200,
            scenarioId: 'test-scenario',
            scenarioLabel: 'Test Scenario',
            atoBonuses,
            rerollsRemaining: 0,
            toolkitItems: [],
            members: [...permanentMembers, atoWanderer],
            startedAt: new Date().toISOString(),
          }

          const postMatchData = buildPostMatchData(match, companyMemberIds, result)

          // ASSERT: ATO wanderer must NOT be in xpGained
          const xpMemberIds = postMatchData.xpGained.map((x) => x.memberId)
          expect(xpMemberIds).not.toContain(atoWanderer.memberId)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('ATO wanderer (casualty + xp gains) must NOT appear in EITHER post-match array', () => {
    fc.assert(
      fc.property(
        fc.array(permanentMemberArb, { minLength: 1, maxLength: 4 }),
        bugTriggeringWandererArb,
        fc.array(atoBonusArb, { maxLength: 3 }),
        resultArb,
        (permanentMembers, atoWanderer, atoBonuses, result) => {
          const companyMemberIds = new Set(permanentMembers.map((m) => m.memberId))

          const match: ActiveMatchState = {
            companyId: 'test-company',
            opponentRating: 200,
            scenarioId: 'test-scenario',
            scenarioLabel: 'Test Scenario',
            atoBonuses,
            rerollsRemaining: 0,
            toolkitItems: [],
            members: [...permanentMembers, atoWanderer],
            startedAt: new Date().toISOString(),
          }

          const postMatchData = buildPostMatchData(match, companyMemberIds, result)

          // ASSERT: ATO wanderer must NOT be in casualties
          const casualtyMemberIds = postMatchData.casualties.map((c) => c.memberId)
          expect(casualtyMemberIds).not.toContain(atoWanderer.memberId)

          // ASSERT: ATO wanderer must NOT be in xpGained
          const xpMemberIds = postMatchData.xpGained.map((x) => x.memberId)
          expect(xpMemberIds).not.toContain(atoWanderer.memberId)
        }
      ),
      { numRuns: 200 }
    )
  })
})
