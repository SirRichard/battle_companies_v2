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
import wargearData from '../../data/wargear.json'
import { formatSpecialRule } from '../labels'

// ── Data pools ────────────────────────────────────────────────────────────────

type SpecialRuleEntry = {
  id: string
  label: string
  parameterised?: boolean
  parameter_type?: string
}

const allRules = specialRulesData as SpecialRuleEntry[]
const wargear = wargearData as Array<{ id: string; label: string }>

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

  it('{ id, parameter } object → output contains resolved parameter in parentheses', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...parameterisedRuleIds),
        fc.oneof(
          fc.integer({ min: 1, max: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes(')'))
        ),
        (id, parameter) => {
          const result = formatSpecialRule({ id, parameter })
          const rule = allRules.find((r) => r.id === id)!
          const paramType = rule.parameter_type

          // Determine expected resolved value based on parameter_type
          let expectedValue: string
          if (paramType === 'weapon' || paramType === 'friendly_hero') {
            // These types attempt a lookup; on miss they humanise the parameter
            const humanised = String(parameter)
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase())
            if (paramType === 'weapon') {
              const weapon = wargear.find((w) => w.id === parameter)
              expectedValue = weapon ? weapon.label : humanised
            } else {
              // friendly_hero with no members passed → humanise fallback
              expectedValue = humanised
            }
          } else {
            expectedValue = String(parameter)
          }

          // Result should end with the resolved value in parentheses
          const escaped = expectedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          expect(result).toMatch(new RegExp(`\\(${escaped}\\)$`))
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

  it('{ id, parameter } with unknown id → output uses humanised id as base label', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => !allRules.some((r) => r.id === s)
        ),
        fc.integer({ min: 1, max: 10 }),
        (unknownId, parameter) => {
          const result = formatSpecialRule({ id: unknownId, parameter })
          const humanised = unknownId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
          // Should use the humanised id as the base and append the parameter
          expect(result).toBe(`${humanised} (${parameter})`)
        }
      ),
      { numRuns: 200 }
    )
  })
})
