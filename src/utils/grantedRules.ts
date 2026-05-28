/**
 * Granted Special Rules — derives special rules conferred by equipment items.
 *
 * Equipment items in equipment.json may have a `grantsSpecialRules` field
 * containing plain string IDs or parameterised objects { id, parameter }.
 * This module collects those into a structured list and provides a composite
 * key set for rating exclusion matching.
 */

import equipmentData from '../data/equipment.json'

interface EquipmentEntry {
  id: string
  label: string
  grantsSpecialRules?: Array<string | { id: string; parameter: string | number }>
}

export interface GrantedRule {
  ruleId: string
  parameter?: string | number
  sourceEquipmentId: string
  sourceEquipmentLabel: string
}

const EQUIPMENT = equipmentData as EquipmentEntry[]

/**
 * Given a member's ownedEquipment array, returns all special rules
 * granted by those equipment items (from equipment.json grantsSpecialRules).
 */
export function getGrantedSpecialRules(ownedEquipment: string[]): GrantedRule[] {
  const result: GrantedRule[] = []

  for (const equipId of ownedEquipment) {
    const entry = EQUIPMENT.find((e) => e.id === equipId)
    if (!entry?.grantsSpecialRules) continue

    for (const rule of entry.grantsSpecialRules) {
      if (typeof rule === 'string') {
        result.push({
          ruleId: rule,
          sourceEquipmentId: entry.id,
          sourceEquipmentLabel: entry.label,
        })
      } else {
        result.push({
          ruleId: rule.id,
          parameter: rule.parameter,
          sourceEquipmentId: entry.id,
          sourceEquipmentLabel: entry.label,
        })
      }
    }
  }

  return result
}

/**
 * Builds a composite key for a granted rule entry.
 * Plain rules: just the ruleId (e.g. "fearless")
 * Parameterised rules: "ruleId:parameter" lowercased (e.g. "terror_x:beast", "dominant:2")
 */
function compositeKey(ruleId: string, parameter?: string | number): string {
  if (parameter === undefined) return ruleId
  return `${ruleId}:${String(parameter).toLowerCase()}`
}

/**
 * Returns the set of composite keys for all special rules granted by equipment.
 * Used by the rating calculator to exclude these from the special rules point tally.
 */
export function getGrantedRuleIds(ownedEquipment: string[]): Set<string> {
  const granted = getGrantedSpecialRules(ownedEquipment)
  return new Set(granted.map((g) => compositeKey(g.ruleId, g.parameter)))
}
