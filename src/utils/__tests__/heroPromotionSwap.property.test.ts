// Feature: company-special-rules-enforcement, Property 1: Hero Promotion Profile Swap Identity

/**
 * Property 1: Hero Promotion Profile Swap Identity
 * Validates: Requirements 1.1, 1.4
 *
 * For any member with `baseUnitId` matching a `heroPromotionOnly` advancement's
 * `fromBaseUnitId`, applying hero promotion SHALL change the member's `baseUnitId`
 * to the advancement's `toBaseUnitId`, set `role` to `hero_in_making`, and grant
 * `heroStats` of `{might: 1, will: 1, fate: 1}`.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyHeroPromotionSwap } from '../advancement'
import companiesData from '../../data/companies.json'
import type { CompanyDefinition, Member, Injury } from '../../models'

// ── Data setup ────────────────────────────────────────────────────────────────

const ALL_COMPANIES = companiesData as CompanyDefinition[]

// Companies that have at least one heroPromotionOnly advancement
const COMPANIES_WITH_HERO_PROMOTION = ALL_COMPANIES.filter((c) =>
  c.advancements.some((a) => a.heroPromotionOnly)
)

// Build a list of all heroPromotionOnly advancements paired with their company
const HERO_PROMOTION_ENTRIES = COMPANIES_WITH_HERO_PROMOTION.flatMap((companyDef) =>
  companyDef.advancements
    .filter((a) => a.heroPromotionOnly)
    .map((advancement) => ({ companyDef, advancement }))
)

// ── Generators ────────────────────────────────────────────────────────────────

// Arbitrary equipment list (random strings simulating equipment IDs)
const arbEquipment = fc.array(
  fc.constantFrom('spear', 'shield', 'bow', 'sword', 'armour', 'dagger', 'lance'),
  { minLength: 0, maxLength: 5 }
)

// Arbitrary experience value
const arbExperience = fc.nat({ max: 50 })

// Arbitrary member that matches a heroPromotionOnly advancement's fromBaseUnitId
const arbMatchingMemberAndCompany = fc
  .constantFrom(...HERO_PROMOTION_ENTRIES)
  .chain(({ companyDef, advancement }) =>
    fc
      .record({
        equipment: arbEquipment,
        experience: arbExperience,
        name: fc.constant('Test Member'),
      })
      .map(({ equipment, experience, name }) => ({
        member: {
          id: 'test-member-1',
          name,
          baseUnitId: advancement.fromBaseUnitId,
          role: 'warrior' as const,
          equipment,
          experience,
          lifetimeExperience: experience,
          injuries: [] as Injury[],
          specialRules: [] as string[],
          statIncreases: {},
          statDecreases: {},
        } satisfies Member,
        companyDef,
        expectedToBaseUnitId: advancement.toBaseUnitId,
      }))
  )

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 1: Hero Promotion Profile Swap Identity', () => {
  it('matching member baseUnitId → swaps to toBaseUnitId, sets role to hero_in_making, grants heroStats {might:1, will:1, fate:1}', () => {
    fc.assert(
      fc.property(arbMatchingMemberAndCompany, ({ member, companyDef, expectedToBaseUnitId }) => {
        const result = applyHeroPromotionSwap(member, companyDef)

        // Must not return null for a matching member
        expect(result).not.toBeNull()

        // baseUnitId swapped to toBaseUnitId
        expect(result!.baseUnitId).toBe(expectedToBaseUnitId)

        // role set to hero_in_making
        expect(result!.role).toBe('hero_in_making')

        // heroStats granted as {might: 1, will: 1, fate: 1}
        expect(result!.heroStats).toEqual({ might: 1, will: 1, fate: 1 })
      }),
      { numRuns: 100 }
    )
  })
})
