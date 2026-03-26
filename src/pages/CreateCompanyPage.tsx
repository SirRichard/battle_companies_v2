import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Button,
  Typography,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'

import PageHeader from '../components/common/PageHeader'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StepAlignment from '../components/wizard/StepAlignment'
import StepFaction from '../components/wizard/StepFaction'
import StepCompany from '../components/wizard/StepCompany'
import StepCompanyName from '../components/wizard/StepCompanyName'
import StepMemberNames from '../components/wizard/StepMemberNames'
import StepLeaderSelection from '../components/wizard/StepLeaderSelection'
import StepPathSelection from '../components/wizard/StepPathSelection'
import StepSpellSelection from '../components/wizard/StepSpellSelection'
import StepGoldEquipment from '../components/wizard/StepGoldEquipment'

import { useAppContext } from '../context/AppContext'
import type { Alignment, WizardState } from '../models'
import type { CompanyDefinition } from '../models'
import {
  createCompany,
  generateTempMemberIds,
} from '../services/company/companyFactory'
import { getUnitLabel } from '../utils/labels'

import companiesData from '../data/companies.json'
import baseUnitsData from '../data/baseUnits.json'
import wargearData from '../data/wargear.json'

const BASE_UNITS_RAW = baseUnitsData as Array<{
  id: string
  baseEquipment: string[]
}>
const WARGEAR_RAW = wargearData as Array<{ id: string; category: string }>

const WIZARD_DRAFT_KEY = 'bc_wizard_draft'

/** Returns mount IDs embedded in a unit's baseEquipment list. */
function getMountsForUnit(unitId: string): string[] {
  const unit = BASE_UNITS_RAW.find((u) => u.id === unitId)
  if (!unit) return []
  return unit.baseEquipment.filter((eq) =>
    WARGEAR_RAW.some((w) => w.id === eq && w.category === 'mount')
  )
}

/** All unique base unit + mount IDs a company could ever use.
 *  Includes starting roster, all advancement targets, and all
 *  reinforcement table results so stats are ready before they're needed. */
function getAllUnitIdsForRoster(companyDef: CompanyDefinition): string[] {
  const unitIds = new Set<string>()

  // Starting roster
  for (const e of companyDef.startingRoster) {
    unitIds.add(e.baseUnitId)
  }

  // Advancements — collect both source and target.
  // fromBaseUnitId may not be in the starting roster when it is itself
  // only reachable via a prior promotion (e.g. Citadel Guard → Guard of
  // the Fountain Court in Minas Tirith).
  for (const a of companyDef.advancements) {
    if (a.fromBaseUnitId) unitIds.add(a.fromBaseUnitId)
    if (a.toBaseUnitId) unitIds.add(a.toBaseUnitId)
  }

  // Helper: extract baseUnitIds from a single table entry, covering:
  //   { baseUnitId }               — "unit" | "choice"
  //   { units: [{ baseUnitId }] }  — "pair" (e.g. Vault Warden team in Durin's Folk)
  //   { pool:  [{ baseUnitId }] }  — "choiceFromPool" (e.g. Wanderers in the Wild)
  type AnyEntry = {
    baseUnitId?: string
    units?: Array<{ baseUnitId?: string }>
    pool?: Array<{ baseUnitId?: string }>
  }
  const addFromEntry = (entry: AnyEntry) => {
    if (entry.baseUnitId) unitIds.add(entry.baseUnitId)
    for (const arr of [entry.units, entry.pool]) {
      if (Array.isArray(arr)) {
        for (const u of arr) {
          if (u.baseUnitId) unitIds.add(u.baseUnitId)
        }
      }
    }
  }

  // Reinforcement table (standard rolls)
  for (const r of companyDef.reinforcementTable) {
    addFromEntry(r as AnyEntry)
  }

  // Special / elite table (roll-of-6 sub-table)
  for (const r of companyDef.specialTable ?? []) {
    addFromEntry(r as AnyEntry)
  }

  // Special purchasable units (Cave Trolls, Gundabad Ogres, etc.)
  for (const u of companyDef.specialUnits ?? []) {
    unitIds.add(u.baseUnitId)
  }

  // Variants (e.g. The Last Alliance Númenórean-only variant)
  for (const v of companyDef.variants ?? []) {
    for (const e of v.startingRoster ?? []) {
      unitIds.add(e.baseUnitId)
    }
    for (const r of v.reinforcementTable ?? []) {
      addFromEntry(r as AnyEntry)
    }
  }

  // Mounts for all of the above
  const mountIds = new Set<string>()
  for (const id of unitIds) {
    for (const m of getMountsForUnit(id)) mountIds.add(m)
  }

  return [...unitIds, ...mountIds]
}

