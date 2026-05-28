/**
 * Chip description resolution utility.
 *
 * Resolves description text for equipment, wargear, and special rule chips
 * displayed on the MatchTrackingPage. Used by ChipDetailPopover to show
 * contextual information when a user taps a chip.
 */

import equipmentData from '../data/equipment.json'
import wargearData from '../data/wargear.json'
import specialRulesData from '../data/specialRules.json'
import heroicActionsData from '../data/heroicActions.json'

export interface ChipPopupContent {
  label: string
  description: string
}

interface EquipmentEntry {
  id: string
  label: string
  description?: string
  grantsSpecialRules?: Array<string | { id: string; parameter: string | number }>
}

interface WargearEntry {
  id: string
  label: string
}

interface SpecialRuleEntry {
  id: string
  label: string
  description?: string
  parameterised?: boolean
}

const EQUIPMENT = equipmentData as EquipmentEntry[]
const WARGEAR = wargearData as WargearEntry[]
const SPECIAL_RULES = specialRulesData as SpecialRuleEntry[]
const HEROIC_ACTIONS = heroicActionsData as SpecialRuleEntry[]

function humanise(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function getEquipmentLabel(id: string): string {
  return EQUIPMENT.find((e) => e.id === id)?.label ?? humanise(id)
}

function getWargearLabel(id: string): string {
  if (id.includes('::')) {
    const [baseId, parameter] = id.split('::')
    if (baseId === 'envenom_weapon') {
      const weaponLabel =
        WARGEAR.find((w) => w.id === parameter)?.label ?? humanise(parameter)
      return `Envenom Weapon (${weaponLabel})`
    }
    const baseLabel =
      WARGEAR.find((w) => w.id === baseId)?.label ?? humanise(baseId)
    const paramLabel =
      WARGEAR.find((w) => w.id === parameter)?.label ?? humanise(parameter)
    return `${baseLabel} (${paramLabel})`
  }
  return WARGEAR.find((w) => w.id === id)?.label ?? humanise(id)
}

function getSpecialRuleLabel(id: string): string {
  return SPECIAL_RULES.find((r) => r.id === id)?.label ?? humanise(id)
}

/**
 * Resolves the label of a granted special rule entry.
 * Handles both plain string IDs and parameterised objects.
 */
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

/**
 * Resolves chip description content for display in ChipDetailPopover.
 *
 * Priority logic:
 * 1. For wargear chips (including envenom_weapon::<id>): look up equipment data
 *    by ID, return description. For envenom chips, look up envenom_weapon entry.
 * 2. For equipment chips: look up equipment data, return description. If no
 *    description but has grantsSpecialRules, resolve those rule labels.
 * 3. For special rule chips: look up specialRules data by ID, return description.
 *    For parameterised rules, append parameter context.
 * 4. Fallback: label + "No description available."
 */
export function getChipDescription(
  chipId: string,
  type: 'equipment' | 'wargear' | 'specialRule',
  parameter?: string
): ChipPopupContent {
  if (type === 'wargear') {
    // For envenom_weapon::<weapon_id>, look up the envenom_weapon equipment entry
    if (chipId.includes('::')) {
      const [baseId] = chipId.split('::')
      if (baseId === 'envenom_weapon') {
        const label = getWargearLabel(chipId)
        const envenomEntry = EQUIPMENT.find((e) => e.id === 'envenom_weapon')
        if (envenomEntry?.description) {
          return { label, description: envenomEntry.description }
        }
        return { label, description: 'No description available.' }
      }
    }

    // Regular wargear — look up in equipment data (wargear items don't have
    // descriptions in wargear.json, but some may exist in equipment.json)
    const label = getWargearLabel(chipId)
    const equipEntry = EQUIPMENT.find((e) => e.id === chipId)
    if (equipEntry?.description) {
      return { label, description: equipEntry.description }
    }
    return { label, description: 'No description available.' }
  }

  if (type === 'equipment') {
    const entry = EQUIPMENT.find((e) => e.id === chipId)
    const label = entry?.label ?? humanise(chipId)

    // Priority: description field
    if (entry?.description) {
      return { label, description: entry.description }
    }

    // Fallback: resolve grantsSpecialRules labels
    if (entry?.grantsSpecialRules && entry.grantsSpecialRules.length > 0) {
      const ruleLabels = entry.grantsSpecialRules.map(resolveGrantedRuleLabel)
      return { label, description: `Grants: ${ruleLabels.join(', ')}` }
    }

    // Final fallback
    return { label, description: 'No description available.' }
  }

  if (type === 'specialRule') {
    // Look up by ID first, then fall back to matching by label (member.specialRules
    // stores labels for rules gained through advancement, not IDs).
    const entry = SPECIAL_RULES.find((r) => r.id === chipId)
      ?? HEROIC_ACTIONS.find((r) => r.id === chipId)
      ?? SPECIAL_RULES.find((r) => r.label === chipId)
      ?? HEROIC_ACTIONS.find((r) => r.label === chipId)
    const label = entry?.label ?? humanise(chipId)

    if (entry?.description) {
      // For parameterised rules, append parameter context
      if (parameter !== undefined && entry.parameterised) {
        return {
          label,
          description: `${entry.description} (Parameter: ${parameter})`,
        }
      }
      return { label, description: entry.description }
    }

    return { label, description: 'No description available.' }
  }

  // Should not reach here, but fallback
  return { label: humanise(chipId), description: 'No description available.' }
}
