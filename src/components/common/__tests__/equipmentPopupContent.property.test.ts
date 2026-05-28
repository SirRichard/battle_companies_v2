// Feature: member-detail-enhancements, Property 1: Equipment Popup Content Correctness

/**
 * Property 1: Equipment Popup Content Correctness
 * Validates: Requirements 1.1
 *
 * For any equipment item from equipment.json that has a non-empty description field,
 * the popup content resolver SHALL return that item's label as the title and its
 * description as the body text.
 *
 * Also tests: items with no description but grantsSpecialRules → body should be
 * formatted granted rules list.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import equipmentData from '../../../data/equipment.json'
import specialRulesData from '../../../data/specialRules.json'
import { getGrantedSpecialRules } from '../../../utils/grantedRules'
import { resolveParameterisedLabel } from '../../../utils/paramLabel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EquipmentDataEntry {
  id: string
  label: string
  description?: string
  grantsSpecialRules?: Array<string | { id: string; parameter: string | number }>
}

const EQUIPMENT_ALL = equipmentData as EquipmentDataEntry[]

const EQUIPMENT_BY_ID = EQUIPMENT_ALL.reduce<Record<string, EquipmentDataEntry>>((acc, e) => {
  acc[e.id] = e
  return acc
}, {})

// ── Popup content resolution logic (mirrors MemberDetailsDrawer inline logic) ─

interface PopupContent {
  label: string
  body: string
}

/**
 * Resolves popup content for an equipment item, replicating the logic from
 * MemberDetailsDrawer's equipment chip onClick handler.
 */
function resolveEquipmentPopupContent(equipId: string): PopupContent | null {
  const item = EQUIPMENT_BY_ID[equipId]
  if (!item) return null

  if (item.description) {
    return { label: item.label, body: item.description }
  }

  if (item.grantsSpecialRules && item.grantsSpecialRules.length > 0) {
    const granted = getGrantedSpecialRules([equipId])
    const lines = granted.map((g) =>
      g.parameter !== undefined
        ? resolveParameterisedLabel({ id: g.ruleId, parameter: g.parameter })
        : (specialRulesData as Array<{ id: string; label: string }>).find(
            (r) => r.id === g.ruleId
          )?.label ?? g.ruleId.replace(/_/g, ' ')
    )
    return { label: item.label, body: lines.join('\n') }
  }

  return null
}

// ── Data subsets ──────────────────────────────────────────────────────────────

const ITEMS_WITH_DESCRIPTION = EQUIPMENT_ALL.filter(
  (e) => e.description && e.description.length > 0
)

const ITEMS_WITH_GRANTS_NO_DESC = EQUIPMENT_ALL.filter(
  (e) =>
    (!e.description || e.description.length === 0) &&
    e.grantsSpecialRules &&
    e.grantsSpecialRules.length > 0
)

// ── Property tests ────────────────────────────────────────────────────────────

describe('Property 1: Equipment Popup Content Correctness', () => {
  /**
   * **Validates: Requirements 1.1**
   *
   * For any equipment item with a non-empty description, the popup content
   * resolver returns that item's label as title and description as body.
   */
  it('items with description → popup title = label, body = description', () => {
    // Ensure we have items to test
    expect(ITEMS_WITH_DESCRIPTION.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(
        fc.constantFrom(...ITEMS_WITH_DESCRIPTION),
        (item) => {
          const result = resolveEquipmentPopupContent(item.id)

          expect(result).not.toBeNull()
          expect(result!.label).toBe(item.label)
          expect(result!.body).toBe(item.description)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.1**
   *
   * For items with grantsSpecialRules but no description, the popup body
   * should be a formatted list of granted rule labels (one per line).
   */
  it('items with grantsSpecialRules but no description → popup body is granted rules list', () => {
    // This subset may be empty if all equipment with grants also has descriptions
    // In that case, skip gracefully
    if (ITEMS_WITH_GRANTS_NO_DESC.length === 0) return

    fc.assert(
      fc.property(
        fc.constantFrom(...ITEMS_WITH_GRANTS_NO_DESC),
        (item) => {
          const result = resolveEquipmentPopupContent(item.id)

          expect(result).not.toBeNull()
          expect(result!.label).toBe(item.label)

          // Body should contain at least one line (one granted rule)
          const lines = result!.body.split('\n')
          expect(lines.length).toBeGreaterThanOrEqual(1)
          expect(lines.every((l) => l.length > 0)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.1**
   *
   * The popup title always equals the equipment item's label field,
   * regardless of whether the body comes from description or granted rules.
   */
  it('popup title always equals item.label for any equipment with popup content', () => {
    const ALL_POPUP_ITEMS = EQUIPMENT_ALL.filter(
      (e) =>
        (e.description && e.description.length > 0) ||
        (e.grantsSpecialRules && e.grantsSpecialRules.length > 0)
    )

    expect(ALL_POPUP_ITEMS.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_POPUP_ITEMS),
        (item) => {
          const result = resolveEquipmentPopupContent(item.id)

          expect(result).not.toBeNull()
          expect(result!.label).toBe(item.label)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 1.1**
   *
   * Description takes priority: if an item has both description AND grantsSpecialRules,
   * the popup body should be the description, not the granted rules list.
   */
  it('description takes priority over grantsSpecialRules for popup body', () => {
    const ITEMS_WITH_BOTH = EQUIPMENT_ALL.filter(
      (e) =>
        e.description &&
        e.description.length > 0 &&
        e.grantsSpecialRules &&
        e.grantsSpecialRules.length > 0
    )

    // Many items have both (badge_of_courage, barding, etc.)
    expect(ITEMS_WITH_BOTH.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(
        fc.constantFrom(...ITEMS_WITH_BOTH),
        (item) => {
          const result = resolveEquipmentPopupContent(item.id)

          expect(result).not.toBeNull()
          expect(result!.body).toBe(item.description)
        }
      ),
      { numRuns: 100 }
    )
  })
})
