import { v4 as uuidv4 } from 'uuid'
import type {
  Company,
  CompanyDefinition,
  Member,
  MemberRole,
  WizardState,
} from '../../models'
import pathsData from '../../data/paths.json'
import equipmentData from '../../data/equipment.json'

const EQUIPMENT_IDS = new Set(equipmentData.map((e) => e.id))

// ─── Path helpers ─────────────────────────────────────────────────────────────

interface PathDef {
  id: string
  heroicAction?: string
  progression: Array<{
    roll: number
    type: string
    label?: string
    description?: string
  }>
}

const PATHS = pathsData as unknown as PathDef[]

function getPathHeroicAction(pathId: string): string | null {
  const path = PATHS.find((p) => p.id === pathId)
  return path?.heroicAction ?? null
}

function heroicActionLabel(actionId: string): string {
  const map: Record<string, string> = {
    heroic_accuracy: 'Heroic Accuracy',
    heroic_challenge: 'Heroic Challenge',
    heroic_channeling: 'Heroic Channelling',
    heroic_defence: 'Heroic Defence',
    heroic_march: 'Heroic March',
    heroic_resolve: 'Heroic Resolve',
    heroic_strength: 'Heroic Strength',
    heroic_strike: 'Heroic Strike',
  }
  return (
    map[actionId] ??
    actionId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  )
}

// ─── buildStartingMembers ─────────────────────────────────────────────────────

/**
 * Builds the initial Member array from a company's startingRoster definition.
 * Assigns temporary IDs used in the wizard, then finalises with real UUIDs.
 *
 * @param heroPaths        tempId → pathId for each hero
 * @param heroSpellChoices tempId → magicalPowerId for Channeling heroes
 * @param rosterOverride   optional roster to use instead of companyDef.startingRoster
 */
export function buildStartingMembers(
  companyDef: CompanyDefinition,
  memberNames: Record<string, string>,
  leaderId: string,
  sergeantIds: string[],
  heroPaths: Record<string, string> = {},
  heroSpellChoices: Record<string, string> = {},
  goldPurchases: Record<string, string[]> = {},
  rosterOverride?: CompanyDefinition['startingRoster']
): Member[] {
  const members: Member[] = []
  let memberIndex = 0

  const roster = rosterOverride ?? companyDef.startingRoster

  for (const entry of roster) {
    for (let i = 0; i < entry.count; i++) {
      const tempId = `member_${memberIndex}`
      const name = memberNames[tempId]?.trim() || `Warrior #${memberIndex + 1}`

      let role: MemberRole = 'warrior'
      const isLeader = tempId === leaderId
      const isSergeant = sergeantIds.includes(tempId)

      if (isLeader) role = 'leader'
      else if (isSergeant) role = 'sergeant'

      const isHero = isLeader || isSergeant

      // Resolve path info for heroes
      const pathId = isHero ? (heroPaths[tempId] ?? null) : null
      const spellChoice =
        pathId === 'path_of_the_sorcerer'
          ? (heroSpellChoices[tempId] ?? null)
          : null
      const heroicAction = pathId ? getPathHeroicAction(pathId) : null

      // Build specialRules: granted heroic action + starting spell (Channeling)
      const specialRules: Array<string | { id: string; parameter: string }> = []
      if (heroicAction) {
        specialRules.push(heroicActionLabel(heroicAction))
      }
      if (spellChoice) {
        // Record the starting spell as a special rule entry so it surfaces in the UI
        const spellLabel = spellChoice
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
        specialRules.push(`Spell: ${spellLabel}`)
      }

      // Parse goldPurchases: separate plain entries from parameterised ones
      const plainEquipment: string[] = []
      const ownedEquipmentItems: string[] = []
      for (const purchaseEntry of goldPurchases[tempId] ?? []) {
        const delimiterIndex = purchaseEntry.indexOf('::')
        if (delimiterIndex !== -1) {
          const itemId = purchaseEntry.slice(0, delimiterIndex)
          const parameter = purchaseEntry.slice(delimiterIndex + 2)
          if (itemId === 'envenom_weapon') {
            ownedEquipmentItems.push('envenom_weapon')
            specialRules.push({ id: 'poisoned_attacks', parameter })
          } else {
            // Unknown parameterised entry — treat as plain equipment
            plainEquipment.push(purchaseEntry)
          }
        } else if (EQUIPMENT_IDS.has(purchaseEntry)) {
          // Equipment.json item → ownedEquipment section
          ownedEquipmentItems.push(purchaseEntry)
        } else {
          plainEquipment.push(purchaseEntry)
        }
      }

      members.push({
        id: uuidv4(),
        name,
        baseUnitId: entry.baseUnitId,
        role,
        equipment: [
          ...(entry.equipment ?? []),
          ...plainEquipment,
        ],
        experience: 0,
        lifetimeExperience: 0,
        injuries: [],
        specialRules,
        heroStats: isHero ? { might: 1, will: 1, fate: 1 } : undefined,
        pathId: pathId ?? undefined,
        statIncreases: {},
        statDecreases: {},
        ownedEquipment: ownedEquipmentItems.length > 0 ? ownedEquipmentItems : undefined,
        spells: spellChoice ? [spellChoice] : undefined,
      })

      memberIndex++
    }
  }

  return members
}

