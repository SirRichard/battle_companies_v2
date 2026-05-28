// Feature: parameterized-special-rules, Property 5: Parameterised rule storage format

/**
 * Property 5: Parameterised rule storage format
 * Validates: Requirements 3.3, 4.1
 *
 * For any valid rule ID and valid parameter value, `applyParameterisedRule`
 * SHALL produce a member whose specialRules array contains an object
 * `{ id: ruleId, parameter: parameterValue }` (not a plain string).
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { applyParameterisedRule } from '../parameterizedRules'
import type { Member } from '../../models'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Arbitrary for non-empty alphanumeric+underscore rule IDs */
const ALPHANUM_UNDERSCORE = 'abcdefghijklmnopqrstuvwxyz0123456789_'
const arbRuleId = fc
  .array(fc.constantFrom(...ALPHANUM_UNDERSCORE.split('')), { minLength: 1, maxLength: 30 })
  .map((chars) => chars.join(''))

/** Arbitrary for parameter values — strings and numbers */
const arbParameterValue = fc.oneof(
  fc.string({ minLength: 1, maxLength: 50 }),
  fc.integer({ min: 1, max: 1000 })
)

/** Build a minimal member without the target rule already present */
function buildMember(existingRules: Array<string | { id: string; parameter: string | number }> = []): Member {
  return {
    id: 'test-member-1',
    name: 'Test Member',
    baseUnitId: 'base-unit-1',
    role: 'warrior',
    equipment: [],
    experience: 50,
    lifetimeExperience: 50,
    injuries: [],
    specialRules: existingRules,
    statIncreases: {},
    statDecreases: {},
  }
}

// ── Property test ─────────────────────────────────────────────────────────────

describe('Property 5: Parameterised rule storage format', () => {
  /**
   * **Validates: Requirements 3.3, 4.1**
   *
   * For any valid rule ID and parameter value, applyParameterisedRule stores
   * the rule as an object { id, parameter } — never a plain string.
   */
  it('applyParameterisedRule stores rule as { id, parameter } object, not a plain string', () => {
    fc.assert(
      fc.property(arbRuleId, arbParameterValue, (ruleId, paramValue) => {
        const member = buildMember()
        const result = applyParameterisedRule(member, ruleId, paramValue)

        // Find the newly added entry
        const addedEntry = result.specialRules.find(
          (sr) =>
            typeof sr === 'object' &&
            sr !== null &&
            sr.id === ruleId &&
            sr.parameter === paramValue
        )

        // Must exist as an object
        expect(addedEntry).toBeDefined()
        expect(typeof addedEntry).toBe('object')
        expect(addedEntry).not.toBeNull()

        // Must have exactly { id, parameter } shape
        expect(addedEntry).toEqual({ id: ruleId, parameter: paramValue })

        // Must NOT be stored as a plain string
        const asString = result.specialRules.find(
          (sr) => typeof sr === 'string' && (sr === ruleId || sr === String(paramValue))
        )
        // The rule should not appear as a plain string entry matching the ruleId
        const stringEntryMatchingId = result.specialRules.filter(
          (sr) => typeof sr === 'string' && sr === ruleId
        )
        expect(stringEntryMatchingId.length).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.3, 4.1**
   *
   * The stored entry is exactly { id: ruleId, parameter: parameterValue }
   * with no extra properties.
   */
  it('stored entry has exactly id and parameter properties, no extras', () => {
    fc.assert(
      fc.property(arbRuleId, arbParameterValue, (ruleId, paramValue) => {
        const member = buildMember()
        const result = applyParameterisedRule(member, ruleId, paramValue)

        const addedEntry = result.specialRules.find(
          (sr) =>
            typeof sr === 'object' &&
            sr !== null &&
            sr.id === ruleId &&
            sr.parameter === paramValue
        )

        expect(addedEntry).toBeDefined()
        // Exactly two keys: id and parameter
        expect(Object.keys(addedEntry!)).toHaveLength(2)
        expect(Object.keys(addedEntry!).sort()).toEqual(['id', 'parameter'])
      }),
      { numRuns: 100 }
    )
  })
})
