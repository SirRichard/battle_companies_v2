import type {
  CompanyDefinition,
  HeroUpgrade,
  Member,
  UniqueWargearEntry,
} from '../models'
import baseUnitsData from '../data/baseUnits.json'

// ── Internal type for baseUnits.json entries ─────────────────────────────────

interface BaseUnitEntry {
  id: string
  keywords: string[]
}

const BASE_UNITS = baseUnitsData as BaseUnitEntry[]

// ── Keyword helpers ──────────────────────────────────────────────────────────

/**
 * Returns the keywords array for a given baseUnitId.
 * Returns [] if the unit is not found.
 */
export function getUnitKeywords(baseUnitId: string): string[] {
  const unit = BASE_UNITS.find((u) => u.id === baseUnitId)
  return unit?.keywords ?? []
}

/**
 * Returns true if the unit identified by baseUnitId has at least one keyword
 * from the allowedKeywords array.
 */
export function unitMatchesKeywords(
  baseUnitId: string,
  allowedKeywords: string[]
): boolean {
  const keywords = getUnitKeywords(baseUnitId)
  return allowedKeywords.some((kw) => keywords.includes(kw))
}

// ── Unique wargear helpers ───────────────────────────────────────────────────

/**
 * Returns true if the given uniqueWargear entry is at its limit across
 * the provided member list.
 */
export function isUniqueWargearAtLimit(
  entry: UniqueWargearEntry,
  allMembers: Member[]
): boolean {
  if (entry.limit === undefined) return false
  const count = allMembers.filter((m) =>
    m.equipment.includes(entry.equipmentId)
  ).length
  return count >= entry.limit
}

/**
 * Returns the uniqueWargear entries from companyDef that are eligible for
 * the given member, applying heroOnly, allowedKeywords, already-owned, and
 * limit checks.
 *
 * @param companyDef  The company definition
 * @param member      The member who wants to purchase
 * @param allMembers  All company members (used for limit check)
 */
export function getEligibleUniqueWargear(
  companyDef: CompanyDefinition,
  member: Member,
  allMembers: Member[]
): UniqueWargearEntry[] {
  if (!companyDef.uniqueWargear || companyDef.uniqueWargear.length === 0) {
    return []
  }

  return companyDef.uniqueWargear.filter((entry) => {
    // a. heroOnly: exclude warriors
    if (entry.heroOnly && member.role === 'warrior') return false

    // b. allowedKeywords: exclude if member's unit doesn't have at least one matching keyword
    if (
      entry.allowedKeywords &&
      entry.allowedKeywords.length > 0 &&
      !unitMatchesKeywords(member.baseUnitId, entry.allowedKeywords)
    ) {
      return false
    }

    // c. Already owned: exclude if member already has this equipment
    if (member.equipment.includes(entry.equipmentId)) return false

    // d. Limit: exclude if at limit
    if (isUniqueWargearAtLimit(entry, allMembers)) return false

    return true
  })
}

// ── Hero upgrade keyword filtering ───────────────────────────────────────────

/**
 * Returns the heroUpgrade entries from companyDef that are eligible for
 * the given hero member, applying allowedKeywords and already-purchased checks.
 *
 * Existing baseUnitIds filtering is preserved.
 */
export function getEligibleHeroUpgrades(
  companyDef: CompanyDefinition,
  member: Member
): HeroUpgrade[] {
  return companyDef.heroUpgrade.filter((upgrade) => {
    // Existing baseUnitIds filtering
    if (
      upgrade.baseUnitIds &&
      upgrade.baseUnitIds.length > 0 &&
      !upgrade.baseUnitIds.includes(member.baseUnitId)
    ) {
      return false
    }

    // allowedKeywords filtering
    if (
      upgrade.allowedKeywords &&
      upgrade.allowedKeywords.length > 0 &&
      !unitMatchesKeywords(member.baseUnitId, upgrade.allowedKeywords)
    ) {
      return false
    }

    // Already purchased: exclude if member already has this upgrade in equipment
    if (member.equipment.includes(upgrade.id)) return false

    return true
  })
}

// ── Hero restrictions ────────────────────────────────────────────────────────

/**
 * Returns the set of baseUnitIds that are allowed to be assigned as heroes,
 * derived from the first heroRestrictions rule found in companySpecialRules.
 * Returns null if no heroRestrictions rule exists (meaning no restriction).
 */
export function getHeroAllowedBaseUnitIds(
  companyDef: CompanyDefinition
): string[] | null {
  for (const rule of companyDef.companySpecialRules) {
    if (rule.heroRestrictions && rule.heroRestrictions.length > 0) {
      return rule.heroRestrictions[0].allowedBaseUnitIds
    }
  }
  return null
}

/**
 * Returns true if the given baseUnitId is eligible to be assigned as a hero
 * given the company's heroRestrictions (if any).
 */
export function isEligibleForHeroRole(
  baseUnitId: string,
  companyDef: CompanyDefinition
): boolean {
  const allowed = getHeroAllowedBaseUnitIds(companyDef)
  if (allowed === null) return true
  return allowed.includes(baseUnitId)
}

// ── Reinforcement substitution ───────────────────────────────────────────────

/**
 * Returns the reinforcementSubstitution entry that applies to the given
 * final adjusted roll number, or null if none applies.
 *
 * Searches all companySpecialRules for a reinforcementSubstitution array
 * and returns the first entry whose appliesTo includes the roll.
 */
export function getApplicableSubstitution(
  companyDef: CompanyDefinition,
  finalRoll: number
): { baseUnitId: string; appliesTo: number[]; prompt: string } | null {
  for (const rule of companyDef.companySpecialRules) {
    if (rule.reinforcementSubstitution) {
      for (const sub of rule.reinforcementSubstitution) {
        if (sub.appliesTo.includes(finalRoll)) {
          return sub
        }
      }
    }
  }
  return null
}

// ── Break point ──────────────────────────────────────────────────────────────

/**
 * Calculates the break point threshold for a company.
 *
 * Algorithm:
 *   1. Look for a companySpecialRule with id === 'breaking_point'.
 *   2. If found, read parameters.breakPointPercentage (must be a number in (0,1]).
 *      If absent or invalid, log a warning and fall back to 0.5.
 *   3. Return Math.floor(startingMemberCount * percentage).
 *
 * @param companyDef           The company definition (for special rules)
 * @param startingMemberCount  The number of members at match start
 */
export function calcBreakPoint(
  companyDef: CompanyDefinition,
  startingMemberCount: number
): number {
  const breakingPointRule = companyDef.companySpecialRules.find(
    (r) => r.id === 'breaking_point'
  )

  if (breakingPointRule) {
    const pct = breakingPointRule.parameters?.breakPointPercentage
    if (typeof pct === 'number' && pct > 0 && pct <= 1) {
      return Math.floor(startingMemberCount * pct)
    }
    console.warn(
      `[calcBreakPoint] Invalid or missing breakPointPercentage for company "${companyDef.id}". Falling back to 0.5.`
    )
  }

  return Math.floor(startingMemberCount * 0.5)
}

/**
 * Returns true if the company is currently broken (active non-casualty
 * member count is at or below the break point threshold).
 */
export function isCompanyBroken(
  breakPoint: number,
  activeMemberCount: number
): boolean {
  return activeMemberCount <= breakPoint
}
