// Feature: company-special-rules-enforcement, Property 14: Warg Marauder Warrior Injury Table Routing

/**
 * Property-based tests for Warg Marauder warrior injury table routing.
 *
 * **Validates: Requirements 9.4**
 *
 * For any Warg Marauder member removed as a casualty, the injury resolution
 * SHALL use the Warrior Injury Table (not the Hero Injury Table), producing
 * a single injury outcome for the entire model.
 *
 * The implementation uses `getUnitRosterOverrides` from `src/utils/limitCheckers.ts`
 * to identify affected units. When a member's `baseUnitId` matches a
 * `unitRosterOverrides` entry, it forces warrior injury table routing
 * regardless of role.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getUnitRosterOverrides } from '../limitCheckers'
import type { CompanyDefinition, CompanySpecialRule } from '../../models'

// ─── Test Data ───────────────────────────────────────────────────────────────

/** Mirkwood company def with dark_union rule and unitRosterOverrides */
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
          "A Warg Marauder takes up 3 slots of the Battle Company Roster, but only counts as a single model towards the Company's Bow Limit.",
        unitRosterOverrides: [
          {
            baseUnitId: 'warg_marauder',
            rosterSlots: 3,
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

// ─── Injury Routing Logic (mirrors PostMatchSummaryPage) ─────────────────────

/**
 * Determines whether the warrior injury table should be used for a casualty.
 * This replicates the routing logic from PostMatchSummaryPage.handleDiceSettled:
 *
 *   const hasRosterOverride = rosterOverrides.some(o => o.baseUnitId === casualty.baseUnitId)
 *   const useHeroTable = casualty.isHero && !hasRosterOverride
 *
 * Returns `true` when warrior table is used (isHero = false for the injury record).
 */
function shouldUseWarriorTable(
  baseUnitId: string,
  isHero: boolean,
  companyDef: CompanyDefinition
): boolean {
  const rosterOverrides = getUnitRosterOverrides(companyDef)
  const hasRosterOverride = rosterOverrides.some(
    (o) => o.baseUnitId === baseUnitId
  )
  const useHeroTable = isHero && !hasRosterOverride
  return !useHeroTable
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary: member role (any valid role, including hero roles) */
const arbRole = fc.constantFrom(
  'warrior',
  'hero_in_making',
  'sergeant',
  'leader'
)

/** Arbitrary: whether the casualty is marked as hero */
const arbIsHero = fc.boolean()

/** Arbitrary: non-override baseUnitId */
const arbNonOverrideBaseUnitId = fc.constantFrom(
  'moria_goblin_warrior',
  'giant_spider',
  'bat_swarm',
  'fell_warg',
  'mirkwood_spider'
)

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Feature: company-special-rules-enforcement, Property 14: Warg Marauder Warrior Injury Table Routing', () => {
  it('Warg Marauder always uses warrior injury table regardless of isHero flag', () => {
    const companyDef = makeMirkwoodCompanyDef()

    fc.assert(
      fc.property(arbIsHero, (isHero) => {
        // Warg Marauder baseUnitId matches unitRosterOverrides entry
        const usesWarriorTable = shouldUseWarriorTable(
          'warg_marauder',
          isHero,
          companyDef
        )

        // Should ALWAYS use warrior table, regardless of isHero
        expect(usesWarriorTable).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('Warg Marauder always uses warrior injury table regardless of role', () => {
    const companyDef = makeMirkwoodCompanyDef()

    fc.assert(
      fc.property(arbRole, arbIsHero, (role, isHero) => {
        // Even if role is leader/sergeant/hero_in_making AND isHero is true,
        // the roster override forces warrior table
        const usesWarriorTable = shouldUseWarriorTable(
          'warg_marauder',
          isHero,
          companyDef
        )

        expect(usesWarriorTable).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('non-override units use hero table when isHero is true', () => {
    const companyDef = makeMirkwoodCompanyDef()

    fc.assert(
      fc.property(arbNonOverrideBaseUnitId, (baseUnitId) => {
        // Non-override unit with isHero = true should use hero table
        const usesWarriorTable = shouldUseWarriorTable(
          baseUnitId,
          true,
          companyDef
        )

        // Should NOT use warrior table (i.e., uses hero table)
        expect(usesWarriorTable).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('non-override units use warrior table when isHero is false', () => {
    const companyDef = makeMirkwoodCompanyDef()

    fc.assert(
      fc.property(arbNonOverrideBaseUnitId, (baseUnitId) => {
        // Non-override unit with isHero = false should use warrior table
        const usesWarriorTable = shouldUseWarriorTable(
          baseUnitId,
          false,
          companyDef
        )

        expect(usesWarriorTable).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('without unitRosterOverrides, hero units always use hero table', () => {
    const companyDef = makeCompanyDefWithoutOverrides()

    fc.assert(
      fc.property(
        fc.constantFrom('warg_marauder', 'moria_goblin_warrior', 'giant_spider'),
        (baseUnitId) => {
          // Without overrides, isHero = true → hero table
          const usesWarriorTable = shouldUseWarriorTable(
            baseUnitId,
            true,
            companyDef
          )

          expect(usesWarriorTable).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
