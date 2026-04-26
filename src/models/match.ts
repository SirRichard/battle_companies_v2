/**
 * ActiveMatchState — the in-progress match stored in IndexedDB.
 * Persisted so the user can close/reopen the app mid-match without losing state.
 */

export interface MemberMatchState {
  memberId: string
  memberName: string
  baseUnitId: string
  role: string
  equipment: string[]
  xpCounterGains: number // manually incremented by user during match
  isCasualty: boolean
  // Hero Might/Will/Fate — null for warriors
  mightMax: number | null
  willMax: number | null
  fateMax: number | null
  mightCurrent: number | null
  willCurrent: number | null
  fateCurrent: number | null
}

export type AtoBonusType =
  | 'influence'
  | 'experience'
  | 'reroll'
  | 'toolkit'
  | 'wanderer'
  | 'ambush'

/** One item assigned to a member as part of the Toolkit ATO bonus */
export interface ToolkitItem {
  memberId: string
  itemId: string
  /** parameter for parameterised items, e.g. weapon id for Envenom Weapon */
  parameter?: string
}

export interface ActiveMatchState {
  /** Same as the company id — used as the PK in IndexedDB */
  companyId: string
  opponentRating: number
  scenarioId: string
  scenarioLabel: string
  /** Against the Odds bonuses selected for this match (multi-select) */
  atoBonuses: AtoBonusType[]
  /** Rerolls remaining (starts at 2 if reroll bonus chosen) */
  rerollsRemaining: number
  /** Toolkit items assigned to members — discarded after match ends */
  toolkitItems: ToolkitItem[]
  members: MemberMatchState[]
  startedAt: string // ISO date string
}
