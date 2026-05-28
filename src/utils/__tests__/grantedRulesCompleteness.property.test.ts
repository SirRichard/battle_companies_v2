// Feature: member-detail-enhancements, Property 2: Granted Special Rules Completeness

/**
 * Property 2: Granted Special Rules Completeness
 * **Validates: Requirements 2.1**
 *
 * For any member whose ownedEquipment contains equipment items with
 * grantsSpecialRules fields, the getGrantedSpecialRules function SHALL return
 * exactly the union of all rules from all owned equipment's grantsSpecialRules
 * arrays, with no duplicates and no omissions.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import equipmentData from '../../data/equipment.json'
import { getGrantedSpecialRules } from '../grantedRules'

// ── Derive equipment IDs that have grantsSpecialRules ─────────────────────────

interface EquipmentEntry {
  id: string
  label: string
  grantsSpecialRules?: Array<string | { id: string; parameter: string | number }>
}

const EQUIPMENT = equipmentData as EquipmentEntry[]

const EQUIPMENT_WITH_GRANTS = EQUIPMENT.filter(
  (e) => e.grantsSpecialRules && e.grantsSpecialRules.length > 0
)

const GRANT_IDS = EQUIPMENT_WITH_GRANTS.map((e) => e.id)

// ── Helper: compute expected union of granted rules for a set of equipment ────

function expectedGrantedRules(equipIds: string[]) {
  const rules: Array<{
    ruleId: string
    parameter?: string | number
    sourceEquipmentId: string
    sourceEquipmentLabel: string
  }> = []

  for (const equipId of equipIds) {
    const entry = EQUIPMENT.find((e) => e.id === equipId)
    if (!entry?.grantsSpecialRules) continue

    for (const rule of entry.grantsSpecialRules) {
      if (typeof rule === 'string') {
        rules.push({
          ruleId: rule,
          sourceEquipmentId: entry.id,
          sourceEquipmentLabel: entry.label,
        })
      } else {
        rules.push({
          ruleId: rule.id,
          parameter: rule.parameter,
          sourceEquipmentId: entry.id,
          sourceEquipmentLabel: entry.label,
        })
      }
    }
  }

  return rules
}

/**
 * Build a composite key for deduplication comparison.
 * Matches the logic in grantedRules.ts for identity.
 */
function ruleKey(r: {
  ruleId: string
  parameter?: string | number
  sourceEquipmentId: string
}): string {
  const paramPart =
    r.parameter !== undefined ? `:${String(r.parameter).toLowerCase()}` : ''
  return `${r.ruleId}${paramPart}@${r.sourceEquipmentId}`
}

// ── Property test ─────────────────────────────────────────────────────────────

describe('Property 2: Granted Special Rules Completeness', () => {
  it('returns exactly the union of all grantsSpecialRules from owned equipment', () => {
    fc.assert(
      fc.property(
        fc.subarray(GRANT_IDS, { minLength: 0, maxLength: GRANT_IDS.length }),
        (equipSubset) => {
          const actual = getGrantedSpecialRules(equipSubset)
          const expected = expectedGrantedRules(equipSubset)

          // Completeness: every expected rule is present in actual
          for (const exp of expected) {
            const found = actual.some(
              (a) =>
                a.ruleId === exp.ruleId &&
                a.parameter === exp.parameter &&
                a.sourceEquipmentId === exp.sourceEquipmentId &&
                a.sourceEquipmentLabel === exp.sourceEquipmentLabel
            )
            expect(found).toBe(true)
          }

          // No omissions: actual length matches expected length
          expect(actual.length).toBe(expected.length)

          // No duplicates: all composite keys are unique
          const keys = actual.map(ruleKey)
          const uniqueKeys = new Set(keys)
          expect(uniqueKeys.size).toBe(keys.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns empty array when no equipment grants rules', () => {
    const NON_GRANT_IDS = EQUIPMENT.filter(
      (e) => !e.grantsSpecialRules || e.grantsSpecialRules.length === 0
    ).map((e) => e.id)

    fc.assert(
      fc.property(
        fc.subarray(NON_GRANT_IDS, {
          minLength: 0,
          maxLength: NON_GRANT_IDS.length,
        }),
        (equipSubset) => {
          const actual = getGrantedSpecialRules(equipSubset)
          expect(actual).toEqual([])
        }
      ),
      { numRuns: 100 }
    )
  })
})
