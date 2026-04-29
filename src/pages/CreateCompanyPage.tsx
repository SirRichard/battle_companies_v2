import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Button,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepButton,
  Divider,
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
  if (!unit || !unit.baseEquipment) return []
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
  visitedSteps: [0],
  alignment: null,
  factionId: null,
  companyTypeId: null,
  variantId: null,
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
      if (draft) {
        const parsed = JSON.parse(draft) as WizardState
        if (!parsed.visitedSteps) {
          parsed.visitedSteps = [0]
        }
        return parsed
      }
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
          // fromStep tells us which wizard step sent the user to stats entry.
          // If present, return to that step; otherwise default to step 6 (paths).
          const fromStepParam = searchParams.get('fromStep')
          const returnStep = fromStepParam !== null ? parseInt(fromStepParam, 10) : 6
          setWizard({ ...parsed, step: isNaN(returnStep) ? 6 : returnStep })
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

  const tempMemberIds = useMemo(() => {
    if (!selectedCompany) return []
    // When a non-default variant is active, use its startingRoster for temp IDs
    const activeVariant = wizard.variantId
      ? selectedCompany.variants?.find(
          (v) => v.id === wizard.variantId && !v.isDefault
        )
      : undefined
    const rosterOverride = activeVariant ? activeVariant.startingRoster : undefined
    return generateTempMemberIds(selectedCompany, rosterOverride)
  }, [selectedCompany, wizard.variantId])

  const forcedLeaderId = useMemo(() => {
    if (!selectedCompany) return null
    // Use variant roster if a non-default variant is active
    const activeVariant = wizard.variantId
      ? selectedCompany.variants?.find(
          (v) => v.id === wizard.variantId && !v.isDefault
        )
      : undefined
    const roster = activeVariant?.startingRoster ?? selectedCompany.startingRoster
    
    let idx = 0
    for (const entry of roster) {
      for (let i = 0; i < entry.count; i++) {
        if (entry.mustBeLeader) return `member_${idx}`
        idx++
      }
    }
    return null
  }, [selectedCompany, wizard.variantId])

  const forcedSergeantIds = useMemo(() => {
    if (!selectedCompany) return []
    // Use variant roster if a non-default variant is active
    const activeVariant = wizard.variantId
      ? selectedCompany.variants?.find(
          (v) => v.id === wizard.variantId && !v.isDefault
        )
      : undefined
    const roster = activeVariant?.startingRoster ?? selectedCompany.startingRoster
    
    const ids: string[] = []
    let idx = 0
    for (const entry of roster) {
      for (let i = 0; i < entry.count; i++) {
        if (entry.mustBeSergeant) ids.push(`member_${idx}`)
        idx++
      }
    }
    return ids
  }, [selectedCompany, wizard.variantId])

  const allRolesForced = useMemo(
    () => !!forcedLeaderId && forcedSergeantIds.length >= 2,
    [forcedLeaderId, forcedSergeantIds]
  )

  // Auto-set variantId when the selected company has no eligible variants.
  // This ensures canAdvance() for step 2 returns true without requiring user
  // interaction for companies that don't have faction-specific variants.
  useEffect(() => {
    if (!selectedCompany || wizard.step !== 2) return
    const eligibleVariants =
      selectedCompany.variants?.filter(
        (v) =>
          !v.isDefault &&
          v.visibleFromFactions?.includes(wizard.factionId ?? '')
      ) ?? []
    if (eligibleVariants.length === 0 && wizard.variantId === null) {
      // No eligible variants — auto-set to the default variant id or 'default'
      const defaultVariant = selectedCompany.variants?.find((v) => v.isDefault)
      const autoId = defaultVariant?.id ?? 'default'
      setWizard((w) => ({ ...w, variantId: autoId }))
    }
  }, [selectedCompany, wizard.factionId, wizard.step, wizard.variantId])

  // Pre-populate wizard state with forced assignments when entering step 5.
  // This ensures canAdvance() for step 5 is immediately true when all roles
  // are pre-assigned by the company definition (mustBeLeader / mustBeSergeant).
  useEffect(() => {
    if (wizard.step !== 5 || !selectedCompany) return
    if (forcedLeaderId && wizard.leaderId !== forcedLeaderId) {
      setWizard((w) => ({ ...w, leaderId: forcedLeaderId }))
    }
    if (forcedSergeantIds.length > 0) {
      const missing = forcedSergeantIds.filter(
        (id) => !wizard.sergeantIds.includes(id)
      )
      if (missing.length > 0) {
        setWizard((w) => ({
          ...w,
          sergeantIds: [
            ...new Set([
              ...forcedSergeantIds,
              ...w.sergeantIds.filter((id) => !forcedSergeantIds.includes(id)),
            ]),
          ],
        }))
      }
    }
  }, [wizard.step, selectedCompany, forcedLeaderId, forcedSergeantIds])

  // When returning from stats page with forced roles, ensure they're set.
  // This handles the case where we skip step 5 (step 4 → stats → step 6).
  useEffect(() => {
    if (wizard.step === 6 && allRolesForced) {
      let needsUpdate = false
      const updates: Partial<WizardState> = {}
      
      if (forcedLeaderId && !wizard.leaderId) {
        updates.leaderId = forcedLeaderId
        needsUpdate = true
      }
      
      if (forcedSergeantIds.length > 0) {
        const missing = forcedSergeantIds.filter(
          (id) => !wizard.sergeantIds.includes(id)
        )
        if (missing.length > 0) {
          updates.sergeantIds = [
            ...new Set([
              ...forcedSergeantIds,
              ...wizard.sergeantIds.filter((id) => !forcedSergeantIds.includes(id)),
            ]),
          ]
          needsUpdate = true
        }
      }
      
      if (needsUpdate) {
        setWizard((w) => ({ ...w, ...updates }))
      }
    }
  }, [wizard.step, wizard.leaderId, wizard.sergeantIds, allRolesForced, forcedLeaderId, forcedSergeantIds])

  // ─── Navigation ──────────────────────────────────────────────────────────

  const go = useCallback((nextStep: number) => {
    setDirection(nextStep > wizard.step ? 1 : -1)
    setWizard((w) => {
      const next = { ...w, step: nextStep }

      // Record the destination as visited (deduplicated)
      if (!next.visitedSteps.includes(nextStep)) {
        next.visitedSteps = [...next.visitedSteps, nextStep]
      }

      // When entering step 5, synchronously apply forced role assignments so
      // the UI renders with the correct state on the very first frame.
      if (nextStep === 5) {
        if (forcedLeaderId && next.leaderId !== forcedLeaderId) {
          next.leaderId = forcedLeaderId
        }
        if (forcedSergeantIds.length > 0) {
          next.sergeantIds = [
            ...new Set([
              ...forcedSergeantIds,
              ...next.sergeantIds.filter((id) => !forcedSergeantIds.includes(id)),
            ]),
          ]
        }
      }
      return next
    })
  }, [wizard.step, forcedLeaderId, forcedSergeantIds])

  const canAdvance = useCallback((): boolean => {
    switch (wizard.step) {
      case 0:
        return wizard.alignment !== null
      case 1:
        return wizard.factionId !== null
      case 2: {
        if (wizard.companyTypeId === null) return false
        // If the selected company has eligible variants, require a variant choice
        const eligibleVariants =
          selectedCompany?.variants?.filter(
            (v) =>
              !v.isDefault &&
              v.visibleFromFactions?.includes(wizard.factionId ?? '')
          ) ?? []
        if (eligibleVariants.length > 0) {
          return wizard.variantId !== null
        }
        return true
      }
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
  }, [wizard, selectedCompany])

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
      variantId: null,
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

  const toggleSergeant = useCallback((tempId: string) => {
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
  }, [])

  const handleSelectLeader = useCallback((tempId: string) => {
    setWizard((w) => ({
      ...w,
      leaderId: w.leaderId === tempId ? null : tempId,
      sergeantIds: w.sergeantIds.filter((id) => id !== tempId),
    }))
  }, [])

  const handleProgressBarClick = useCallback(
    (targetStep: number) => {
      // Guard: only allow backward navigation to actually-visited steps
      if (targetStep >= wizard.step) return
      if (!wizard.visitedSteps.includes(targetStep)) return

      // Apply the same downstream resets as the existing step-change handlers
      setWizard((w) => {
        const next = { ...w }

        if (targetStep <= 0) {
          // Jumping to Alignment: reset everything downstream of step 0
          next.factionId = null
          next.companyTypeId = null
          next.variantId = null
          next.memberNames = {}
          next.leaderId = null
          next.sergeantIds = []
          next.heroPaths = {}
          next.heroSpellChoices = {}
        } else if (targetStep <= 1) {
          // Jumping to Faction: reset everything downstream of step 1
          next.companyTypeId = null
          next.variantId = null
          next.memberNames = {}
          next.leaderId = null
          next.sergeantIds = []
          next.heroPaths = {}
          next.heroSpellChoices = {}
        } else if (targetStep <= 2) {
          // Jumping to Company: reset everything downstream of step 2
          next.variantId = null
          next.memberNames = {}
          next.leaderId = null
          next.sergeantIds = []
          next.heroPaths = {}
          next.heroSpellChoices = {}
        }
        // Steps 3–6: no downstream resets needed (state is additive / independent)

        return next
      })

      go(targetStep)
    },
    [wizard.step, wizard.visitedSteps, go]
  )

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

  const doFinish = useCallback(async () => {
    if (!selectedCompany || saving) return
    setSaving(true)
    try {
      const company = createCompany(
        wizard,
        selectedCompany,
        wizard.heroPaths,
        wizard.heroSpellChoices,
        wizard.variantId
      )
      await saveCompany(company)
      sessionStorage.removeItem(WIZARD_DRAFT_KEY)
      navigate(`/companies/${company.id}`)
    } finally {
      setSaving(false)
    }
  }, [selectedCompany, saving, wizard, saveCompany, navigate])

  const handleFinish = useCallback(() => {
    // If company has gold and we're on the gold step, confirm before saving
    if ((selectedCompany?.gold ?? 0) > 0 && wizard.step === STEPS.length - 1) {
      setShowGoldConfirm(true)
    } else {
      void doFinish()
    }
  }, [selectedCompany, wizard.step, doFinish])

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
        // Check for missing stats before advancing to step 6 (from step 4 or 5)
        if ((wizard.step === 5 || (wizard.step === 4 && allRolesForced)) && selectedCompany) {
          const allIds = getAllUnitIdsForRoster(selectedCompany)
          const missing = allIds.filter((id) => !getStatsForUnit(id))
          if (missing.length > 0) {
            navigate(`/stats?wizard=1&units=${missing.join(',')}&fromStep=${wizard.step}`)
            return
          }
        }
        // Skip gold step if no gold
        if (wizard.step === 6 && (selectedCompany?.gold ?? 0) === 0) {
          handleFinish()
          return
        }
        // Skip step 5 (leader/sergeant selection) when all roles are forced
        if (wizard.step === 4 && allRolesForced) {
          setWizard((w) => ({
            ...w,
            step: 6,
            leaderId: forcedLeaderId ?? w.leaderId,
            sergeantIds: forcedSergeantIds.length > 0
              ? [...new Set([...forcedSergeantIds, ...w.sergeantIds.filter(id => !forcedSergeantIds.includes(id))])]
              : w.sergeantIds,
          }))
          setDirection(1)
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
    allRolesForced,
    forcedLeaderId,
    forcedSergeantIds,
  ])

  const handleAbort = useCallback(() => {
    sessionStorage.removeItem(WIZARD_DRAFT_KEY)
    setWizard(INITIAL_WIZARD)
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
      case 2: {
        // Compute eligible variants for the selected company
        const eligibleVariants =
          selectedCompany?.variants?.filter(
            (v) =>
              !v.isDefault &&
              v.visibleFromFactions?.includes(wizard.factionId ?? '')
          ) ?? []

        // Default variant (isDefault: true, or the sentinel 'default')
        const defaultVariant = selectedCompany?.variants?.find(
          (v) => v.isDefault
        )

        // Auto-set variantId when no eligible variants exist and a company is selected
        // (handled via useEffect below; here we just render the company selector)

        return (
          <>
            <StepCompany
              factionId={wizard.factionId!}
              value={wizard.companyTypeId}
              onChange={selectCompany}
            />

            {/* Variant picker — only shown when a company with eligible variants is selected */}
            {wizard.companyTypeId !== null && eligibleVariants.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2.5, opacity: 0.3 }} />
                <Typography
                  sx={{
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.8rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'primary.main',
                    opacity: 0.85,
                    mb: 1.5,
                  }}
                >
                  Choose Your Roster
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontStyle: 'italic', opacity: 0.65, mb: 2 }}
                >
                  This company has multiple roster options. Select which variant
                  you wish to play.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {/* Standard / default option */}
                  {(() => {
                    const standardId = defaultVariant?.id ?? 'default'
                    const isSelected = wizard.variantId === standardId
                    return (
                      <Box
                        key="standard"
                        onClick={() =>
                          setWizard((w) => ({ ...w, variantId: standardId }))
                        }
                        sx={{
                          border: '1px solid',
                          borderColor: isSelected
                            ? 'primary.main'
                            : 'rgba(200,164,90,0.18)',
                          borderRadius: 1,
                          background: isSelected
                            ? 'rgba(200,164,90,0.08)'
                            : 'transparent',
                          px: 2.5,
                          py: 1.75,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          transition: 'border-color 0.18s, background 0.18s',
                          '&:hover': {
                            borderColor: isSelected
                              ? 'primary.main'
                              : 'rgba(200,164,90,0.4)',
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            flexShrink: 0,
                            border: '2px solid',
                            borderColor: isSelected
                              ? 'primary.main'
                              : 'rgba(200,164,90,0.3)',
                            background: isSelected
                              ? 'primary.main'
                              : 'transparent',
                            transition: 'all 0.18s',
                          }}
                        />
                        <Box>
                          <Typography
                            sx={{
                              fontFamily: '"Cinzel", serif',
                              fontSize: '0.9rem',
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? 'primary.main' : 'text.primary',
                            }}
                          >
                            {defaultVariant?.label ?? 'Standard Roster'}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.6 }}>
                            Standard starting roster
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })()}

                  {/* Each eligible variant */}
                  {eligibleVariants.map((variant) => {
                    const isSelected = wizard.variantId === variant.id
                    return (
                      <Box
                        key={variant.id}
                        onClick={() =>
                          setWizard((w) => ({ ...w, variantId: variant.id }))
                        }
                        sx={{
                          border: '1px solid',
                          borderColor: isSelected
                            ? 'primary.main'
                            : 'rgba(200,164,90,0.18)',
                          borderRadius: 1,
                          background: isSelected
                            ? 'rgba(200,164,90,0.08)'
                            : 'transparent',
                          px: 2.5,
                          py: 1.75,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          transition: 'border-color 0.18s, background 0.18s',
                          '&:hover': {
                            borderColor: isSelected
                              ? 'primary.main'
                              : 'rgba(200,164,90,0.4)',
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            flexShrink: 0,
                            border: '2px solid',
                            borderColor: isSelected
                              ? 'primary.main'
                              : 'rgba(200,164,90,0.3)',
                            background: isSelected
                              ? 'primary.main'
                              : 'transparent',
                            transition: 'all 0.18s',
                          }}
                        />
                        <Box>
                          <Typography
                            sx={{
                              fontFamily: '"Cinzel", serif',
                              fontSize: '0.9rem',
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? 'primary.main' : 'text.primary',
                            }}
                          >
                            {variant.label}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.6 }}>
                            Variant roster
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            )}
          </>
        )
      }

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
            forcedLeaderId={forcedLeaderId}
            forcedSergeantIds={forcedSergeantIds}
            onSelectLeader={handleSelectLeader}
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
        // Resolve the active roster (variant or default)
        const activeVariantForGold =
          wizard.variantId
            ? selectedCompany.variants?.find(
                (v) => v.id === wizard.variantId && !v.isDefault
              )
            : undefined
        const goldRoster = activeVariantForGold?.startingRoster ?? selectedCompany.startingRoster
        // Build the roster member list with names + hero status
        const goldMembers: Array<{
          tempId: string
          name: string
          baseUnitId: string
          equipment: string[]
          isHero: boolean
        }> = []
        let mi = 0
        for (const entry of goldRoster) {
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
            leaderId={wizard.leaderId}
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
          {STEPS.map((label, index) => {
            const isCompleted =
              label === 'Command'
                ? allRolesForced && wizard.step > 5
                : index < wizard.step
            const isVisited = wizard.visitedSteps.includes(index)
            const isClickable = isCompleted && isVisited

            return (
              <Step
                key={label}
                completed={label === 'Command' ? (allRolesForced && wizard.step > 5) : undefined}
              >
                {isClickable ? (
                  <StepButton
                    onClick={() => handleProgressBarClick(index)}
                    aria-label={`Go back to ${label} step`}
                    sx={{
                      cursor: 'pointer',
                      '& .MuiStepLabel-label': {
                        textDecoration: 'none',
                        transition: 'text-decoration 0.15s',
                      },
                      '&:hover .MuiStepLabel-label': {
                        textDecoration: 'underline',
                      },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '2px',
                        borderRadius: 1,
                      },
                    }}
                  >
                    {label}
                  </StepButton>
                ) : (
                  <StepLabel
                    sx={{ cursor: 'default', pointerEvents: 'none' }}
                    aria-disabled={index !== wizard.step ? true : undefined}
                  >
                    {label}
                  </StepLabel>
                )}
              </Step>
            )
          })}
        </Stepper>
      </Box>

      {/* Step content */}
      <Box
        sx={{
          flex: 1,
          px: { xs: 2, sm: 3 },
          pt: 3,
          pb: { xs: 14, sm: 12 },
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
          zIndex: 10,
        }}
      >
        <Button
          variant="outlined"
          onClick={() =>
            wizard.step === 0
              ? setShowAbortConfirm(true)
              : wizard.step === 6 && allRolesForced
                ? go(4)
                : go(wizard.step - 1)
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
                console.log('Next button clicked at step', wizard.step, 'allRolesForced:', allRolesForced)
                // Check for missing stats before advancing to step 6 (from step 4 or 5)
                if ((wizard.step === 5 || (wizard.step === 4 && allRolesForced)) && selectedCompany) {
                  const allIds = getAllUnitIdsForRoster(selectedCompany)
                  const missing = allIds.filter((id) => !getStatsForUnit(id))
                  console.log('Stats check - allIds:', allIds.length, 'missing:', missing.length)
                  if (missing.length > 0) {
                    console.log('Navigating to stats page with missing units:', missing)
                    navigate(`/stats?wizard=1&units=${missing.join(',')}&fromStep=${wizard.step}`)
                    return
                  }
                }
                // After paths (step 6): skip gold step if no gold
                if (wizard.step === 6 && (selectedCompany?.gold ?? 0) === 0) {
                  handleFinish()
                  return
                }
                // Skip step 5 (leader/sergeant selection) when all roles are forced
                if (wizard.step === 4 && allRolesForced) {
                  console.log('Skipping step 5, jumping to step 6 with forced roles')
                  setWizard((w) => ({
                    ...w,
                    step: 6,
                    leaderId: forcedLeaderId ?? w.leaderId,
                    sergeantIds: forcedSergeantIds.length > 0
                      ? [...new Set([...forcedSergeantIds, ...w.sergeantIds.filter(id => !forcedSergeantIds.includes(id))])]
                      : w.sergeantIds,
                  }))
                  setDirection(1)
                  return
                }
                console.log('Normal advance to step', wizard.step + 1)
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
