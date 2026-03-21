import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  TextField,
  Button,
  LinearProgress,
  Alert,
  Chip,
  Divider,
  Collapse,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import EditIcon from '@mui/icons-material/Edit'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import { motion, AnimatePresence } from 'framer-motion'

import PageHeader from '../components/common/PageHeader'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useAppContext } from '../context/AppContext'
import type { MemberStats, StoredBaseUnitStats } from '../models'
import { STATS_ENTRY_FIELDS, MOUNT_STATS_ENTRY_FIELDS } from '../constants'
import type { CompanyDefinition } from '../models'

import companiesData from '../data/companies.json'
import baseUnitsData from '../data/baseUnits.json'
import wargearData from '../data/wargear.json'

const COMPANIES = companiesData as CompanyDefinition[]
const BASE_UNITS = baseUnitsData as Array<{
  id: string
  label: string
  pointsCost: number
  keywords: string[]
  baseEquipment: string[]
}>
const WARGEAR = wargearData as Array<{
  id: string
  label: string
  category: string
}>

// ─── Helpers ─────────────────────────────────────────────────────────────────

type StatKey = keyof MemberStats
type FormValues = Record<StatKey, string>

function getUnitLabel(id: string): string {
  return (
    BASE_UNITS.find((u) => u.id === id)?.label ??
    id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  )
}

function getMountLabel(id: string): string {
  return (
    WARGEAR.find((w) => w.id === id)?.label ??
    id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  )
}

/** Returns mount IDs used by a base unit (via its baseEquipment list). */
function getMountsForUnit(unitId: string): string[] {
  const unit = BASE_UNITS.find((u) => u.id === unitId)
  if (!unit) return []
  return unit.baseEquipment.filter((eq) =>
    WARGEAR.some((w) => w.id === eq && w.category === 'mount')
  )
}

/** All unique base unit IDs needed for a company (starting + advancements + reinforcements). */
function getUnitsForCompany(companyId: string): string[] {
  const company = COMPANIES.find((c) => c.id === companyId)
  if (!company) return []
  const ids = new Set<string>()
  for (const entry of company.startingRoster) ids.add(entry.baseUnitId)
  for (const adv of company.advancements) {
    ids.add(adv.fromBaseUnitId)
    ids.add(adv.toBaseUnitId)
  }
  for (const row of company.reinforcementTable) {
    if (row.baseUnitId) ids.add(row.baseUnitId)
  }
  return Array.from(ids)
}

/** All unique mount IDs needed for a set of unit IDs. */
function getMountsForUnits(unitIds: string[]): string[] {
  const mounts = new Set<string>()
  for (const uid of unitIds) {
    for (const m of getMountsForUnit(uid)) mounts.add(m)
  }
  return Array.from(mounts)
}

const emptyForm = (isMount: boolean): FormValues =>
  Object.fromEntries(
    (isMount ? MOUNT_STATS_ENTRY_FIELDS : STATS_ENTRY_FIELDS).map((f) => [
      f.key,
      '',
    ])
  ) as FormValues

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: (dir: number) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
    transition: { duration: 0.18 },
  }),
}

// ─── Validation ───────────────────────────────────────────────────────────────

// Union covers both STATS_ENTRY_FIELDS and MOUNT_STATS_ENTRY_FIELDS entries
type FieldMeta =
  | (typeof STATS_ENTRY_FIELDS)[number]
  | (typeof MOUNT_STATS_ENTRY_FIELDS)[number]