const COMPANIES = companiesData as CompanyDefinition[]

const STEPS = [
  'Alignment',
  'Faction',
  'Company',
  'Name',
  'Members',
  'Command',
  'Paths',
  'Gold',
]

const STEP_TITLES = [
  'Choose Your Alignment',
  'Choose Your Faction',
  'Choose Your Company',
  'Name Your Company',
  'Name Your Members',
  'Appoint Your Heroes',
  'Choose Hero Paths',
  'Spend Your Gold',
]

const MotionBox = motion(Box)

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: (dir: number) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
    transition: { duration: 0.2 },
  }),
}

const INITIAL_WIZARD: WizardState = {
  step: 0,
  alignment: null,
  factionId: null,
  companyTypeId: null,
  companyName: '',
  memberNames: {},
  leaderId: null,
  sergeantIds: [],
  heroPaths: {},
  heroSpellChoices: {},
  goldPurchases: {},
}

export default function CreateCompanyPage() {
  const { saveCompany, getStatsForUnit } = useAppContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [wizard, setWizard] = useState<WizardState>(() => {
    try {
      const draft = sessionStorage.getItem(WIZARD_DRAFT_KEY)
      if (draft) return JSON.parse(draft) as WizardState
    } catch {
      /* ignore malformed draft */
    }
    return INITIAL_WIZARD
  })
  const [direction, setDirection] = useState(1)

  // Persist wizard state to sessionStorage on every change so we can restore
  // it if the user is redirected to stats entry mid-wizard.
  useEffect(() => {
    try {
      sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(wizard))
    } catch {
      /* ignore */
    }
  }, [wizard])

  // When EditStatsPage navigates back here with ?from=stats, the component
  // may already be mounted (React Router doesn't unmount it), so the lazy
  // useState initialiser won't re-run. Explicitly rehydrate from sessionStorage
  // whenever we see that signal.
  useEffect(() => {
    if (searchParams.get('from') === 'stats') {
      try {
        const draft = sessionStorage.getItem(WIZARD_DRAFT_KEY)
        if (draft) {
          const parsed = JSON.parse(draft) as WizardState
          // Advance straight to path selection — stats are now all entered
          setWizard({ ...parsed, step: 6 })
        }
      } catch {
        /* ignore */
      }
    }
  }, [searchParams])
  const [showAbortConfirm, setShowAbortConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showGoldConfirm, setShowGoldConfirm] = useState(false)

  // ─── Derived data ────────────────────────────────────────────────────────

  const selectedCompany = useMemo(
    () => COMPANIES.find((c) => c.id === wizard.companyTypeId) ?? null,
    [wizard.companyTypeId]
  )

  const tempMemberIds = useMemo(
    () => (selectedCompany ? generateTempMemberIds(selectedCompany) : []),
    [selectedCompany]
  )

  // ─── Navigation ──────────────────────────────────────────────────────────

  const go = (nextStep: number) => {
    setDirection(nextStep > wizard.step ? 1 : -1)
    setWizard((w) => ({ ...w, step: nextStep }))
  }

  const canAdvance = (): boolean => {
    switch (wizard.step) {
      case 0:
        return wizard.alignment !== null
      case 1:
        return wizard.factionId !== null
      case 2:
        return wizard.companyTypeId !== null
      case 3:
        return wizard.companyName.trim().length > 0
      case 4:
        return true // names are optional; blank names get defaults like 'Warrior #1'
      case 5:
        return wizard.leaderId !== null && wizard.sergeantIds.length === 2
      case 6: {
        // All three heroes must have a path; Channeling heroes also need a spell
        const heroTempIds = [wizard.leaderId!, ...wizard.sergeantIds]
        return heroTempIds.every((tid) => {
          const pathId = wizard.heroPaths[tid]
          if (!pathId) return false
          if (pathId === 'path_of_channeling' && !wizard.heroSpellChoices[tid])
            return false
          return true
        })
      }
      case 7:
        return true // gold step is always advanceable (unspent gold is discarded)
      default:
        return false
    }
  }

  // ─── Step actions ────────────────────────────────────────────────────────

  const selectAlignment = (alignment: Alignment) => {
    setWizard((w) => ({
      ...w,
      alignment,
      factionId: null,
      companyTypeId: null,
    }))
  }

  const selectFaction = (factionId: string) => {
    setWizard((w) => ({ ...w, factionId, companyTypeId: null }))
  }

  const selectCompany = (companyTypeId: string | null) => {
    setWizard((w) => ({
      ...w,
      companyTypeId,
      memberNames: {},
      leaderId: null,
      sergeantIds: [],
      heroPaths: {},
      heroSpellChoices: {},
    }))
  }

  const setMemberName = (tempId: string, name: string) => {
    setWizard((w) => ({
      ...w,
      memberNames: { ...w.memberNames, [tempId]: name },
    }))
  }

  const toggleSergeant = (tempId: string) => {
    setWizard((w) => {
      if (w.leaderId === tempId) return w
      const already = w.sergeantIds.includes(tempId)
      if (already) {
        return {
          ...w,
          sergeantIds: w.sergeantIds.filter((id) => id !== tempId),
        }
      }
      if (w.sergeantIds.length >= 2) return w
      return { ...w, sergeantIds: [...w.sergeantIds, tempId] }
    })
  }

  // ─── Final save ──────────────────────────────────────────────────────────

  // Gold remaining helper
  const goldRemaining = () => {
    if (!selectedCompany) return 0
    const wg = wargearData as Array<{ id: string; rating?: [number, number] }>
    const spent = (
      Object.values(wizard.goldPurchases ?? {}) as string[][]
    ).reduce(
      (sum: number, items: string[]) =>
        sum +
        items.reduce((s: number, wId: string) => {
          const w = wg.find((x) => x.id === wId)
          return s + (w?.rating?.[0] ?? 1)
        }, 0),
      0
    )
    return (selectedCompany.gold ?? 0) - spent
  }

  const doFinish = async () => {
    if (!selectedCompany || saving) return
    setSaving(true)
    try {
      const company = createCompany(
        wizard,
        selectedCompany,
        wizard.heroPaths,
        wizard.heroSpellChoices
      )
      await saveCompany(company)
      sessionStorage.removeItem(WIZARD_DRAFT_KEY)
      navigate(`/companies/${company.id}`)
    } finally {
      setSaving(false)
    }
  }

  const handleFinish = () => {
    // If company has gold and we're on the gold step, confirm before saving
    if ((selectedCompany?.gold ?? 0) > 0 && wizard.step === STEPS.length - 1) {
      setShowGoldConfirm(true)
    } else {
      void doFinish()
    }
  }

  // Enter key shortcut for Next / Form Company (only when canAdvance() is true and step > 1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      // Don't fire if focus is inside a text input or textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'BUTTON') return
      if (wizard.step <= 1) return
      if (!canAdvance()) return
      if (wizard.step === STEPS.length - 1) {
        handleFinish()
      } else {
        if (wizard.step === 5 && selectedCompany) {
          const allIds = getAllUnitIdsForRoster(selectedCompany)
          const missing = allIds.filter((id) => !getStatsForUnit(id))
          if (missing.length > 0) {
            navigate(`/stats?wizard=1&units=${missing.join(',')}`)
            return
          }
        }
        // Skip gold step if no gold
        if (wizard.step === 6 && (selectedCompany?.gold ?? 0) === 0) {
          handleFinish()
          return
        }
        go(wizard.step + 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    wizard.step,
    canAdvance,
    handleFinish,
    selectedCompany,
    go,
    navigate,
    getStatsForUnit,
  ])

  const handleAbort = useCallback(() => {
    sessionStorage.removeItem(WIZARD_DRAFT_KEY)
    navigate('/')
  }, [navigate])

  // ─── Render steps ────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (wizard.step) {
      // ── Step 0: Alignment ───────────────────────────────────────────────
      case 0:
        return (
          <StepAlignment
            value={wizard.alignment}
            onChange={selectAlignment}
            onAdvance={() => go(1)}
          />
        )

      // ── Step 1: Faction ─────────────────────────────────────────────────
      case 1:
        return (
          <StepFaction
            alignment={wizard.alignment!}
            value={wizard.factionId}
            onChange={selectFaction}
            onAdvance={() => go(2)}
          />
        )

      // ── Step 2: Company type ─────────────────────────────────────────────
      case 2:
        return (
          <StepCompany
            factionId={wizard.factionId!}
            value={wizard.companyTypeId}
            onChange={selectCompany}
          />
        )

      // ── Step 3: Company name ─────────────────────────────────────────────
      case 3:
        return (
          <StepCompanyName
            companyDef={selectedCompany!}
            value={wizard.companyName}
            onChange={(name) => setWizard((w) => ({ ...w, companyName: name }))}
          />
        )

      // ── Step 4: Member names ─────────────────────────────────────────────
      case 4:
        return (
          <StepMemberNames
            companyDef={selectedCompany!}
            memberNames={wizard.memberNames}
            onChange={setMemberName}
          />
        )

      // ── Step 5: Leader & Sergeants ───────────────────────────────────────
      case 5:
        return (
          <StepLeaderSelection
            companyDef={selectedCompany!}
            memberNames={wizard.memberNames}
            leaderId={wizard.leaderId}
            sergeantIds={wizard.sergeantIds}
            onSelectLeader={(tempId) =>
              setWizard((w) => ({
                ...w,
                leaderId: w.leaderId === tempId ? null : tempId,
                sergeantIds: w.sergeantIds.filter((id) => id !== tempId),
              }))
            }
            onToggleSergeant={toggleSergeant}
          />
        )

      // ── Step 6: Hero Paths ──────────────────────────────────────────────
      case 6: {
        const heroTempIds = [wizard.leaderId!, ...wizard.sergeantIds]

        // Find the first hero that doesn't have a path yet, or needs a spell chosen
        const pendingHeroTempId = heroTempIds.find((tid) => {
          const pathId = wizard.heroPaths[tid]
          if (!pathId) return true
          if (pathId === 'path_of_channeling' && !wizard.heroSpellChoices[tid])
            return true
          return false
        })

        // All done — summary view
        if (!pendingHeroTempId) {
          return (
            <Box>
              <Typography
                variant="body2"
                sx={{ fontStyle: 'italic', opacity: 0.7, mb: 3 }}
              >
                All heroes have chosen their paths. Review below, then press
                Form Company.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {heroTempIds.map((tid) => {
                  const pathId = wizard.heroPaths[tid]
                  const pLabel =
                    pathId
                      ?.replace(/_/g, ' ')
                      .replace(/\bpath of\b/i, '')
                      .trim() ?? '—'
                  const formattedPath =
                    pLabel.charAt(0).toUpperCase() + pLabel.slice(1)
                  const isLeader = tid === wizard.leaderId
                  const tidIdx2 = parseInt(tid.replace('member_', ''), 10)
                  const name =
                    wizard.memberNames[tid]?.trim() || `Warrior #${tidIdx2 + 1}`
                  const spell = wizard.heroSpellChoices[tid]

                  // Resolve roster entry for unit type + equipment
                  const tidIdx = parseInt(tid.replace('member_', ''), 10)
                  let run = 0
                  let rosterEntry: {
                    baseUnitId: string
                    equipment?: string[]
                  } | null = null
                  for (const e of selectedCompany!.startingRoster) {
                    if (tidIdx < run + e.count) {
                      rosterEntry = e
                      break
                    }
                    run += e.count
                  }
                  const equipment = rosterEntry?.equipment ?? []

                  return (
                    <Box
                      key={tid}
                      sx={{
                        border: '1px solid',
                        borderColor: isLeader ? 'primary.main' : 'primary.dark',
                        borderRadius: 2,
                        p: 2,
                        background: 'rgba(201,168,76,0.03)',
                      }}
                    >
                      {/* Header: name + role badge + change button */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          mb: 1,
                        }}
                      >
                        <Box>
                          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                            {name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                              color: isLeader ? 'primary.main' : 'primary.dark',
                              fontWeight: 700,
                            }}
                          >
                            {isLeader ? 'Leader' : 'Sergeant'}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setWizard((w) => ({
                              ...w,
                              heroPaths: Object.fromEntries(
                                Object.entries(w.heroPaths).filter(
                                  ([k]) => k !== tid
                                )
                              ),
                              heroSpellChoices: Object.fromEntries(
                                Object.entries(w.heroSpellChoices).filter(
                                  ([k]) => k !== tid
                                )
                              ),
                            }))
                          }}
                          sx={{
                            mt: 0.5,
                            fontSize: '0.7rem',
                            py: 0.5,
                            px: 1.5,
                            minHeight: 0,
                          }}
                        >
                          Change Path
                        </Button>
                      </Box>

                      <Box
                        sx={{
                          borderTop: '1px solid',
                          borderColor: 'divider',
                          opacity: 0.3,
                          mb: 1.5,
                        }}
                      />

                      {/* Unit type */}
                      {rosterEntry && (
                        <>
                          <Typography
                            variant="caption"
                            sx={{ opacity: 0.55, display: 'block', mb: 0.25 }}
                          >
                            Unit Type
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1.25 }}>
                            {getUnitLabel(rosterEntry.baseUnitId)}
                          </Typography>
                        </>
                      )}

                      {/* Equipment */}
                      {equipment.length > 0 && (
                        <>
                          <Typography
                            variant="caption"
                            sx={{ opacity: 0.55, display: 'block', mb: 0.5 }}
                          >
                            Equipment
                          </Typography>
                          <Box
                            sx={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 0.5,
                              mb: 1.25,
                            }}
                          >
                            {equipment.map((eq: string) => (
                              <Box
                                key={eq}
                                sx={{
                                  px: 1,
                                  py: 0.25,
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'rgba(200,164,90,0.35)',
                                  fontSize: '0.7rem',
                                }}
                              >
                                {eq
                                  .replace(/_/g, ' ')
                                  .replace(/\b\w/g, (l) => l.toUpperCase())}
                              </Box>
                            ))}
                          </Box>
                        </>
                      )}

                      {/* Path */}
                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.55, display: 'block', mb: 0.25 }}
                      >
                        Heroic Path
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: 'primary.main', fontWeight: 600 }}
                      >
                        Path of {formattedPath}
                      </Typography>
                      {spell && (
                        <Typography
                          variant="caption"
                          sx={{ opacity: 0.6, display: 'block', mt: 0.25 }}
                        >
                          Starting spell:{' '}
                          {spell
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Typography>
                      )}
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )
        }

        const currentPathId = wizard.heroPaths[pendingHeroTempId]
        const needsSpell =
          currentPathId === 'path_of_channeling' &&
          !wizard.heroSpellChoices[pendingHeroTempId]
        const heroTempIdx2 = parseInt(
          pendingHeroTempId.replace('member_', ''),
          10
        )
        const heroName =
          wizard.memberNames[pendingHeroTempId]?.trim() ||
          `Warrior #${heroTempIdx2 + 1}`
        const heroRole =
          pendingHeroTempId === wizard.leaderId ? 'leader' : 'sergeant'

        // Derive the roster entry for this tempId so we can show unit type + gear
        const heroTempIndex = parseInt(
          pendingHeroTempId.replace('member_', ''),
          10
        )
        let rosterRunning = 0
        let heroRosterEntry: {
          baseUnitId: string
          equipment?: string[]
        } | null = null
        for (const entry of selectedCompany!.startingRoster) {
          if (heroTempIndex < rosterRunning + entry.count) {
            heroRosterEntry = entry
            break
          }
          rosterRunning += entry.count
        }
        const heroBaseUnitId = heroRosterEntry?.baseUnitId ?? ''
        const heroEquipment = heroRosterEntry?.equipment ?? []

        if (needsSpell) {
          return (
            <StepSpellSelection
              heroName={heroName}
              baseUnitId={heroBaseUnitId}
              equipment={heroEquipment}
              selectedSpellId={
                wizard.heroSpellChoices[pendingHeroTempId] ?? null
              }
              onSelect={(spellId) =>
                setWizard((w) => ({
                  ...w,
                  heroSpellChoices: {
                    ...w.heroSpellChoices,
                    [pendingHeroTempId]: spellId,
                  },
                }))
              }
            />
          )
        }

        const heroBaseStats = heroBaseUnitId
          ? getStatsForUnit(heroBaseUnitId)?.stats
          : undefined

        return (
          <StepPathSelection
            heroName={heroName}
            heroRole={heroRole}
            baseUnitId={heroBaseUnitId}
            equipment={heroEquipment}
            baseStats={heroBaseStats}
            selectedPathId={wizard.heroPaths[pendingHeroTempId] ?? null}
            onSelect={(pathId) =>
              setWizard((w) => ({
                ...w,
                heroPaths: { ...w.heroPaths, [pendingHeroTempId]: pathId },
              }))
            }
          />
        )
      }

      // ── Step 7: Gold Equipment ──────────────────────────────────────────
      case 7: {
        if (!selectedCompany) return null
        // Build the roster member list with names + hero status
        const goldMembers: Array<{
          tempId: string
          name: string
          baseUnitId: string
          equipment: string[]
          isHero: boolean
        }> = []
        let mi = 0
        for (const entry of selectedCompany.startingRoster) {
          for (let i = 0; i < entry.count; i++) {
            const tid = `member_${mi}`
            const name = wizard.memberNames[tid]?.trim() || `Warrior #${mi + 1}`
            const isHero =
              tid === wizard.leaderId || wizard.sergeantIds.includes(tid)
            goldMembers.push({
              tempId: tid,
              name,
              baseUnitId: entry.baseUnitId,
              equipment: entry.equipment ?? [],
              isHero,
            })
            mi++
          }
        }
        return (
          <StepGoldEquipment
            gold={selectedCompany.gold ?? 0}
            members={goldMembers}
            companyTypeId={selectedCompany.id}
            goldPurchases={wizard.goldPurchases ?? {}}
            onUpdate={(tempId, wargearIds) =>
              setWizard((w) => ({
                ...w,
                goldPurchases: { ...w.goldPurchases, [tempId]: wargearIds },
              }))
            }
          />
        )
      }

      default:
        return null
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="New Company"
        subtitle={STEP_TITLES[wizard.step]}
        onBack={() => setShowAbortConfirm(true)}
      />

      {/* Stepper */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          overflowX: 'auto',
        }}
      >
        <Stepper activeStep={wizard.step} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Step content */}
      <Box
        sx={{
          flex: 1,
          px: { xs: 2, sm: 3 },
          py: 3,
          maxWidth: 600,
          width: '100%',
          mx: 'auto',
          overflowX: 'hidden',
        }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <MotionBox
            key={wizard.step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {renderStep()}
          </MotionBox>
        </AnimatePresence>
      </Box>

      {/* Navigation footer */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          background:
            'linear-gradient(0deg, rgba(26,15,5,0.98) 0%, rgba(42,26,10,0.95) 100%)',
          position: 'sticky',
          bottom: 0,
        }}
      >
        <Button
          variant="outlined"
          onClick={() =>
            wizard.step === 0 ? setShowAbortConfirm(true) : go(wizard.step - 1)
          }
          sx={{ minWidth: 100, minHeight: 44 }}
        >
          {wizard.step === 0 ? 'Cancel' : 'Back'}
        </Button>

        {wizard.step < STEPS.length - 1 ? (
          // Steps 0 and 1 auto-advance on card selection — no Next button needed
          wizard.step <= 1 ? (
            <Box sx={{ minWidth: 100 }} />
          ) : (
            <Button
              variant="contained"
              onClick={() => {
                // Between step 5 and 6: check for missing stats
                if (wizard.step === 5 && selectedCompany) {
                  const allIds = getAllUnitIdsForRoster(selectedCompany)
                  const missing = allIds.filter((id) => !getStatsForUnit(id))
                  if (missing.length > 0) {
                    navigate(`/stats?wizard=1&units=${missing.join(',')}`)
                    return
                  }
                }
                // After paths (step 6): skip gold step if no gold
                if (wizard.step === 6 && (selectedCompany?.gold ?? 0) === 0) {
                  handleFinish()
                  return
                }
                go(wizard.step + 1)
              }}
              disabled={!canAdvance()}
              sx={{ minWidth: 100, minHeight: 44 }}
            >
              Next
            </Button>
          )
        ) : (
          <Button
            variant="contained"
            onClick={handleFinish}
            disabled={!canAdvance() || saving}
            sx={{ minWidth: 140, minHeight: 44 }}
          >
            {saving ? 'Mustering…' : 'Form Company'}
          </Button>
        )}
      </Box>

      {/* Abort confirmation */}
      <ConfirmDialog
        open={showAbortConfirm}
        title="Abandon Creation?"
        message="Your progress will be lost. Return to the home screen?"
        confirmLabel="Abandon"
        onConfirm={handleAbort}
        onCancel={() => setShowAbortConfirm(false)}
        dangerous
      />

      {/* Gold confirmation — warns about unspent gold */}
      <ConfirmDialog
        open={showGoldConfirm}
        title="Form Company?"
        message={
          goldRemaining() > 0
            ? `You have ${goldRemaining()} Gold unspent. Any unspent gold is discarded and cannot be recovered. Proceed?`
            : 'Finalise your company and begin your campaign?'
        }
        confirmLabel="Form Company"
        onConfirm={() => {
          setShowGoldConfirm(false)
          void doFinish()
        }}
        onCancel={() => setShowGoldConfirm(false)}
        dangerous={goldRemaining() > 0}
      />
    </Box>
  )
}
