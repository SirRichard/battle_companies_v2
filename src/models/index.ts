// ─── Static Data Models ───────────────────────────────────────────────────────

export type Alignment = 'good' | 'evil'

export interface BaseUnit {
  id: string
  label: string
  pointsCost: number
  keywords: string[]
  baseEquipment: string[]
  equipmentOptions?: {
    selectionRule: string
    options: Array<{
      id: string
      label: string
      equipment: string[]
      pointsCost: number
    }>
  }
}

export interface CompanyAdvancement {
  fromBaseUnitId: string
  toBaseUnitId: string
  heroPromotion?: boolean
  heroPromotionOnly?: boolean
  equipment?: string[]
  equipmentCarryOver?: string[]
}

export interface ReinforcementEntry {
  roll: number[]
  result: 'none' | 'unit' | 'special'
  baseUnitId?: string
  equipment?: string[]
}

export interface HeroUpgrade {
  id: string
  label: string
  description: string
  baseUnitIds?: string[]
}

export interface CompanySpecialRule {
  id: string
  title: string
  flavor?: string
  description: string
  limitExemptions?: {
    bow?: string[]
    cavalry?: string[]
  }
  reinforcementSubstitution?: Array<{
    baseUnitId: string
    appliesTo: number[]
    prompt: string
  }>
  parameters?: Record<string, unknown>
}

export interface StartingRosterEntry {
  baseUnitId: string
  count: number
  equipment?: string[]
  mustBeLeader?: boolean
}

export interface SpecialTableEntry {
  roll: number[]
  result: string
  baseUnitId?: string
  rare?: number
  count?: number
}

export interface SpecialUnitEntry {
  baseUnitId: string
  influenceCost: number
  rare?: number
}

export interface CompanyDefinition {
  id: string
  label: string
  factionId: string | string[]
  reinforcementCost: number
  maxCompanySize: number
  gold: number
  flavorTexts: string[]
  companySpecialRules: CompanySpecialRule[]
  startingRoster: StartingRosterEntry[]
  advancements: CompanyAdvancement[]
  reinforcementTable: ReinforcementEntry[]
  specialTable?: SpecialTableEntry[]
  specialUnits?: SpecialUnitEntry[]
  heroUpgrade: HeroUpgrade[]
  variants?: Array<{
    id: string
    label: string
    isDefault?: boolean
    startingRoster?: StartingRosterEntry[]
    reinforcementTable?: ReinforcementEntry[]
  }>
}

export interface Faction {
  id: string
  label: string
  alignment: Alignment
}

// ─── Live Campaign Models ─────────────────────────────────────────────────────

export type MemberRole = 'leader' | 'sergeant' | 'hero_in_making' | 'warrior'

export type InjuryType =
  | 'arm_wound'
  | 'leg_wound'
  | 'broken_honour'
  | 'missing_next_game'

export interface Injury {
  type: InjuryType
  count: number // for stacking injuries like broken_honour
}

export interface MemberStats {
  move?: number
  fight?: number
  shoot?: number
  strength?: number
  defence?: number
  attacks?: number
  wounds?: number
  courage?: number
  intelligence?: number
}

export interface Member {
  id: string
  name: string
  baseUnitId: string
  role: MemberRole
  equipment: string[]
  experience: number
  lifetimeExperience: number
  injuries: Injury[]
  specialRules: string[]
  heroStats?: {
    might: number
    will: number
    fate: number
  }
  pathId?: string
  statIncreases: Partial<MemberStats> // advances above base
  statDecreases: Partial<MemberStats> // injuries that reduce stats
  armourUpgraded?: boolean // hero has purchased one armour upgrade
}

export interface MatchRecord {
  id: string
  date: string
  result: 'win' | 'draw' | 'loss'
  opponentRating: number
  scenarioId: string
  scenarioLabel: string
  influenceGained: number
  casualties: Array<{
    memberId: string
    memberName: string
    injuryResult: string
  }>
  xpGained: Array<{
    memberId: string
    memberName: string
    xp: number
  }>
}

export interface Company {
  id: string
  name: string
  companyTypeId: string // references CompanyDefinition.id
  factionId: string
  alignment: Alignment
  members: Member[]
  influence: number
  gold: number
  wins: number
  draws: number
  losses: number
  matchHistory: MatchRecord[]
  wandererId?: string
  createdAt: string
  lastPlayedAt: string
}

// ─── Stats Library ─────────────────────────────────────────────────────────────

export interface StoredBaseUnitStats {
  baseUnitId: string
  stats: Required<MemberStats>
  isMountStats?: boolean
}

// ─── Wizard State ──────────────────────────────────────────────────────────────

export interface WizardState {
  step: number
  alignment: Alignment | null
  factionId: string | null
  companyTypeId: string | null
  companyName: string
  memberNames: Record<string, string> // tempId -> name
  leaderId: string | null
  sergeantIds: string[]
  heroPaths: Record<string, string> // tempId -> pathId
  heroSpellChoices: Record<string, string> // tempId -> magicalPowerId (Channeling only)
}
