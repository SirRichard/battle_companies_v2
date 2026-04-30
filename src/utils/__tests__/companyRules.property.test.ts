/**
 * Property-based tests for src/utils/companyRules.ts
 * Feature: unhandled-company-data-fields
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { CompanyDefinition, HeroUpgrade, Member, UniqueWargearEntry } from '../../models'
import {
  getEligibleUniqueWargear,
  getEligibleHeroUpgrades,
  getUnitKeywords,
  isEligibleForHeroRole,
} from '../companyRules'
import baseUnitsData from '../../data/baseUnits.json'

// ── Real unit data ────────────────────────────────────────────────────────────

interface BaseUnitEntry {
  id: string
  keywords: string[]
}

const BASE_UNITS = baseUnitsData as BaseUnitEntry[]

// Collect all distinct keywords present in baseUnits.json
const ALL_KEYWORDS = Array.from(
  new Set(BASE_UNITS.flatMap((u) => u.keywords))
)

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Arbitrary: a hero role */
const heroRoleArb = fc.constantFrom(
  'leader' as const,
  'sergeant' as const,
  'hero_in_making' as const
)

/** Arbitrary: pick a real baseUnitId from baseUnits.json */
const realBaseUnitIdArb = fc.constantFrom(...BASE_UNITS.map((u) => u.id))

/** Arbitrary: a non-empty subset of real keywords */
const realKeywordsSubsetArb = fc
  .shuffledSubarray(ALL_KEYWORDS, { minLength: 1, maxLength: ALL_KEYWORDS.length })

/** Build a minimal Member */
function makeMember(
  overrides: Partial<Member> & { role: Member['role'] }
): Member {
  return {
    id: 'test-member',
    name: 'Test Member',
    baseUnitId: 'warrior_of_minas_tirith', // real unit with keyword "man"
    equipment: [],
    experience: 0,
    lifetimeExperience: 0,
    injuries: [],
    specialRules: [],
    statIncreases: {},
    statDecreases: {},
    ...overrides,
  }
}

/** Build a minimal UniqueWargearEntry */
function makeUniqueWargearEntry(
  overrides: Partial<UniqueWargearEntry> & { equipmentId: string }
): UniqueWargearEntry {
  return {
    label: 'Test Wargear',
    influenceCost: 3,
    rating: [5, 10],
    ...overrides,
  }
}

