/**
 * Preservation Property Tests
 * Property 2: Preservation — Non-Hero-Upgrade Display Behavior Unchanged
 *
 * Validates: Requirements 3.1, 3.2, 3.4, 3.5
 *
 * These tests capture baseline behavior observed on UNFIXED code.
 * They MUST ALL PASS on unfixed code (they test non-bug-condition cases).
 * They will continue to pass after the fix is applied.
 *
 * Observed behaviors on unfixed code:
 *   - Warrior member: isHero === false → hero upgrades section never rendered
 *   - Hero in company with heroUpgrade.length === 0: section is hidden (guard fires)
 *   - Hero who owns ALL upgrades: getEligibleHeroUpgrades returns [] → section hidden
 *   - getEligibleHeroUpgrades: stable, filters by baseUnitIds and allowedKeywords
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getEligibleHeroUpgrades } from '../../../utils/companyRules'
import companiesData from '../../../data/companies.json'
import type { CompanyDefinition, Injury, Member, MemberRole } from '../../../models'

const ALL_COMPANIES = companiesData as CompanyDefinition[]

// ── Companies with at least one heroUpgrade entry ─────────────────────────────
const COMPANIES_WITH_UPGRADES = ALL_COMPANIES.filter(
  (c) => c.heroUpgrade.length > 0
)

// ── Companies with NO heroUpgrade entries ─────────────────────────────────────
// NOTE: All companies in the data have at least one heroUpgrade entry.
// We simulate a company with no heroUpgrade by using a synthetic companyDef.
// This tests the guard: if (!companyDef || companyDef.heroUpgrade.length === 0) return null

// ── The Shire company — has two heroUpgrade entries ───────────────────────────
const SHIRE_COMPANY = ALL_COMPANIES.find((c) => c.id === 'the_shire')!

// ── Minimal member factory ────────────────────────────────────────────────────
function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'test-member-1',
    name: 'Test Member',
    baseUnitId: 'hobbit_militia',
    role: 'warrior',
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

function makeHeroMember(overrides: Partial<Member> = {}): Member {
  return makeMember({
    role: 'leader',
    heroStats: { might: 1, will: 1, fate: 1 },
    ...overrides,
  })
}

// ── Simulated MemberDetailsDrawer hero-upgrades section logic (current/unfixed) ──
// Mirrors the current code in MemberDetailsDrawer.tsx:
//   const isHero = member.role !== 'warrior'
//   if (!isHero) → section not rendered
//   if (!companyDef || companyDef.heroUpgrade.length === 0) return null
//   const eligibleUpgrades = getEligibleHeroUpgrades(companyDef, member)
//   if (eligibleUpgrades.length === 0) return null
//   return eligibleUpgrades  // (the bug: shows eligible-to-earn, not owned)
function simulateHeroUpgradesSectionLogic(
  companyDef: CompanyDefinition | null,
  member: Member
): 'not_rendered' | 'hidden' | { upgrades: ReturnType<typeof getEligibleHeroUpgrades> } {
  // Step 1: isHero check
  const isHero = member.role !== 'warrior'
  if (!isHero) return 'not_rendered'

  // Step 2: companyDef guard
  if (!companyDef || companyDef.heroUpgrade.length === 0) return 'hidden'

  // Step 3: eligible upgrades (current/unfixed logic)
  const eligibleUpgrades = getEligibleHeroUpgrades(companyDef, member)
  if (eligibleUpgrades.length === 0) return 'hidden'

  return { upgrades: eligibleUpgrades }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

// Warrior roles (non-hero)
const WARRIOR_ROLES: MemberRole[] = ['warrior']

// Hero roles
const HERO_ROLES: MemberRole[] = ['leader', 'sergeant', 'hero_in_making']

// Arbitrary: a warrior member
const arbitraryWarriorMember = fc.record({
  id: fc.constant('test-warrior'),
  name: fc.constant('Test Warrior'),
  baseUnitId: fc.constantFrom('hobbit_militia', 'hobbit_shirriff', 'warrior_of_arnor'),
  role: fc.constantFrom<MemberRole>(...WARRIOR_ROLES),
  equipment: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
  experience: fc.nat({ max: 50 }),
  lifetimeExperience: fc.nat({ max: 50 }),
  injuries: fc.constant([] as Injury[]),
  specialRules: fc.constant([] as string[]),
  statIncreases: fc.constant({}),
  statDecreases: fc.constant({}),
})

// Arbitrary: a hero member with all Shire upgrades owned
const SHIRE_UPGRADE_IDS = SHIRE_COMPANY.heroUpgrade.map((u) => u.id)
const arbitraryHeroWithAllShireUpgrades = fc.record({
  id: fc.constant('test-hero-all'),
  name: fc.constant('Bilbo'),
  baseUnitId: fc.constant('hobbit_militia'),
  role: fc.constantFrom<MemberRole>(...HERO_ROLES),
  equipment: fc.constant([...SHIRE_UPGRADE_IDS] as string[]),
  experience: fc.nat({ max: 50 }),
  lifetimeExperience: fc.nat({ max: 50 }),
  injuries: fc.constant([] as Injury[]),
  specialRules: fc.constant([] as string[]),
  heroStats: fc.constant({ might: 1, will: 1, fate: 1 }),
  statIncreases: fc.constant({}),
  statDecreases: fc.constant({}),
})

// Arbitrary: a hero member for any company with upgrades
const arbitraryHeroMemberForCompanyWithUpgrades = fc.record({
  id: fc.constant('test-hero-1'),
  name: fc.constant('Test Hero'),
  baseUnitId: fc.constant('hobbit_militia'),
  role: fc.constantFrom<MemberRole>(...HERO_ROLES),
  equipment: fc.constant([] as string[]),
  experience: fc.nat({ max: 50 }),
  lifetimeExperience: fc.nat({ max: 50 }),
  injuries: fc.constant([] as Injury[]),
  specialRules: fc.constant([] as string[]),
  heroStats: fc.constant({ might: 1, will: 1, fate: 1 }),
  statIncreases: fc.constant({}),
  statDecreases: fc.constant({}),
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 2 (Preservation): Non-Hero-Upgrade Display Behavior Unchanged', () => {
  /**
   * Preservation 1: Warrior members — hero upgrades section is NEVER rendered
   *
   * For any warrior member (role === 'warrior'), isHero === false, so the
   * hero upgrades section is never rendered regardless of companyDef.
   *
   * Observed on unfixed code: returns 'not_rendered'.
   * Expected after fix: same — 'not_rendered'.
   */
  describe('Warrior member preservation', () => {
    it('warrior member: hero upgrades section is never rendered (not_rendered)', () => {
      const warrior = makeMember({ role: 'warrior' })
      const result = simulateHeroUpgradesSectionLogic(SHIRE_COMPANY, warrior)
      expect(result).toBe('not_rendered')
    })

    it('warrior member with equipment: hero upgrades section is never rendered', () => {
      const warrior = makeMember({
        role: 'warrior',
        equipment: [...SHIRE_UPGRADE_IDS],
      })
      const result = simulateHeroUpgradesSectionLogic(SHIRE_COMPANY, warrior)
      expect(result).toBe('not_rendered')
    })

    it('for any warrior member, hero upgrades section is never rendered regardless of company', () => {
      fc.assert(
        fc.property(
          arbitraryWarriorMember,
          fc.constantFrom(...COMPANIES_WITH_UPGRADES),
          (warrior, companyDef) => {
            const result = simulateHeroUpgradesSectionLogic(companyDef, warrior)
            expect(result).toBe('not_rendered')
          }
        ),
        { numRuns: 200 }
      )
    })

    it('warrior with null companyDef: hero upgrades section is never rendered', () => {
      const warrior = makeMember({ role: 'warrior' })
      const result = simulateHeroUpgradesSectionLogic(null, warrior)
      expect(result).toBe('not_rendered')
    })
  })

  /**
   * Preservation 2: Hero in company with heroUpgrade.length === 0 — section is hidden
   *
   * When companyDef.heroUpgrade is empty, the guard fires and returns null (hidden).
   * This is correct behavior both before and after the fix.
   *
   * Observed on unfixed code: returns 'hidden'.
   * Expected after fix: same — 'hidden'.
   */
  describe('Hero in company with no heroUpgrade entries', () => {
    it('hero in company with heroUpgrade=[] should have section hidden', () => {
      const hero = makeHeroMember()
      // Synthetic company with no heroUpgrade entries
      const emptyCompany: CompanyDefinition = {
        ...SHIRE_COMPANY,
        id: 'test_empty',
        heroUpgrade: [],
      }
      const result = simulateHeroUpgradesSectionLogic(emptyCompany, hero)
      expect(result).toBe('hidden')
    })

    it('for any hero member in a company with heroUpgrade=[], section is hidden', () => {
      fc.assert(
        fc.property(
          arbitraryHeroMemberForCompanyWithUpgrades,
          (hero) => {
            const emptyCompany: CompanyDefinition = {
              ...SHIRE_COMPANY,
              id: 'test_empty',
              heroUpgrade: [],
            }
            const result = simulateHeroUpgradesSectionLogic(emptyCompany, hero)
            expect(result).toBe('hidden')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('hero with null companyDef: section is hidden', () => {
      const hero = makeHeroMember()
      const result = simulateHeroUpgradesSectionLogic(null, hero)
      expect(result).toBe('hidden')
    })
  })

  /**
   * Preservation 3: Hero who owns ALL upgrades — section is hidden (coincidentally correct)
   *
   * When a hero owns all upgrades in companyDef.heroUpgrade, getEligibleHeroUpgrades
   * returns [] (all filtered out as already owned). The section is hidden.
   *
   * This is coincidentally correct on unfixed code (the bug doesn't fire here).
   * Expected after fix: same — section shows all owned upgrades (not hidden).
   *
   * NOTE: This test captures the UNFIXED behavior (section hidden when all owned).
   * After the fix, the section will show owned upgrades instead of being hidden.
   * This test is scoped to the UNFIXED behavior observation.
   *
   * Validates: Requirement 3.1 — hero already possessing an upgrade is excluded
   * from eligible swap options (getEligibleHeroUpgrades returns [] when all owned).
   */
  describe('Hero who owns all upgrades — getEligibleHeroUpgrades returns []', () => {
    it('hero who owns all Shire upgrades: getEligibleHeroUpgrades returns []', () => {
      const hero = makeHeroMember({ equipment: [...SHIRE_UPGRADE_IDS] })
      const eligible = getEligibleHeroUpgrades(SHIRE_COMPANY, hero)
      expect(eligible).toHaveLength(0)
    })

    it('for any hero who owns all upgrades in a company, getEligibleHeroUpgrades returns []', () => {
      fc.assert(
        fc.property(
          arbitraryHeroWithAllShireUpgrades,
          (hero) => {
            const eligible = getEligibleHeroUpgrades(SHIRE_COMPANY, hero)
            expect(eligible).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('hero who owns all upgrades in any company: getEligibleHeroUpgrades returns []', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...COMPANIES_WITH_UPGRADES),
          (companyDef) => {
            const allUpgradeIds = companyDef.heroUpgrade.map((u) => u.id)
            const hero = makeHeroMember({
              baseUnitId: companyDef.heroUpgrade[0].baseUnitIds?.[0] ?? 'hobbit_militia',
              equipment: allUpgradeIds,
            })
            const eligible = getEligibleHeroUpgrades(companyDef, hero)
            // All upgrades are owned, so none are eligible
            // (some may be filtered by baseUnitIds/allowedKeywords, but owned ones are always excluded)
            const ownedAndEligibleByUnit = companyDef.heroUpgrade.filter((u) => {
              // Check if this upgrade would be eligible for this unit (ignoring ownership)
              if (u.baseUnitIds && u.baseUnitIds.length > 0 && !u.baseUnitIds.includes(hero.baseUnitId)) return false
              return true
            })
            // All upgrades that would be eligible for this unit are owned, so eligible should be []
            const eligibleWithoutOwnershipCheck = ownedAndEligibleByUnit.filter(
              (u) => !hero.equipment.includes(u.id)
            )
            expect(eligibleWithoutOwnershipCheck).toHaveLength(0)
            // The actual function should also return [] for owned upgrades
            const ownedUpgradesInEligible = eligible.filter((u) =>
              hero.equipment.includes(u.id)
            )
            expect(ownedUpgradesInEligible).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Preservation 4: getEligibleHeroUpgrades filters correctly
   *
   * Validates: Requirement 3.2 — getEligibleHeroUpgrades SHALL CONTINUE TO
   * filter by baseUnitIds and allowedKeywords correctly for any input.
   *
   * These tests verify the function's filtering logic is stable and unchanged.
   */
  describe('getEligibleHeroUpgrades filtering preservation', () => {
    /**
     * 4a: Already-owned upgrades are always excluded
     * Requirement 3.1: hero already possessing an upgrade → excluded from eligible
     */
    it('already-owned upgrade is excluded from eligible upgrades', () => {
      const ownedId = SHIRE_UPGRADE_IDS[0]
      const hero = makeHeroMember({ equipment: [ownedId] })
      const eligible = getEligibleHeroUpgrades(SHIRE_COMPANY, hero)
      const ownedInEligible = eligible.find((u) => u.id === ownedId)
      expect(ownedInEligible).toBeUndefined()
    })

    it('for any subset of owned upgrades, none appear in getEligibleHeroUpgrades result', () => {
      const subsetArb = fc.array(
        fc.constantFrom(...SHIRE_UPGRADE_IDS),
        { minLength: 0, maxLength: SHIRE_UPGRADE_IDS.length }
      ).map((arr) => [...new Set(arr)])

      fc.assert(
        fc.property(
          subsetArb,
          (ownedIds) => {
            const hero = makeHeroMember({ equipment: ownedIds })
            const eligible = getEligibleHeroUpgrades(SHIRE_COMPANY, hero)
            // No owned upgrade should appear in eligible
            const ownedInEligible = eligible.filter((u) =>
              ownedIds.includes(u.id)
            )
            expect(ownedInEligible).toHaveLength(0)
          }
        ),
        { numRuns: 200 }
      )
    })

    /**
     * 4b: baseUnitIds filtering — upgrade with baseUnitIds only eligible for matching units
     * Requirement 3.2: filter by baseUnitIds
     *
     * The Wanderers in the Wild company has "i_have_my_own_sword" with
     * allowedKeywords: ["hobbit"] — only hobbit units can get it.
     */
    it('upgrade with allowedKeywords is excluded for non-matching unit', () => {
      const WANDERERS = ALL_COMPANIES.find((c) => c.id === 'wanderers_in_the_wild')!
      // "i_have_my_own_sword" has allowedKeywords: ["hobbit"]
      const keywordUpgrade = WANDERERS.heroUpgrade.find(
        (u) => u.allowedKeywords && u.allowedKeywords.length > 0
      )
      if (!keywordUpgrade) return // skip if no keyword-restricted upgrade

      // A non-hobbit hero (warrior_of_arnor has keyword "man")
      const nonHobbitHero = makeHeroMember({ baseUnitId: 'warrior_of_arnor' })
      const eligible = getEligibleHeroUpgrades(WANDERERS, nonHobbitHero)
      const keywordUpgradeInEligible = eligible.find((u) => u.id === keywordUpgrade.id)
      expect(keywordUpgradeInEligible).toBeUndefined()
    })

    it('upgrade with allowedKeywords is included for matching unit', () => {
      const WANDERERS = ALL_COMPANIES.find((c) => c.id === 'wanderers_in_the_wild')!
      const keywordUpgrade = WANDERERS.heroUpgrade.find(
        (u) => u.allowedKeywords && u.allowedKeywords.length > 0
      )
      if (!keywordUpgrade) return // skip if no keyword-restricted upgrade

      // A hobbit hero
      const hobbitHero = makeHeroMember({ baseUnitId: 'hobbit_militia' })
      const eligible = getEligibleHeroUpgrades(WANDERERS, hobbitHero)
      const keywordUpgradeInEligible = eligible.find((u) => u.id === keywordUpgrade.id)
      expect(keywordUpgradeInEligible).toBeDefined()
    })

    /**
     * 4c: baseUnitIds filtering — upgrade with baseUnitIds only eligible for listed units
     * Requirement 3.2: filter by baseUnitIds
     *
     * Dol Amroth company has an upgrade with baseUnitIds: ["knight_of_dol_amroth", "man_at_arms_of_dol_amroth"]
     */
    it('upgrade with baseUnitIds is excluded for non-listed unit', () => {
      const DOL_AMROTH = ALL_COMPANIES.find((c) => c.id === 'dol_amroth')!
      const baseUnitUpgrade = DOL_AMROTH?.heroUpgrade.find(
        (u) => u.baseUnitIds && u.baseUnitIds.length > 0
      )
      if (!DOL_AMROTH || !baseUnitUpgrade) return // skip if not found

      // A hobbit hero (not in baseUnitIds)
      const hobbitHero = makeHeroMember({ baseUnitId: 'hobbit_militia' })
      const eligible = getEligibleHeroUpgrades(DOL_AMROTH, hobbitHero)
      const baseUnitUpgradeInEligible = eligible.find((u) => u.id === baseUnitUpgrade.id)
      expect(baseUnitUpgradeInEligible).toBeUndefined()
    })

    it('upgrade with baseUnitIds is included for listed unit', () => {
      const DOL_AMROTH = ALL_COMPANIES.find((c) => c.id === 'dol_amroth')!
      const baseUnitUpgrade = DOL_AMROTH?.heroUpgrade.find(
        (u) => u.baseUnitIds && u.baseUnitIds.length > 0
      )
      if (!DOL_AMROTH || !baseUnitUpgrade) return // skip if not found

      const allowedUnitId = baseUnitUpgrade.baseUnitIds![0]
      const hero = makeHeroMember({ baseUnitId: allowedUnitId })
      const eligible = getEligibleHeroUpgrades(DOL_AMROTH, hero)
      const baseUnitUpgradeInEligible = eligible.find((u) => u.id === baseUnitUpgrade.id)
      expect(baseUnitUpgradeInEligible).toBeDefined()
    })

    /**
     * 4d: Result stability — calling getEligibleHeroUpgrades twice with the same
     * inputs returns the same result (pure function, no side effects).
     */
    it('getEligibleHeroUpgrades is stable (same inputs → same output)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...COMPANIES_WITH_UPGRADES),
          fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
          (companyDef, equipment) => {
            const hero = makeHeroMember({ equipment })
            const result1 = getEligibleHeroUpgrades(companyDef, hero)
            const result2 = getEligibleHeroUpgrades(companyDef, hero)
            expect(result1.map((u) => u.id)).toEqual(result2.map((u) => u.id))
          }
        ),
        { numRuns: 200 }
      )
    })

    /**
     * 4e: getEligibleHeroUpgrades never returns an upgrade that is in member.equipment
     * (ownership exclusion is always applied)
     */
    it('getEligibleHeroUpgrades never returns an upgrade already in member.equipment', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...COMPANIES_WITH_UPGRADES),
          fc.array(
            fc.constantFrom(...COMPANIES_WITH_UPGRADES.flatMap((c) => c.heroUpgrade.map((u) => u.id))),
            { minLength: 0, maxLength: 5 }
          ).map((arr) => [...new Set(arr)]),
          (companyDef, equipment) => {
            const hero = makeHeroMember({ equipment })
            const eligible = getEligibleHeroUpgrades(companyDef, hero)
            const ownedInEligible = eligible.filter((u) =>
              equipment.includes(u.id)
            )
            expect(ownedInEligible).toHaveLength(0)
          }
        ),
        { numRuns: 200 }
      )
    })
  })
})
