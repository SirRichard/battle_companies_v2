/**
 * Parameterised Rule Label Resolution
 *
 * Resolves a parameterised rule entry { id, parameter } to its display label
 * with the concrete parameter value substituted for the "(X)" placeholder.
 *
 * Resolution strategies by parameter_type:
 * - weapon: look up parameter in wargear.json, use its label
 * - friendly_hero: find member in companyMembers by id, use their name
 * - integer, distance, target_integer, target_keyword: raw value in parentheses
 */

import specialRulesData from '../data/specialRules.json'
import wargearData from '../data/wargear.json'

interface SpecialRuleData {
  id: string
  label: string
  parameterised?: boolean
  parameter_type?: string
}

interface WargearEntry {
  id: string
  label: string
}

const SPECIAL_RULES = specialRulesData as SpecialRuleData[]
const WARGEAR = wargearData as WargearEntry[]

function humanise(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

/**
 * Resolves a parameterised rule entry to its display label with concrete
 * parameter value substituted. Handles weapon → wargear label lookup,
 * friendly_hero → member name lookup, and raw value pass-through.
 */
export function resolveParameterisedLabel(
  entry: { id: string; parameter: string | number },
  companyMembers?: Array<{ id: string; name: string }>
): string {
  const rule = SPECIAL_RULES.find((r) => r.id === entry.id)

  if (!rule) {
    // Rule not found — format id nicely with parameter
    return `${humanise(entry.id)} (${entry.parameter})`
  }

  const paramType = rule.parameter_type
  let resolvedValue: string

  switch (paramType) {
    case 'weapon': {
      const weapon = WARGEAR.find((w) => w.id === entry.parameter)
      resolvedValue = weapon ? weapon.label : humanise(String(entry.parameter))
      break
    }
    case 'friendly_hero': {
      const member = companyMembers?.find((m) => m.id === entry.parameter)
      resolvedValue = member ? member.name : humanise(String(entry.parameter))
      break
    }
    case 'integer':
    case 'distance':
    case 'target_integer':
    case 'target_keyword':
    default:
      resolvedValue = String(entry.parameter)
      break
  }

  // Replace placeholder pattern in label with resolved value.
  // Labels use patterns like "(X)", "(X+)", or similar parenthetical placeholders.
  // Escape $ in resolvedValue since it's special in String.replace replacement strings.
  const placeholderRegex = /\(X[^)]*\)/
  const safeValue = resolvedValue.replace(/\$/g, '$$$$')
  if (placeholderRegex.test(rule.label)) {
    return rule.label.replace(placeholderRegex, `(${safeValue})`)
  }

  // Label has no placeholder — append resolved value in parentheses
  return `${rule.label} (${resolvedValue})`
}
