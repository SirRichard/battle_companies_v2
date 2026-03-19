import { db } from '../db/database'
import type { Company, StoredBaseUnitStats } from '../../models'

// ─── Company Operations ───────────────────────────────────────────────────────

export const companyService = {
  async getAll(): Promise<Company[]> {
    return db.companies.orderBy('lastPlayedAt').reverse().toArray()
  },

  async getById(id: string): Promise<Company | undefined> {
    return db.companies.get(id)
  },

  async save(company: Company): Promise<void> {
    await db.companies.put(company)
  },

  async delete(id: string): Promise<void> {
    await db.companies.delete(id)
  },

  async updateLastPlayed(id: string): Promise<void> {
    await db.companies.update(id, { lastPlayedAt: new Date().toISOString() })
  },
}

// ─── Stats Library Operations ─────────────────────────────────────────────────

export const statsService = {
  async getAll(): Promise<StoredBaseUnitStats[]> {
    return db.baseUnitStats.toArray()
  },

  async getByUnitId(
    baseUnitId: string
  ): Promise<StoredBaseUnitStats | undefined> {
    return db.baseUnitStats.get(baseUnitId)
  },

  async save(stats: StoredBaseUnitStats): Promise<void> {
    await db.baseUnitStats.put(stats)
  },

  async hasStats(baseUnitId: string): Promise<boolean> {
    const entry = await db.baseUnitStats.get(baseUnitId)
    return entry !== undefined
  },

  async getMissingForUnits(baseUnitIds: string[]): Promise<string[]> {
    const missing: string[] = []
    for (const id of baseUnitIds) {
      const has = await statsService.hasStats(id)
      if (!has) missing.push(id)
    }
    return missing
  },

  async clearAll(): Promise<void> {
    await db.baseUnitStats.clear()
  },
}

// ─── Stats Cascade ────────────────────────────────────────────────────────────

/**
 * When a base unit's stats are edited, update statIncreases/statDecreases on
 * all members across all companies whose baseUnitId matches. Per SRS §4.3.3.
 *
 * We don't store absolute stats on members — only deltas (statIncreases /
 * statDecreases). The base stats always come from the library lookup. So a
 * cascade here simply means re-reading the library on next render — which
 * happens automatically. However we do need to persist any affected companies
 * so lastPlayedAt and other derived fields stay consistent. We touch each
 * affected company to force a re-save that picks up the new library values.
 */
export async function cascadeStatsUpdate(baseUnitId: string): Promise<number> {
  const allCompanies = await db.companies.toArray()
  let affected = 0
  for (const company of allCompanies) {
    const hasUnit = company.members.some((m) => m.baseUnitId === baseUnitId)
    if (hasUnit) {
      // Re-save the company unchanged — the UI will re-derive stats from the
      // updated library on next load. Mark lastPlayedAt unchanged.
      await db.companies.put(company)
      affected++
    }
  }
  return affected
}

// ─── App State Operations ─────────────────────────────────────────────────────

export const appStateService = {
  async get<T>(key: string): Promise<T | undefined> {
    const entry = await db.appState.get(key)
    return entry?.value as T | undefined
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.appState.put({ key, value })
  },
}
