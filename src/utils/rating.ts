/**
 * Company Rating calculation — SRS §4.8.1
 *
 * Warriors:  base unit points + equipment points (warrior cost = rating[0])
 * Heroes:    base unit points + equipment points (hero cost = rating[0] OR rating[1])
 *            + stat increase points
 *            + special rule points
 */

import baseUnitsData from '../data/baseUnits.json'
import specialRulesData from '../data/specialRules.json'
import wargearData from '../data/wargear.json'
import type { Member, MemberStats, StoredBaseUnitStats } from '../models'
import { getGrantedRuleIds } from './grantedRules'

const SPECIAL_RULES = specialRulesData as Array<{ id: string; label: string; minor: boolean }>

const MINOR_RULE_LABELS = new Set(
  SPECIAL_RULES.filter((r) => r.minor).map((r) => r.label)
)

/** Map from rule label → rule ID for exclusion matching */
const LABEL_TO_ID = new Map(SPECIAL_RULES.map((r) => [r.label, r.id]))

const BASE_UNITS = baseUnitsData as Array<{
  id: string
  pointsCost: number
  baseWargear?: string[]
  wargearOptions?: { options: Array<{ wargear: string[] }> }
}>
const WARGEAR = wargearData as Array<{
  id: string
  rating?: [number, number]
}>

/**
 * Returns the set of wargear IDs that are "free" for rating purposes on a given
 * base unit — i.e. items in baseWargear or any wargearOptions entry.
 * These always use the lower wargear cost (rating[0]) regardless of A+W total.
 */
function getFreeWargearIds(baseUnitId: string): Set<string> {
  const unit = BASE_UNITS.find((u) => u.id === baseUnitId)
  if (!unit) return new Set()
  const ids = new Set<string>(unit.baseWargear ?? [])
  for (const opt of unit.wargearOptions?.options ?? []) {
    for (const eq of opt.wargear) ids.add(eq)
  }
  return ids
}

// Average profile thresholds — advancements that bring a stat to ≤ these
// values do NOT add to rating (SRS §4.8.1)
const AVERAGE_PROFILE: Required<MemberStats> = {
  move: 0, // move is not in the SRS average table; always counts
  fight: 4,
  shoot: 4, // 4+ in SRS terms — stored as numeric 4
  strength: 3,
  defence: 3,
  attacks: 1,
  wounds: 1,
  courage: 7, // 7+ — stored as 7
  intelligence: 7,
}

function wargearWarriorCost(id: string): number {
  const w = WARGEAR.find((w) => w.id === id)
  return w?.rating?.[0] ?? 0
}

function wargearHeroCost(id: string): number {
  const w = WARGEAR.find((w) => w.id === id)
  return w?.rating?.[1] ?? 0
}

function baseUnitCost(id: string): number {
  return BASE_UNITS.find((u) => u.id === id)?.pointsCost ?? 0
}

