/**
 * Parameterised Rule Utilities
 *
 * Core logic for ownership detection, parameter validation, and
 * parameterised rule application during postmatch advancement.
 */

import type { Member } from '../models'

export interface SpecialRuleEntry {
  id: string
  label: string
  parameterised?: boolean
  parameter_type?: string
  minor?: boolean
}

export interface WargearEntry {
  id: string
  label: string
  category: string
}

/**
 * Determines if a rule is "already owned" by a member.
 *
 * Non-parameterised rules:
 *   Owned if specialRules contains a string matching rule.id OR rule.label.
 *
 * Parameterised rules:
 *   Owned if specialRules contains an object with matching id AND exact same parameter,
 *   OR a plain string matching the rule's id (legacy format).
 *   Same id but different parameter → NOT owned.
 */
export function isRuleOwned(
  member: Member,
  rule: SpecialRuleEntry,
  candidateParameter?: string | number
): boolean {
  const { specialRules } = member

  if (!rule.parameterised) {
    // Non-parameterised: owned if any string entry matches id or label
    return specialRules.some(
      (sr) => typeof sr === 'string' && (sr === rule.id || sr === rule.label)
    )
  }

  // Parameterised rule
  for (const sr of specialRules) {
    // Legacy plain string matching rule id → treat as owned
    if (typeof sr === 'string' && sr === rule.id) {
      return true
    }

    // Object entry: must match id AND exact same parameter
    if (
      typeof sr === 'object' &&
      sr !== null &&
      sr.id === rule.id &&
      candidateParameter !== undefined &&
      sr.parameter === candidateParameter
    ) {
      return true
    }
  }

  return false
}

/**
 * Validates a parameter value against its expected parameter_type.
 *
 * - friendly_hero / weapon / target_keyword: non-empty string
 * - integer / target_integer: positive integer (> 0)
 * - distance: positive number (> 0)
 */
export function isValidParameter(
  value: string | number | null | undefined,
  parameterType: string
): boolean {
  if (value === null || value === undefined) return false

  switch (parameterType) {
    case 'friendly_hero':
    case 'weapon':
    case 'target_keyword': {
      return typeof value === 'string' && value.trim().length > 0
    }

    case 'integer':
    case 'target_integer': {
      if (typeof value === 'number') {
        return Number.isInteger(value) && value > 0
      }
      // String that parses to positive integer
      if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isInteger(parsed) && parsed > 0
      }
      return false
    }

    case 'distance': {
      if (typeof value === 'number') {
        return value > 0
      }
      // String that parses to positive number
      if (typeof value === 'string') {
        const cleaned = value.replace(/["″]$/, '') // strip trailing quote mark
        const parsed = Number(cleaned)
        return !isNaN(parsed) && parsed > 0
      }
      return false
    }

    default:
      return false
  }
}

/**
 * Applies a parameterised rule to a member.
 *
 * Stores as { id: ruleId, parameter } in specialRules array.
 * Subtracts 5 XP (floored at 0).
 * Returns unchanged member if duplicate exists (same id AND same parameter).
 */
export function applyParameterisedRule(
  member: Member,
  ruleId: string,
  parameter: string | number
): Member {
  // Check for duplicate: same id AND same parameter already present
  const isDuplicate = member.specialRules.some(
    (sr) =>
      typeof sr === 'object' && sr !== null && sr.id === ruleId && sr.parameter === parameter
  )

  if (isDuplicate) {
    return member
  }

  return {
    ...member,
    specialRules: [...member.specialRules, { id: ruleId, parameter }],
    experience: Math.max(0, member.experience - 5),
  }
}

/**
 * Returns eligible hero targets for Combat Synergy (friendly_hero parameter_type).
 * Includes only members with role: leader | sergeant | hero_in_making,
 * excludes the receiving member.
 */
export function getEligibleHeroes(
  companyMembers: Member[],
  receivingMemberId: string
): Member[] {
  const heroRoles = new Set(['leader', 'sergeant', 'hero_in_making'])
  return companyMembers.filter(
    (m) => heroRoles.has(m.role) && m.id !== receivingMemberId
  )
}

/**
 * Returns eligible weapons for Poisoned Attacks (weapon parameter_type).
 * Merges baseWargear + member.equipment, filters by category (weapon|bow|throwing),
 * excludes weapons that already have a poisoned_attacks rule assigned to this member.
 */
export function getEligibleWeapons(
  member: Member,
  baseWargear: string[],
  wargearData: WargearEntry[]
): WargearEntry[] {
  // Merge and deduplicate wargear IDs
  const allWargearIds = [...new Set([...baseWargear, ...member.equipment])]

  // Find weapons already assigned poisoned_attacks for this member
  const alreadyPoisoned = new Set(
    member.specialRules
      .filter(
        (sr): sr is { id: string; parameter: string | number } =>
          typeof sr === 'object' && sr !== null && sr.id === 'poisoned_attacks'
      )
      .map((sr) => String(sr.parameter))
  )

  const eligibleCategories = new Set(['weapon', 'bow', 'throwing'])

  // Build lookup from wargearData
  const wargearMap = new Map(wargearData.map((w) => [w.id, w]))

  return allWargearIds
    .map((id) => wargearMap.get(id))
    .filter(
      (entry): entry is WargearEntry =>
        entry !== undefined &&
        eligibleCategories.has(entry.category) &&
        !alreadyPoisoned.has(entry.id)
    )
}
