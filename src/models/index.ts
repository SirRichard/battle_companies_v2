// ─── Static Data Models ───────────────────────────────────────────────────────

export type Alignment = 'good' | 'evil'

export interface BaseUnit {
  id: string
  label: string
  pointsCost: number
  keywords: string[]
  baseWargear: string[]
  wargearOptions?: {
    selectionRule: string
    options: Array<{
      id: string
      label: string
      wargear: string[]
      pointsCost: number
    }>
  }
}

export interface CompanyAdvancement {
  fromBaseUnitId: string
  toBaseUnitId: string
  requiredEquipment?: string[]
  heroPromotion?: boolean
  heroPromotionOnly?: boolean
  equipment?: string[]
  equipmentCarryOver?: string[]
  retainWargear?: boolean
}

export interface ReinforcementEntry {
  roll: number[]
  result:
    | 'none'
    | 'unit'
    | 'choice'
    | 'special'
    | 'choiceFromTable'
    | 'choiceFromPool'
    | 'pair'
  baseUnitId?: string
  equipment?: string[]
  rare?: number
  count?: number
  units?: Array<{ baseUnitId: string; rare?: number }>
  includeRolls?: number[]
  pool?: Array<{ baseUnitId: string; rare?: number }>
}

export interface UniqueWargearEntry {
  equipmentId: string
  label: string
  category?: string
  influenceCost: number
  rating: [number, number]
  allowedKeywords?: string[]
  heroOnly?: boolean
  limit?: number
}

export interface HeroUpgrade {
  id: string
  label: string
  flavor?: string
  description: string
  baseUnitIds?: string[]
  allowedKeywords?: string[]
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
  heroRestrictions?: Array<{ allowedBaseUnitIds: string[] }>
  parameters?: Record<string, unknown>
  throwingExemptions?: string[]
  unitRosterOverrides?: Array<{
    baseUnitId: string
    rosterSlots: number
    bowLimitCount: number
  }>
  substitution?: {
    unitId: string
    condition: { unitSlain: string }
    replacesAnyRoll?: boolean
    minRoll: number
    limit: number
    heroRoleOptions: string[]
  }
  vaultWardenConfig?: {
    pairBaseUnitIds: string[]
    overflowBehavior: string
    replacementSubstitution: boolean
  }
}

export interface StartingRosterEntry {
  baseUnitId: string
  count: number
  equipment?: string[]
  mustBeLeader?: boolean
  mustBeSergeant?: boolean
}

export interface SpecialTableEntry {
  roll: number[]
  result: string
  baseUnitId?: string
  rare?: number
  count?: number
  units?: Array<{ baseUnitId: string; rare?: number }>
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
  uniqueWargear?: UniqueWargearEntry[]
  variants?: Array<{
    id: string
    label: string
    isDefault?: boolean
    visibleFromFactions?: string[]
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
  | 'dead'

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
  specialRules: Array<string | { id: string; parameter: string | number }>
  heroStats?: {
    might: number
    will: number
    fate: number
    fateMax?: number // ceiling enforced by path max (Protection by Valar)
  }
  pathId?: string
  statIncreases: Partial<MemberStats> // advances above base
  statDecreases: Partial<MemberStats> // injuries that reduce stats
  armourUpgraded?: boolean // legacy — superseded by armourUpgrades
  armourUpgrades?: string[] // wargear IDs that caused a +1D armour upgrade (one per purchase)
  ownedEquipment?: string[] // Equipment item IDs (from Armoury Equipment tab)
  creatureId?: string // Attached creature ID (Leader/Sergeant only, one per hero)
  spells?: string[] // spell IDs from CHANNELING_SPELLS (Path of Channeling only)
  spellImprovements?: Record<string, number> // spellId → number of casting value improvements (0–2)
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
  // warg_marauder-specific fields (Req 4.2, 4.3)
  riderCount?: number
  additionalRiders?: Array<{ equipment: string[] }>
}

// ─── Wizard State ──────────────────────────────────────────────────────────────

export interface WizardState {
  step: number
  visitedSteps: number[]
  alignment: Alignment | null
  factionId: string | null
  companyTypeId: string | null
  variantId: string | null
  companyName: string
  memberNames: Record<string, string> // tempId -> name
  leaderId: string | null
  sergeantIds: string[]
  heroPaths: Record<string, string> // tempId -> pathId
  heroSpellChoices: Record<string, string> // tempId -> magicalPowerId (Channeling only)
  goldPurchases: Record<string, string[]> // tempId -> additional wargear ids bought with gold
}
