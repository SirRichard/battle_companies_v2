// Feature: company-special-rules-enforcement, Property 7: Company of Heroes Auto-Promotion

/**
 * Property 7: Company of Heroes Auto-Promotion
 * Validates: Requirements 5.1
 *
 * For any new member added via reinforcement to a company with the
 * `company_of_heroes` rule, the resulting member SHALL have `role` set to
 * `hero_in_making` and `heroStats` set to `{might: 1, will: 1, fate: 1}`.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyCompanyOfHeroesPromotion } from '../advancement'
import type { Member, Injury } from '../../models'

// ── Generators ────────────────────────────────────────────────────────────────

// Arbitrary base unit IDs representing possible reinforcement results
const arbBaseUnitId = fc.constantFrom(
  'warrior_of_numenor',
  'hobbit_militia',
  'hobbit_shirriff',
  'ranger_of_arnor',
  'dwarf_warrior',
  'wood_elf_warrior',
  'orc_warrior',
  'uruk_hai'
)

// Arbitrary equipment list
const arbEquipment = fc.array(
  fc.constantFrom('spear', 'shield', 'bow', 'sword', 'armour', 'dagger', 'longbow', 'throwing_weapons'),
  { minLength: 0, maxLength: 5 }
)

// Arbitrary member name
const arbName = fc.constantFrom(
  'Aragorn',
  'Frodo',
  'Gimli',
  'Legolas',
  'Boromir',
  'Samwise',
  'Merry',
  'Pippin'
)

// Arbitrary new recruit member (warrior role, no heroStats, fresh recruit)
const arbNewRecruit: fc.Arbitrary<Member> = fc
  .record({
    baseUnitId: arbBaseUnitId,
    equipment: arbEquipment,
    name: arbName,
  })
  .map(({ baseUnitId, equipment, name }) => ({
    id: 'recruit-1',
    name,
    baseUnitId,
    role: 'warrior' as const,
    equipment,
    experience: 0,
    lifetimeExperience: 0,
    injuries: [] as Injury[],
    specialRules: [] as string[],
    statIncreases: {},
    statDecreases: {},
  }))

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 7: Company of Heroes Auto-Promotion', () => {
  it('any new recruit promoted via Company of Heroes has role=hero_in_making and heroStats={might:1, will:1, fate:1}', () => {
    fc.assert(
      fc.property(arbNewRecruit, (member) => {
        const result = applyCompanyOfHeroesPromotion(member)

        // Role must be hero_in_making
        expect(result.role).toBe('hero_in_making')

        // heroStats must be exactly {might: 1, will: 1, fate: 1}
        expect(result.heroStats).toEqual({ might: 1, will: 1, fate: 1 })
      }),
      { numRuns: 100 }
    )
  })

  it('auto-promotion preserves all other member fields unchanged', () => {
    fc.assert(
      fc.property(arbNewRecruit, (member) => {
        const result = applyCompanyOfHeroesPromotion(member)

        // All non-role/heroStats fields preserved
        expect(result.id).toBe(member.id)
        expect(result.name).toBe(member.name)
        expect(result.baseUnitId).toBe(member.baseUnitId)
        expect(result.equipment).toEqual(member.equipment)
        expect(result.experience).toBe(member.experience)
        expect(result.lifetimeExperience).toBe(member.lifetimeExperience)
        expect(result.injuries).toEqual(member.injuries)
        expect(result.specialRules).toEqual(member.specialRules)
        expect(result.statIncreases).toEqual(member.statIncreases)
        expect(result.statDecreases).toEqual(member.statDecreases)
      }),
      { numRuns: 100 }
    )
  })

  it('auto-promotion works regardless of baseUnitId (any unit type gets promoted)', () => {
    fc.assert(
      fc.property(arbBaseUnitId, arbEquipment, (baseUnitId, equipment) => {
        const member: Member = {
          id: 'any-unit',
          name: 'Test',
          baseUnitId,
          role: 'warrior',
          equipment,
          experience: 0,
          lifetimeExperience: 0,
          injuries: [],
          specialRules: [],
          statIncreases: {},
          statDecreases: {},
        }

        const result = applyCompanyOfHeroesPromotion(member)

        expect(result.role).toBe('hero_in_making')
        expect(result.heroStats).toEqual({ might: 1, will: 1, fate: 1 })
      }),
      { numRuns: 100 }
    )
  })
})
