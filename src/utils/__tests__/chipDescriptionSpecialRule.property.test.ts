// Feature: match-tracking-responsive, Property 5: Special rule chip description resolution

/**
 * Property 5: Special rule chip description resolution
 * Validates: Requirements 8.2
 *
 * For any special rule entry (plain ID or parameterised { id, parameter } object),
 * the chip description lookup SHALL return the description field from specialRules
 * data matching the rule ID. For parameterised rules, the result SHALL include
 * the parameter context.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import specialRulesData from '../../data/specialRules.json'
import { getChipDescription } from '../chipDescription'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpecialRuleEntry {
  id: string
  label: string
  description?: string
  parameterised?: boolean
}

const ALL_RULES = specialRulesData as SpecialRuleEntry[]

// ── Data subsets ──────────────────────────────────────────────────────────────

const RULES_WITH_DESCRIPTION = ALL_RULES.filter(
  (r) => r.description && r.description.length > 0
)

const PARAMETERISED_WITH_DESCRIPTION = RULES_WITH_DESCRIPTION.filter(
  (r) => r.parameterised === true
)

const NON_PARAMETERISED_WITH_DESCRIPTION = RULES_WITH_DESCRIPTION.filter(
  (r) => !r.parameterised
)

const ALL_KNOWN_IDS = new Set(ALL_RULES.map((r) => r.id))

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 5: Special rule chip description resolution', () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For any non-parameterised rule with a description, getChipDescription
   * with type='specialRule' returns that exact description.
   */
  it('plain rule IDs with description → returns matching description from data', () => {
    expect(NON_PARAMETERISED_WITH_DESCRIPTION.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(
        fc.constantFrom(...NON_PARAMETERISED_WITH_DESCRIPTION),
        (rule) => {
          const result = getChipDescription(rule.id, 'specialRule')

          expect(result.label).toBe(rule.label)
          expect(result.description).toBe(rule.description)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 8.2**
   *
   * For any parameterised rule with a description, calling getChipDescription
   * with a parameter value returns description that includes parameter context.
   */
  it('parameterised rules with parameter → description includes parameter context', () => {
    expect(PARAMETERISED_WITH_DESCRIPTION.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(
        fc.constantFrom(...PARAMETERISED_WITH_DESCRIPTION),
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) => s.trim().length > 0 && !s.includes(')')
          ),
          fc.integer({ min: 1, max: 99 }).map(String)
        ),
        (rule, parameter) => {
          const result = getChipDescription(rule.id, 'specialRule', parameter)

          expect(result.label).toBe(rule.label)
          // Description must contain the original rule description
          expect(result.description).toContain(rule.description)
          // Description must include parameter context
          expect(result.description).toContain(`(Parameter: ${parameter})`)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 8.2**
   *
   * For parameterised rules called WITHOUT a parameter, the description
   * is returned without parameter context appended.
   */
  it('parameterised rules without parameter → returns base description only', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PARAMETERISED_WITH_DESCRIPTION),
        (rule) => {
          const result = getChipDescription(rule.id, 'specialRule')

          expect(result.label).toBe(rule.label)
          expect(result.description).toBe(rule.description)
          expect(result.description).not.toContain('(Parameter:')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 8.2**
   *
   * For unknown rule IDs not in specialRules.json, returns humanised label
   * and fallback description.
   */
  it('unknown rule IDs → returns fallback "No description available."', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (s) => !ALL_KNOWN_IDS.has(s) && /^[a-z_]+$/.test(s)
        ),
        (unknownId) => {
          const result = getChipDescription(unknownId, 'specialRule')

          expect(result.description).toBe('No description available.')
        }
      ),
      { numRuns: 100 }
    )
  })
})
