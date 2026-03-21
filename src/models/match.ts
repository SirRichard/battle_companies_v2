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

export type AtoBonusType = 'influence' | 'experience' | 'reroll' | 'ambush'

export interface ActiveMatchState {
  /** Same as the company id — used as the PK in IndexedDB */
  companyId: string
  opponentRating: number
  scenarioId: string
  scenarioLabel: string
  /** Against the Odds bonuses selected for this match */
  atoBonus: AtoBonusType | null
  /** Rerolls remaining (starts at 2 if reroll bonus chosen) */
  rerollsRemaining: number
  members: MemberMatchState[]
  startedAt: string // ISO date string
}
