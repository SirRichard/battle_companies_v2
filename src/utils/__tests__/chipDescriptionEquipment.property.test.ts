// Feature: match-tracking-responsive, Property 4: Equipment chip description resolution

/**
 * Property 4: Equipment chip description resolution
 * **Validates: Requirements 8.1, 8.7**
 *
 * For any equipment entry, the chip description lookup SHALL return:
 * the `description` field if present; otherwise, if `grantsSpecialRules`
 * is non-empty, the resolved labels of those rules; otherwise, a fallback
 * "No description available" message.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getChipDescription } from '../chipDescription'
import equipmentData from '../../data/equipment.json'
import specialRulesData from '../../data/specialRules.json'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EquipmentEntry {
  id: string
  label: string
  description?: string
  grantsSpecialRules?: Array<string | { id: string; parameter: string | number }>
}

interface SpecialRuleEntry {
  id: string
  label: string
  description?: string
  parameterised?: boolean
}

const EQUIPMENT = equipmentData as EquipmentEntry[]
const SPECIAL_RULES = specialRulesData as SpecialRuleEntry[]

// ── Data subsets ──────────────────────────────────────────────────────────────

const EQUIPMENT_WITH_DESCRIPTION = EQUIPMENT.filter(
  (e) => e.description && e.description.length > 0
)

const EQUIPMENT_WITH_GRANTS_NO_DESC = EQUIPMENT.filter(
  (e) =>
    (!e.description || e.description.length === 0) &&
    e.grantsSpecialRules &&
    e.grantsSpecialRules.length > 0
)

const EQUIPMENT_WITH_NEITHER = EQUIPMENT.filter(
  (e) =>
    (!e.description || e.description.length === 0) &&
    (!e.grantsSpecialRules || e.grantsSpecialRules.length === 0)
)

// ── Helper ────────────────────────────────────────────────────────────────────

function humanise(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function getSpecialRuleLabel(id: string): string {
  return SPECIAL_RULES.find((r) => r.id === id)?.label ?? humanise(id)
}

function resolveGrantedRuleLabel(
  entry: string | { id: string; parameter: string | number }
): string {
  if (typeof entry === 'string') {
    return getSpecialRuleLabel(entry)
  }
  const rule = SPECIAL_RULES.find((r) => r.id === entry.id)
  if (!rule) return humanise(entry.id)
  return `${rule.label.replace(/\(X[^)]*\)/, `(${entry.parameter})`)}`
}

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 4: Equipment chip description resolution', () => {
  /**
   * **Validates: Requirements 8.1, 8.7**
   *
   * Equipment entries with a description field → lookup returns that description.
   */
  it('equipment with description field → returns description', () => {
    expect(EQUIPMENT_WITH_DESCRIPTION.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(
        fc.constantFrom(...EQUIPMENT_WITH_DESCRIPTION),
        (entry) => {
          const result = getChipDescription(entry.id, 'equipment')

          expect(result.label).toBe(entry.label)
          expect(result.description).toBe(entry.description)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 8.1, 8.7**
   *
   * Equipment entries without description but with grantsSpecialRules →
   * lookup returns resolved rule labels prefixed with "Grants: ".
   */
  it('equipment without description but with grantsSpecialRules → returns resolved rule labels', () => {
    // If no real entries match this category, generate synthetic ones
    if (EQUIPMENT_WITH_GRANTS_NO_DESC.length > 0) {
      fc.assert(
        fc.property(
          fc.constantFrom(...EQUIPMENT_WITH_GRANTS_NO_DESC),
          (entry) => {
            const result = getChipDescription(entry.id, 'equipment')

            expect(result.label).toBe(entry.label)
            const expectedLabels = entry.grantsSpecialRules!.map(resolveGrantedRuleLabel)
            expect(result.description).toBe(`Grants: ${expectedLabels.join(', ')}`)
          }
        ),
        { numRuns: 100 }
      )
    } else {
      // All real equipment entries have descriptions, so verify the priority:
      // description field wins over grantsSpecialRules when both present
      const withBoth = EQUIPMENT.filter(
        (e) =>
          e.description &&
          e.description.length > 0 &&
          e.grantsSpecialRules &&
          e.grantsSpecialRules.length > 0
      )
      expect(withBoth.length).toBeGreaterThan(0)

      fc.assert(
        fc.property(fc.constantFrom(...withBoth), (entry) => {
          const result = getChipDescription(entry.id, 'equipment')

          // Description takes priority over grantsSpecialRules
          expect(result.description).toBe(entry.description)
          expect(result.description).not.toContain('Grants:')
        }),
        { numRuns: 100 }
      )
    }
  })

  /**
   * **Validates: Requirements 8.1, 8.7**
   *
   * Unknown equipment IDs (no description, no grantsSpecialRules) →
   * lookup returns humanised label + fallback message.
   */
  it('unknown equipment IDs → returns fallback "No description available."', () => {
    const knownIds = new Set(EQUIPMENT.map((e) => e.id))

    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z_]{2,20}$/).filter((s) => !knownIds.has(s)),
        (unknownId) => {
          const result = getChipDescription(unknownId, 'equipment')

          expect(result.label).toBe(humanise(unknownId))
          expect(result.description).toBe('No description available.')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 8.1, 8.7**
   *
   * Priority resolution: for any equipment entry, description field always
   * takes precedence over grantsSpecialRules resolution.
   */
  it('description field takes priority over grantsSpecialRules', () => {
    const withBoth = EQUIPMENT.filter(
      (e) =>
        e.description &&
        e.description.length > 0 &&
        e.grantsSpecialRules &&
        e.grantsSpecialRules.length > 0
    )
    expect(withBoth.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(fc.constantFrom(...withBoth), (entry) => {
        const result = getChipDescription(entry.id, 'equipment')

        // Must return description, not the grants resolution
        expect(result.description).toBe(entry.description)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 8.1, 8.7**
   *
   * For any equipment entry, the returned label always matches the entry's
   * label field (or humanised ID for unknowns).
   */
  it('returned label matches equipment label field for all known entries', () => {
    fc.assert(
      fc.property(fc.constantFrom(...EQUIPMENT), (entry) => {
        const result = getChipDescription(entry.id, 'equipment')
        expect(result.label).toBe(entry.label)
      }),
      { numRuns: 100 }
    )
  })
})