export function calcMemberRating(
  member: Member,
  baseStats: StoredBaseUnitStats | undefined
): number {
  const isHero = member.role !== 'warrior'
  const base = baseUnitCost(member.baseUnitId)

  // Equipment
  if (!isHero) {
    const equipCost = member.equipment.reduce(
      (s, eq) => s + wargearWarriorCost(eq),
      0
    )
    return base + equipCost
  }

  // ── Hero extras ─────────────────────────────────────────────────────────
  let heroPoints = 0

  // Might / Will / Fate — 5pts each
  if (member.heroStats) {
    heroPoints +=
      (member.heroStats.might + member.heroStats.will + member.heroStats.fate) *
      5
  }

  // Stat increases (only those above the average profile threshold count)
  const inc = member.statIncreases ?? {}
  const statKeys: (keyof MemberStats)[] = [
    'move',
    'fight',
    'shoot',
    'strength',
    'defence',
    'attacks',
    'wounds',
    'courage',
    'intelligence',
  ]
  for (const key of statKeys) {
    const increase = inc[key] ?? 0
    if (increase <= 0) continue
    // Shoot/Courage/Intelligence do not contribute (SRS §4.8.1)
    if (key === 'shoot' || key === 'courage' || key === 'intelligence') continue

    // Attacks / Wounds: 10pts per increase
    if (key === 'attacks' || key === 'wounds') {
      heroPoints += increase * 10
      continue
    }

    // For other stats: only the portion that takes the hero above the average
    // profile threshold counts. e.g. if base fight is 3 and average is 4,
    // the first increase to 4 is free; only increases above 4 count.
    const baseVal = (baseStats?.stats[key] ?? 0) as number
    const avgThreshold = AVERAGE_PROFILE[key] as number
    const effectiveBase = Math.max(baseVal, avgThreshold)
    const newVal = baseVal + increase
    const countableIncrease = Math.max(0, newVal - effectiveBase)
    heroPoints += countableIncrease * 5
  }

  // ── Hero wargear cost (SRS §4.8.1 "Hero's Wargear") ────────────────────
  // Current A+W determines whether higher wargear costs apply.
  // Uses current values (base + stat increases) per user requirement.
  const baseUnitStats = baseStats?.stats
  const baseAttacks = (baseUnitStats?.attacks ?? 1) as number
  const baseWounds = (baseUnitStats?.wounds ?? 1) as number
  const incAttacks = (member.statIncreases?.attacks ?? 0) as number
  const incWounds = (member.statIncreases?.wounds ?? 0) as number
  const currentAW = baseAttacks + incAttacks + (baseWounds + incWounds)

  const freeWargear = getFreeWargearIds(member.baseUnitId)

  const equipCost = member.equipment.reduce((s, eq) => {
    // baseWargear and wargearOptions items always use lower cost
    if (freeWargear.has(eq)) return s + wargearWarriorCost(eq)
    // Armoury / extra purchases: lower cost if A+W < 3, higher if A+W >= 3
    return s + (currentAW >= 3 ? wargearHeroCost(eq) : wargearWarriorCost(eq))
  }, 0)

  // Special rules: 5pts each (SRS §4.8.1)
  // Heroic Actions do NOT contribute to rating — filter them out.
  // They are stored in specialRules as labels like "Heroic Resolve", "Heroic Strike", etc.
  const HEROIC_ACTION_LABELS = new Set([
    'Heroic Accuracy',
    'Heroic Challenge',
    'Heroic Channelling',
    'Heroic Defence',
    'Heroic March',
    'Heroic Resolve',
    'Heroic Strength',
    'Heroic Strike',
    // Universal heroic actions (never stored, but guard anyway)
    'Heroic Move',
    'Heroic Shoot',
    'Heroic Combat',
  ])

  // Compute exclusion set: rules granted by equipment should not add to rating
  const grantedExclusion = getGrantedRuleIds(member.ownedEquipment ?? [])

  const countableSpecialRules = member.specialRules.filter((r) => {
    if (typeof r === 'string') {
      if (HEROIC_ACTION_LABELS.has(r)) return false
      // Check if this label's rule ID is in the granted exclusion set
      const ruleId = LABEL_TO_ID.get(r)
      if (ruleId && grantedExclusion.has(ruleId)) return false
      return true
    } else {
      // Parameterised rule { id, parameter } — build composite key
      const key = `${r.id}:${String(r.parameter).toLowerCase()}`
      if (grantedExclusion.has(key)) return false
      return true
    }
  })

  const stringRules = countableSpecialRules.filter(
    (r) => typeof r === 'string'
  ) as string[]
  const paramRules = countableSpecialRules.filter(
    (r) => typeof r !== 'string'
  ) as Array<{ id: string; parameter: string | number }>

  // For string rules, split into minor/major
  const minorRules = stringRules.filter((r) => MINOR_RULE_LABELS.has(r))
  const majorRules = stringRules.filter((r) => !MINOR_RULE_LABELS.has(r))

  // Parameterised rules count as major (5pts each)
  heroPoints +=
    Math.min(minorRules.length * 5, 10) +
    majorRules.length * 5 +
    paramRules.length * 5

  return base + equipCost + heroPoints
}

export function calcCompanyRating(
  members: Member[],
  getStatsForUnit: (id: string) => StoredBaseUnitStats | undefined,
  wanderer?: { pointsCost: number }
): number {
  const memberTotal = members
    .filter((m) => !m.injuries.some((i) => i.type === 'missing_next_game'))
    .reduce(
      (sum, m) => sum + calcMemberRating(m, getStatsForUnit(m.baseUnitId)),
      0
    )
  const wandererTotal = wanderer ? wanderer.pointsCost : 0
  return memberTotal + wandererTotal
}
