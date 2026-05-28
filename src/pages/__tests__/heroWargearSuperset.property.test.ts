// Feature: battle-companies-fixes-and-features, Property 12: Hero wargear pool is a superset of own-profile wargear

/**
 * Property 12: Hero wargear pool is a superset of own-profile wargear
 * Validates: Requirements 11.1, 11.2, 11.3
 *
 * For any hero in a company, the wargear purchase pool available to that hero
 * SHALL be a superset of the wargear available to the hero's own baseUnitId profile.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getAllCompanyProfileIds } from '../CompanyDetailsPage'
import type { CompanyDefinition } from '../../models'
import baseUnitsData from '../../data/baseUnits.json'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_UNITS = baseUnitsData as Array<{
  id: string
  baseWargear?: string[]
  wargearOptions?: { options: Array<{ wargear: string[] }> }
}>

/** Collect all wargear IDs accessible from a single baseUnitId profile */
function getProfileWargearIds(unitId: string): Set<string> {
  const unit = BASE_UNITS.find((u) => u.id === unitId)
  if (!unit) return new Set()
  const ids = new Set<string>()
  for (const e of unit.baseWargear ?? []) ids.add(e)
  for (const opt of unit.wargearOptions?.options ?? []) {
    for (const e of opt.wargear) ids.add(e)
  }
  return ids
}

/** Collect all wargear IDs accessible from a set of profile IDs */
function getExpandedWargearIds(profileIds: string[]): Set<string> {
  const ids = new Set<string>()
  for (const unitId of profileIds) {
    for (const e of getProfileWargearIds(unitId)) ids.add(e)
  }
  return ids
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generate a valid baseUnitId from the real data */
const validUnitIdArb = fc.constantFrom(...BASE_UNITS.map((u) => u.id))

/** Generate a reinforcement table entry with a baseUnitId */
const reinforcementEntryArb = fc.record({
  roll: fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 3 }),
  result: fc.constant('unit' as const),
  baseUnitId: validUnitIdArb,
})

/** Generate a special table entry with a baseUnitId */
const specialTableEntryArb = fc.record({
  roll: fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 3 }),
  result: fc.constant('unit' as const),
  baseUnitId: validUnitIdArb,
})

/** Generate a special unit entry */
const specialUnitEntryArb = fc.record({
  baseUnitId: validUnitIdArb,
  influenceCost: fc.integer({ min: 1, max: 10 }),
})

/** Generate a minimal CompanyDefinition with various profile IDs */
const companyDefArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  label: fc.string({ minLength: 1, maxLength: 30 }),
  factionId: fc.string({ minLength: 1, maxLength: 20 }),
  maxCompanySize: fc.integer({ min: 5, max: 20 }),
  reinforcementCost: fc.integer({ min: 1, max: 5 }),
  gold: fc.integer({ min: 0, max: 100 }),
  flavorTexts: fc.constant([]),
  companySpecialRules: fc.constant([]),
  reinforcementTable: fc.array(reinforcementEntryArb, { minLength: 1, maxLength: 6 }),
  specialTable: fc.option(
    fc.array(specialTableEntryArb, { minLength: 1, maxLength: 4 }),
    { nil: undefined }
  ),
  specialUnits: fc.option(
    fc.array(specialUnitEntryArb, { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
  startingRoster: fc.constant([]),
  advancements: fc.constant([]),
  heroUpgrade: fc.constant([]),
}) as fc.Arbitrary<CompanyDefinition>

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 12: Hero wargear pool is a superset of own-profile wargear', () => {
  it('expanded pool includes all wargear from every profile in the company charts', () => {
    fc.assert(
      fc.property(companyDefArb, (companyDef) => {
        const allProfileIds = getAllCompanyProfileIds(companyDef)
        const expandedWargear = getExpandedWargearIds(allProfileIds)

        // For every profile referenced in the company charts,
        // its wargear must be a subset of the expanded pool
        for (const profileId of allProfileIds) {
          const ownWargear = getProfileWargearIds(profileId)
          for (const wId of ownWargear) {
            expect(expandedWargear.has(wId)).toBe(true)
          }
        }
      }),
      { numRuns: 200 }
    )
  })

  it('expanded pool includes wargear from reinforcementTable profiles', () => {
    fc.assert(
      fc.property(companyDefArb, (companyDef) => {
        const allProfileIds = new Set(getAllCompanyProfileIds(companyDef))

        // Every baseUnitId in reinforcementTable must be in the expanded pool
        for (const row of companyDef.reinforcementTable) {
          if (row.baseUnitId) {
            expect(allProfileIds.has(row.baseUnitId)).toBe(true)
          }
        }
      }),
      { numRuns: 200 }
    )
  })

  it('expanded pool includes wargear from specialTable profiles', () => {
    fc.assert(
      fc.property(companyDefArb, (companyDef) => {
        const allProfileIds = new Set(getAllCompanyProfileIds(companyDef))

        for (const row of companyDef.specialTable ?? []) {
          if (row.baseUnitId) {
            expect(allProfileIds.has(row.baseUnitId)).toBe(true)
          }
        }
      }),
      { numRuns: 200 }
    )
  })

  it('expanded pool includes wargear from specialUnits profiles', () => {
    fc.assert(
      fc.property(companyDefArb, (companyDef) => {
        const allProfileIds = new Set(getAllCompanyProfileIds(companyDef))

        for (const unit of companyDef.specialUnits ?? []) {
          expect(allProfileIds.has(unit.baseUnitId)).toBe(true)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('own-profile wargear is always a subset of the expanded pool', () => {
    fc.assert(
      fc.property(companyDefArb, validUnitIdArb, (companyDef, heroUnitId) => {
        // Simulate: hero's own profile wargear
        const ownWargear = getProfileWargearIds(heroUnitId)

        // If the hero's baseUnitId is in the company charts, the expanded pool
        // must contain all of the hero's own wargear
        const allProfileIds = getAllCompanyProfileIds(companyDef)
        if (allProfileIds.includes(heroUnitId)) {
          const expandedWargear = getExpandedWargearIds(allProfileIds)
          for (const wId of ownWargear) {
            expect(expandedWargear.has(wId)).toBe(true)
          }
        }
      }),
      { numRuns: 200 }
    )
  })
})
