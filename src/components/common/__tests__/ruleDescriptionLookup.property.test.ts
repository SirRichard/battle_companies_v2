// Feature: member-detail-enhancements, Property 5: Rule Description Lookup Correctness

/**
 * Property 5: Rule Description Lookup Correctness
 * Validates: Requirements 6.1, 6.2
 *
 * For any special rule (plain string or parameterised object) that has a matching
 * entry in specialRules.json with a non-empty description field, the description
 * resolver SHALL return that description. For rules with no matching entry, it
 * SHALL return undefined.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import specialRulesData from '../../../data/specialRules.json'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpecialRuleEntry {
  id: string
  label: string
  description: string
  parameterised: boolean
}

const ALL_RULES = specialRulesData as SpecialRuleEntry[]

// ── Lookup maps (mirrors MemberDetailsDrawer logic) ───────────────────────────

/** Lookup by label — used for plain string rules */
const SPECIAL_RULES_MAP = ALL_RULES.reduce<Record<string, string>>((acc, r) => {
  acc[r.label] = r.description
  return acc
}, {})

/** Lookup by ID — used for parameterised rules */
const SPECIAL_RULES_BY_ID = ALL_RULES.reduce<Record<string, string>>((acc, r) => {
  acc[r.id] = r.description
  return acc
}, {})

// ── Description resolver (replicates drawer lookup logic) ─────────────────────

/**
 * Resolves description for a plain string rule (looked up by label).
 * Returns the description or undefined if not found.
 */
function resolveDescriptionByLabel(label: string): string | undefined {
  return SPECIAL_RULES_MAP[label] || undefined
}

/**
 * Resolves description for a parameterised rule (looked up by ID).
 * Returns the description or undefined if not found.
 */
function resolveDescriptionById(ruleId: string): string | undefined {
  return SPECIAL_RULES_BY_ID[ruleId] || undefined
}

// ── Data subsets ──────────────────────────────────────────────────────────────

const RULES_WITH_DESCRIPTION = ALL_RULES.filter(
  (r) => r.description && r.description.length > 0
)

const PARAMETERISED_RULES_WITH_DESCRIPTION = RULES_WITH_DESCRIPTION.filter(
  (r) => r.parameterised
)

const NON_PARAMETERISED_RULES_WITH_DESCRIPTION = RULES_WITH_DESCRIPTION.filter(
  (r) => !r.parameterised
)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 5: Rule Description Lookup Correctness', () => {
  /**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any non-parameterised rule with a non-empty description,
   * looking up by label returns that exact description.
   */
  it('plain string rules with description → lookup by label returns correct description', () => {
    expect(NON_PARAMETERISED_RULES_WITH_DESCRIPTION.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(
        fc.constantFrom(...NON_PARAMETERISED_RULES_WITH_DESCRIPTION),
        (rule) => {
          const result = resolveDescriptionByLabel(rule.label)

          expect(result).toBeDefined()
          expect(result).toBe(rule.description)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any parameterised rule with a non-empty description,
   * looking up by ID returns that exact description.
   */
  it('parameterised rules with description → lookup by ID returns correct description', () => {
    expect(PARAMETERISED_RULES_WITH_DESCRIPTION.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(
        fc.constantFrom(...PARAMETERISED_RULES_WITH_DESCRIPTION),
        (rule) => {
          const result = resolveDescriptionById(rule.id)

          expect(result).toBeDefined()
          expect(result).toBe(rule.description)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any rule with a non-empty description, looking up by ID always
   * returns that description (both parameterised and non-parameterised).
   */
  it('all rules with description → lookup by ID returns correct description', () => {
    expect(RULES_WITH_DESCRIPTION.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(
        fc.constantFrom(...RULES_WITH_DESCRIPTION),
        (rule) => {
          const result = resolveDescriptionById(rule.id)

          expect(result).toBeDefined()
          expect(result).toBe(rule.description)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For unknown rule IDs/labels that don't exist in specialRules.json,
   * the resolver returns undefined.
   */
  it('unknown rule IDs return undefined', () => {
    const knownIds = new Set(ALL_RULES.map((r) => r.id))

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !knownIds.has(s) && !Object.prototype.hasOwnProperty.call(Object.prototype, s)
        ),
        (unknownId) => {
          const result = resolveDescriptionById(unknownId)
          expect(result).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For unknown labels that don't exist in specialRules.json,
   * the resolver returns undefined.
   */
  it('unknown rule labels return undefined', () => {
    const knownLabels = new Set(ALL_RULES.map((r) => r.label))

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !knownLabels.has(s) && !Object.prototype.hasOwnProperty.call(Object.prototype, s)
        ),
        (unknownLabel) => {
          const result = resolveDescriptionByLabel(unknownLabel)
          expect(result).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})
