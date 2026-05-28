// Feature: parameterized-special-rules, Property 8: Ownership determination correctness

/**
 * Property 8: Ownership determination correctness
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 *
 * For any member specialRules array (containing a mix of strings and { id, parameter } objects)
 * and any candidate rule:
 * - A non-parameterised rule is "owned" iff the array contains a string matching the rule's id or label
 * - A parameterised rule is "owned" iff the array contains an object with matching id AND exact same
 *   parameter, OR a plain string matching the rule's id (legacy)
 * - A parameterised rule with same id but different parameter is NOT "owned"
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { isRuleOwned } from '../parameterizedRules'
import type { Member } from '../../models'
import type { SpecialRuleEntry } from '../parameterizedRules'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMember(
  specialRules: Array<string | { id: string; parameter: string | number }>
): Member {
  return {
    id: 'member-1',
    name: 'Test Member',
    baseUnitId: 'base-1',
    role: 'warrior',
    equipment: [],
    experience: 20,
    lifetimeExperience: 20,
    injuries: [],
    specialRules,
    statIncreases: {},
    statDecreases: {},
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generate a non-empty alphanumeric identifier (no spaces, lowercase) */
const arbId = fc.stringMatching(/^[a-z][a-z0-9_]{0,19}$/)

/** Generate a label (may contain spaces and mixed case) */
const arbLabel = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0)

/** Generate a parameter value (string or number) */
const arbParameter = fc.oneof(
  arbId,
  fc.integer({ min: 1, max: 100 })
)

/** Generate a string entry for specialRules */
const arbStringEntry = arbId

/** Generate an object entry for specialRules */
const arbObjectEntry = fc.record({
  id: arbId,
  parameter: arbParameter,
})

/** Generate a mixed specialRules array */
const arbSpecialRules = fc.array(
  fc.oneof(arbStringEntry, arbObjectEntry),
  { minLength: 0, maxLength: 10 }
)

/** Generate a non-parameterised rule */
const arbNonParamRule = fc.record({
  id: arbId,
  label: arbLabel,
  parameterised: fc.constant(false as const),
})

/** Generate a parameterised rule */
const arbParamRule = fc.record({
  id: arbId,
  label: arbLabel,
  parameterised: fc.constant(true as const),
  parameter_type: fc.constantFrom('friendly_hero', 'weapon', 'integer', 'distance', 'target_keyword', 'target_integer'),
})

// ── Property Tests ────────────────────────────────────────────────────────────

describe('Property 8: Ownership determination correctness', () => {
  it('non-parameterised rule: owned iff string matches id or label', () => {
    fc.assert(
      fc.property(arbSpecialRules, arbNonParamRule, (specialRules, rule) => {
        const member = makeMember(specialRules)
        const result = isRuleOwned(member, rule as SpecialRuleEntry)

        // Expected: owned if any string entry matches rule.id or rule.label
        const expected = specialRules.some(
          (sr) => typeof sr === 'string' && (sr === rule.id || sr === rule.label)
        )

        expect(result).toBe(expected)
      }),
      { numRuns: 100 }
    )
  })

  it('parameterised rule: owned iff object matches id+parameter, or legacy string matches id', () => {
    fc.assert(
      fc.property(
        arbSpecialRules,
        arbParamRule,
        arbParameter,
        (specialRules, rule, candidateParam) => {
          const member = makeMember(specialRules)
          const result = isRuleOwned(member, rule as SpecialRuleEntry, candidateParam)

          // Expected: owned if legacy string matches rule.id OR object with same id+parameter
          const expected = specialRules.some((sr) => {
            if (typeof sr === 'string') {
              return sr === rule.id
            }
            return sr.id === rule.id && sr.parameter === candidateParam
          })

          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('parameterised rule with same id but different parameter is NOT owned', () => {
    fc.assert(
      fc.property(
        arbId,
        arbParameter,
        arbParameter,
        arbLabel,
        (ruleId, storedParam, candidateParam, label) => {
          // Ensure parameters are actually different
          fc.pre(storedParam !== candidateParam)

          const specialRules: Array<string | { id: string; parameter: string | number }> = [
            { id: ruleId, parameter: storedParam },
          ]
          const member = makeMember(specialRules)
          const rule: SpecialRuleEntry = {
            id: ruleId,
            label,
            parameterised: true,
            parameter_type: 'friendly_hero',
          }

          const result = isRuleOwned(member, rule, candidateParam)
          expect(result).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
