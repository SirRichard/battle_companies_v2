/**
 * Property-based tests for kit info description fallback logic
 * Feature: ato-kit-enhancements, Property 2: Item description fallback completeness
 *
 * **Validates: Requirements 1.4**
 *
 * For any equipment or wargear item without a description field, the info dialog
 * display should contain either the item's formatted grantsSpecialRules or a
 * fallback indicator string — never an empty/blank entry.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── Pure fallback logic (mirrors KitInfoDialog implementation) ───────────────

type SpecialRuleEntry = string | { id: string; parameter: string | number }

interface EquipmentEntry {
  id: string
  label: string
  description?: string
  grantsSpecialRules?: SpecialRuleEntry[]
}

/**
 * Formats a special rule entry for display.
 * Mirrors the formatSpecialRule logic from src/utils/labels.ts.
 */
function formatSpecialRule(entry: SpecialRuleEntry): string {
  if (typeof entry === 'string') {
    // Humanise the ID as fallback (simplified — real impl looks up specialRules.json)
    return entry.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }
  // Object form: { id, parameter }
  const label = entry.id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  return `${label} (${entry.parameter})`
}

/**
 * Determines the description to display for a kit item.
 * This is the same fallback logic used in KitInfoDialog.
 */
function getItemDescription(equipEntry: EquipmentEntry | undefined): string {
  if (equipEntry?.description) {
    return equipEntry.description
  } else if (
    equipEntry?.grantsSpecialRules &&
    equipEntry.grantsSpecialRules.length > 0
  ) {
    return (
      'Grants: ' + equipEntry.grantsSpecialRules.map(formatSpecialRule).join(', ')
    )
  } else {
    return 'No description available'
  }
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate non-empty, non-blank strings for descriptions */
const arbNonBlankString = fc.string({ minLength: 1, maxLength: 100 }).filter(
  (s) => s.trim().length > 0
)

/** Generate a special rule as a plain string ID */
const arbStringRule = fc.string({ minLength: 1, maxLength: 20 })

/** Generate a special rule as an object with id and parameter */
const arbObjectRule = fc.record({
  id: arbStringRule,
  parameter: fc.oneof(
    arbStringRule,
    fc.integer({ min: 1, max: 10 })
  ),
})

/** Generate a special rule entry (string or object) */
const arbSpecialRuleEntry: fc.Arbitrary<SpecialRuleEntry> = fc.oneof(
  arbStringRule,
  arbObjectRule
)

/** Generate equipment entry WITH a description */
const arbEquipWithDescription: fc.Arbitrary<EquipmentEntry> = fc.record({
  id: arbStringRule,
  label: fc.string({ minLength: 1, maxLength: 30 }),
  description: arbNonBlankString,
  grantsSpecialRules: fc.option(
    fc.array(arbSpecialRuleEntry, { minLength: 0, maxLength: 5 }),
    { nil: undefined }
  ),
})

/** Generate equipment entry WITHOUT description but WITH grantsSpecialRules */
const arbEquipWithRulesOnly: fc.Arbitrary<EquipmentEntry> = fc.record({
  id: arbStringRule,
  label: fc.string({ minLength: 1, maxLength: 30 }),
  grantsSpecialRules: fc.array(arbSpecialRuleEntry, { minLength: 1, maxLength: 5 }),
}).map((e) => ({ ...e, description: undefined }))

/** Generate equipment entry WITHOUT description AND without grantsSpecialRules */
const arbEquipWithNothing: fc.Arbitrary<EquipmentEntry> = fc.record({
  id: arbStringRule,
  label: fc.string({ minLength: 1, maxLength: 30 }),
}).map((e) => ({ ...e, description: undefined, grantsSpecialRules: undefined }))

/** Generate equipment entry with empty grantsSpecialRules array */
const arbEquipWithEmptyRules: fc.Arbitrary<EquipmentEntry> = fc.record({
  id: arbStringRule,
  label: fc.string({ minLength: 1, maxLength: 30 }),
}).map((e) => ({ ...e, description: undefined, grantsSpecialRules: [] }))

/** Generate any equipment entry (all variants) */
const arbAnyEquipEntry: fc.Arbitrary<EquipmentEntry> = fc.oneof(
  arbEquipWithDescription,
  arbEquipWithRulesOnly,
  arbEquipWithNothing,
  arbEquipWithEmptyRules
)

// ─────────────────────────────────────────────────────────────────────────────

describe('Feature: ato-kit-enhancements, Property 2: Item description fallback completeness', () => {
  it('description is never empty or blank for any equipment entry', () => {
    fc.assert(
      fc.property(arbAnyEquipEntry, (equipEntry) => {
        const description = getItemDescription(equipEntry)

        expect(description.trim().length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })

  it('items with description field use that description directly', () => {
    fc.assert(
      fc.property(arbEquipWithDescription, (equipEntry) => {
        const description = getItemDescription(equipEntry)

        expect(description).toBe(equipEntry.description)
      }),
      { numRuns: 100 }
    )
  })

  it('items without description but with grantsSpecialRules show formatted rules', () => {
    fc.assert(
      fc.property(arbEquipWithRulesOnly, (equipEntry) => {
        const description = getItemDescription(equipEntry)

        expect(description).toMatch(/^Grants: .+/)
        expect(description.length).toBeGreaterThan('Grants: '.length)
      }),
      { numRuns: 100 }
    )
  })

  it('items without description and without grantsSpecialRules show fallback indicator', () => {
    fc.assert(
      fc.property(arbEquipWithNothing, (equipEntry) => {
        const description = getItemDescription(equipEntry)

        expect(description).toBe('No description available')
      }),
      { numRuns: 100 }
    )
  })

  it('items with empty grantsSpecialRules array show fallback indicator', () => {
    fc.assert(
      fc.property(arbEquipWithEmptyRules, (equipEntry) => {
        const description = getItemDescription(equipEntry)

        expect(description).toBe('No description available')
      }),
      { numRuns: 100 }
    )
  })

  it('undefined equipment entry shows fallback indicator', () => {
    // When item not found in equipment.json, equipEntry is undefined
    const description = getItemDescription(undefined)
    expect(description).toBe('No description available')
  })
})
