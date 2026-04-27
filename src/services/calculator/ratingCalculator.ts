import type { Company, Member, StoredBaseUnitStats } from '../../models'
import { AVERAGE_PROFILE, RATING_POINTS } from '../../constants'
import specialRulesData from '../../data/specialRules.json'

const MINOR_RULE_LABELS = new Set(
  (specialRulesData as Array<{ label: string; minor: boolean }>)
    .filter((r) => r.minor)
    .map((r) => r.label)
)

/**
 * Calculates a single member's point rating per SRS §4.8.1.
 * Warriors: base points + equipment points.
 * Heroes: base + equipment + stat increases + special rules.
 * Injured members return 0 (excluded from company rating).
 */
export function calcMemberRating(
  member: Member,
  baseStats: StoredBaseUnitStats | undefined,
  baseCost: number,
  equipmentCosts: Record<string, number>
): number {
  // Injured members don't count toward company rating (SRS §4.8.1)
  const isInjured = member.injuries.some(
    (i) =>
      i.type === 'arm_wound' ||
      i.type === 'leg_wound' ||
      i.type === 'broken_honour' ||
      i.type === 'missing_next_game'
  )
  if (isInjured) return 0

  // Base unit cost
  let rating = baseCost

  // Equipment costs
  for (const eqId of member.equipment) {
    rating += equipmentCosts[eqId] ?? 0
  }

  // Heroes get additional points for stat increases
  if (member.role !== 'warrior' && baseStats) {
    const increases = member.statIncreases

    // Move, Fight, Strength, Defence: +5 each if above average profile
    const statsWith5 = ['move', 'fight', 'strength', 'defence'] as const
    for (const stat of statsWith5) {
      const increase = increases[stat] ?? 0
      if (increase > 0) {
        const baseVal = baseStats.stats[stat] ?? 0
        const avgThreshold =
          AVERAGE_PROFILE[stat as keyof typeof AVERAGE_PROFILE] ?? 0
        // Only count increases that bring stat above average (SRS §4.8.1 note)
        const effectiveBase = Math.max(baseVal, avgThreshold)
        const countable = Math.max(0, baseVal + increase - effectiveBase)
        rating += countable * RATING_POINTS.fight // same 5pts for all these
      }
    }

    // Attacks and Wounds: +10 each
    for (const stat of ['attacks', 'wounds'] as const) {
      const increase = increases[stat] ?? 0
      const baseVal = baseStats.stats[stat] ?? 0
      const avgThreshold =
        AVERAGE_PROFILE[stat as keyof typeof AVERAGE_PROFILE] ?? 0
      const effectiveBase = Math.max(baseVal, avgThreshold)
      const countable = Math.max(0, baseVal + increase - effectiveBase)
      rating += countable * RATING_POINTS.attacks
    }

    // Hero M/W/F: +5 each
    if (member.heroStats) {
      rating += member.heroStats.might * RATING_POINTS.might
      rating += member.heroStats.will * RATING_POINTS.will
      rating += member.heroStats.fate * RATING_POINTS.fate
    }

    // Special rules: +5 each (minor rules capped at 10 total)
    // Heroic Actions do NOT contribute to rating.
    const HEROIC_ACTION_LABELS = new Set([
      'Heroic Accuracy',
      'Heroic Challenge',
      'Heroic Channelling',
      'Heroic Defence',
      'Heroic March',
      'Heroic Resolve',
      'Heroic Strength',
      'Heroic Strike',
      'Heroic Move',
      'Heroic Shoot',
      'Heroic Combat',
    ])
    const countableSpecialRules = member.specialRules.filter(
      (r) => !HEROIC_ACTION_LABELS.has(r)
    )
    const minorRules = countableSpecialRules.filter((r) =>
      MINOR_RULE_LABELS.has(r)
    )
    const majorRules = countableSpecialRules.filter(
      (r) => !MINOR_RULE_LABELS.has(r)
    )
    rating += Math.min(minorRules.length * 5, 10) + majorRules.length * 5
  }

  return rating
}

/**
 * Calculates total Company Rating — sum of all non-injured member ratings.
 */
export function calcCompanyRating(
  company: Company,
  allBaseStats: StoredBaseUnitStats[],
  baseCosts: Record<string, number>,
  equipmentCosts: Record<string, number>
): number {
  const statsMap = Object.fromEntries(
    allBaseStats.map((s) => [s.baseUnitId, s])
  )

  return company.members.reduce((total, member) => {
    const baseStats = statsMap[member.baseUnitId]
    const baseCost = baseCosts[member.baseUnitId] ?? 0
    return total + calcMemberRating(member, baseStats, baseCost, equipmentCosts)
  }, 0)
}
