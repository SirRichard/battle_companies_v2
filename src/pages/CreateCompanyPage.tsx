import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Stepper, Step, StepLabel } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'

import PageHeader from '../components/common/PageHeader'
import ConfirmDialog from '../components/common/ConfirmDialog'
import StepAlignment from '../components/wizard/StepAlignment'
import StepFaction from '../components/wizard/StepFaction'
import StepCompany from '../components/wizard/StepCompany'
import StepCompanyName from '../components/wizard/StepCompanyName'
import StepMemberNames from '../components/wizard/StepMemberNames'
import StepLeaderSelection from '../components/wizard/StepLeaderSelection'

import { useAppContext } from '../context/AppContext'
import type { Alignment, WizardState } from '../models'
import type { CompanyDefinition } from '../models'
import {
  createCompany,
  generateTempMemberIds,
} from '../services/company/companyFactory'

import companiesData from '../data/companies.json'

const COMPANIES = companiesData as CompanyDefinition[]

const STEPS = ['Alignment', 'Faction', 'Company', 'Name', 'Members', 'Command']

const STEP_TITLES = [
  'Choose Your Alignment',
  'Choose Your Faction',
  'Choose Your Company',
  'Name Your Company',
  'Name Your Members',
  'Appoint Your Heroes',
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
}

export default function CreateCompanyPage() {
  const { saveCompany } = useAppContext()
  const navigate = useNavigate()

  const [wizard, setWizard] = useState<WizardState>(INITIAL_WIZARD)
  const [direction, setDirection] = useState(1)
  const [showAbortConfirm, setShowAbortConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

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
        return tempMemberIds.every(
          (id) => (wizard.memberNames[id] ?? '').trim().length > 0
        )
      case 5:
        return wizard.leaderId !== null && wizard.sergeantIds.length === 2
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

  const handleFinish = async () => {
    if (!selectedCompany || saving) return
    setSaving(true)
    try {
      const company = createCompany(wizard, selectedCompany)
      await saveCompany(company)
      // Navigate to stats entry for this company's units
      navigate(`/companies/${company.id}?statsRequired=true`)
    } finally {
      setSaving(false)
    }
  }

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
              onClick={() => go(wizard.step + 1)}
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
        onConfirm={() => navigate('/')}
        onCancel={() => setShowAbortConfirm(false)}
        dangerous
      />
    </Box>
  )
}
