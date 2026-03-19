import Dexie, { type Table } from 'dexie'
import type { Company, StoredBaseUnitStats } from '../../models'

export class BattleCompaniesDB extends Dexie {
  companies!: Table<Company, string>
  baseUnitStats!: Table<StoredBaseUnitStats, string>
  appState!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('BattleCompaniesDB')

    this.version(1).stores({
      companies: 'id, name, factionId, alignment, lastPlayedAt',
      baseUnitStats: 'baseUnitId',
      appState: 'key',
    })
  }
}

export const db = new BattleCompaniesDB()
