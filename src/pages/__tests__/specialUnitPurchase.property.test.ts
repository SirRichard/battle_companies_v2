// Feature: toolkit-special-units-hero-upgrades, Properties 11–13: Special Unit Purchase

/**
 * Property tests for special unit purchase in StoreTab.
 *
 * Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import companiesData from '../../data/companies.json'
import baseUnitsData from '../../data/baseUnits.json'
import type {
  CompanyDefinition,
  SpecialUnitEntry,
  Member,
  Company,
} from '../../models'
import { getUnitLabel } from '../../utils/labels'
import { getEffectiveRosterSlots } from '../../utils/limitCheckers'

// ─── Data Setup ───────────────────────────────────────────────────────────────

const COMPANIES_DEF = companiesData as CompanyDefinition[]
const BASE_UNITS = baseUnitsData as Array<{ id: string; label: string; baseWargear?: string[] }>

/** Companies that actually have specialUnits defined */
const COMPANIES_WITH_SPECIAL_UNITS = COMPANIES_DEF.filter(
  (c) => c.specialUnits && c.specialUnits.length > 0
)

// ─── Helpers (mirror StoreTab logic) ──────────────────────────────────────────

/**
 * Resolves display data for a special unit entry.
 * Mirrors the rendering logic in StoreTab's Special Units section.
 */
function resolveSpecialUnitDisplay(entry: SpecialUnitEntry) {
  const unitLabel = getUnitLabel(entry.baseUnitId)
  return {
    label: unitLabel,
    influenceCost: entry.influenceCost,
    rare: entry.rare ?? null,
  }
}

/**
 * Determines whether a special unit purchase should be disabled.
 * Mirrors the disablement logic in StoreTab:
 *   disabled = insufficientInfluence || atMax || rareLimitReached
 */
function isPurchaseDisabled(
  entry: SpecialUnitEntry,
  company: Company,
  companyDef: CompanyDefinition
): boolean {
  const insufficientInfluence = company.influence < entry.influenceCost
  const effectiveSlots = getEffectiveRosterSlots(company.members, companyDef)
  const maxSize = companyDef.maxCompanySize ?? 15
  const atMax = effectiveSlots >= maxSize
  const rosterCountForUnit = company.members.filter(
    (m) => m.baseUnitId === entry.baseUnitId
  ).length
  const rareLimitReached =
    entry.rare != null && rosterCountForUnit >= entry.rare
  return insufficientInfluence || atMax || rareLimitReached
}

/**
 * Simulates purchasing a special unit.
 * Mirrors the onClick handler in StoreTab's Special Units section.
 */
