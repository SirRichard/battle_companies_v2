// Feature: company-special-rules-enforcement, Property 8: Led By the Ranger Substitution Availability

/**
 * Property 8: Led By the Ranger Substitution Availability
 * Validates: Requirements 6.1, 6.4
 *
 * For any company with the `led_by_the_ranger` rule, substitution SHALL be
 * offered if and only if: (a) no living member has `baseUnitId` of
 * `ranger_of_the_north`, AND (b) the reinforcement roll is ≥ the rule's
 * `minRoll` value.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ── Pure function under test ──────────────────────────────────────────────────

/**
 * Determines whether the Led By the Ranger substitution should be offered.
 *
 * Substitution is available when ALL of the following hold:
 * - roll >= substitutionRule.minRoll
 * - no living member has baseUnitId === substitutionRule.unitId (limit check)
 * - no living member has baseUnitId === substitutionRule.condition.unitSlain (condition check)
 */
function isSubstitutionAvailable(
  members: Array<{ baseUnitId: string }>,
  roll: number,
  substitutionRule: {
    unitId: string
    condition: { unitSlain: string }
    minRoll: number
    limit: number
  }
): boolean {
  // Check roll >= minRoll
  if (roll < substitutionRule.minRoll) return false
  // Check limit: no living member with baseUnitId === unitId
  const livingCount = members.filter(
    (m) => m.baseUnitId === substitutionRule.unitId
  ).length
  if (livingCount >= substitutionRule.limit) return false
  // Check condition: unit specified in condition.unitSlain must not be alive
  const conditionUnitAlive = members.some(
    (m) => m.baseUnitId === substitutionRule.condition.unitSlain
  )
  if (conditionUnitAlive) return false
  return true
}

// ── The Shire's substitution rule ─────────────────────────────────────────────

const SHIRE_SUBSTITUTION_RULE = {
  unitId: 'ranger_of_the_north',
  condition: { unitSlain: 'ranger_of_the_north' },
  minRoll: 2,
  limit: 1,
  heroRoleOptions: ['leader', 'sergeant'],
}

// ── Generators ────────────────────────────────────────────────────────────────

// Non-ranger base unit IDs (Shire roster without ranger)
const arbNonRangerBaseUnitId = fc.constantFrom(
  'hobbit_militia',
  'hobbit_shirriff',
  'hobbit_archer',
  'battlin_brandybuck',
  'tookish_hunter'
)

// Member with a non-ranger baseUnitId
const arbNonRangerMember = arbNonRangerBaseUnitId.map(
  (baseUnitId): { baseUnitId: string } => ({
    baseUnitId,
  })
)

// Roster with NO ranger_of_the_north (ranger slain scenario)
const arbRosterWithoutRanger = fc.array(arbNonRangerMember, {
  minLength: 0,
  maxLength: 12,
})

// Roster that includes at least one living ranger_of_the_north
const arbRosterWithRanger = fc
  .tuple(
    fc.array(arbNonRangerMember, { minLength: 0, maxLength: 11 }),
    fc.nat({ max: 11 })
  )
  .map(([others, insertIdx]) => {
    const roster = [...others]
    const idx = Math.min(insertIdx, roster.length)
    roster.splice(idx, 0, { baseUnitId: 'ranger_of_the_north' })
    return roster
  })

// Valid reinforcement roll (1-6 on a d6)
const arbRoll = fc.integer({ min: 1, max: 6 })

// Successful roll (>= minRoll of 2)
const arbSuccessfulRoll = fc.integer({ min: 2, max: 6 })

// Failed roll (< minRoll of 2, i.e. roll of 1)
const arbFailedRoll = fc.constant(1)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 8: Led By the Ranger Substitution Availability', () => {
  it('substitution IS offered when no living ranger AND roll >= minRoll', () => {
    fc.assert(
      fc.property(arbRosterWithoutRanger, arbSuccessfulRoll, (members, roll) => {
        const result = isSubstitutionAvailable(
          members,
          roll,
          SHIRE_SUBSTITUTION_RULE
        )
        expect(result).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('substitution is NOT offered when roll < minRoll (regardless of roster)', () => {
    fc.assert(
      fc.property(arbRosterWithoutRanger, arbFailedRoll, (members, roll) => {
        const result = isSubstitutionAvailable(
          members,
          roll,
          SHIRE_SUBSTITUTION_RULE
        )
        expect(result).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('substitution is NOT offered when living ranger exists (regardless of roll)', () => {
    fc.assert(
      fc.property(arbRosterWithRanger, arbRoll, (members, roll) => {
        const result = isSubstitutionAvailable(
          members,
          roll,
          SHIRE_SUBSTITUTION_RULE
        )
        expect(result).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('biconditional: substitution offered iff (no ranger alive AND roll >= minRoll)', () => {
    // Mix of all possible states
    const arbAnyRoster = fc.oneof(arbRosterWithoutRanger, arbRosterWithRanger)

    fc.assert(
      fc.property(arbAnyRoster, arbRoll, (members, roll) => {
        const result = isSubstitutionAvailable(
          members,
          roll,
          SHIRE_SUBSTITUTION_RULE
        )

        const noRangerAlive = !members.some(
          (m) => m.baseUnitId === 'ranger_of_the_north'
        )
        const rollMeetsThreshold = roll >= SHIRE_SUBSTITUTION_RULE.minRoll
        const expected = noRangerAlive && rollMeetsThreshold

        expect(result).toBe(expected)
      }),
      { numRuns: 100 }
    )
  })
})
