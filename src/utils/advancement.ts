/**
 * Advancement utilities — hero path rolling, warrior progression,
 * injury resolution, and member mutation helpers.
 */

import type { Member, CompanyDefinition } from '../models'
import type { StoredBaseUnitStats } from '../models'
import baseUnitsData from '../data/baseUnits.json'
import pathsData from '../data/paths.json'

// ─── Types ────────────────────────────────────────────────────────────────────

const BASE_UNITS = baseUnitsData as Array<{
  id: string
  label: string
  pointsCost: number
  baseWargear?: string[]
  onTheirOwnPath?: boolean | { condition: string; requiredEquipment: string[] }
}>

export interface PathProgEntry {
  roll: number
  type: string
  options?: PathProgEntry[] | string[]
  specialRuleId?: string
  label?: string
  description?: string
  activationType?: string
  bonus?: string
  maximum?: number
  parameter?: number | string
  amount?: number
}

export interface PathDef {
  id: string
  label: string
  heroicAction?: string
  maximums: {
    relative?: Partial<Record<string, number>>
    absolute?: Partial<Record<string, number>>
  }
  progression: PathProgEntry[]
}

const PATHS = pathsData as unknown as PathDef[]

export function getPath(pathId: string): PathDef | undefined {
  return PATHS.find((p) => p.id === pathId)
}

export function getPathEntry(
  pathId: string,
  roll: number
): PathProgEntry | undefined {
  return getPath(pathId)?.progression.find((e) => e.roll === roll)
}

// ─── Is On Their Own Path ─────────────────────────────────────────────────────

export function isOnTheirOwnPath(
  baseUnitId: string,
  equipment: string[]
): boolean {
  const unit = BASE_UNITS.find((u) => u.id === baseUnitId)
  if (!unit) return false
  const otp = unit.onTheirOwnPath
  if (!otp) return false
  if (otp === true) return true
  // Conditional
  if (typeof otp === 'object' && otp.condition === 'equipment') {
    return otp.requiredEquipment.every((eq) => equipment.includes(eq))
  }
  return false
}

// ─── Advancement eligibility ──────────────────────────────────────────────────

/**
 * Returns the eligible warrior advancements for a member based on their
 * current baseUnitId and equipment, filtered from the company's advancements list.
 * Excludes heroPromotionOnly advancements (those are only triggered by Hero in the Making).
 */
export function getWarriorAdvancements(
  member: Member,
  companyDef: CompanyDefinition
): Array<{
  toBaseUnitId: string
  equipment?: string[]
  retainWargear?: boolean
}> {
  return companyDef.advancements
    .filter((a) => {
      if (a.heroPromotionOnly) return false
      if (a.fromBaseUnitId !== member.baseUnitId) return false
      if (a.requiredEquipment && a.requiredEquipment.length > 0) {
        return a.requiredEquipment.every((eq: string) =>
          member.equipment.includes(eq)
        )
      }
      return true
    })
    .map((a) => ({
      toBaseUnitId: a.toBaseUnitId,
      equipment: a.equipment,
      retainWargear: (a as any).retainWargear,
    }))
}

/**
 * Apply a warrior promotion — returns the updated Member.
 * Preserves name and experience; replaces baseUnitId and equipment
 * (keeping any carryover items).
 */
export function applyWarriorPromotion(
  member: Member,
  toBaseUnitId: string,
  newEquipment: string[],
  retainWargear: boolean,
  getStatsForUnit: (id: string) => StoredBaseUnitStats | undefined
): Member {
  const newUnit = BASE_UNITS.find((u) => u.id === toBaseUnitId)
  const baseWargear = newUnit?.baseWargear ?? []
  let equipment: string[]
  if (retainWargear) {
    // Keep existing wargear that was added BEYOND the old base profile
    // (member.equipment already excludes old base equipment since it's stored separately)
    equipment = [...member.equipment]
  } else {
    // Only store the additional carry-over items — base equipment is implicit in the profile
    equipment = [...(newEquipment ?? [])]
  }
  // Ensure we don't double-store items already in the new base profile
  const baseSet = new Set(baseWargear)
  equipment = equipment.filter((e) => !baseSet.has(e))
  return {
    ...member,
    baseUnitId: toBaseUnitId,
    equipment,
    experience: Math.max(0, member.experience - 5),
    statIncreases: {},
    statDecreases: {},
  }
}