function validateForm(
  values: FormValues,
  fields: readonly FieldMeta[]
): {
  errors: Partial<Record<StatKey, string>>
  warnings: Partial<Record<StatKey, string>>
} {
  const errors: Partial<Record<StatKey, string>> = {}
  const warnings: Partial<Record<StatKey, string>> = {}

  for (const field of fields) {
    const key = field.key as StatKey
    const raw = values[key] ?? ''

    if (raw === '') {
      errors[key] = 'Required'
      continue
    }

    const val = parseInt(raw, 10)
    if (isNaN(val)) {
      errors[key] = 'Must be a number'
      continue
    }

    if (val < field.min || val > field.max) {
      errors[key] = `Must be ${field.min}–${field.max}`
      continue
    }

    // Warn thresholds (unusual but valid)
    if (field.warnBelow != null && val < field.warnBelow) {
      warnings[key] = `${val} is unusually low — double-check your rulebook`
    } else if (field.warnAbove != null && val > field.warnAbove) {
      warnings[key] = `${val} is unusually high — double-check your rulebook`
    }
  }

  return { errors, warnings }
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function EditStatsPage() {
  const {
    statsLibrary,
    saveStats,
    saveStatsAndCascade,
    getStatsForUnit,
    companies,
  } = useAppContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const companyIdParam = searchParams.get('companyId')
  const isNewCompany = searchParams.get('new') === '1'

  // Focused wizard mode: arrived from mid-wizard stats check.
  // units= is a comma-separated list of baseUnitIds that need stats.
  const wizardMode = searchParams.get('wizard') === '1'
  const wizardUnits = useMemo(() => {
    const raw = searchParams.get('units')
    if (!wizardMode || !raw) return []
    return raw.split(',').filter(Boolean)
  }, [wizardMode, searchParams])

  // ─── Determine work queue ─────────────────────────────────────────────────
  // companyIdParam is the UUID of the saved Company instance.
  // getUnitsForCompany needs the companyTypeId (e.g. 'arnor'), not the UUID.

  const companyTypeId = useMemo(() => {
    if (!companyIdParam) return null
    return companies.find((c) => c.id === companyIdParam)?.companyTypeId ?? null
  }, [companyIdParam, companies])

  // Compute the work queues once on mount and lock them.
  // We must NOT re-filter as statsLibrary updates mid-session — doing so
  // causes the queue to shrink beneath currentIndex, breaking the counter
  // and making currentId undefined before navigation fires.
  const [queues] = useState<{ unitQueue: string[]; mountQueue: string[] }>(
    () => {
      if (wizardMode && wizardUnits.length > 0) {
        const units = wizardUnits
          .filter(
            (id) => !WARGEAR.some((w) => w.id === id && w.category === 'mount')
          )
          .filter((id) => !getStatsForUnit(id))
        const mounts = wizardUnits
          .filter((id) =>
            WARGEAR.some((w) => w.id === id && w.category === 'mount')
          )
          .filter((id) => !getStatsForUnit(id))
        return { unitQueue: units, mountQueue: mounts }
      }
      if (companyTypeId) {
        const allUnits = getUnitsForCompany(companyTypeId)
        const allMounts = getMountsForUnits(allUnits)
        return {
          unitQueue: allUnits.filter((id) => !getStatsForUnit(id)),
          mountQueue: allMounts.filter((id) => !getStatsForUnit(id)),
        }
      }
      return { unitQueue: [], mountQueue: [] }
    }
  )
  const { unitQueue, mountQueue } = queues

  // Phase: 'units' first, then 'mounts', then done
  const [phase, setPhase] = useState<'units' | 'mounts'>('units')
  const activeQueue = phase === 'units' ? unitQueue : mountQueue
  const isMount = phase === 'mounts'

  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [formValues, setFormValues] = useState<FormValues>(emptyForm(isMount))
  const [errors, setErrors] = useState<Partial<Record<StatKey, string>>>({})
  const [warnings, setWarnings] = useState<Partial<Record<StatKey, string>>>({})
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [confirmExit, setConfirmExit] = useState(false)

  const currentId = activeQueue[currentIndex] ?? null
  const currentLabel = currentId
    ? isMount
      ? getMountLabel(currentId)
      : getUnitLabel(currentId)
    : ''
  const existingStats = currentId ? getStatsForUnit(currentId) : undefined

  const fields = isMount ? MOUNT_STATS_ENTRY_FIELDS : STATS_ENTRY_FIELDS

  // Load existing stats when unit changes
  useEffect(() => {
    if (existingStats) {
      setFormValues(
        Object.fromEntries(
          fields.map((f) => [
            f.key,
            String(existingStats.stats[f.key as StatKey] ?? ''),
          ])
        ) as FormValues
      )
    } else {
      setFormValues(emptyForm(isMount))
    }
    setErrors({})
    setWarnings({})
  }, [currentId, isMount])

  // When unit queue is done, advance to mount queue
  useEffect(() => {
    if (phase === 'units' && unitQueue.length === 0 && mountQueue.length > 0) {
      setPhase('mounts')
      setCurrentIndex(0)
    }
  }, [phase, unitQueue.length, mountQueue.length])

  // ─── Save handler ─────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!currentId) return

    const { errors: errs, warnings: warns } = validateForm(formValues, fields)
    setErrors(errs)
    setWarnings(warns)
    if (Object.keys(errs).length > 0) return

    const stats = Object.fromEntries(
      fields.map((f) => [
        f.key,
        parseInt(formValues[f.key as StatKey] ?? '0', 10),
      ])
    ) as Required<MemberStats>

    const entry: StoredBaseUnitStats = {
      baseUnitId: currentId,
      stats,
      isMountStats: isMount,
    }

    // Use cascade save if editing an existing stat (company members must update)
    const isEdit = !!existingStats && !savedIds.includes(currentId)
    if (isEdit) {
      await saveStatsAndCascade(entry)
    } else {
      await saveStats(entry)
    }

    setSavedIds((prev) => [...prev, currentId])

    const isLastInQueue = currentIndex >= activeQueue.length - 1

    if (!isLastInQueue) {
      setDirection(1)
      setCurrentIndex((i) => i + 1)
      return
    }

    // Finished current phase
    if (phase === 'units' && mountQueue.length > 0) {
      setPhase('mounts')
      setCurrentIndex(0)
      setDirection(1)
      return
    }

    // All done
    if (wizardMode) {
      // Return to wizard — it will rehydrate from sessionStorage
      navigate('/companies/new?from=stats')
      return
    }
    navigate(companyIdParam ? `/companies/${companyIdParam}` : '/')
  }, [
    currentId,
    formValues,
    fields,
    isMount,
    existingStats,
    savedIds,
    currentIndex,
    activeQueue.length,
    phase,
    mountQueue.length,
    companyIdParam,
    wizardMode,
    saveStats,
    saveStatsAndCascade,
    navigate,
  ])

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1)
      setCurrentIndex((i) => i - 1)
    }
  }

  const handleFieldChange = (key: StatKey, raw: string) => {
    const numeric = raw.replace(/[^0-9]/g, '')
    setFormValues((prev) => ({ ...prev, [key]: numeric }))
    // Clear error/warning for this field on edit
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
    if (warnings[key]) setWarnings((prev) => ({ ...prev, [key]: undefined }))
  }

  // ─── Browse / edit mode (no companyId, not wizard mode) ────────────────────

  if (!companyIdParam && !wizardMode) {
    return <BrowseStatsMode />
  }

  // ─── All stats already recorded ──────────────────────────────────────────

  const totalNeeded = unitQueue.length + mountQueue.length
  if (totalNeeded === 0) {
    // In wizard mode this means we landed here but everything was already saved —
    // redirect straight back to the wizard.
    if (wizardMode) {
      navigate('/companies/new', { replace: true })
      return null
    }
    return (
      <Box
        sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <PageHeader
          title="Stats Entry"
          subtitle="All done"
          backTo={companyIdParam ? `/companies/${companyIdParam}` : '/'}
        />
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircleOutlineIcon
              sx={{ fontSize: 56, color: 'success.main', mb: 2 }}
            />
            <Typography variant="h3" sx={{ mb: 1 }}>
              All Stats Recorded
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontStyle: 'italic', color: 'text.secondary', mb: 3 }}
            >
              All base unit stats for this company are already in your library.
            </Typography>
            <Button
              variant="contained"
              onClick={() =>
                navigate(companyIdParam ? `/companies/${companyIdParam}` : '/')
              }
            >
              View Company
            </Button>
          </Box>
        </Box>
      </Box>
    )
  }

  // ─── Progress ─────────────────────────────────────────────────────────────

  const totalDone = savedIds.length
  const progressPct = (currentIndex / activeQueue.length) * 100

  const phaseLabel = isMount ? 'Mount Stats' : 'Unit Stats'
  const phaseSubtitle = isMount
    ? `${currentIndex + 1} of ${mountQueue.length} mounts`
    : `${currentIndex + 1} of ${unitQueue.length} units`

  const hasWarnings = Object.keys(warnings).length > 0

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title={
          isMount
            ? `Mount Stats — ${currentLabel}`
            : `Unit Stats — ${currentLabel}`
        }
        subtitle={
          wizardMode
            ? `Company Creation · ${phaseLabel} · ${phaseSubtitle}`
            : `${phaseLabel} · ${phaseSubtitle}`
        }
        onBack={() => setConfirmExit(true)}
      />

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={progressPct}
        sx={{ height: 3, flexShrink: 0 }}
      />

      {/* Mount phase indicator */}
      {unitQueue.length > 0 && mountQueue.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {(['units', 'mounts'] as const).map((p) => (
            <Box
              key={p}
              sx={{
                flex: 1,
                py: 0.75,
                textAlign: 'center',
                borderBottom:
                  phase === p ? '2px solid' : '2px solid transparent',
                borderColor: phase === p ? 'primary.main' : 'transparent',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.7rem',
                  letterSpacing: '0.06em',
                  color: phase === p ? 'primary.main' : 'text.disabled',
                }}
              >
                {p === 'units'
                  ? `Units (${unitQueue.length})`
                  : `Mounts (${mountQueue.length})`}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2, sm: 3 },
          py: 3,
          maxWidth: 520,
          width: '100%',
          mx: 'auto',
        }}
      >
        {/* Rulebook reminder */}
        <Alert severity="info" sx={{ mb: 2.5, fontSize: '0.82rem', py: 0.5 }}>
          Reference your official Battle Companies rulebook for these stats.
          This app does not include copyrighted game data.
        </Alert>

        {isMount && (
          <Alert severity="info" sx={{ mb: 2.5, fontSize: '0.82rem', py: 0.5 }}>
            <strong>Mount Stats</strong> — enter the stats for the mount itself.
            Shoot is not applicable to mounts.
          </Alert>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${phase}-${currentId}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {existingStats && !savedIds.includes(currentId ?? '') && (
              <Alert
                severity="success"
                sx={{ mb: 2, fontSize: '0.82rem', py: 0.5 }}
              >
                Stats already on file — editing will update all company members
                using this unit.
              </Alert>
            )}

            {/* Stat grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' },
                gap: 2,
              }}
            >
              {fields.map((field) => {
                const key = field.key as StatKey
                const hasError = !!errors[key]
                const hasWarning = !hasError && !!warnings[key]

                return (
                  <Box key={key}>
                    <TextField
                      label={field.label}
                      value={formValues[key] ?? ''}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      error={hasError}
                      helperText={errors[key] ?? field.hint}
                      size="small"
                      fullWidth
                      inputProps={{
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        maxLength: 2,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': hasWarning
                          ? { borderColor: 'warning.main !important' }
                          : {},
                      }}
                      FormHelperTextProps={{
                        sx: {
                          color: hasError ? 'error.main' : 'text.secondary',
                        },
                      }}
                    />
                    {hasWarning && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.5,
                        }}
                      >
                        <WarningAmberIcon
                          sx={{ fontSize: 12, color: 'warning.main' }}
                        />
                        <Typography
                          sx={{
                            fontSize: '0.68rem',
                            color: 'warning.main',
                            lineHeight: 1.3,
                          }}
                        >
                          {warnings[key]}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>

            {/* Range reference */}
            <Collapse in={hasWarnings}>
              <Alert
                severity="warning"
                sx={{ mt: 2, fontSize: '0.8rem', py: 0.5 }}
              >
                One or more stats look unusual. You can still save — just
                double-check against your rulebook before continuing.
              </Alert>
            </Collapse>
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Footer */}
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
          onClick={handlePrev}
          disabled={currentIndex === 0 && phase === 'units'}
          sx={{ minWidth: 80, minHeight: 44 }}
        >
          Back
        </Button>

        <Button
          variant="contained"
          onClick={handleSave}
          sx={{ minWidth: 160, minHeight: 44 }}
        >
          {currentIndex < activeQueue.length - 1 ||
          (phase === 'units' && mountQueue.length > 0)
            ? 'Save & Continue'
            : 'Save & Finish'}
        </Button>
      </Box>

      {/* Exit confirmation — warns that unsaved stats will be lost */}
      <ConfirmDialog
        open={confirmExit}
        title="Leave Stats Entry?"
        message="Stats entry is not complete. Any stats you haven't saved yet will be lost, and you will need to return to finish before viewing this company."
        confirmLabel="Leave Anyway"
        cancelLabel="Keep Entering"
        onConfirm={() => {
          setConfirmExit(false)
          if (companyIdParam) {
            navigate(isNewCompany ? '/' : `/companies/${companyIdParam}`)
          } else {
            navigate('/')
          }
        }}
        onCancel={() => setConfirmExit(false)}
        dangerous
      />
    </Box>
  )
}

