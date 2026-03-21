import { v4 as uuidv4 } from 'uuid'
import type {
  Company,
  CompanyDefinition,
  Member,
  MemberRole,
  WizardState,
} from '../../models'
import pathsData from '../../data/paths.json'

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
 */
export function buildStartingMembers(
  companyDef: CompanyDefinition,
  memberNames: Record<string, string>,
  leaderId: string,
  sergeantIds: string[],
  heroPaths: Record<string, string> = {},
  heroSpellChoices: Record<string, string> = {}
): Member[] {
  const members: Member[] = []
  let memberIndex = 0

  for (const entry of companyDef.startingRoster) {
    for (let i = 0; i < entry.count; i++) {
      const tempId = `member_${memberIndex}`
      const name = memberNames[tempId] ?? `Warrior #${memberIndex + 1}`

      let role: MemberRole = 'warrior'
      const isLeader = tempId === leaderId
      const isSergeant = sergeantIds.includes(tempId)

      if (isLeader) role = 'leader'
      else if (isSergeant) role = 'sergeant'

      const isHero = isLeader || isSergeant

      // Resolve path info for heroes
      const pathId = isHero ? (heroPaths[tempId] ?? null) : null
      const spellChoice =
        pathId === 'path_of_channeling'
          ? (heroSpellChoices[tempId] ?? null)
          : null
      const heroicAction = pathId ? getPathHeroicAction(pathId) : null

      // Build specialRules: granted heroic action + starting spell (Channeling)
      const specialRules: string[] = []
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

      members.push({
        id: uuidv4(),
        name,
        baseUnitId: entry.baseUnitId,
        role,
        equipment: [...(entry.equipment ?? [])],
        experience: 0,
        lifetimeExperience: 0,
        injuries: [],
        specialRules,
        heroStats: isHero ? { might: 1, will: 1, fate: 1 } : undefined,
        pathId: pathId ?? undefined,
        statIncreases: {},
        statDecreases: {},
      })

      memberIndex++
    }
  }

  return members
}

// ─── createCompany ────────────────────────────────────────────────────────────

/**
 * Creates a new Company from the completed wizard state.
 */
export function createCompany(
  wizardState: WizardState,
  companyDef: CompanyDefinition,
  heroPaths: Record<string, string> = {},
  heroSpellChoices: Record<string, string> = {}
): Company {
  const members = buildStartingMembers(
    companyDef,
    wizardState.memberNames,
    wizardState.leaderId!,
    wizardState.sergeantIds,
    heroPaths,
    heroSpellChoices
  )

  const now = new Date().toISOString()

  return {
    id: uuidv4(),
    name: wizardState.companyName.trim(),
    companyTypeId: companyDef.id,
    factionId: companyDef.factionId,
    alignment: wizardState.alignment!,
    members,
    influence: 0,
    gold: companyDef.gold,
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
 */
export function generateTempMemberIds(companyDef: CompanyDefinition): string[] {
  const ids: string[] = []
  let i = 0
  for (const entry of companyDef.startingRoster) {
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
