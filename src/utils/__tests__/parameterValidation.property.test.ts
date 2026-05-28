// Feature: parameterized-special-rules, Property 1: Parameter validation correctness

/**
 * Property 1: Parameter validation correctness
 * Validates: Requirements 1.2
 *
 * For any parameter value and parameter_type combination, `isValidParameter` SHALL return
 * `true` if and only if the value is non-empty and matches the type constraints
 * (string for friendly_hero/weapon/target_keyword, positive integer for integer/target_integer,
 * positive number with optional quote for distance).
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { isValidParameter } from '../parameterizedRules'

// ── Generators ────────────────────────────────────────────────────────────────

// String parameter types expect non-empty strings
const STRING_PARAM_TYPES = ['friendly_hero', 'weapon', 'target_keyword'] as const

// Integer parameter types expect positive integers
const INTEGER_PARAM_TYPES = ['integer', 'target_integer'] as const

// Distance parameter type expects positive number (with optional trailing quote)
const DISTANCE_PARAM_TYPE = 'distance' as const

// All valid parameter types
const ALL_PARAM_TYPES = [...STRING_PARAM_TYPES, ...INTEGER_PARAM_TYPES, DISTANCE_PARAM_TYPE] as const

// Non-empty string (trimmed length > 0)
const arbNonEmptyString: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0)

// Empty or whitespace-only string
const arbEmptyOrWhitespace: fc.Arbitrary<string> = fc.constantFrom('', ' ', '  ', '\t', '\n', '   ')

// Positive integer (> 0)
const arbPositiveInt: fc.Arbitrary<number> = fc.integer({ min: 1, max: 10000 })

// Non-positive integer (<= 0)
const arbNonPositiveInt: fc.Arbitrary<number> = fc.integer({ min: -10000, max: 0 })

// Positive number (> 0) for distance
const arbPositiveNumber: fc.Arbitrary<number> = fc.double({ min: 0.01, max: 1000, noNaN: true })

// Non-positive number (<= 0) for distance
const arbNonPositiveNumber: fc.Arbitrary<number> = fc.oneof(
  fc.constant(0),
  fc.double({ min: -1000, max: -0.01, noNaN: true }),
)

// String representation of positive integer
const arbPositiveIntString: fc.Arbitrary<string> = arbPositiveInt.map((n) => String(n))

// String representation of positive number with optional trailing quote
const arbDistanceString: fc.Arbitrary<string> = fc.oneof(
  arbPositiveNumber.map((n) => String(n)),
  arbPositiveNumber.map((n) => `${n}"`),
  arbPositiveNumber.map((n) => `${n}\u2033`), // double prime ″
)

// Invalid distance strings
const arbInvalidDistanceString: fc.Arbitrary<string> = fc.oneof(
  fc.constant('0'),
  fc.constant('-5'),
  fc.constant('abc'),
  fc.constant(''),
  arbNonPositiveNumber.map((n) => String(n)),
)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 1: Parameter validation correctness', () => {
  describe('string parameter types (friendly_hero, weapon, target_keyword)', () => {
    it('returns true for non-empty strings', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...STRING_PARAM_TYPES),
          arbNonEmptyString,
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('returns false for empty/whitespace-only strings', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...STRING_PARAM_TYPES),
          arbEmptyOrWhitespace,
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('returns false for null/undefined', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...STRING_PARAM_TYPES),
          fc.constantFrom(null, undefined),
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('returns false for numeric values', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...STRING_PARAM_TYPES),
          fc.integer({ min: -100, max: 100 }),
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  describe('integer parameter types (integer, target_integer)', () => {
    it('returns true for positive integers (number type)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...INTEGER_PARAM_TYPES),
          arbPositiveInt,
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('returns true for positive integer strings', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...INTEGER_PARAM_TYPES),
          arbPositiveIntString,
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(true)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('returns false for non-positive integers', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...INTEGER_PARAM_TYPES),
          arbNonPositiveInt,
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('returns false for non-integer numbers', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...INTEGER_PARAM_TYPES),
          fc.double({ min: 0.01, max: 100, noNaN: true }).filter((n) => !Number.isInteger(n)),
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })

    it('returns false for null/undefined', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...INTEGER_PARAM_TYPES),
          fc.constantFrom(null, undefined),
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  describe('distance parameter type', () => {
    it('returns true for positive numbers', () => {
      fc.assert(
        fc.property(arbPositiveNumber, (value) => {
          expect(isValidParameter(value, DISTANCE_PARAM_TYPE)).toBe(true)
        }),
        { numRuns: 100 },
      )
    })

    it('returns true for positive number strings with optional quote suffix', () => {
      fc.assert(
        fc.property(arbDistanceString, (value) => {
          expect(isValidParameter(value, DISTANCE_PARAM_TYPE)).toBe(true)
        }),
        { numRuns: 100 },
      )
    })

    it('returns false for non-positive numbers', () => {
      fc.assert(
        fc.property(arbNonPositiveNumber, (value) => {
          expect(isValidParameter(value, DISTANCE_PARAM_TYPE)).toBe(false)
        }),
        { numRuns: 100 },
      )
    })

    it('returns false for invalid distance strings', () => {
      fc.assert(
        fc.property(arbInvalidDistanceString, (value) => {
          expect(isValidParameter(value, DISTANCE_PARAM_TYPE)).toBe(false)
        }),
        { numRuns: 100 },
      )
    })

    it('returns false for null/undefined', () => {
      fc.assert(
        fc.property(fc.constantFrom(null, undefined), (value) => {
          expect(isValidParameter(value, DISTANCE_PARAM_TYPE)).toBe(false)
        }),
        { numRuns: 100 },
      )
    })
  })

  describe('unknown parameter types', () => {
    it('returns false for any value with unknown parameter_type', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) => !(ALL_PARAM_TYPES as readonly string[]).includes(s),
          ),
          fc.oneof(
            arbNonEmptyString,
            arbPositiveInt,
            fc.constant(null),
          ),
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })
  })

  describe('cross-type: all parameter types reject null/undefined', () => {
    it('returns false for null/undefined across all types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_PARAM_TYPES),
          fc.constantFrom(null, undefined),
          (paramType, value) => {
            expect(isValidParameter(value, paramType)).toBe(false)
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
