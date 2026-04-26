/**
 * PostMatchData — passed from MatchTrackingPage to PostMatchSummaryPage
 * via React Router location state.
 */

import type { AtoBonusType } from './match'

export interface PostMatchCasualty {
  memberId: string
  memberName: string
  role: string // leader | sergeant | hero_in_making | warrior
  baseUnitId: string
  isHero: boolean
}

export interface PostMatchXpEntry {
  memberId: string
  memberName: string
  xp: number
}

export interface PostMatchData {
  companyId: string
  result: 'win' | 'draw' | 'loss'
  opponentRating: number
  scenarioId: string
  scenarioLabel: string
  atoBonuses: AtoBonusType[]
  influenceBase: number // base influence (2 + result bonus + ato)
  casualties: PostMatchCasualty[]
  xpGained: PostMatchXpEntry[]
}
