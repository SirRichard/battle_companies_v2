// Feature: battle-companies-fixes-and-features, Property 1: Minor special rule cap

/**
 * Property 1: Minor special rule cap
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 *
 * For a hero with zero stat increases, zero heroStats (M/W/F = 0),
 * no equipment, and a base unit cost of 0, the rating equals:
 *   min(minorCount * 5, 10) + majorCount * 5
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import specialRulesData from '../../data/specialRules.json'
import { calcMemberRating, calcCompanyRating } from '../rating'
import type { Member } from '../../models'

// ── Label pools derived from actual data ──────────────────────────────────────

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

/** Pick N distinct items from an array */
function distinctSubset<T>(arr: T[], n: number): fc.Arbitrary<T[]> {
  return fc.shuffledSubarray(arr, { minLength: n, maxLength: n })
}

/** Arbitrary: pick between 0 and max distinct items from arr */
function subsetOf<T>(arr: T[], max?: number): fc.Arbitrary<T[]> {
  const hi = max !== undefined ? Math.min(max, arr.length) : arr.length
  return fc.integer({ min: 0, max: hi }).chain((n) => distinctSubset(arr, n))
}

// ── Helper: build a minimal hero Member ──────────────────────────────────────

function makeHero(specialRules: string[]): Member {
  return {
    id: 'test-hero',
    name: 'Test Hero',
    // Use a baseUnitId that does not exist in baseUnits.json → pointsCost = 0
    baseUnitId: '__nonexistent__',
    role: 'leader',
    equipment: [],
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules,
    heroStats: { might: 0, will: 0, fate: 0 },
    statIncreases: {},
    statDecreases: {},
  }
}

// ── Property test ─────────────────────────────────────────────────────────────

describe('Property 1: Minor special rule cap', () => {
  it('rating equals min(minorCount*5, 10) + majorCount*5 for a zero-base hero', () => {
    fc.assert(
      fc.property(
        subsetOf(MINOR_RULE_LABELS),
        subsetOf(MAJOR_RULE_LABELS),
        subsetOf(HEROIC_ACTION_LABELS_ARRAY),
        (minorRules, majorRules, heroicActions) => {
          const specialRules = [...minorRules, ...majorRules, ...heroicActions]
          const member = makeHero(specialRules)

          const expected =
            Math.min(minorRules.length * 5, 10) + majorRules.length * 5

          const actual = calcMemberRating(member, undefined)

          expect(actual).toBe(expected)
        }
      ),
      { numRuns: 500 }
    )
  })
})

// Feature: battle-companies-fixes-and-features, Property 10: Wanderer rating contribution

/**
 * Property 10: Wanderer rating contribution
 * Validates: Requirements 9.1, 9.2
 *
 * For any company (members + optional wanderer):
 * - When a wanderer is provided, calcCompanyRating returns memberTotal + wanderer.pointsCost
 * - When no wanderer is provided, calcCompanyRating returns memberTotal only
 * - The difference between the two calls equals the wanderer's pointsCost
 */

function makeWarrior(id: string): Member {
  return {
    id,
    name: `Warrior ${id}`,
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
}

const noStats = (_id: string) => undefined

describe('Property 10: Wanderer rating contribution', () => {
  it('adding a wanderer increases rating by exactly wanderer.pointsCost', () => {
    fc.assert(
      fc.property(
        // 0–5 warriors (all healthy, base cost 0 since __nonexistent__)
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
        // wanderer pointsCost: any non-negative integer
        fc.integer({ min: 0, max: 500 }),
        (memberIds, pointsCost) => {
          const members = memberIds.map(makeWarrior)
          const wanderer = { pointsCost }

          const withoutWanderer = calcCompanyRating(members, noStats, undefined)
          const withWanderer = calcCompanyRating(members, noStats, wanderer)

          expect(withWanderer - withoutWanderer).toBe(pointsCost)
        }
      ),
      { numRuns: 300 }
    )
  })

  it('without a wanderer, rating equals member total only', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
        (memberIds) => {
          const members = memberIds.map(makeWarrior)

          const withoutWanderer = calcCompanyRating(members, noStats, undefined)
          const withUndefined = calcCompanyRating(members, noStats)

          expect(withoutWanderer).toBe(withUndefined)
        }
      ),
      { numRuns: 200 }
    )
  })
})