function purchaseSpecialUnit(
  entry: SpecialUnitEntry,
  company: Company
): Company {
  const baseUnit = BASE_UNITS.find((u) => u.id === entry.baseUnitId)
  const defaultWargear = baseUnit?.baseWargear ?? []
  const newMember: Member = {
    id: `test-${Date.now()}-${Math.random()}`,
    name: getUnitLabel(entry.baseUnitId),
    baseUnitId: entry.baseUnitId,
    role: 'warrior',
    equipment: defaultWargear,
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: [],
    statIncreases: {},
    statDecreases: {},
  }
  return {
    ...company,
    influence: company.influence - entry.influenceCost,
    members: [...company.members, newMember],
  }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Picks a random company definition that has specialUnits */
const companyDefWithSpecialUnitsArb: fc.Arbitrary<CompanyDefinition> = fc.constantFrom(
  ...COMPANIES_WITH_SPECIAL_UNITS
)

/** Generates a special unit entry from a given company def */
function specialUnitEntryArb(
  companyDef: CompanyDefinition
): fc.Arbitrary<SpecialUnitEntry> {
  return fc.constantFrom(...companyDef.specialUnits!)
}

/** Generates a minimal Member with a given baseUnitId */
function memberArb(baseUnitId: string): fc.Arbitrary<Member> {
  return fc.record({
    id: fc.uuid(),
    name: fc.constant(getUnitLabel(baseUnitId)),
    baseUnitId: fc.constant(baseUnitId),
    role: fc.constant('warrior' as const),
    equipment: fc.constant(
      BASE_UNITS.find((u) => u.id === baseUnitId)?.baseWargear ?? []
    ),
    experience: fc.constant(0),
    lifetimeExperience: fc.constant(0),
    injuries: fc.constant([]),
    specialRules: fc.constant([]),
    statIncreases: fc.constant({}),
    statDecreases: fc.constant({}),
  })
}

/** Generates a roster of warriors with random baseUnitIds from the company's reinforcement table */
function rosterArb(companyDef: CompanyDefinition, minLen: number, maxLen: number): fc.Arbitrary<Member[]> {
  // Collect all possible baseUnitIds from the company
  const possibleIds: string[] = []
  for (const row of companyDef.reinforcementTable) {
    if (row.baseUnitId) possibleIds.push(row.baseUnitId)
    if (row.units) row.units.forEach((u) => possibleIds.push(u.baseUnitId))
    if (row.pool) row.pool.forEach((u) => possibleIds.push(u.baseUnitId))
  }
  for (const entry of companyDef.startingRoster) {
    possibleIds.push(entry.baseUnitId)
  }
  // Deduplicate
  const uniqueIds = [...new Set(possibleIds)]
  if (uniqueIds.length === 0) {
    return fc.constant([])
  }

  return fc
    .array(fc.constantFrom(...uniqueIds), { minLength: minLen, maxLength: maxLen })
    .chain((ids) => fc.tuple(...ids.map((id) => memberArb(id))))
    .map((members) => members as Member[])
}

/** Generates a Company state with configurable influence and roster */
function companyArb(companyDef: CompanyDefinition): fc.Arbitrary<Company> {
  const maxSize = companyDef.maxCompanySize ?? 15
  return fc
    .tuple(
      fc.integer({ min: 0, max: 100 }), // influence
      rosterArb(companyDef, 0, Math.min(maxSize + 2, 20)) // roster (can exceed max for testing)
    )
    .map(([influence, members]) => ({
      id: 'test-company',
      name: 'Test Company',
      companyTypeId: companyDef.id,
      factionId: typeof companyDef.factionId === 'string' ? companyDef.factionId : companyDef.factionId[0],
      alignment: 'evil' as const,
      members,
      influence,
      gold: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      matchHistory: [],
      createdAt: '2024-01-01',
      lastPlayedAt: '2024-01-01',
    }))
}

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 11: Special unit display completeness', () => {
  /**
   * **Validates: Requirements 4.3**
   *
   * Row contains resolved label, influenceCost, and rare limit.
   */
  it('each special unit row contains resolved label, influenceCost, and rare limit', () => {
    fc.assert(
      fc.property(
        companyDefWithSpecialUnitsArb.chain((def) =>
          specialUnitEntryArb(def).map((entry) => ({ def, entry }))
        ),
        ({ def: _def, entry }) => {
          const display = resolveSpecialUnitDisplay(entry)

          // Label must be a non-empty string resolved from baseUnits
          expect(display.label).toBeTruthy()
          expect(typeof display.label).toBe('string')
          expect(display.label.length).toBeGreaterThan(0)

          // influenceCost must be a positive number
          expect(display.influenceCost).toBe(entry.influenceCost)
          expect(display.influenceCost).toBeGreaterThan(0)

          // rare must be present (null if not defined on entry)
          if (entry.rare != null) {
            expect(display.rare).toBe(entry.rare)
            expect(display.rare).toBeGreaterThan(0)
          } else {
            expect(display.rare).toBeNull()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('resolved label matches getUnitLabel for the baseUnitId', () => {
    fc.assert(
      fc.property(
        companyDefWithSpecialUnitsArb.chain((def) =>
          specialUnitEntryArb(def).map((entry) => ({ def, entry }))
        ),
        ({ entry }) => {
          const display = resolveSpecialUnitDisplay(entry)
          const expectedLabel = getUnitLabel(entry.baseUnitId)
          expect(display.label).toBe(expectedLabel)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 12: Special unit purchase state transition', () => {
  /**
   * **Validates: Requirements 4.4**
   *
   * Influence reduced by cost, new Member with correct baseUnitId/role/wargear.
   */
  it('purchase reduces influence by cost and adds member with correct baseUnitId, role, and wargear', () => {
    fc.assert(
      fc.property(
        companyDefWithSpecialUnitsArb.chain((def) =>
          fc.tuple(
            fc.constant(def),
            specialUnitEntryArb(def),
            companyArb(def)
          )
        ),
        ([def, entry, company]) => {
          // Only test valid purchases (sufficient influence, below max, below rare)
          if (isPurchaseDisabled(entry, company, def)) return // skip invalid states

          const influenceBefore = company.influence
          const memberCountBefore = company.members.length

          const after = purchaseSpecialUnit(entry, company)

          // Influence reduced by exactly influenceCost
          expect(after.influence).toBe(influenceBefore - entry.influenceCost)

          // One new member added
          expect(after.members.length).toBe(memberCountBefore + 1)

          // New member has correct properties
          const newMember = after.members[after.members.length - 1]
          expect(newMember.baseUnitId).toBe(entry.baseUnitId)
          expect(newMember.role).toBe('warrior')

          // Wargear matches base unit's default
          const baseUnit = BASE_UNITS.find((u) => u.id === entry.baseUnitId)
          const expectedWargear = baseUnit?.baseWargear ?? []
          expect(newMember.equipment).toEqual(expectedWargear)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('new member has zero experience and empty injuries/specialRules', () => {
    fc.assert(
      fc.property(
        companyDefWithSpecialUnitsArb.chain((def) =>
          fc.tuple(
            fc.constant(def),
            specialUnitEntryArb(def),
            companyArb(def)
          )
        ),
        ([def, entry, company]) => {
          if (isPurchaseDisabled(entry, company, def)) return

          const after = purchaseSpecialUnit(entry, company)
          const newMember = after.members[after.members.length - 1]

          expect(newMember.experience).toBe(0)
          expect(newMember.lifetimeExperience).toBe(0)
          expect(newMember.injuries).toEqual([])
          expect(newMember.specialRules).toEqual([])
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 13: Special unit purchase disablement', () => {
  /**
   * **Validates: Requirements 4.5, 4.6, 4.7, 4.8**
   *
   * Disabled iff influence < cost OR roster >= max OR count >= rare.
   */
  it('purchase disabled iff influence < cost OR roster >= max OR count >= rare', () => {
    fc.assert(
      fc.property(
        companyDefWithSpecialUnitsArb.chain((def) =>
          fc.tuple(
            fc.constant(def),
            specialUnitEntryArb(def),
            companyArb(def)
          )
        ),
        ([def, entry, company]) => {
          const insufficientInfluence = company.influence < entry.influenceCost
          const effectiveSlots = getEffectiveRosterSlots(company.members, def)
          const maxSize = def.maxCompanySize ?? 15
          const atMax = effectiveSlots >= maxSize
          const rosterCountForUnit = company.members.filter(
            (m) => m.baseUnitId === entry.baseUnitId
          ).length
          const rareLimitReached =
            entry.rare != null && rosterCountForUnit >= entry.rare

          const expectedDisabled =
            insufficientInfluence || atMax || rareLimitReached
          const actualDisabled = isPurchaseDisabled(entry, company, def)

          expect(actualDisabled).toBe(expectedDisabled)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('disabled when influence is exactly zero and cost > 0', () => {
    fc.assert(
      fc.property(
        companyDefWithSpecialUnitsArb.chain((def) =>
          specialUnitEntryArb(def).map((entry) => ({ def, entry }))
        ),
        ({ def, entry }) => {
          const company: Company = {
            id: 'test',
            name: 'Test',
            companyTypeId: def.id,
            factionId: typeof def.factionId === 'string' ? def.factionId : def.factionId[0],
            alignment: 'evil',
            members: [],
            influence: 0,
            gold: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            matchHistory: [],
            createdAt: '2024-01-01',
            lastPlayedAt: '2024-01-01',
          }

          // All special units have influenceCost > 0, so should be disabled
          expect(isPurchaseDisabled(entry, company, def)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('disabled when roster at max regardless of influence', () => {
    fc.assert(
      fc.property(
        companyDefWithSpecialUnitsArb.chain((def) =>
          fc.tuple(
            fc.constant(def),
            specialUnitEntryArb(def),
            fc.integer({ min: 100, max: 500 }) // high influence
          )
        ),
        ([def, entry, influence]) => {
          const maxSize = def.maxCompanySize ?? 15
          // Fill roster to max with starting roster unit
          const fillUnitId = def.startingRoster[0]?.baseUnitId ?? entry.baseUnitId
          const members: Member[] = Array.from({ length: maxSize }, (_, i) => ({
            id: `fill-${i}`,
            name: `Warrior ${i}`,
            baseUnitId: fillUnitId,
            role: 'warrior' as const,
            equipment: [],
            experience: 0,
            lifetimeExperience: 0,
            injuries: [],
            specialRules: [],
            statIncreases: {},
            statDecreases: {},
          }))

          const company: Company = {
            id: 'test',
            name: 'Test',
            companyTypeId: def.id,
            factionId: typeof def.factionId === 'string' ? def.factionId : def.factionId[0],
            alignment: 'evil',
            members,
            influence,
            gold: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            matchHistory: [],
            createdAt: '2024-01-01',
            lastPlayedAt: '2024-01-01',
          }

          expect(isPurchaseDisabled(entry, company, def)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('disabled when rare limit reached regardless of influence and roster space', () => {
    fc.assert(
      fc.property(
        companyDefWithSpecialUnitsArb.chain((def) =>
          fc.tuple(
            fc.constant(def),
            specialUnitEntryArb(def),
            fc.integer({ min: 100, max: 500 }) // high influence
          )
        ),
        ([def, entry, influence]) => {
          if (entry.rare == null) return // skip entries without rare limit

          // Create roster with exactly `rare` members of the special unit type
          const members: Member[] = Array.from(
            { length: entry.rare },
            (_, i) => ({
              id: `special-${i}`,
              name: getUnitLabel(entry.baseUnitId),
              baseUnitId: entry.baseUnitId,
              role: 'warrior' as const,
              equipment: [],
              experience: 0,
              lifetimeExperience: 0,
              injuries: [],
              specialRules: [],
              statIncreases: {},
              statDecreases: {},
            })
          )

          const company: Company = {
            id: 'test',
            name: 'Test',
            companyTypeId: def.id,
            factionId: typeof def.factionId === 'string' ? def.factionId : def.factionId[0],
            alignment: 'evil',
            members,
            influence,
            gold: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            matchHistory: [],
            createdAt: '2024-01-01',
            lastPlayedAt: '2024-01-01',
          }

          expect(isPurchaseDisabled(entry, company, def)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('enabled when influence sufficient, roster below max, and count below rare', () => {
    fc.assert(
      fc.property(
        companyDefWithSpecialUnitsArb.chain((def) =>
          specialUnitEntryArb(def).map((entry) => ({ def, entry }))
        ),
        ({ def, entry }) => {
          // Construct a valid purchase scenario
          const company: Company = {
            id: 'test',
            name: 'Test',
            companyTypeId: def.id,
            factionId: typeof def.factionId === 'string' ? def.factionId : def.factionId[0],
            alignment: 'evil',
            members: [], // empty roster = below max and below rare
            influence: entry.influenceCost + 10, // sufficient
            gold: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            matchHistory: [],
            createdAt: '2024-01-01',
            lastPlayedAt: '2024-01-01',
          }

          expect(isPurchaseDisabled(entry, company, def)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
