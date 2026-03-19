import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { Company, StoredBaseUnitStats } from '../models'
import {
  companyService,
  statsService,
  appStateService,
  cascadeStatsUpdate,
} from '../services/company/companyService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppContextValue {
  // Companies
  companies: Company[]
  activeCompany: Company | null
  loadCompanies: () => Promise<void>
  saveCompany: (company: Company) => Promise<void>
  deleteCompany: (id: string) => Promise<void>
  setActiveCompany: (company: Company | null) => void

  // Stats library
  statsLibrary: StoredBaseUnitStats[]
  saveStats: (stats: StoredBaseUnitStats) => Promise<void>
  saveStatsAndCascade: (stats: StoredBaseUnitStats) => Promise<void>
  getStatsForUnit: (baseUnitId: string) => StoredBaseUnitStats | undefined
  clearAllStats: () => Promise<void>

  // App state
  hasSeenDisclaimer: boolean
  markDisclaimerSeen: () => Promise<void>

  // Loading
  isLoading: boolean
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [activeCompany, setActiveCompany] = useState<Company | null>(null)
  const [statsLibrary, setStatsLibrary] = useState<StoredBaseUnitStats[]>([])
  const [hasSeenDisclaimer, setHasSeenDisclaimer] = useState(true) // default true, will check
  const [isLoading, setIsLoading] = useState(true)

  // ─── Load on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    ;(async () => {
      try {
        const [allCompanies, allStats, disclaimerSeen] = await Promise.all([
          companyService.getAll(),
          statsService.getAll(),
          appStateService.get<boolean>('disclaimerSeen'),
        ])
        setCompanies(allCompanies)
        setStatsLibrary(allStats)
        setHasSeenDisclaimer(disclaimerSeen === true)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  // ─── Company operations ───────────────────────────────────────────────────

  const loadCompanies = useCallback(async () => {
    const all = await companyService.getAll()
    setCompanies(all)
  }, [])

  const saveCompany = useCallback(
    async (company: Company) => {
      await companyService.save(company)
      setCompanies((prev) => {
        const idx = prev.findIndex((c) => c.id === company.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = company
          return next.sort(
            (a, b) =>
              new Date(b.lastPlayedAt).getTime() -
              new Date(a.lastPlayedAt).getTime()
          )
        }
        return [company, ...prev]
      })
      // Keep active company in sync
      if (activeCompany?.id === company.id) {
        setActiveCompany(company)
      }
    },
    [activeCompany]
  )

  const deleteCompany = useCallback(
    async (id: string) => {
      await companyService.delete(id)
      setCompanies((prev) => prev.filter((c) => c.id !== id))
      if (activeCompany?.id === id) setActiveCompany(null)
    },
    [activeCompany]
  )

  // ─── Stats operations ─────────────────────────────────────────────────────

  const saveStats = useCallback(async (stats: StoredBaseUnitStats) => {
    await statsService.save(stats)
    setStatsLibrary((prev) => {
      const idx = prev.findIndex((s) => s.baseUnitId === stats.baseUnitId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = stats
        return next
      }
      return [...prev, stats]
    })
  }, [])

  // Save stats then cascade update to all affected companies (SRS §4.3.3)
  const saveStatsAndCascade = useCallback(
    async (stats: StoredBaseUnitStats) => {
      await statsService.save(stats)
      await cascadeStatsUpdate(stats.baseUnitId)
      // Reload both stats library and companies so UI reflects the changes
      const [allStats, allCompanies] = await Promise.all([
        statsService.getAll(),
        companyService.getAll(),
      ])
      setStatsLibrary(allStats)
      setCompanies(allCompanies)
    },
    []
  )

  const getStatsForUnit = useCallback(
    (baseUnitId: string) =>
      statsLibrary.find((s) => s.baseUnitId === baseUnitId),
    [statsLibrary]
  )

  const clearAllStats = useCallback(async () => {
    await statsService.clearAll()
    setStatsLibrary([])
  }, [])

  // ─── Disclaimer ──────────────────────────────────────────────────────────

  const markDisclaimerSeen = useCallback(async () => {
    await appStateService.set('disclaimerSeen', true)
    setHasSeenDisclaimer(true)
  }, [])

  // ─── Context value ────────────────────────────────────────────────────────

  const value: AppContextValue = {
    companies,
    activeCompany,
    loadCompanies,
    saveCompany,
    deleteCompany,
    setActiveCompany,
    statsLibrary,
    saveStats,
    saveStatsAndCascade,
    getStatsForUnit,
    clearAllStats,
    hasSeenDisclaimer,
    markDisclaimerSeen,
    isLoading,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