/**
 * Apply hero promotion profile swap for companies with heroPromotionOnly advancements.
 * Checks if the member's baseUnitId matches any heroPromotionOnly advancement's fromBaseUnitId.
 * If match: swaps baseUnitId, filters equipment to equipmentCarryOver list, sets role to hero_in_making,
 * grants heroStats {might:1, will:1, fate:1}.
 * If no match: returns null (caller falls back to standard applyHeroInTheMaking).
 */
export function applyHeroPromotionSwap(
  member: Member,
  companyDef: CompanyDefinition
): Member | null {
  const matchingAdvancement = companyDef.advancements.find(
    (a) => a.heroPromotionOnly && a.fromBaseUnitId === member.baseUnitId
  )

  if (!matchingAdvancement) return null

  const carryOverList = matchingAdvancement.equipmentCarryOver ?? []
  const filteredEquipment = member.equipment.filter((eq) =>
    carryOverList.includes(eq)
  )

  return {
    ...member,
    baseUnitId: matchingAdvancement.toBaseUnitId,
    equipment: filteredEquipment,
    role: 'hero_in_making',
    heroStats: { might: 1, will: 1, fate: 1 },
    experience: Math.max(0, member.experience - 5),
  }
}

/**
 * Apply Company of Heroes auto-promotion to a newly recruited member.
 * Sets role to hero_in_making and grants heroStats {might:1, will:1, fate:1}.
 * Used by Wanderers in the Wild when adding reinforcements.
 */
export function applyCompanyOfHeroesPromotion(member: Member): Member {
  return {
    ...member,
    role: 'hero_in_making',
    heroStats: { might: 1, will: 1, fate: 1 },
  }
}

/**
 * Apply Hero in the Making: promote warrior role to hero_in_making,
 * grant 1/1/1 MWF, subtract 5 XP.
 */
export function applyHeroInTheMaking(member: Member): Member {
  return {
    ...member,
    role: 'hero_in_making',
    heroStats: { might: 1, will: 1, fate: 1 },
    experience: Math.max(0, member.experience - 5),
  }
}

// ─── Path maximum helpers ─────────────────────────────────────────────────────

/**
 * Checks whether a hero can gain the given stat increase given their
 * path's relative/absolute maximums and current statIncreases.
 */
export function canIncreaseStat(
  member: Member,
  stat: string,
  pathDef: PathDef,
  baseStats: Record<string, number>
): boolean {
  const current = (member.statIncreases as Record<string, number>)[stat] ?? 0
  const relMax = pathDef.maximums.relative?.[stat]
  const absMax = pathDef.maximums.absolute?.[stat]

  // Stats tracked as relative increases
  const relativeStats = [
    'fight',
    'shoot',
    'strength',
    'defence',
    'move',
    'courage',
    'intelligence',
  ]

  if (relativeStats.includes(stat)) {
    // For target-number stats, current is stored as a negative delta; compare absolute value
    const improvementCount = ['shoot', 'courage', 'intelligence'].includes(stat)
      ? Math.abs(current)
      : current
    // Check relative cap first; fall back to absolute cap if no relative cap defined
    const cap = relMax ?? absMax
    if (cap !== undefined && improvementCount >= cap) return false
  } else {
    // Absolute: check total value
    const baseVal = baseStats[stat] ?? 1
    const total = baseVal + current
    if (absMax !== undefined && total >= absMax) return false
    if (stat === 'might' || stat === 'will' || stat === 'fate') {
      // These are in heroStats
      const heroVal =
        stat === 'might'
          ? (member.heroStats?.might ?? 1)
          : stat === 'will'
            ? (member.heroStats?.will ?? 1)
            : (member.heroStats?.fate ?? 1)
      if (absMax !== undefined && heroVal >= absMax) return false
    }
    if (stat === 'attacks' || stat === 'wounds') {
      if (absMax !== undefined && total >= absMax) return false
    }
  }

  // Global caps from rules manual
  if (stat === 'fight' && (baseStats.fight ?? 1) + current >= 9) return false
  // shoot already handled above via Math.abs(current)

  return true
}

/**
 * Apply a stat increase to the member. For MWF uses heroStats, for others uses statIncreases.
 * For shoot/courage/intelligence the number goes DOWN (better stat) so we subtract.
 */
