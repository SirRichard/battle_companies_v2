// Feature: member-detail-enhancements, Property 6: Parameter Resolution Correctness

/**
 * Property 6: Parameter Resolution Correctness
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 *
 * For any parameterised special rule entry { id, parameter } stored on a member,
 * resolveParameterisedLabel SHALL produce a label that:
 * - Contains the concrete parameter value (resolved to weapon label for
 *   parameter_type: weapon, hero name for friendly_hero, raw value otherwise)
 * - Never contains the literal text "(X)"
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import specialRulesData from '../../data/specialRules.json'
import wargearData from '../../data/wargear.json'
import { resolveParameterisedLabel } from '../paramLabel'

// ── Data setup ────────────────────────────────────────────────────────────────

interface SpecialRuleEntry {
  id: string
  label: string
  parameterised?: boolean
  parameter_type?: string
}

interface WargearEntry {
  id: string
  label: string
}

const SPECIAL_RULES = specialRulesData as SpecialRuleEntry[]
const WARGEAR = wargearData as WargearEntry[]

const PARAMETERISED_RULES = SPECIAL_RULES.filter((r) => r.parameterised === true)

const WEAPON_RULES = PARAMETERISED_RULES.filter((r) => r.parameter_type === 'weapon')
const FRIENDLY_HERO_RULES = PARAMETERISED_RULES.filter(
  (r) => r.parameter_type === 'friendly_hero'
)
const INTEGER_RULES = PARAMETERISED_RULES.filter((r) => r.parameter_type === 'integer')
const DISTANCE_RULES = PARAMETERISED_RULES.filter((r) => r.parameter_type === 'distance')
const TARGET_INTEGER_RULES = PARAMETERISED_RULES.filter(
  (r) => r.parameter_type === 'target_integer'
)
const TARGET_KEYWORD_RULES = PARAMETERISED_RULES.filter(
  (r) => r.parameter_type === 'target_keyword'
)

const WARGEAR_IDS = WARGEAR.map((w) => w.id)

// ── Generators ────────────────────────────────────────────────────────────────

/** Pick a random parameterised rule from a given subset */
function arbRuleFrom(rules: SpecialRuleEntry[]) {
  return fc.constantFrom(...rules)
}

/** Generate a member array with a guaranteed matching member */
function arbCompanyMembers(heroId: string) {
  const nameArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0)
  return nameArb.map((name) => [{ id: heroId, name }])
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 6: Parameter Resolution Correctness', () => {
  it('weapon type: output contains the wargear label and never "(X)"', () => {
    // Skip if no weapon rules exist
    if (WEAPON_RULES.length === 0 || WARGEAR_IDS.length === 0) return

    fc.assert(
      fc.property(
        arbRuleFrom(WEAPON_RULES),
        fc.constantFrom(...WARGEAR_IDS),
        (rule, weaponId) => {
          const result = resolveParameterisedLabel({ id: rule.id, parameter: weaponId })
          const weapon = WARGEAR.find((w) => w.id === weaponId)!

          // Must contain the resolved weapon label
          expect(result).toContain(weapon.label)
          // Must never contain literal "(X)"
          expect(result).not.toMatch(/\(X[^)]*\)/)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('friendly_hero type: output contains the hero name and never "(X)"', () => {
    if (FRIENDLY_HERO_RULES.length === 0) return

    fc.assert(
      fc.property(
        arbRuleFrom(FRIENDLY_HERO_RULES),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0 && !s.startsWith('X')),
        fc.uuid(),
        (rule, heroName, heroId) => {
          const members = [{ id: heroId, name: heroName }]
          const result = resolveParameterisedLabel(
            { id: rule.id, parameter: heroId },
            members
          )

          // Must contain the hero name
          expect(result).toContain(heroName)
          // Must never contain literal "(X)"
          expect(result).not.toMatch(/\(X[^)]*\)/)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('integer type: output contains the raw integer value and never "(X)"', () => {
    if (INTEGER_RULES.length === 0) return

    fc.assert(
      fc.property(
        arbRuleFrom(INTEGER_RULES),
        fc.integer({ min: 1, max: 10 }),
        (rule, value) => {
          const result = resolveParameterisedLabel({ id: rule.id, parameter: value })

          // Must contain the raw value
          expect(result).toContain(String(value))
          // Must never contain literal "(X)"
          expect(result).not.toMatch(/\(X[^)]*\)/)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('distance type: output contains the raw distance value and never "(X)"', () => {
    if (DISTANCE_RULES.length === 0) return

    fc.assert(
      fc.property(
        arbRuleFrom(DISTANCE_RULES),
        fc.integer({ min: 1, max: 24 }),
        (rule, value) => {
          const result = resolveParameterisedLabel({ id: rule.id, parameter: value })

          expect(result).toContain(String(value))
          expect(result).not.toMatch(/\(X[^)]*\)/)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('target_integer type: output contains the raw value and never "(X)"', () => {
    if (TARGET_INTEGER_RULES.length === 0) return

    fc.assert(
      fc.property(
        arbRuleFrom(TARGET_INTEGER_RULES),
        fc.integer({ min: 1, max: 6 }).map((n) => `${n}+`),
        (rule, value) => {
          const result = resolveParameterisedLabel({ id: rule.id, parameter: value })

          expect(result).toContain(value)
          expect(result).not.toMatch(/\(X[^)]*\)/)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('target_keyword type: output contains the raw keyword and never "(X)"', () => {
    if (TARGET_KEYWORD_RULES.length === 0) return

    const keywords = fc.constantFrom(
      'Beast', 'Cavalry', 'Elf', 'Dwarf', 'Man', 'Orc', 'Hobbit', 'Monster'
    )

    fc.assert(
      fc.property(
        arbRuleFrom(TARGET_KEYWORD_RULES),
        keywords,
        (rule, keyword) => {
          const result = resolveParameterisedLabel({ id: rule.id, parameter: keyword })

          expect(result).toContain(keyword)
          expect(result).not.toMatch(/\(X[^)]*\)/)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no parameterised rule ever produces output containing literal "(X)"', () => {
    if (PARAMETERISED_RULES.length === 0) return

    // Generate appropriate parameter for each rule type
    const arbEntry = fc.constantFrom(...PARAMETERISED_RULES).chain((rule) => {
      let paramArb: fc.Arbitrary<string | number>

      switch (rule.parameter_type) {
        case 'weapon':
          paramArb = fc.constantFrom(...WARGEAR_IDS)
          break
        case 'friendly_hero':
          paramArb = fc.uuid()
          break
        case 'integer':
        case 'distance':
          paramArb = fc.integer({ min: 1, max: 20 })
          break
        case 'target_integer':
          paramArb = fc.integer({ min: 1, max: 6 }).map((n) => `${n}+`)
          break
        case 'target_keyword':
          paramArb = fc.constantFrom(
            'Beast', 'Cavalry', 'Elf', 'Dwarf', 'Man', 'Orc'
          )
          break
        default:
          paramArb = fc.string({ minLength: 1, maxLength: 10 })
          break
      }

      return paramArb.map((param) => ({ rule, param }))
    })

    fc.assert(
      fc.property(arbEntry, ({ rule, param }) => {
        // For friendly_hero, provide matching members
        let members: Array<{ id: string; name: string }> | undefined
        if (rule.parameter_type === 'friendly_hero') {
          members = [{ id: String(param), name: 'TestHero' }]
        }

        const result = resolveParameterisedLabel(
          { id: rule.id, parameter: param },
          members
        )

        expect(result).not.toMatch(/\(X[^)]*\)/)
      }),
      { numRuns: 200 }
    )
  })
})
