// Feature: company-special-rules-enforcement, Property 3: Non-Matching Units Get Standard Promotion

/**
 * Property 3: Non-Matching Units Get Standard Promotion
 *
 * **Validates: Requirements 1.5**
 *
 * For any member whose baseUnitId does NOT match any heroPromotionOnly
 * advancement's fromBaseUnitId, applying hero promotion SHALL return null
 * (indicating caller should use standard Hero in the Making logic).
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyHeroPromotionSwap } from '../advancement'
import companiesData from '../../data/companies.json'
import type { CompanyDefinition, Member } from '../../models'

const ALL_COMPANIES = companiesData as CompanyDefinition[]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get all fromBaseUnitIds that have heroPromotionOnly advancements in a company.
 */
function getHeroPromotionFromIds(companyDef: CompanyDefinition): string[] {
  return companyDef.advancements
    .filter((a) => a.heroPromotionOnly)
    .map((a) => a.fromBaseUnitId)
}

/**
 * Companies that have at least one heroPromotionOnly advancement.
 * These are the companies where the non-matching path is meaningful.
 */
const COMPANIES_WITH_HERO_PROMOTION = ALL_COMPANIES.filter(
  (c) => c.advancements.some((a) => a.heroPromotionOnly)
)

/**
 * Companies that have NO heroPromotionOnly advancements.
 * For these, every member should get null from applyHeroPromotionSwap.
 */
const COMPANIES_WITHOUT_HERO_PROMOTION = ALL_COMPANIES.filter(
  (c) => !c.advancements.some((a) => a.heroPromotionOnly)
)

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Arbitrary equipment array */
const arbEquipment = fc.array(
  fc.constantFrom('spear', 'shield', 'bow', 'armour', 'sword', 'dagger', 'whip'),
  { minLength: 0, maxLength: 4 }
)

/** Arbitrary base unit ID that does NOT match any heroPromotionOnly fromBaseUnitId */
function arbNonMatchingBaseUnitId(companyDef: CompanyDefinition): fc.Arbitrary<string> {
  const promotionFromIds = new Set(getHeroPromotionFromIds(companyDef))
  // Use unit IDs from the company's reinforcement table that aren't in the promotion set
  const companyUnitIds = companyDef.reinforcementTable
    .filter((e) => e.baseUnitId && !promotionFromIds.has(e.baseUnitId))
    .map((e) => e.baseUnitId!)

  // Also add some generic IDs that definitely won't match
  const candidateIds = [
    ...new Set([
      ...companyUnitIds,
      'warrior_of_gondor',
      'orc_warrior',
      'hobbit_militia',
      'uruk_hai_scout',
      'elf_warrior',
    ]),
  ].filter((id) => !promotionFromIds.has(id))

  return fc.constantFrom(...candidateIds)
}

/** Build a Member with given baseUnitId and random equipment */
function arbMember(baseUnitId: fc.Arbitrary<string>): fc.Arbitrary<Member> {
  return fc.record({
    id: fc.uuid(),
    name: fc.constant('Test Member'),
    baseUnitId,
    role: fc.constant('warrior' as const),
    equipment: arbEquipment,
    experience: fc.nat({ max: 30 }),
    lifetimeExperience: fc.nat({ max: 50 }),
    injuries: fc.constant([]),
    specialRules: fc.constant([]),
    statIncreases: fc.constant({}),
    statDecreases: fc.constant({}),
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Feature: company-special-rules-enforcement, Property 3: Non-Matching Units Get Standard Promotion', () => {
  it('non-matching baseUnitId in company WITH heroPromotionOnly advancements returns null', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...COMPANIES_WITH_HERO_PROMOTION).chain((companyDef) =>
          fc.tuple(fc.constant(companyDef), arbMember(arbNonMatchingBaseUnitId(companyDef)))
        ),
        ([companyDef, member]) => {
          const result = applyHeroPromotionSwap(member, companyDef)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('any member in company WITHOUT heroPromotionOnly advancements returns null', () => {
    // For companies with no heroPromotionOnly advancements, every unit gets null
    fc.assert(
      fc.property(
        fc.constantFrom(...COMPANIES_WITHOUT_HERO_PROMOTION),
        fc.constantFrom(
          'warrior_of_gondor',
          'orc_warrior',
          'hobbit_militia',
          'ranger_of_arnor',
          'knight_of_arnor',
          'uruk_hai_scout'
        ),
        arbEquipment,
        (companyDef, baseUnitId, equipment) => {
          const member: Member = {
            id: 'test-1',
            name: 'Test',
            baseUnitId,
            role: 'warrior',
            equipment,
            experience: 5,
            lifetimeExperience: 10,
            injuries: [],
            specialRules: [],
            statIncreases: {},
            statDecreases: {},
          }
          const result = applyHeroPromotionSwap(member, companyDef)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('null result means original baseUnitId is preserved (caller uses standard logic)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...COMPANIES_WITH_HERO_PROMOTION).chain((companyDef) =>
          fc.tuple(fc.constant(companyDef), arbMember(arbNonMatchingBaseUnitId(companyDef)))
        ),
        ([companyDef, member]) => {
          const originalBaseUnitId = member.baseUnitId
          const result = applyHeroPromotionSwap(member, companyDef)

          // Result is null — no swap happened
          expect(result).toBeNull()

          // Original member is unchanged (function is pure, no mutation)
          expect(member.baseUnitId).toBe(originalBaseUnitId)
        }
      ),
      { numRuns: 100 }
    )
  })
})
