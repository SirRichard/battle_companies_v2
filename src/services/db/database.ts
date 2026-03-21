import Dexie, { type Table } from 'dexie'
import type { Company, StoredBaseUnitStats } from '../../models'
import type { ActiveMatchState } from '../../models/match'

export class BattleCompaniesDB extends Dexie {
  companies!: Table<Company, string>
  baseUnitStats!: Table<StoredBaseUnitStats, string>
  appState!: Table<{ key: string; value: unknown }, string>
  activeMatches!: Table<ActiveMatchState, string>

  constructor() {
    super('BattleCompaniesDB')

    this.version(1).stores({
      companies: 'id, name, factionId, alignment, lastPlayedAt',
      baseUnitStats: 'baseUnitId',
      appState: 'key',
    })

    // Version 2: add activeMatches table for in-progress match persistence
    this.version(2).stores({
      companies: 'id, name, factionId, alignment, lastPlayedAt',
      baseUnitStats: 'baseUnitId',
      appState: 'key',
      activeMatches: 'companyId',
    })
  }
}

export const db = new BattleCompaniesDB()
