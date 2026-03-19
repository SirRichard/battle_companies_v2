import { v4 as uuidv4 } from 'uuid'
import type {
  Company,
  CompanyDefinition,
  Member,
  MemberRole,
  WizardState,
} from '../../models'

/**
 * Builds the initial Member array from a company's startingRoster definition.
 * Assigns temporary IDs used in the wizard, then finalises with real UUIDs.
 */
export function buildStartingMembers(
  companyDef: CompanyDefinition,
  memberNames: Record<string, string>,
  leaderId: string,
  sergeantIds: string[]
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

      members.push({
        id: uuidv4(),
        name,
        baseUnitId: entry.baseUnitId,
        role,
        equipment: [...(entry.equipment ?? [])],
        experience: 0,
        lifetimeExperience: 0,
        injuries: [],
        specialRules: [],
        heroStats: isHero ? { might: 1, will: 1, fate: 1 } : undefined,
        statIncreases: {},
        statDecreases: {},
      })

      memberIndex++
    }
  }

  return members
}

/**
 * Creates a new Company from the completed wizard state.
 */
export function createCompany(
  wizardState: WizardState,
  companyDef: CompanyDefinition
): Company {
  const members = buildStartingMembers(
    companyDef,
    wizardState.memberNames,
    wizardState.leaderId!,
    wizardState.sergeantIds
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
