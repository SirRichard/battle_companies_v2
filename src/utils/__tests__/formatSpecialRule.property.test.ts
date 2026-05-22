// Feature: battle-companies-fixes-and-features, Property 30: Parameterised special rule display format

/**
 * Property 30: Parameterised special rule display format
 * Validates: Requirements 35.3, 35.4, 35.5, 35.7
 *
 * - Plain string ID with parameterised: true → output ends with " (X)"
 * - { id, parameter } object → output ends with " (${parameter})"
 * - Plain string ID with parameterised: false → output contains no parenthetical suffix
 * - Plain string ID not found in specialRules.json → output equals the raw string (fallback)
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import specialRulesData from '../../data/specialRules.json'
import { formatSpecialRule } from '../labels'

// ── Data pools ────────────────────────────────────────────────────────────────

type SpecialRuleEntry = {
  id: string
  label: string
  parameterised?: boolean
}

const allRules = specialRulesData as SpecialRuleEntry[]

const parameterisedRuleIds = allRules
  .filter((r) => r.parameterised === true)
  .map((r) => r.id)

const nonParameterisedRuleIds = allRules
  .filter((r) => !r.parameterised)
  .map((r) => r.id)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the string ends with a parenthetical like " (something)" */
function hasParenthetical(s: string): boolean {
  return /\s*\([^)]+\)\s*$/.test(s)
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 30: Parameterised special rule display format', () => {
  it('plain string with parameterised: true → output ends with " (X)"', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...parameterisedRuleIds),
        (id) => {
          const result = formatSpecialRule(id)
          expect(result).toMatch(/\(X\)$/)
        }
      ),
      { numRuns: parameterisedRuleIds.length * 3 }
    )
  })

  it('{ id, parameter } object → output ends with " (${parameter})"', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...parameterisedRuleIds),
        fc.oneof(
          fc.integer({ min: 1, max: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes(')'))
        ),
        (id, parameter) => {
          const result = formatSpecialRule({ id, parameter })
          expect(result).toMatch(new RegExp(`\\(${String(parameter).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)$`))
        }
      ),
      { numRuns: 300 }
    )
  })

  it('plain string with parameterised: false → output contains no parenthetical suffix', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonParameterisedRuleIds),
        (id) => {
          const result = formatSpecialRule(id)
          // Non-parameterised rules should not end with a parenthetical
          expect(hasParenthetical(result)).toBe(false)
        }
      ),
      { numRuns: nonParameterisedRuleIds.length * 3 }
    )
  })

  it('plain string ID not found in specialRules.json → output equals the raw string', () => {
    fc.assert(
      fc.property(
        // Generate IDs that are guaranteed not to be in specialRules.json
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (s) => !allRules.some((r) => r.id === s)
        ),
        (unknownId) => {
          const result = formatSpecialRule(unknownId)
          expect(result).toBe(unknownId)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('{ id, parameter } with unknown id → output uses raw id as base label', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => !allRules.some((r) => r.id === s)
        ),
        fc.integer({ min: 1, max: 10 }),
        (unknownId, parameter) => {
          const result = formatSpecialRule({ id: unknownId, parameter })
          // Should use the raw id as the base and append the parameter
          expect(result).toBe(`${unknownId} (${parameter})`)
        }
      ),
      { numRuns: 200 }
    )
  })
})