export function applyStatIncrease(member: Member, stat: string): Member {
  if (stat === 'might' || stat === 'will' || stat === 'fate') {
    const hs = member.heroStats!
    return {
      ...member,
      heroStats: {
        ...hs,
        [stat]: (hs[stat as keyof typeof hs] as number) + 1,
      },
    }
  }
  const current = (member.statIncreases as Record<string, number>)[stat] ?? 0
  // For target-number stats (shoot/courage/intelligence), improving means the number goes DOWN
  const delta = ['shoot', 'courage', 'intelligence'].includes(stat) ? -1 : 1
  return {
    ...member,
    statIncreases: {
      ...member.statIncreases,
      [stat]: current + delta,
    },
    experience: Math.max(0, member.experience - 5),
  }
}

/**
 * Apply a special rule label to the member's specialRules list.
 * Subtracts 5 XP.
 */
export function applySpecialRule(member: Member, ruleLabel: string): Member {
  if (member.specialRules.some((r) => r === ruleLabel)) return member // already has it
  return {
    ...member,
    specialRules: [...member.specialRules, ruleLabel],
    experience: Math.max(0, member.experience - 5),
  }
}

/**
 * Subtract 5 XP from a hero after advancement.
 */
export function subtractAdvancementXp(member: Member): Member {
  return { ...member, experience: Math.max(0, member.experience - 5) }
}

// ─── Injury helpers ───────────────────────────────────────────────────────────

export type InjuryOutcome =
  | { type: 'dead' }
  | { type: 'arm_wound'; count: number }
  | { type: 'leg_wound'; count: number }
  | { type: 'broken_honour'; count: number; retired?: boolean }
  | { type: 'missing_next_game' }
  | { type: 'full_recovery'; healsInjury?: boolean }
  | { type: 'protection_by_valar' }
  | { type: 'wounds_of_a_hero'; bonusInfluence: number }
  | { type: 'scratch_choice' } // pause for user choice
  | { type: 'warrior_dead' }
  | { type: 'warrior_injured' }
  | { type: 'warrior_full_recovery' }
  | { type: 'warrior_lesson_learned'; bonusXp: number }

export function resolveHeroInjury(roll: number, member: Member): InjuryOutcome {
  if (roll === 2) return { type: 'dead' }
  if (roll === 3) {
    const existing = member.injuries.find((i) => i.type === 'arm_wound')
    return { type: 'arm_wound', count: (existing?.count ?? 0) + 1 }
  }
  if (roll === 4) {
    const existing = member.injuries.find((i) => i.type === 'leg_wound')
    return { type: 'leg_wound', count: (existing?.count ?? 0) + 1 }
  }
  if (roll === 5) {
    const existing = member.injuries.find((i) => i.type === 'broken_honour')
    const newCount = (existing?.count ?? 0) + 1
    return { type: 'broken_honour', count: newCount, retired: newCount >= 3 }
  }
  if (roll === 6) return { type: 'scratch_choice' }
  if (roll >= 7 && roll <= 10) {
    const hasHealable = member.injuries.some(
      (i) =>
        i.type === 'arm_wound' ||
        i.type === 'leg_wound' ||
        i.type === 'broken_honour'
    )
    return { type: 'full_recovery', healsInjury: hasHealable }
  }
  if (roll === 11) return { type: 'protection_by_valar' }
  if (roll === 12) {
    const bonusInfluence = Math.floor(Math.random() * 6) + 1
    return { type: 'wounds_of_a_hero', bonusInfluence }
  }
  return { type: 'full_recovery' }
}

export function resolveWarriorInjury(roll: number): InjuryOutcome {
  if (roll <= 3) return { type: 'warrior_dead' }
  if (roll <= 5) return { type: 'warrior_injured' }
  if (roll <= 11) return { type: 'warrior_full_recovery' }
  // roll === 12
  const bonusXp = Math.floor(Math.random() * 3) + 1 // D3
  return { type: 'warrior_lesson_learned', bonusXp }
}

/**
 * Apply an injury outcome to a Member, returning the updated Member.
 * Dead members are flagged; callers should remove them from the roster.
 */