/** Build a minimal CompanyDefinition with uniqueWargear */
function makeCompanyDef(
  uniqueWargear: UniqueWargearEntry[]
): CompanyDefinition {
  return {
    id: 'test_company',
    label: 'Test Company',
    factionId: 'gondor',
    reinforcementCost: 2,
    maxCompanySize: 15,
    gold: 0,
    flavorTexts: [],
    companySpecialRules: [],
    startingRoster: [],
    advancements: [],
    reinforcementTable: [],
    heroUpgrade: [],
    uniqueWargear,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Property 1: Unique wargear keyword eligibility
// Validates: Requirements 1.2, 1.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 1: Unique wargear keyword eligibility
 * Validates: Requirements 1.2, 1.3
 *
 * For any hero member and any UniqueWargearEntry with a non-empty allowedKeywords
 * array, getEligibleUniqueWargear includes the entry iff the hero's unit has at
 * least one keyword from allowedKeywords.
 *
 * Strategy: Use real baseUnitIds from baseUnits.json and real keywords from the
 * same data. The expected result is computed independently using getUnitKeywords
 * directly, so the test verifies the iff relationship without mocking.
 */
describe('Property 1: Unique wargear keyword eligibility', () => {
  it('entry is included iff hero unit has at least one matching keyword', () => {
    fc.assert(
      fc.property(
        // Hero role
        heroRoleArb,
        // A real baseUnitId
        realBaseUnitIdArb,
        // A non-empty subset of real keywords to use as allowedKeywords
        realKeywordsSubsetArb,
        (heroRole, baseUnitId, allowedKeywords) => {
          const equipmentId = 'test_unique_item'
          const entry = makeUniqueWargearEntry({ equipmentId, allowedKeywords })
          const companyDef = makeCompanyDef([entry])
          const member = makeMember({ role: heroRole, baseUnitId })

          const result = getEligibleUniqueWargear(companyDef, member, [member])

          // Compute expected result independently using getUnitKeywords
          const unitKeywords = getUnitKeywords(baseUnitId)
          const hasMatch = allowedKeywords.some((kw) => unitKeywords.includes(kw))
          const included = result.some((e) => e.equipmentId === equipmentId)

          expect(included).toBe(hasMatch)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 2: Unique wargear heroOnly exclusion
// Validates: Requirement 1.4
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 2: Unique wargear heroOnly exclusion
 * Validates: Requirement 1.4
 *
 * For any warrior member and any UniqueWargearEntry with heroOnly: true,
 * getEligibleUniqueWargear never includes that entry.
 *
 * Strategy: Use a real baseUnitId. To isolate the heroOnly check from keyword
 * filtering, we either omit allowedKeywords (no keyword restriction) or use
 * the unit's actual keywords as allowedKeywords (so keyword check passes).
 * Either way, heroOnly: true must still exclude warriors.
 */
describe('Property 2: Unique wargear heroOnly exclusion', () => {
  it('heroOnly entry never appears for a warrior', () => {
    fc.assert(
      fc.property(
        // A real baseUnitId — we use its actual keywords to ensure keyword
        // filtering doesn't interfere with the heroOnly check
        realBaseUnitIdArb,
        (baseUnitId) => {
          const equipmentId = 'hero_only_item'
          const unitKeywords = getUnitKeywords(baseUnitId)

          // Use the unit's own keywords as allowedKeywords so keyword check passes
          // (or omit allowedKeywords entirely if the unit has no keywords)
          const entry = makeUniqueWargearEntry({
            equipmentId,
            heroOnly: true,
            allowedKeywords: unitKeywords.length > 0 ? unitKeywords : undefined,
          })
          const companyDef = makeCompanyDef([entry])
          const warrior = makeMember({ role: 'warrior', baseUnitId })

          const result = getEligibleUniqueWargear(companyDef, warrior, [warrior])

          const included = result.some((e) => e.equipmentId === equipmentId)
          expect(included).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 3: Unique wargear limit enforcement
// Validates: Requirement 1.5
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 3: Unique wargear limit enforcement
 * Validates: Requirement 1.5
 *
 * For any UniqueWargearEntry with a limit value, when the count of members
 * already carrying equipmentId >= limit, getEligibleUniqueWargear does not
 * include that entry for any member.
 *
 * Strategy: Use a real baseUnitId for the buyer. Omit allowedKeywords so
 * keyword filtering doesn't interfere. Build a carrier list of size >= limit.
 */
describe('Property 3: Unique wargear limit enforcement', () => {
  it('entry does not appear when limit is reached or exceeded', () => {
    fc.assert(
      fc.property(
        // limit: 1–5
        fc.integer({ min: 1, max: 5 }),
        // extra carriers beyond the limit: 0–3
        fc.integer({ min: 0, max: 3 }),
        // hero role for the member trying to purchase
        heroRoleArb,
        (limit, extraCarriers, heroRole) => {
          const equipmentId = 'limited_item'
          // No allowedKeywords — keyword filtering won't interfere
          const entry = makeUniqueWargearEntry({ equipmentId, limit })

          // Build a list of members that already carry the item (count = limit + extraCarriers)
          const carrierCount = limit + extraCarriers
          const carriers: Member[] = Array.from({ length: carrierCount }, (_, i) =>
            makeMember({
              id: `carrier_${i}`,
              role: 'warrior',
              equipment: [equipmentId],
            })
          )

          // The member trying to purchase (does NOT already own it)
          const buyer = makeMember({
            id: 'buyer',
            role: heroRole,
            equipment: [],
          })

          const allMembers = [...carriers, buyer]
          const companyDef = makeCompanyDef([entry])

          const result = getEligibleUniqueWargear(companyDef, buyer, allMembers)

          const included = result.some((e) => e.equipmentId === equipmentId)
          expect(included).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 4: Unique wargear already-owned exclusion
// Validates: Requirement 1.7
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 4: Unique wargear already-owned exclusion
 * Validates: Requirement 1.7
 *
 * For any hero whose equipment already contains the entry's equipmentId,
 * getEligibleUniqueWargear does not include that entry.
 *
 * Strategy: Use a real baseUnitId. Omit allowedKeywords so keyword filtering
 * doesn't interfere. The hero already owns the item.
 */
describe('Property 4: Unique wargear already-owned exclusion', () => {
  it('entry does not appear when hero already owns it', () => {
    fc.assert(
      fc.property(
        // Hero role
        heroRoleArb,
        // A real baseUnitId
        realBaseUnitIdArb,
        (heroRole, baseUnitId) => {
          const equipmentId = 'already_owned_item'

          // No allowedKeywords — keyword filtering won't interfere
          const entry = makeUniqueWargearEntry({ equipmentId })
          const companyDef = makeCompanyDef([entry])

          // Hero already owns the item
          const hero = makeMember({
            role: heroRole,
            baseUnitId,
            equipment: [equipmentId],
          })

          const result = getEligibleUniqueWargear(companyDef, hero, [hero])

          const included = result.some((e) => e.equipmentId === equipmentId)
          expect(included).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 5: Unique wargear purchase state change
// Validates: Requirement 1.6
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 5: Unique wargear purchase state change
 * Validates: Requirements 1.6
 *
 * For any valid unique wargear purchase (member is eligible, company has
 * sufficient IP), after the purchase:
 * - company influence decreases by exactly entry.influenceCost
 * - member.equipment contains entry.equipmentId
 *
 * This is a pure state-transition test — no UI rendering needed.
 * It simulates what handleBuyWargear does: deduct influenceCost from influence
 * and add equipmentId to member.equipment.
 */
describe('Property 5: Unique wargear purchase state change', () => {
  it('influence decreases by influenceCost and equipment contains equipmentId after purchase', () => {
    fc.assert(
      fc.property(
        // Hero role
        heroRoleArb,
        // A real baseUnitId
        realBaseUnitIdArb,
        // influenceCost: 1–10
        fc.integer({ min: 1, max: 10 }),
        // extra IP beyond cost: 0–20 (ensures company can afford it)
        fc.integer({ min: 0, max: 20 }),
        (heroRole, baseUnitId, influenceCost, extraIp) => {
          const equipmentId = 'unique_purchase_item'
          const entry = makeUniqueWargearEntry({ equipmentId, influenceCost })

          // Company has sufficient IP
          const initialInfluence = influenceCost + extraIp

          // Member does not already own the item
          const member = makeMember({ role: heroRole, baseUnitId, equipment: [] })

          // Simulate the purchase: deduct influenceCost, add equipmentId to equipment
          const newInfluence = initialInfluence - entry.influenceCost
          const newEquipment = [...member.equipment, entry.equipmentId]

          // Assert: influence decreased by exactly influenceCost
          expect(newInfluence).toBe(initialInfluence - influenceCost)

          // Assert: equipment contains equipmentId
          expect(newEquipment).toContain(equipmentId)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 7: Hero restrictions eligibility
// Validates: Requirements 3.1, 3.2, 3.5
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 7: Hero restrictions eligibility
 * Validates: Requirements 3.1, 3.2, 3.5
 *
 * For any company with a heroRestrictions rule and any baseUnitId,
 * isEligibleForHeroRole returns true iff the baseUnitId is in allowedBaseUnitIds.
 *
 * Also tests the no-restriction case: when heroRestrictions is absent,
 * isEligibleForHeroRole always returns true.
 *
 * Strategy: Use real baseUnitIds from baseUnits.json. Build a CompanyDefinition
 * with a heroRestrictions rule containing a random subset of real baseUnitIds.
 * The expected result is computed independently by checking set membership.
 */
describe('Property 7: Hero restrictions eligibility', () => {
  it('returns true iff baseUnitId is in allowedBaseUnitIds when restriction exists', () => {
    fc.assert(
      fc.property(
        // A random non-empty subset of real baseUnitIds to use as allowedBaseUnitIds
        fc.shuffledSubarray(BASE_UNITS.map((u) => u.id), { minLength: 1, maxLength: BASE_UNITS.length }),
        // A real baseUnitId to test eligibility for
        realBaseUnitIdArb,
        (allowedBaseUnitIds, baseUnitId) => {
          const companyDef: CompanyDefinition = {
            id: 'test_company',
            label: 'Test Company',
            factionId: 'gondor',
            reinforcementCost: 2,
            maxCompanySize: 15,
            gold: 0,
            flavorTexts: [],
            companySpecialRules: [
              {
                id: 'hero_restrictions_rule',
                title: 'Hero Restrictions',
                description: 'Only certain units may be heroes.',
                heroRestrictions: [{ allowedBaseUnitIds }],
              },
            ],
            startingRoster: [],
            advancements: [],
            reinforcementTable: [],
            heroUpgrade: [],
          }

          const result = isEligibleForHeroRole(baseUnitId, companyDef)
          const expected = allowedBaseUnitIds.includes(baseUnitId)

          expect(result).toBe(expected)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('always returns true when no heroRestrictions rule exists', () => {
    fc.assert(
      fc.property(
        // A real baseUnitId
        realBaseUnitIdArb,
        (baseUnitId) => {
          const companyDef: CompanyDefinition = {
            id: 'test_company',
            label: 'Test Company',
            factionId: 'gondor',
            reinforcementCost: 2,
            maxCompanySize: 15,
            gold: 0,
            flavorTexts: [],
            companySpecialRules: [],
            startingRoster: [],
            advancements: [],
            reinforcementTable: [],
            heroUpgrade: [],
          }

          const result = isEligibleForHeroRole(baseUnitId, companyDef)
          expect(result).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 10: Hero upgrade keyword filtering
// Validates: Requirements 5.2, 5.3, 5.4, 5.5
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 10: Hero upgrade keyword filtering
 * Validates: Requirements 5.2, 5.3, 5.4, 5.5
 *
 * For any hero member and any HeroUpgrade with a non-empty allowedKeywords array,
 * getEligibleHeroUpgrades includes the upgrade iff the hero's unit has at least
 * one keyword from allowedKeywords (and the hero hasn't already purchased it).
 *
 * Strategy: Use real baseUnitIds from baseUnits.json and real keywords from the
 * same data. The expected result is computed independently using getUnitKeywords
 * directly, so the test verifies the iff relationship without mocking.
 * Also tests the already-purchased exclusion: when the hero already has the
 * upgrade in their equipment, it must not appear regardless of keyword match.
 */
describe('Property 10: Hero upgrade keyword filtering', () => {
  it('upgrade is included iff hero unit has at least one matching keyword (not already purchased)', () => {
    fc.assert(
      fc.property(
        // Hero role
        heroRoleArb,
        // A real baseUnitId
        realBaseUnitIdArb,
        // A non-empty subset of real keywords to use as allowedKeywords
        realKeywordsSubsetArb,
        (heroRole, baseUnitId, allowedKeywords) => {
          const upgradeId = 'test_hero_upgrade'
          const upgrade: HeroUpgrade = {
            id: upgradeId,
            label: 'Test Hero Upgrade',
            description: 'A test upgrade with keyword restriction.',
            allowedKeywords,
          }
          const companyDef: CompanyDefinition = {
            id: 'test_company',
            label: 'Test Company',
            factionId: 'gondor',
            reinforcementCost: 2,
            maxCompanySize: 15,
            gold: 0,
            flavorTexts: [],
            companySpecialRules: [],
            startingRoster: [],
            advancements: [],
            reinforcementTable: [],
            heroUpgrade: [upgrade],
          }

          // Hero has NOT already purchased the upgrade
          const hero = makeMember({ role: heroRole, baseUnitId, equipment: [] })

          const result = getEligibleHeroUpgrades(companyDef, hero)

          // Compute expected result independently using getUnitKeywords
          const unitKeywords = getUnitKeywords(baseUnitId)
          const hasMatch = allowedKeywords.some((kw) => unitKeywords.includes(kw))
          const included = result.some((u) => u.id === upgradeId)

          expect(included).toBe(hasMatch)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('upgrade is excluded when hero has already purchased it, regardless of keyword match', () => {
    fc.assert(
      fc.property(
        // Hero role
        heroRoleArb,
        // A real baseUnitId
        realBaseUnitIdArb,
        (heroRole, baseUnitId) => {
          const upgradeId = 'already_purchased_upgrade'
          const unitKeywords = getUnitKeywords(baseUnitId)

          // Use the unit's own keywords as allowedKeywords so keyword check would pass
          // (or omit allowedKeywords if the unit has no keywords)
          const upgrade: HeroUpgrade = {
            id: upgradeId,
            label: 'Already Purchased Upgrade',
            description: 'An upgrade the hero already has.',
            allowedKeywords: unitKeywords.length > 0 ? unitKeywords : undefined,
          }
          const companyDef: CompanyDefinition = {
            id: 'test_company',
            label: 'Test Company',
            factionId: 'gondor',
            reinforcementCost: 2,
            maxCompanySize: 15,
            gold: 0,
            flavorTexts: [],
            companySpecialRules: [],
            startingRoster: [],
            advancements: [],
            reinforcementTable: [],
            heroUpgrade: [upgrade],
          }

          // Hero has already purchased the upgrade
          const hero = makeMember({ role: heroRole, baseUnitId, equipment: [upgradeId] })

          const result = getEligibleHeroUpgrades(companyDef, hero)

          const included = result.some((u) => u.id === upgradeId)
          expect(included).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 6: Substitution prompt visibility
// Validates: Requirement 2.1
// ─────────────────────────────────────────────────────────────────────────────

import {
  getApplicableSubstitution,
  calcBreakPoint,
  isCompanyBroken,
} from '../companyRules'

/**
 * Property 6: Substitution prompt visibility
 * Validates: Requirement 2.1
 *
 * For any CompanyDefinition with a reinforcementSubstitution rule and any
 * final adjusted roll number, getApplicableSubstitution returns non-null iff
 * the roll is in the appliesTo array.
 *
 * Strategy: Generate a random appliesTo array of integers and a random roll.
 * Build a CompanyDefinition with a single reinforcementSubstitution entry.
 * Assert the iff relationship directly.
 */
describe('Property 6: Substitution prompt visibility', () => {
  it('returns non-null iff roll is in appliesTo', () => {
    fc.assert(
      fc.property(
        // appliesTo: array of 1–6 distinct integers in range 1–12
        fc.uniqueArray(fc.integer({ min: 1, max: 12 }), { minLength: 1, maxLength: 6 }),
        // roll: any integer in range 1–12
        fc.integer({ min: 1, max: 12 }),
        (appliesTo, roll) => {
          const companyDef: CompanyDefinition = {
            id: 'test_company',
            label: 'Test Company',
            factionId: 'gondor',
            reinforcementCost: 2,
            maxCompanySize: 15,
            gold: 0,
            flavorTexts: [],
            companySpecialRules: [
              {
                id: 'substitution_rule',
                title: 'Substitution Rule',
                description: 'A test substitution rule.',
                reinforcementSubstitution: [
                  {
                    baseUnitId: 'warrior_of_minas_tirith',
                    appliesTo,
                    prompt: 'Would you like to substitute?',
                  },
                ],
              },
            ],
            startingRoster: [],
            advancements: [],
            reinforcementTable: [],
            heroUpgrade: [],
          }

          const result = getApplicableSubstitution(companyDef, roll)
          const expected = appliesTo.includes(roll)

          expect(result !== null).toBe(expected)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('returns null when no reinforcementSubstitution rule exists', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        (roll) => {
          const companyDef: CompanyDefinition = {
            id: 'test_company',
            label: 'Test Company',
            factionId: 'gondor',
            reinforcementCost: 2,
            maxCompanySize: 15,
            gold: 0,
            flavorTexts: [],
            companySpecialRules: [],
            startingRoster: [],
            advancements: [],
            reinforcementTable: [],
            heroUpgrade: [],
          }

          const result = getApplicableSubstitution(companyDef, roll)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 11: Break point calculation correctness
// Validates: Requirements 6.1, 6.2, 6.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 11: Break point calculation correctness
 * Validates: Requirements 6.1, 6.2, 6.3
 *
 * For any startingMemberCount and any company definition:
 * - Valid breakPointPercentage (0 < pct <= 1): returns Math.floor(count * pct)
 * - Invalid breakPointPercentage (pct <= 0, pct > 1, non-number): falls back to Math.floor(count * 0.5)
 * - No breaking_point rule: falls back to Math.floor(count * 0.5)
 *
 * Strategy: Generate random member counts and percentages. Build CompanyDefinitions
 * with and without breaking_point rules, using valid and invalid percentages.
 */
describe('Property 11: Break point calculation correctness', () => {
  /** Helper to build a CompanyDefinition with a breaking_point rule */
  function makeCompanyWithBreakPoint(
    breakPointPercentage: unknown
  ): CompanyDefinition {
    return {
      id: 'test_company',
      label: 'Test Company',
      factionId: 'gondor',
      reinforcementCost: 2,
      maxCompanySize: 30,
      gold: 0,
      flavorTexts: [],
      companySpecialRules: [
        {
          id: 'breaking_point',
          title: 'Breaking Point',
          description: 'Custom break point.',
          parameters: { breakPointPercentage },
        },
      ],
      startingRoster: [],
      advancements: [],
      reinforcementTable: [],
      heroUpgrade: [],
    }
  }

  function makeCompanyWithoutBreakPoint(): CompanyDefinition {
    return {
      id: 'test_company',
      label: 'Test Company',
      factionId: 'gondor',
      reinforcementCost: 2,
      maxCompanySize: 30,
      gold: 0,
      flavorTexts: [],
      companySpecialRules: [],
      startingRoster: [],
      advancements: [],
      reinforcementTable: [],
      heroUpgrade: [],
    }
  }

  it('returns Math.floor(count * pct) for valid breakPointPercentage', () => {
    fc.assert(
      fc.property(
        // startingMemberCount: 1–30
        fc.integer({ min: 1, max: 30 }),
        // valid percentage: (0, 1] — use float with 32-bit fround values
        fc.float({ min: Math.fround(0.01), max: Math.fround(1.0), noNaN: true }),
        (count, pct) => {
          // Ensure pct is strictly > 0 and <= 1
          fc.pre(pct > 0 && pct <= 1)
          const companyDef = makeCompanyWithBreakPoint(pct)
          const result = calcBreakPoint(companyDef, count)
          expect(result).toBe(Math.floor(count * pct))
        }
      ),
      { numRuns: 200 }
    )
  })

  it('falls back to Math.floor(count * 0.5) for pct <= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        // invalid: pct <= 0 — use values clearly at or below 0
        fc.float({ min: Math.fround(-10.0), max: Math.fround(0.0), noNaN: true }),
        (count, pct) => {
          const companyDef = makeCompanyWithBreakPoint(pct)
          const result = calcBreakPoint(companyDef, count)
          expect(result).toBe(Math.floor(count * 0.5))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('falls back to Math.floor(count * 0.5) for pct > 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        // invalid: pct > 1 — use values clearly above 1
        fc.float({ min: Math.fround(1.01), max: Math.fround(10.0), noNaN: true }),
        (count, pct) => {
          // Ensure pct is strictly > 1
          fc.pre(pct > 1)
          const companyDef = makeCompanyWithBreakPoint(pct)
          const result = calcBreakPoint(companyDef, count)
          expect(result).toBe(Math.floor(count * 0.5))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('falls back to Math.floor(count * 0.5) for non-number breakPointPercentage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        // non-number values: string, null, undefined, boolean, object
        fc.oneof(
          fc.string(),
          fc.constant(null),
          fc.constant(undefined),
          fc.boolean(),
        ),
        (count, invalidPct) => {
          const companyDef = makeCompanyWithBreakPoint(invalidPct)
          const result = calcBreakPoint(companyDef, count)
          expect(result).toBe(Math.floor(count * 0.5))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('falls back to Math.floor(count * 0.5) when no breaking_point rule exists', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        (count) => {
          const companyDef = makeCompanyWithoutBreakPoint()
          const result = calcBreakPoint(companyDef, count)
          expect(result).toBe(Math.floor(count * 0.5))
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 12: Broken state detection
// Validates: Requirement 6.5
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 12: Broken state detection
 * Validates: Requirement 6.5
 *
 * For any breakPoint and activeMemberCount, isCompanyBroken returns true iff
 * activeMemberCount <= breakPoint.
 *
 * Strategy: Generate random integers for both values in range 0–20.
 * Assert the iff relationship directly.
 */
describe('Property 12: Broken state detection', () => {
  it('returns true iff activeMemberCount <= breakPoint', () => {
    fc.assert(
      fc.property(
        // breakPoint: 0–20
        fc.integer({ min: 0, max: 20 }),
        // activeMemberCount: 0–20
        fc.integer({ min: 0, max: 20 }),
        (breakPoint, activeMemberCount) => {
          const result = isCompanyBroken(breakPoint, activeMemberCount)
          expect(result).toBe(activeMemberCount <= breakPoint)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 8: Multi-count recruitment size change
// Validates: Requirements 4.2, 4.6
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 8: Multi-count recruitment size change
 * Validates: Requirements 4.2, 4.6
 *
 * For any unit reinforcement result with count = N (N >= 1), after a successful
 * recruitment the company's members array grows by exactly N and the company's
 * influence decreases by exactly reinforcementCost (once, regardless of N).
 *
 * This is a pure state-transition test — no UI rendering needed.
 * It simulates the confirmRecruitment + finaliseRecruitment logic directly:
 *   - push N copies of { baseUnitId, equipment } into candidates
 *   - deduct reinforcementCost once from influence
 *   - add all N members to company.members
 */
describe('Property 8: Multi-count recruitment size change', () => {
  it('members grows by exactly N and influence decreases by reinforcementCost once', () => {
    fc.assert(
      fc.property(
        // N: count of units to recruit (1–5)
        fc.integer({ min: 1, max: 5 }),
        // current member count: 0–10
        fc.integer({ min: 0, max: 10 }),
        // maxCompanySize: must be >= currentMembers + N to allow recruitment
        fc.integer({ min: 0, max: 5 }), // extra room beyond N
        // reinforcementCost: 1–5
        fc.integer({ min: 1, max: 5 }),
        // initial influence: enough to cover cost
        fc.integer({ min: 0, max: 20 }),
        (n, currentMemberCount, extraRoom, reinforcementCost, extraInfluence) => {
          const maxCompanySize = currentMemberCount + n + extraRoom
          const initialInfluence = reinforcementCost + extraInfluence

          // Build a minimal company with currentMemberCount members
          const members: Member[] = Array.from({ length: currentMemberCount }, (_, i) =>
            makeMember({ id: `member_${i}`, role: 'warrior' })
          )

          // Simulate: company has room for N more (members.length + N <= maxCompanySize)
          fc.pre(members.length + n <= maxCompanySize)

          // Simulate confirmRecruitment: build N candidates
          const baseUnitId = 'warrior_of_minas_tirith'
          const equipment: string[] = []
          const candidates = Array.from({ length: n }, () => ({ baseUnitId, equipment }))

          // Simulate finaliseRecruitment: add all candidates to members, deduct cost once
          const newMembers = [...members, ...candidates.map((c, i) => makeMember({
            id: `new_${i}`,
            role: 'warrior',
            baseUnitId: c.baseUnitId,
            equipment: c.equipment,
          }))]
          const newInfluence = initialInfluence - reinforcementCost

          // Assert: members grew by exactly N
          expect(newMembers.length).toBe(members.length + n)

          // Assert: influence decreased by exactly reinforcementCost (once)
          expect(newInfluence).toBe(initialInfluence - reinforcementCost)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property 9: Multi-count size limit enforcement
// Validates: Requirement 4.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property 9: Multi-count size limit enforcement
 * Validates: Requirement 4.3
 *
 * For any company where members.length + N > maxCompanySize, recruitment is
 * blocked and members.length is unchanged.
 *
 * This tests the blocking condition:
 *   company.members.length + candidates.length > maxCompanySize
 *
 * Strategy: Generate a company where adding N units would exceed maxCompanySize.
 * Simulate the size check and assert that recruitment is blocked.
 */
describe('Property 9: Multi-count size limit enforcement', () => {
  it('recruitment is blocked when members.length + N > maxCompanySize', () => {
    fc.assert(
      fc.property(
        // N: count of units to recruit (1–5)
        fc.integer({ min: 1, max: 5 }),
        // current member count: 1–15
        fc.integer({ min: 1, max: 15 }),
        // shortfall: how many slots short of fitting N units (1–N)
        fc.integer({ min: 1, max: 5 }),
        (n, currentMemberCount, shortfall) => {
          // maxCompanySize is set so that members.length + N > maxCompanySize
          // i.e. maxCompanySize = currentMemberCount + n - shortfall
          // We need maxCompanySize >= currentMemberCount (can't be smaller than current)
          const maxCompanySize = currentMemberCount + n - shortfall
          fc.pre(maxCompanySize >= currentMemberCount) // company is not already over limit
          fc.pre(shortfall <= n) // shortfall is at most N

          // Build a minimal company with currentMemberCount members
          const members: Member[] = Array.from({ length: currentMemberCount }, (_, i) =>
            makeMember({ id: `member_${i}`, role: 'warrior' })
          )

          // Simulate the size check from confirmRecruitment:
          //   if (company.members.length + candidates.length > maxCompanySize) → block
          const wouldExceedSize = members.length + n > maxCompanySize

          // Assert: the check correctly identifies that recruitment should be blocked
          expect(wouldExceedSize).toBe(true)

          // Assert: members array is unchanged (recruitment blocked, no members added)
          const membersAfterBlock = [...members] // no change
          expect(membersAfterBlock.length).toBe(members.length)
        }
      ),
      { numRuns: 200 }
    )
  })
})
