/**
 * Label lookup utilities — resolve display names from IDs using static JSON data.
 * Falls back to a humanised form of the ID if no entry is found.
 */

import companiesData from '../data/companies.json'
import baseUnitsData from '../data/baseUnits.json'
import wargearData from '../data/wargear.json'
import specialRulesRaw from '../data/specialRules.json'

import { resolveParameterisedLabel } from './paramLabel'
import type { CompanyDefinition } from '../models'

const COMPANIES = companiesData as CompanyDefinition[]
const BASE_UNITS = baseUnitsData as Array<{ id: string; label: string }>
const WARGEAR = wargearData as Array<{ id: string; label: string }>

type SpecialRuleEntry = {
  id: string
  label: string
  parameterised?: boolean
}
const SPECIAL_RULES_DATA = specialRulesRaw as SpecialRuleEntry[]

function humanise(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

export function getCompanyLabel(companyTypeId: string): string {
  return (
    COMPANIES.find((c) => c.id === companyTypeId)?.label ??
    humanise(companyTypeId)
  )
}

export function getUnitLabel(baseUnitId: string): string {
  return (
    BASE_UNITS.find((u) => u.id === baseUnitId)?.label ?? humanise(baseUnitId)
  )
}

export function getWargearLabel(wargearId: string): string {
  // Handle parameterised entries in "baseId::parameter" format
  if (wargearId.includes('::')) {
    const [baseId, parameter] = wargearId.split('::')
    if (baseId === 'envenom_weapon') {
      // Resolve parameter as weapon label from wargear.json
      const weaponLabel =
        WARGEAR.find((w) => w.id === parameter)?.label ?? humanise(parameter)
      return `Envenom Weapon (${weaponLabel})`
    }
    // Other parameterised entries: resolve both parts
    const baseLabel =
      WARGEAR.find((w) => w.id === baseId)?.label ?? humanise(baseId)
    const paramLabel =
      WARGEAR.find((w) => w.id === parameter)?.label ?? humanise(parameter)
    return `${baseLabel} (${paramLabel})`
  }

  return WARGEAR.find((w) => w.id === wargearId)?.label ?? humanise(wargearId)
}

/** Format a list of equipment IDs as a comma-separated label string. */
export function formatEquipment(equipmentIds: string[]): string {
  return equipmentIds.map(getWargearLabel).join(', ')
}

/**
 * Format a special rule entry for display.
 *
 * - Plain string ID with `parameterised: true` in specialRules.json → "Label (X)"
 * - Plain string ID with `parameterised: false` → "Label"
 * - Plain string ID not found in specialRules.json → raw ID string (fallback)
 * - Object `{ id, parameter }` → "Label (parameter)"
 */
export function formatSpecialRule(
  entry: string | { id: string; parameter: string | number }
): string {
  if (typeof entry === 'string') {
    const rule = SPECIAL_RULES_DATA.find((r) => r.id === entry)
    if (!rule) return entry
    if (rule.parameterised) return `${rule.label} (X)`
    return rule.label
  }
  // Object form: { id, parameter } — delegate to resolveParameterisedLabel
  // which handles weapon→wargear label lookup, friendly_hero→member name, etc.
  return resolveParameterisedLabel(entry)
}
