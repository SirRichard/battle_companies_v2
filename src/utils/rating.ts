/**
 * Company Rating calculation — SRS §4.8.1
 *
 * Warriors:  base unit points + equipment points (warrior cost = rating[0])
 * Heroes:    base unit points + equipment points (hero cost = rating[1])
 *            + stat increase points
 *            + special rule points
 *
 * Note: hero wargear scaling (§4.8.1 "Hero's Wargear") is deferred until
 * the armoury/progression system is in place. For now all wargear uses the
 * flat hero cost from rating[1].
 */

import baseUnitsData from '../data/baseUnits.json'
import wargearData from '../data/wargear.json'
import type { Member, MemberStats, StoredBaseUnitStats } from '../models'

const BASE_UNITS = baseUnitsData as Array<{ id: string; pointsCost: number }>
const WARGEAR = wargearData as Array<{ id: string; rating?: [number, number] }>

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
  const equipCost = isHero
    ? member.equipment.reduce((s, eq) => s + wargearHeroCost(eq), 0)
    : member.equipment.reduce((s, eq) => s + wargearWarriorCost(eq), 0)

  if (!isHero) return base + equipCost

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

  // Special rules: 5pts each (minor rules capped at 10pts total by SRS)
  // We store all as specialRules; distinction between minor/major TBD with progression
  heroPoints += member.specialRules.length * 5

  return base + equipCost + heroPoints
}

export function calcCompanyRating(
  members: Member[],
  getStatsForUnit: (id: string) => StoredBaseUnitStats | undefined
): number {
  return members
    .filter((m) => !m.injuries.some((i) => i.type === 'missing_next_game'))
    .reduce(
      (sum, m) => sum + calcMemberRating(m, getStatsForUnit(m.baseUnitId)),
      0
    )
}
