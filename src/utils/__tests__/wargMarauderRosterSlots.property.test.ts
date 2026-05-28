// Feature: company-special-rules-enforcement, Property 12: Warg Marauder Roster Slot Override

/**
 * Property-based tests for Warg Marauder roster slot override.
 *
 * **Validates: Requirements 9.1**
 *
 * For any Mirkwood roster containing Warg Marauder members, the effective
 * roster slot total SHALL equal `(non-marauder count × 1) + (marauder count × rosterSlots)`
 * where `rosterSlots` is read from `unitRosterOverrides`.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getEffectiveRosterSlots } from '../limitCheckers'
import type { CompanyDefinition, CompanySpecialRule } from '../../models'

// ─── Test Data ───────────────────────────────────────────────────────────────

const WARG_MARAUDER_ROSTER_SLOTS = 3

/** Company def with dark_union rule containing unitRosterOverrides */
function makeMirkwoodCompanyDef(): CompanyDefinition {
  return {
    id: 'mirkwood',
    label: 'Mirkwood',
    factionId: 'moria',
    reinforcementCost: 3,
    maxCompanySize: 15,
    gold: 0,
    flavorTexts: [],
    companySpecialRules: [
      {
        id: 'dark_union',
        title: 'Dark Union',
        description:
          'A Warg Marauder takes up 3 slots of the Battle Company Roster.',
        unitRosterOverrides: [
          {
            baseUnitId: 'warg_marauder',
            rosterSlots: WARG_MARAUDER_ROSTER_SLOTS,
            bowLimitCount: 1,
          },
        ],
      } as CompanySpecialRule,
    ],
    startingRoster: [],
    advancements: [],
    reinforcementTable: [],
    heroUpgrade: [],
  } as CompanyDefinition
}

/** Company def WITHOUT unitRosterOverrides */
function makeCompanyDefWithoutOverrides(): CompanyDefinition {
  return {
    id: 'some_other_company',
    label: 'Some Other Company',
    factionId: 'moria',
    reinforcementCost: 3,
    maxCompanySize: 15,
    gold: 0,
    flavorTexts: [],
    companySpecialRules: [],
    startingRoster: [],
    advancements: [],
    reinforcementTable: [],
    heroUpgrade: [],
  } as CompanyDefinition
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Non-marauder base unit IDs */
const NON_MARAUDER_UNITS = [
  'moria_goblin_warrior',
  'moria_goblin_prowler',
  'giant_spider',
  'bat_swarm',
] as const

/** Arbitrary: number of warg marauders (0-5) */
const arbMarauderCount = fc.integer({ min: 0, max: 5 })

/** Arbitrary: number of non-marauder members (0-8) */
const arbNonMarauderCount = fc.integer({ min: 0, max: 8 })

/** Build a roster with specified marauder and non-marauder counts */
function buildRoster(
  marauderCount: number,
  nonMarauderCount: number
): Array<{ baseUnitId: string }> {
  const members: Array<{ baseUnitId: string }> = []

  for (let i = 0; i < marauderCount; i++) {
    members.push({ baseUnitId: 'warg_marauder' })
  }

  for (let i = 0; i < nonMarauderCount; i++) {
    members.push({
      baseUnitId: NON_MARAUDER_UNITS[i % NON_MARAUDER_UNITS.length],
    })
  }

  return members
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: company-special-rules-enforcement, Property 12: Warg Marauder Roster Slot Override', () => {
  it('effective roster slots equals (non-marauder count × 1) + (marauder count × rosterSlots)', () => {
    fc.assert(
      fc.property(
        arbMarauderCount,
        arbNonMarauderCount,
        (marauderCount, nonMarauderCount) => {
          const members = buildRoster(marauderCount, nonMarauderCount)
          const companyDef = makeMirkwoodCompanyDef()

          const effectiveSlots = getEffectiveRosterSlots(members, companyDef)

          const expected =
            nonMarauderCount * 1 + marauderCount * WARG_MARAUDER_ROSTER_SLOTS

          expect(effectiveSlots).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('roster with at least one marauder always exceeds plain member count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        arbNonMarauderCount,
        (marauderCount, nonMarauderCount) => {
          const members = buildRoster(marauderCount, nonMarauderCount)
          const companyDef = makeMirkwoodCompanyDef()

          const effectiveSlots = getEffectiveRosterSlots(members, companyDef)
          const plainCount = members.length

          // Since rosterSlots (3) > 1, effective slots must exceed plain count
          expect(effectiveSlots).toBeGreaterThan(plainCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('without unitRosterOverrides, all members count as 1 slot each', () => {
    fc.assert(
      fc.property(
        arbMarauderCount,
        arbNonMarauderCount,
        (marauderCount, nonMarauderCount) => {
          const members = buildRoster(marauderCount, nonMarauderCount)
          const companyDef = makeCompanyDefWithoutOverrides()

          const effectiveSlots = getEffectiveRosterSlots(members, companyDef)

          // Without overrides, every member is 1 slot
          expect(effectiveSlots).toBe(members.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})
