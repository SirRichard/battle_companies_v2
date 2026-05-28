// Feature: parameterized-special-rules, Property 7: Duplicate parameterised rule prevention

/**
 * Property 7: Duplicate parameterised rule prevention
 * Validates: Requirements 4.3
 *
 * For any member whose specialRules already contains { id: ruleId, parameter: paramValue },
 * calling applyParameterisedRule(member, ruleId, paramValue) SHALL return a member with
 * identical specialRules array and identical experience value (no mutation).
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyParameterisedRule } from '../parameterizedRules'
import type { Member } from '../../models'

// ── Arbitraries ───────────────────────────────────────────────────────────────

const arbRuleId = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')), {
    minLength: 1,
    maxLength: 30,
  })
  .map((chars) => chars.join(''))

const arbStringParam = fc.string({ minLength: 1, maxLength: 40 })
const arbNumberParam = fc.integer({ min: 1, max: 1000 })
const arbParameter = fc.oneof(arbStringParam, arbNumberParam)

const arbXp = fc.integer({ min: 0, max: 100 })

/** Additional special rules entries (mix of strings and objects) to pad the array */
const arbExtraStringRule = fc.string({ minLength: 1, maxLength: 20 })
const arbExtraObjectRule = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  parameter: fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.integer({ min: 1, max: 100 })),
})
const arbExtraRule = fc.oneof(
  arbExtraStringRule,
  arbExtraObjectRule.map((r) => ({ id: r.id, parameter: r.parameter }))
)

function makeMember(
  xp: number,
  specialRules: Array<string | { id: string; parameter: string | number }>
): Member {
  return {
    id: 'member-1',
    name: 'Test Member',
    baseUnitId: 'base-1',
    role: 'warrior',
    equipment: [],
    experience: xp,
    lifetimeExperience: xp,
    injuries: [],
    specialRules,
    statIncreases: {},
    statDecreases: {},
  }
}

// ── Property test ─────────────────────────────────────────────────────────────

describe('Property 7: Duplicate parameterised rule prevention', () => {
  it('returns same reference when rule with same id+parameter already exists', () => {
    fc.assert(
      fc.property(
        arbRuleId,
        arbParameter,
        arbXp,
        fc.array(arbExtraRule, { minLength: 0, maxLength: 5 }),
        (ruleId, paramValue, xp, extraRules) => {
          // Build member that already has { id: ruleId, parameter: paramValue }
          const existingRule = { id: ruleId, parameter: paramValue }
          const specialRules: Array<string | { id: string; parameter: string | number }> = [
            ...extraRules,
            existingRule,
          ]
          const member = makeMember(xp, specialRules)

          // Call with same id + parameter → should be no-op
          const result = applyParameterisedRule(member, ruleId, paramValue)

          // Same reference returned (no mutation)
          expect(result).toBe(member)

          // Experience unchanged
          expect(result.experience).toBe(xp)

          // specialRules length unchanged
          expect(result.specialRules).toHaveLength(specialRules.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})