// ─── Browse / Edit mode ────────────────────────────────────────────────────────

function BrowseStatsMode() {
  const { statsLibrary, saveStatsAndCascade, getStatsForUnit, clearAllStats } =
    useAppContext()
  const navigate = useNavigate()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<FormValues>({} as FormValues)
  const [errors, setErrors] = useState<Partial<Record<StatKey, string>>>({})
  const [warnings, setWarnings] = useState<Partial<Record<StatKey, string>>>({})
  const [saving, setSaving] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  // Group library entries by whether they're mounts
  const unitEntries = statsLibrary.filter((s) => !s.isMountStats)
  const mountEntries = statsLibrary.filter((s) => s.isMountStats)

  const startEdit = (entry: StoredBaseUnitStats) => {
    const fields = entry.isMountStats
      ? MOUNT_STATS_ENTRY_FIELDS
      : STATS_ENTRY_FIELDS
    setFormValues(
      Object.fromEntries(
        fields.map((f) => [f.key, String(entry.stats[f.key as StatKey] ?? '')])
      ) as FormValues
    )
    setErrors({})
    setWarnings({})
    setEditingId(entry.baseUnitId)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setErrors({})
    setWarnings({})
  }

  const handleSave = async (entry: StoredBaseUnitStats) => {
    const fields = entry.isMountStats
      ? MOUNT_STATS_ENTRY_FIELDS
      : STATS_ENTRY_FIELDS
    const { errors: errs, warnings: warns } = validateForm(formValues, fields)
    setErrors(errs)
    setWarnings(warns)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const stats = Object.fromEntries(
        fields.map((f) => [
          f.key,
          parseInt(formValues[f.key as StatKey] ?? '0', 10),
        ])
      ) as Required<MemberStats>
      await saveStatsAndCascade({
        baseUnitId: entry.baseUnitId,
        stats,
        isMountStats: entry.isMountStats,
      })
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  const getLabel = (entry: StoredBaseUnitStats) =>
    entry.isMountStats
      ? getMountLabel(entry.baseUnitId)
      : getUnitLabel(entry.baseUnitId)

  const renderStatBadges = (entry: StoredBaseUnitStats) => {
    const fields = entry.isMountStats
      ? MOUNT_STATS_ENTRY_FIELDS
      : STATS_ENTRY_FIELDS
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
        {fields.map((f) => (
          <Chip
            key={f.key}
            label={`${f.label}: ${entry.stats[f.key as StatKey] ?? '—'}`}
            size="small"
            sx={{ fontSize: '0.72rem', height: 22 }}
          />
        ))}
      </Box>
    )
  }

  const renderEditForm = (entry: StoredBaseUnitStats) => {
    const fields = entry.isMountStats
      ? MOUNT_STATS_ENTRY_FIELDS
      : STATS_ENTRY_FIELDS
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem', py: 0.5 }}>
          Editing these stats will update all company members using this unit.
        </Alert>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' },
            gap: 1.5,
            mb: 2,
          }}
        >
          {fields.map((field) => {
            const key = field.key as StatKey
            return (
              <TextField
                key={key}
                label={field.label}
                value={formValues[key] ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '')
                  setFormValues((prev) => ({ ...prev, [key]: v }))
                  if (errors[key])
                    setErrors((prev) => ({ ...prev, [key]: undefined }))
                }}
                error={!!errors[key]}
                helperText={errors[key] ?? field.hint}
                size="small"
                inputProps={{
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                  maxLength: 2,
                }}
              />
            )
          })}
        </Box>
        {Object.keys(warnings).length > 0 && (
          <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem', py: 0.5 }}>
            Some stats look unusual — double-check your rulebook before saving.
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={cancelEdit}
            sx={{ minHeight: 44 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => handleSave(entry)}
            disabled={saving}
            sx={{ minHeight: 44 }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </Box>
      </Box>
    )
  }

  const renderSection = (entries: StoredBaseUnitStats[], title: string) => {
    if (entries.length === 0) return null
    return (
      <Box sx={{ mb: 3 }}>
        <Typography
          sx={{
            fontFamily: '"Cinzel", serif',
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            color: 'primary.main',
            opacity: 0.8,
            textTransform: 'uppercase',
            mb: 1.5,
          }}
        >
          {title}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {entries.map((entry) => {
            const isEditing = editingId === entry.baseUnitId
            return (
              <Box
                key={entry.baseUnitId}
                sx={{
                  border: '1px solid',
                  borderColor: isEditing
                    ? 'primary.main'
                    : 'rgba(200,164,90,0.18)',
                  borderRadius: 1,
                  p: 2,
                  background: isEditing
                    ? 'rgba(200,164,90,0.06)'
                    : 'transparent',
                  transition: 'all 0.18s',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                    }}
                  >
                    {getLabel(entry)}
                  </Typography>
                  {!isEditing && (
                    <Button
                      size="small"
                      startIcon={<EditIcon fontSize="small" />}
                      onClick={() => startEdit(entry)}
                      sx={{
                        minHeight: 36,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </Box>
                {!isEditing && renderStatBadges(entry)}
                {isEditing && renderEditForm(entry)}
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Base Unit Stats"
        subtitle="Your stats library"
        backTo="/"
      />
      <Box
        sx={{
          flex: 1,
          px: { xs: 2, sm: 3 },
          py: 3,
          maxWidth: 600,
          width: '100%',
          mx: 'auto',
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontStyle: 'italic', opacity: 0.65, mb: 3 }}
        >
          Stats entered here are stored locally and reused across all companies.
          Editing a stat will update all company members using that unit.
        </Typography>

        {statsLibrary.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 8, opacity: 0.4 }}>
            <Typography variant="h4">No Stats Recorded Yet</Typography>
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              Stats are entered when you create a new company.
            </Typography>
          </Box>
        ) : (
          <>
            {renderSection(unitEntries, 'Unit Stats')}
            {mountEntries.length > 0 && (
              <Divider sx={{ my: 2, opacity: 0.3 }} />
            )}
            {renderSection(mountEntries, 'Mount Stats')}

            {/* Clear all button */}
            <Box
              sx={{
                mt: 5,
                pt: 3,
                borderTop: '1px solid',
                borderColor: 'rgba(200,80,60,0.25)',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <Button
                variant="outlined"
                startIcon={<DeleteForeverIcon />}
                onClick={() => setConfirmClear(true)}
                sx={{
                  minHeight: 44,
                  borderColor: 'error.dark',
                  color: 'error.light',
                  '&:hover': {
                    borderColor: 'error.main',
                    background: 'rgba(200,60,40,0.08)',
                  },
                }}
              >
                Clear All Stats
              </Button>
            </Box>
          </>
        )}
      </Box>

      <ConfirmDialog
        open={confirmClear}
        title="Clear All Stats?"
        message="This will permanently delete all recorded unit stats from your library. Your companies will remain, but you will need to re-enter stats before viewing them. This cannot be undone."
        confirmLabel="Clear All"
        onConfirm={async () => {
          await clearAllStats()
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
        dangerous
      />
    </Box>
  )
}
