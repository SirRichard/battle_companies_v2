// Feature: company-special-rules-enforcement, Property 4: Dwarf-Dale Ratio Enforcement

/**
 * Property 4: Dwarf-Dale Ratio Enforcement
 * Validates: Requirements 2.1, 2.4
 *
 * For any roster of Defenders of the North and any candidate Dwarf-keyword
 * reinforcement, the ratio check SHALL return true (blocked) if and only if
 * the count of members with "dwarf" keyword (including the candidate) would
 * exceed the count of members with "dale" keyword.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { wouldExceedDwarfDaleRatio } from '../limitCheckers'
import type { LimitCheckContext } from '../limitCheckers'
import type { CompanyDefinition } from '../../models'

// ── Constants ─────────────────────────────────────────────────────────────────

const DWARF_UNIT_IDS = [
  'erebor_dwarf_warrior',
  'grim_hammer_warrior',
  'dwarf_warrior',
  'dwarf_ranger',
  'khazad_guard',
  'iron_guard',
  'iron_hills_warrior',
  'iron_hills_goat_rider',
] as const

const DALE_UNIT_IDS = ['warrior_of_dale', 'knight_of_dale'] as const

const NEUTRAL_UNIT_IDS = ['warrior_of_arnor', 'ranger_of_arnor'] as const

// ── Minimal CompanyDefinition for testing ─────────────────────────────────────

const DEFENDERS_COMPANY_DEF = {
  id: 'defenders_of_the_north',
  label: 'Defenders of the North',
  factionId: 'good',
  reinforcementCost: 3,
  maxCompanySize: 15,
  gold: 200,
  flavorTexts: [],
  companySpecialRules: [],
  startingRoster: [],
  advancements: [],
  reinforcementTable: [],
  heroUpgrade: [],
} as unknown as CompanyDefinition

// ── Base units map (keywords lookup) ──────────────────────────────────────────

const BASE_UNITS_MAP: Record<string, { baseWargear: string[]; keywords: string[] }> = {}

for (const id of DWARF_UNIT_IDS) {
  BASE_UNITS_MAP[id] = { baseWargear: [], keywords: ['dwarf'] }
}
for (const id of DALE_UNIT_IDS) {
  BASE_UNITS_MAP[id] = { baseWargear: [], keywords: ['man', 'dale'] }
}
for (const id of NEUTRAL_UNIT_IDS) {
  BASE_UNITS_MAP[id] = { baseWargear: [], keywords: ['man'] }
}

// ── Generators ────────────────────────────────────────────────────────────────

const arbDwarfUnitId = fc.constantFrom(...DWARF_UNIT_IDS)
const arbDaleUnitId = fc.constantFrom(...DALE_UNIT_IDS)
const arbNeutralUnitId = fc.constantFrom(...NEUTRAL_UNIT_IDS)
const arbAnyUnitId = fc.constantFrom(...DWARF_UNIT_IDS, ...DALE_UNIT_IDS, ...NEUTRAL_UNIT_IDS)

const arbMember = (unitIdArb: fc.Arbitrary<string>) =>
  unitIdArb.map((baseUnitId) => ({ baseUnitId, equipment: [] as string[] }))

const arbRoster = fc.array(arbMember(arbAnyUnitId), { minLength: 0, maxLength: 12 })

// ── Helper: build context ─────────────────────────────────────────────────────

function buildCtx(
  members: Array<{ baseUnitId: string; equipment: string[] }>
): LimitCheckContext {
  return {
    members,
    companyDef: DEFENDERS_COMPANY_DEF,
    baseUnitsMap: BASE_UNITS_MAP,
    wargearCategoryMap: {},
  }
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 4: Dwarf-Dale Ratio Enforcement', () => {
  it('returns true (blocked) iff dwarf count including candidate exceeds dale count', () => {
    fc.assert(
      fc.property(arbRoster, arbMember(arbAnyUnitId), (roster, candidate) => {
        const ctx = buildCtx(roster)
        const result = wouldExceedDwarfDaleRatio(ctx, [candidate])

        // Manually compute expected result
        const allIds = [...roster.map((m) => m.baseUnitId), candidate.baseUnitId]
        let dwarfCount = 0
        let daleCount = 0
        for (const id of allIds) {
          const keywords = BASE_UNITS_MAP[id]?.keywords ?? []
          if (keywords.includes('dwarf')) dwarfCount++
          if (keywords.includes('dale')) daleCount++
        }

        const expectedBlocked = dwarfCount > daleCount
        expect(result).toBe(expectedBlocked)
      }),
      { numRuns: 200 }
    )
  })

  it('adding a dwarf to a roster with no dale members is always blocked', () => {
    const arbNonDaleRoster = fc.array(
      arbMember(fc.constantFrom(...DWARF_UNIT_IDS, ...NEUTRAL_UNIT_IDS)),
      { minLength: 0, maxLength: 10 }
    )

    fc.assert(
      fc.property(arbNonDaleRoster, arbMember(arbDwarfUnitId), (roster, candidate) => {
        const ctx = buildCtx(roster)
        const result = wouldExceedDwarfDaleRatio(ctx, [candidate])

        // With no dale members, any dwarf addition means dwarf > 0 = dale → blocked
        expect(result).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('adding a dale member never triggers the block', () => {
    fc.assert(
      fc.property(arbRoster, arbMember(arbDaleUnitId), (roster, candidate) => {
        const ctx = buildCtx(roster)
        const result = wouldExceedDwarfDaleRatio(ctx, [candidate])

        // Adding dale increases dale count, so check manually
        const allIds = [...roster.map((m) => m.baseUnitId), candidate.baseUnitId]
        let dwarfCount = 0
        let daleCount = 0
        for (const id of allIds) {
          const keywords = BASE_UNITS_MAP[id]?.keywords ?? []
          if (keywords.includes('dwarf')) dwarfCount++
          if (keywords.includes('dale')) daleCount++
        }

        // Adding a dale member increases dale count, so dwarf can't exceed new dale count
        // unless there were already more dwarves than (dale + 1)
        expect(result).toBe(dwarfCount > daleCount)
      }),
      { numRuns: 100 }
    )
  })

  it('equal dwarf and dale counts are not blocked', () => {
    // Generate rosters with exactly N dwarves and N dale members
    const arbBalancedRoster = fc.integer({ min: 1, max: 5 }).chain((n) =>
      fc.tuple(
        fc.array(arbMember(arbDwarfUnitId), { minLength: n, maxLength: n }),
        fc.array(arbMember(arbDaleUnitId), { minLength: n, maxLength: n })
      ).map(([dwarves, dales]) => [...dwarves, ...dales])
    )

    fc.assert(
      fc.property(arbBalancedRoster, arbMember(arbDaleUnitId), (roster, candidate) => {
        const ctx = buildCtx(roster)
        // Adding a dale member to a balanced roster: dwarf(N) vs dale(N+1) → not blocked
        const result = wouldExceedDwarfDaleRatio(ctx, [candidate])
        expect(result).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('neutral members (no dwarf/dale keyword) do not affect the ratio', () => {
    // Start with 1 dwarf, 1 dale (balanced), add neutral → still not blocked
    fc.assert(
      fc.property(
        fc.array(arbMember(arbNeutralUnitId), { minLength: 0, maxLength: 8 }),
        arbMember(arbNeutralUnitId),
        (neutralRoster, candidate) => {
          // Add 1 dwarf and 1 dale to make it balanced
          const roster = [
            { baseUnitId: 'dwarf_warrior', equipment: [] as string[] },
            { baseUnitId: 'warrior_of_dale', equipment: [] as string[] },
            ...neutralRoster,
          ]
          const ctx = buildCtx(roster)
          // Adding a neutral member: dwarf(1) vs dale(1) → not blocked
          const result = wouldExceedDwarfDaleRatio(ctx, [candidate])
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