// ─── createCompany ────────────────────────────────────────────────────────────

/**
 * Resolves the active variant for a company definition given a variantId.
 * Returns the variant only when it is a non-default variant that matches the id.
 */
function resolveVariant(
  companyDef: CompanyDefinition,
  variantId?: string | null
) {
  if (!variantId) return null
  const variant = companyDef.variants?.find((v) => v.id === variantId)
  if (!variant || variant.isDefault) return null
  return variant
}

/**
 * Creates a new Company from the completed wizard state.
 *
 * @param variantId  optional variant id; when it matches a non-default variant,
 *                   that variant's startingRoster (and reinforcementTable if
 *                   present) are used instead of the company-level defaults.
 */
export function createCompany(
  wizardState: WizardState,
  companyDef: CompanyDefinition,
  heroPaths: Record<string, string> = {},
  heroSpellChoices: Record<string, string> = {},
  variantId?: string | null
): Company {
  const variant = resolveVariant(companyDef, variantId ?? wizardState.variantId)
  const rosterOverride = variant?.startingRoster

  const members = buildStartingMembers(
    companyDef,
    wizardState.memberNames,
    wizardState.leaderId!,
    wizardState.sergeantIds,
    heroPaths,
    heroSpellChoices,
    wizardState.goldPurchases ?? {},
    rosterOverride
  )

  const now = new Date().toISOString()

  return {
    id: uuidv4(),
    name: wizardState.companyName.trim(),
    companyTypeId: companyDef.id,
    factionId: Array.isArray(companyDef.factionId)
      ? companyDef.factionId[0]
      : companyDef.factionId,
    alignment: wizardState.alignment!,
    members,
    influence: 0,
    gold: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    matchHistory: [],
    createdAt: now,
    lastPlayedAt: now,
  }
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Generates the list of temp member IDs in wizard order — used to map names.
 * When rosterOverride is provided it is used instead of companyDef.startingRoster.
 */
export function generateTempMemberIds(
  companyDef: CompanyDefinition,
  rosterOverride?: CompanyDefinition['startingRoster']
): string[] {
  const ids: string[] = []
  let i = 0
  const roster = rosterOverride ?? companyDef.startingRoster
  for (const entry of roster) {
    for (let j = 0; j < entry.count; j++) {
      ids.push(`member_${i}`)
      i++
    }
  }
  return ids
}

/**
 * Returns the total number of starting members across all roster entries.
 */
export function getTotalStartingMembers(companyDef: CompanyDefinition): number {
  return companyDef.startingRoster.reduce((sum, e) => sum + e.count, 0)
}