export function applyInjuryOutcome(
  member: Member,
  outcome: InjuryOutcome
): { member: Member; isDead: boolean } {
  switch (outcome.type) {
    case 'dead':
      return { member, isDead: true }

    case 'arm_wound': {
      if (outcome.count >= 2) return { member, isDead: true } // forced retirement
      const injuries = [
        ...member.injuries.filter((i) => i.type !== 'arm_wound'),
        { type: 'arm_wound' as const, count: 1 },
      ]
      return { member: { ...member, injuries }, isDead: false }
    }

    case 'leg_wound': {
      if (outcome.count >= 2) return { member, isDead: true } // forced retirement
      const injuries = [
        ...member.injuries.filter((i) => i.type !== 'leg_wound'),
        { type: 'leg_wound' as const, count: 1 },
      ]
      const currentDecrease = member.statDecreases.move ?? 0
      return {
        member: {
          ...member,
          injuries,
          statDecreases: { ...member.statDecreases, move: currentDecrease + 1 },
        },
        isDead: false,
      }
    }

    case 'broken_honour': {
      if (outcome.retired) return { member, isDead: true }
      const newCount = outcome.count
      const injuries = [
        ...member.injuries.filter((i) => i.type !== 'broken_honour'),
        { type: 'broken_honour' as const, count: newCount },
      ]
      // Add Fearful on second broken honour
      const specialRules =
        newCount >= 2 && !member.specialRules.some((r) => r === 'Fearful')
          ? [...member.specialRules, 'Fearful']
          : member.specialRules
      return { member: { ...member, injuries, specialRules }, isDead: false }
    }

    case 'missing_next_game': {
      const injuries = [
        ...member.injuries.filter((i) => i.type !== 'missing_next_game'),
        { type: 'missing_next_game' as const, count: 1 },
      ]
      return { member: { ...member, injuries }, isDead: false }
    }

    case 'full_recovery': {
      // Optionally heals one existing injury — caller decides which to heal
      return { member, isDead: false }
    }

    case 'protection_by_valar': {
      // +1 Fate (up to path max — enforced by caller)
      const hs = member.heroStats
      if (!hs) return { member, isDead: false }
      const fateMax = hs.fateMax ?? 99
      return {
        member: {
          ...member,
          heroStats: { ...hs, fate: Math.min(hs.fate + 1, fateMax) },
        },
        isDead: false,
      }
    }

    case 'wounds_of_a_hero':
      // Influence bonus handled by caller
      return { member, isDead: false }

    case 'warrior_dead':
      return { member, isDead: true }

    case 'warrior_injured': {
      const injuries = [
        ...member.injuries.filter((i) => i.type !== 'missing_next_game'),
        { type: 'missing_next_game' as const, count: 1 },
      ]
      return { member: { ...member, injuries }, isDead: false }
    }

    case 'warrior_full_recovery':
      return { member, isDead: false }

    case 'warrior_lesson_learned':
      // Bonus XP handled by caller
      return { member, isDead: false }

    default:
      return { member, isDead: false }
  }
}

/**
 * Heal one specific injury type from a member (used on Full Recovery).
 */
export function healInjury(
  member: Member,
  injuryType: 'arm_wound' | 'leg_wound' | 'broken_honour'
): Member {
  const existing = member.injuries.find((i) => i.type === injuryType)
  if (!existing) return member

  const newInjuries = member.injuries.filter((i) => i.type !== injuryType)

  // If healing a leg wound, restore 1 move
  if (injuryType === 'leg_wound') {
    const currentDecrease = member.statDecreases.move ?? 0
    return {
      ...member,
      injuries: newInjuries,
      statDecreases: {
        ...member.statDecreases,
        move: Math.max(0, currentDecrease - 1),
      },
    }
  }
  // If healing broken honour, remove Fearful if count was 2
  if (injuryType === 'broken_honour' && existing.count >= 2) {
    return {
      ...member,
      injuries: newInjuries,
      specialRules: member.specialRules.filter((r) => r !== 'Fearful'),
    }
  }

  return { ...member, injuries: newInjuries }
}

// ─── Warrior progression check ────────────────────────────────────────────────

/** Returns true if a member has accumulated 5+ XP since their last progression. */
export function needsProgression(member: Member): boolean {
  return member.experience >= 5
}

export function roll2d6(): number {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1
}

export function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1
}
