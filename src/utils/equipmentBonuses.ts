/**
 * Equipment-derived stat bonuses.
 *
 * These are modifiers that come from a member's currently equipped wargear
 * and are applied on top of base stats + stat increases.
 *
 * Currently tracked:
 *   shield        → +1 Defence
 *   armourUpgraded (hero boolean) → +1/+2/+3 Defence depending on upgrade tier
 *
 * light_shield, iron_shield, pavise: no Defence bonus (rule book p.110)
 * Armour bonuses (light/standard/heavy/dwarf) are already baked into base
 * unit stats — the upgrade bonus is the *delta* from upgrading one tier.
 */

import wargearData from '../data/wargear.json'
import baseUnitsData from '../data/baseUnits.json'

const WARGEAR_RAW = wargearData as Array<{ id: string; category: string }>
const BASE_UNITS_RAW = baseUnitsData as Array<{
  id: string
  baseWargear?: string[]
}>

// Armour tiers in ascending order
const ARMOUR_TIERS: Record<string, number> = {
  armour_1: 1, // light armour     → +1D
  armour_2: 2, // armour           → +2D
  armour_3: 3, // heavy armour / dwarf armour → +3D
  armour_4: 4, // heavy dwarf armour → +4D
}

// How much Defence each tier provides relative to unarmoured (tier 0)
// armour_1 = +1, armour_2 = +2, armour_3 = +3, armour_4 = +4
const ARMOUR_DEFENCE: Record<string, number> = {
  armour_1: 1,
  armour_2: 2,
  armour_3: 3,
  armour_4: 4,
}

function getWargearCategory(id: string): string {
  return WARGEAR_RAW.find((w) => w.id === id)?.category ?? ''
}

function getBaseArmourTier(baseUnitId: string): number {
  const unit = BASE_UNITS_RAW.find((u) => u.id === baseUnitId)
  if (!unit?.baseWargear) return 0
  let highest = 0
  for (const eq of unit.baseWargear) {
    const tier = ARMOUR_TIERS[getWargearCategory(eq)]
    if (tier && tier > highest) highest = tier
  }
  return highest
}

export interface EquipmentStatBonus {
  defence: number
}

/**
 * Calculate the stat bonus from a member's equipped wargear.
 *
 * @param equipment     - member.equipment (assigned option + purchased wargear)
 * @param baseUnitId    - used to determine base armour tier for upgrade delta
 * @param armourUpgraded - legacy bool flag (kept for backward compat)
 * @param armourUpgrades - new array of wargear IDs that caused armour upgrades
 */
export function calcEquipmentStatBonus(
  equipment: string[],
  baseUnitId: string,
  armourUpgraded?: boolean,
  armourUpgrades?: string[]
): EquipmentStatBonus {
  let defenceBonus = 0

  // Shield → +1D (only "shield", not light_shield / iron_shield / pavise)
  if (equipment.includes('shield')) {
    defenceBonus += 1
  }

  // Armour upgrade (heroes only): count upgrades purchased and compute delta.
  // armourUpgrades[] is the new mechanism; armourUpgraded bool is legacy fallback.
  const upgradeCount = armourUpgrades
    ? armourUpgrades.length
    : armourUpgraded
      ? 1
      : 0
  if (upgradeCount > 0) {
    const baseTier = getBaseArmourTier(baseUnitId)
    const upgradedTier = Math.min(4, baseTier + upgradeCount)
    const baseDefenceFromArmour = ARMOUR_DEFENCE[`armour_${baseTier}`] ?? 0
    const upgradedDefenceFromArmour =
      ARMOUR_DEFENCE[`armour_${upgradedTier}`] ?? 0
    defenceBonus += upgradedDefenceFromArmour - baseDefenceFromArmour
  }

  return { defence: defenceBonus }
}
