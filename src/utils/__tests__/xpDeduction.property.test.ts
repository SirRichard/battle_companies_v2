// Feature: parameterized-special-rules, Property 6: XP deduction on parameterised rule confirmation

/**
 * Property 6: XP deduction on parameterised rule confirmation
 * Validates: Requirements 4.2
 *
 * For any member with experience value `xp`, after `applyParameterisedRule`
 * is called (and the rule is not a duplicate), the resulting member's
 * experience SHALL equal `max(0, xp - 5)`.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyParameterisedRule } from '../parameterizedRules'
import type { Member } from '../../models'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'member-1',
    name: 'Test Member',
    baseUnitId: 'base-1',
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

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** XP values in range 0–100 */
const arbXp = fc.integer({ min: 0, max: 100 })

/** Random rule IDs that won't collide with pre-existing rules */
const arbRuleId = fc.stringMatching(/^[a-z][a-z0-9_]{2,20}$/)

/** Random parameter values (string variant) */
const arbParameter = fc.oneof(
  fc.string({ minLength: 1, maxLength: 30 }),
  fc.integer({ min: 1, max: 100 }).map(String)
)

// ── Property test ─────────────────────────────────────────────────────────────

describe('Property 6: XP deduction on parameterised rule confirmation', () => {
  it('resulting experience equals max(0, xp - 5) after non-duplicate application', () => {
    fc.assert(
      fc.property(arbXp, arbRuleId, arbParameter, (xp, ruleId, parameter) => {
        // Member with no pre-existing rules → guarantees non-duplicate
        const member = makeMember({ experience: xp, specialRules: [] })

        const result = applyParameterisedRule(member, ruleId, parameter)

        // Rule was actually added (not duplicate)
        expect(result.specialRules).toContainEqual({ id: ruleId, parameter })

        // XP deduction property
        expect(result.experience).toBe(Math.max(0, xp - 5))
      }),
      { numRuns: 200 }
    )
  })
})
