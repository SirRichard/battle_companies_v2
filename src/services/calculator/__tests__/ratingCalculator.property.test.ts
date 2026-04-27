// Feature: battle-companies-fixes-and-features, Property 2: Rating calculator consistency

/**
 * Property 2: Rating calculator consistency
 * Validates: Requirements 1.8
 *
 * For any hero member with no equipment and a non-existent baseUnitId (cost=0),
 * `calcMemberRating` in `src/utils/rating.ts` and
 * `calcMemberRating` in `src/services/calculator/ratingCalculator.ts`
 * must return the same value.
 *
 * Strategy: use baseUnitId='__nonexistent__' (baseCost=0) and equipment=[]
 * to eliminate equipment-cost discrepancies, and injuries=[] to avoid the
 * ratingCalculator's early-return-0 for injured members.
 * This isolates the stat-increase, heroStats, and special-rule logic.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import specialRulesData from '../../../data/specialRules.json'
import { calcMemberRating as calcRatingTs } from '../../../utils/rating'
import { calcMemberRating as calcRatingCalc } from '../ratingCalculator'
import type { Member, MemberRole, StoredBaseUnitStats } from '../../../models'

// ── Label pools ───────────────────────────────────────────────────────────────

const HEROIC_ACTION_LABELS = new Set([
  'Heroic Accuracy',
  'Heroic Challenge',
  'Heroic Channelling',
  'Heroic Defence',
  'Heroic March',
  'Heroic Resolve',
  'Heroic Strength',
  'Heroic Strike',
  'Heroic Move',
  'Heroic Shoot',
  'Heroic Combat',
])

const allRules = specialRulesData as Array<{ label: string; minor: boolean }>

const MINOR_RULE_LABELS: string[] = allRules
  .filter((r) => r.minor)
  .map((r) => r.label)

const MAJOR_RULE_LABELS: string[] = allRules
  .filter((r) => !r.minor && !HEROIC_ACTION_LABELS.has(r.label))
  .map((r) => r.label)

const HEROIC_ACTION_LABELS_ARRAY: string[] = Array.from(HEROIC_ACTION_LABELS)

// ── Arbitraries ───────────────────────────────────────────────────────────────

function subsetOf<T>(arr: T[], max?: number): fc.Arbitrary<T[]> {
  const hi = max !== undefined ? Math.min(max, arr.length) : arr.length
  return fc
    .integer({ min: 0, max: hi })
    .chain((n) => fc.shuffledSubarray(arr, { minLength: n, maxLength: n }))
}

const heroRoleArb: fc.Arbitrary<MemberRole> = fc.constantFrom(
  'leader',
  'sergeant',
  'hero_in_making'
)

const heroStatsArb = fc.record({
  might: fc.integer({ min: 0, max: 3 }),
  will: fc.integer({ min: 0, max: 3 }),
  fate: fc.integer({ min: 0, max: 3 }),
})

/** Stat increases — only the stats that both calculators handle */
const statIncreasesArb = fc.record({
  move: fc.integer({ min: 0, max: 3 }),
  fight: fc.integer({ min: 0, max: 3 }),
  strength: fc.integer({ min: 0, max: 3 }),
  defence: fc.integer({ min: 0, max: 3 }),
  attacks: fc.integer({ min: 0, max: 2 }),
  wounds: fc.integer({ min: 0, max: 2 }),
})

/** Base stats for the unit — used by both calculators for threshold comparisons */
const baseStatsArb: fc.Arbitrary<StoredBaseUnitStats> = fc.record({
  baseUnitId: fc.constant('__nonexistent__'),
  stats: fc.record({
    move: fc.integer({ min: 4, max: 6 }),
    fight: fc.integer({ min: 2, max: 5 }),
    shoot: fc.integer({ min: 0, max: 6 }),
    strength: fc.integer({ min: 2, max: 4 }),
    defence: fc.integer({ min: 3, max: 6 }),
    attacks: fc.integer({ min: 1, max: 2 }),
    wounds: fc.integer({ min: 1, max: 2 }),
    courage: fc.integer({ min: 3, max: 7 }),
    intelligence: fc.integer({ min: 3, max: 7 }),
  }),
})

// ── Property test ─────────────────────────────────────────────────────────────

describe('Property 2: Rating calculator consistency', () => {
  it('rating.ts and ratingCalculator.ts return the same value for any hero member', () => {
    fc.assert(
      fc.property(
        heroRoleArb,
        heroStatsArb,
        statIncreasesArb,
        subsetOf(MINOR_RULE_LABELS),
        subsetOf(MAJOR_RULE_LABELS),
        subsetOf(HEROIC_ACTION_LABELS_ARRAY),
        baseStatsArb,
        (role, heroStats, statIncreases, minorRules, majorRules, heroicActions, baseStats) => {
          const specialRules = [...minorRules, ...majorRules, ...heroicActions]

          const member: Member = {
            id: 'test-hero',
            name: 'Test Hero',
            // Non-existent baseUnitId → baseCost = 0 in both calculators
            baseUnitId: '__nonexistent__',
            role,
            equipment: [],
            experience: 0,
            lifetimeExperience: 0,
            injuries: [],
            specialRules,
            heroStats,
            statIncreases,
            statDecreases: {},
          }

          const ratingTs = calcRatingTs(member, baseStats)
          // ratingCalculator takes explicit baseCost=0 and equipmentCosts={}
          const ratingCalc = calcRatingCalc(member, baseStats, 0, {})

          expect(ratingCalc).toBe(ratingTs)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('warrior members: both calculators return baseCost (0) when equipment is empty', () => {
    fc.assert(
      fc.property(
        baseStatsArb,
        (baseStats) => {
          const member: Member = {
            id: 'test-warrior',
            name: 'Test Warrior',
            baseUnitId: '__nonexistent__',
            role: 'warrior',
            equipment: [],
            experience: 0,
            lifetimeExperience: 0,
            injuries: [],
            specialRules: [],
            statIncreases: {},
            statDecreases: {},
          }

          const ratingTs = calcRatingTs(member, baseStats)
          const ratingCalc = calcRatingCalc(member, baseStats, 0, {})

          expect(ratingCalc).toBe(ratingTs)
          expect(ratingTs).toBe(0)
        }
      ),
      { numRuns: 200 }
    )
  })
})
