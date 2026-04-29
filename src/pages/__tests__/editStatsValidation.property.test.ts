// Feature: battle-companies-fixes-and-features, Property 4/5/6: Stats validation

/**
 * Property 4: Stats validation rejects out-of-range values
 * Validates: Requirements 4.1, 4.2, 4.7
 *
 * Property 5: Stats validation accepts in-range values
 * Validates: Requirements 4.3
 *
 * Property 6: Stats validation warns on threshold violations
 * Validates: Requirements 4.4, 4.5
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateForm } from '../EditStatsPage'
import { STATS_ENTRY_FIELDS, MOUNT_STATS_ENTRY_FIELDS } from '../../constants'
import type { MemberStats } from '../../models'

type StatKey = keyof MemberStats
type FormValues = Record<StatKey, string>

// All field sets to test
const ALL_FIELD_SETS = [
  { label: 'STATS_ENTRY_FIELDS', fields: STATS_ENTRY_FIELDS },
  { label: 'MOUNT_STATS_ENTRY_FIELDS', fields: MOUNT_STATS_ENTRY_FIELDS },
] as const

// Build a valid form (all fields at their min) for a given field set
function buildValidForm(
  fields: typeof STATS_ENTRY_FIELDS | typeof MOUNT_STATS_ENTRY_FIELDS
): FormValues {
  return Object.fromEntries(fields.map((f) => [f.key, String(f.min)])) as FormValues
}

// ── Property 4: Out-of-range values produce errors ────────────────────────────

describe('Property 4: Stats validation rejects out-of-range values', () => {
  for (const { label, fields } of ALL_FIELD_SETS) {
    it(`rejects below-min values for ${label}`, () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...fields),
          (field) => {
            // Only test fields where a value below min is possible (min > Number.MIN_SAFE_INTEGER)
            const belowMin = field.min - 1
            const form: FormValues = {
              ...buildValidForm(fields),
              [field.key]: String(belowMin),
            }
            const { errors } = validateForm(form, fields)
            expect(Object.keys(errors).length).toBeGreaterThan(0)
            expect(errors[field.key as StatKey]).toBeTruthy()
          }
        ),
        { numRuns: 200 }
      )
    })

    it(`rejects above-max values for ${label}`, () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...fields),
          (field) => {
            const aboveMax = field.max + 1
            const form: FormValues = {
              ...buildValidForm(fields),
              [field.key]: String(aboveMax),
            }
            const { errors } = validateForm(form, fields)
            expect(Object.keys(errors).length).toBeGreaterThan(0)
            expect(errors[field.key as StatKey]).toBeTruthy()
          }
        ),
        { numRuns: 200 }
      )
    })
  }
})

// ── Property 5: In-range values produce no errors ─────────────────────────────

describe('Property 5: Stats validation accepts in-range values', () => {
  for (const { label, fields } of ALL_FIELD_SETS) {
    it(`accepts all in-range values for ${label}`, () => {
      // Build an arbitrary that picks a valid value for each field
      const validFormArb = fc.record(
        Object.fromEntries(
          fields.map((f) => [
            f.key,
            fc.integer({ min: f.min, max: f.max }).map(String),
          ])
        )
      ) as fc.Arbitrary<FormValues>

      fc.assert(
        fc.property(validFormArb, (form) => {
          const { errors } = validateForm(form, fields)
          expect(Object.keys(errors)).toHaveLength(0)
        }),
        { numRuns: 300 }
      )
    })
  }
})

// ── Property 6: Threshold values produce warnings but no errors ───────────────

describe('Property 6: Stats validation warns on threshold violations', () => {
  for (const { label, fields } of ALL_FIELD_SETS) {
    const warnBelowFields = fields.filter(
      (f) => f.warnBelow != null && f.warnBelow > f.min
    )
    const warnAboveFields = fields.filter(
      (f) => f.warnAbove != null && f.warnAbove < f.max
    )

    if (warnBelowFields.length > 0) {
      it(`warns (but no error) for warnBelow zone in ${label}`, () => {
        // For each field with a warnBelow threshold, pair it with a value in [min, warnBelow-1]
        const arb = fc.constantFrom(...warnBelowFields).chain((field) =>
          fc
            .integer({ min: field.min, max: (field.warnBelow as number) - 1 })
            .map((val) => ({ field, val }))
        )

        fc.assert(
          fc.property(arb, ({ field, val }) => {
            const form: FormValues = {
              ...buildValidForm(fields),
              [field.key]: String(val),
            }
            const { errors, warnings } = validateForm(form, fields)
            expect(errors[field.key as StatKey]).toBeUndefined()
            expect(warnings[field.key as StatKey]).toBeTruthy()
          }),
          { numRuns: 200 }
        )
      })
    }

    if (warnAboveFields.length > 0) {
      it(`warns (but no error) for warnAbove zone in ${label}`, () => {
        // For each field with a warnAbove threshold, pair it with a value in [warnAbove+1, max]
        const arb = fc.constantFrom(...warnAboveFields).chain((field) =>
          fc
            .integer({ min: (field.warnAbove as number) + 1, max: field.max })
            .map((val) => ({ field, val }))
        )

        fc.assert(
          fc.property(arb, ({ field, val }) => {
            const form: FormValues = {
              ...buildValidForm(fields),
              [field.key]: String(val),
            }
            const { errors, warnings } = validateForm(form, fields)
            expect(errors[field.key as StatKey]).toBeUndefined()
            expect(warnings[field.key as StatKey]).toBeTruthy()
          }),
          { numRuns: 200 }
        )
      })
    }
  }
})
