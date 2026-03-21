/**
 * MatchSetupPage
 *
 * Step 1 of the match flow:
 *   1. Enter opponent rating
 *   2. If underdog by ≥15pts → Against the Odds bonus selection
 *   3. Scenario pick (manual dropdown OR random roll)
 *   4. Navigate to MatchTrackingPage
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Chip,
  Tooltip,
} from '@mui/material'
import CasinoIcon from '@mui/icons-material/Casino'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import PageHeader from '../components/common/PageHeader'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useAppContext } from '../context/AppContext'
import { calcCompanyRating } from '../utils/rating'
import type { ActiveMatchState, AtoBonusType } from '../models/match'
import scenariosData from '../data/scenarios.json'

// ─── Data ─────────────────────────────────────────────────────────────────────

interface ScenarioDef {
  id: string
  label: string
  firstRollRange: [number, number]
  secondRoll: number
}
const SCENARIOS = scenariosData as ScenarioDef[]

const ATO_BONUSES: {
  id: AtoBonusType
  label: string
  desc: string
  ratingValue: number
}[] = [
  {
    id: 'influence',
    label: 'Influence',
    desc: '+2 IP for victory, +1 for draw or defeat.',
    ratingValue: 15,
  },
  {
    id: 'experience',
    label: 'Experience',
    desc: '+2 XP per model for victory, +1 for draw or defeat.',
    ratingValue: 30,
  },
  {
    id: 'reroll',
    label: 'Rerolls',
    desc: '2 rerolls usable at any point during the match.',
    ratingValue: 15,
  },
  {
    id: 'ambush',
    label: 'Ambush!',
    desc: 'You choose the scenario instead of rolling at random.',
    ratingValue: 60,
  },
]

// ─── Scenario roller ──────────────────────────────────────────────────────────

function rollScenario(): ScenarioDef {
  const first = Math.floor(Math.random() * 6) + 1
  const second = Math.floor(Math.random() * 6) + 1
  const bucket = first <= 2 ? [1, 2] : first <= 4 ? [3, 4] : [5, 6]
  const match = SCENARIOS.find(
    (s) => s.firstRollRange[0] === bucket[0] && s.secondRoll === second
  )
  return match ?? SCENARIOS[0]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchSetupPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const { companies, getStatsForUnit, saveActiveMatch, loadActiveMatch } =
    useAppContext()

  const company = companies.find((c) => c.id === companyId)
  const companyRating = company
    ? calcCompanyRating(company.members, getStatsForUnit)
    : 0

  // ── State ──────────────────────────────────────────────────────────────────
  const [opponentRating, setOpponentRating] = useState('')
  const [atoBonus, setAtoBonus] = useState<AtoBonusType | null>(null)
  const [scenarioId, setScenarioId] = useState('')
  const [rolledScenario, setRolledScenario] = useState<ScenarioDef | null>(null)
  const [showAbort, setShowAbort] = useState(false)
  const [resumePrompt, setResumePrompt] = useState(false)
  const [existingMatch, setExistingMatch] = useState<ActiveMatchState | null>(
    null
  )

  // Check for an in-progress match on mount
  useEffect(() => {
    if (!companyId) return
    loadActiveMatch(companyId).then((m) => {
      if (m) {
        setExistingMatch(m)
        setResumePrompt(true)
      }
    })
  }, [companyId, loadActiveMatch])

  const opponentRatingNum = parseInt(opponentRating, 10)
  const ratingDiff = isNaN(opponentRatingNum)
    ? 0
    : opponentRatingNum - companyRating
  const isUnderdog = ratingDiff >= 15

  // How much "bonus rating" the chosen ATO adds
  const atoBonusRating = atoBonus
    ? (ATO_BONUSES.find((b) => b.id === atoBonus)?.ratingValue ?? 0)
    : 0
  const adjustedRating = companyRating + atoBonusRating
  const activeScenario =
    rolledScenario ?? SCENARIOS.find((s) => s.id === scenarioId)
  const canProceed =
    !isNaN(opponentRatingNum) &&
    opponentRatingNum > 0 &&
    activeScenario !== undefined

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRollScenario = () => {
    const s = rollScenario()
    setRolledScenario(s)
    setScenarioId(s.id)
  }

  const handleManualScenario = (id: string) => {
    setScenarioId(id)
    setRolledScenario(null)
  }

  const handleStart = async () => {
    if (!company || !activeScenario) return

    const activeMembers = company.members.filter(
      (m) => !m.injuries.some((i) => i.type === 'missing_next_game')
    )

    const match: ActiveMatchState = {
      companyId: company.id,
      opponentRating: opponentRatingNum,
      scenarioId: activeScenario.id,
      scenarioLabel: activeScenario.label,
      atoBonus,
      rerollsRemaining: atoBonus === 'reroll' ? 2 : 0,
      members: activeMembers.map((m) => ({
        memberId: m.id,
        memberName: m.name,
        baseUnitId: m.baseUnitId,
        role: m.role,
        equipment: m.equipment,
        xpCounterGains: 0,
        isCasualty: false,
        mightMax: m.heroStats?.might ?? null,
        willMax: m.heroStats?.will ?? null,
        fateMax: m.heroStats?.fate ?? null,
        mightCurrent: m.heroStats?.might ?? null,
        willCurrent: m.heroStats?.will ?? null,
        fateCurrent: m.heroStats?.fate ?? null,
      })),
      startedAt: new Date().toISOString(),
    }

    await saveActiveMatch(match)
    navigate(`/companies/${company.id}/match`)
  }

  const handleResume = () => {
    navigate(`/companies/${companyId}/match`)
  }

  const handleAtoSelect = (id: AtoBonusType) => {
    // Toggle off if already selected
    setAtoBonus((prev) => (prev === id ? null : id))
  }

  if (!company) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Company not found.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Start Match"
        subtitle={company.name}
        onBack={() => setShowAbort(true)}
      />

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: { xs: 2, sm: 3 },
          py: 3,
          maxWidth: 560,
          mx: 'auto',
          width: '100%',
        }}
      >
        {/* ── Your rating ─────────────────────────────────────────────────── */}
        <Box
          sx={{
            mb: 3,
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <Typography
            variant="caption"
            sx={{ opacity: 0.6, display: 'block', mb: 0.25 }}
          >
            Your Company Rating
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '1.5rem',
              color: 'primary.main',
              fontWeight: 700,
            }}
          >
            {companyRating}
          </Typography>
        </Box>

        {/* ── Opponent rating ─────────────────────────────────────────────── */}
        <SectionLabel>Opponent's Rating</SectionLabel>
        <TextField
          fullWidth
          placeholder="Enter opponent's company rating"
          value={opponentRating}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, '')
            setOpponentRating(v)
            setAtoBonus(null) // reset bonus if rating changes
          }}
          type="number"
          inputProps={{ min: 1 }}
          sx={{ mt: 1, mb: 3 }}
        />

        {/* ── Against the Odds ─────────────────────────────────────────────── */}
        {isUnderdog && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SectionLabel>Against the Odds</SectionLabel>
              <Tooltip title="Your rating is 15+ below your opponent's. Choose one bonus to even the odds.">
                <HelpOutlineIcon
                  sx={{ fontSize: 16, opacity: 0.5, cursor: 'help' }}
                />
              </Tooltip>
            </Box>
            <Typography
              variant="caption"
              sx={{
                opacity: 0.55,
                fontStyle: 'italic',
                display: 'block',
                mb: 1.5,
              }}
            >
              You are outrated by {ratingDiff} pts. Select one bonus — your
              adjusted rating cannot exceed your opponent's.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {ATO_BONUSES.filter(
                (bonus) => bonus.ratingValue <= ratingDiff
              ).map((bonus) => {
                const isSelected = atoBonus === bonus.id
                return (
                  <Box
                    key={bonus.id}
                    onClick={() => handleAtoSelect(bonus.id)}
                    sx={{
                      p: 1.5,
                      border: '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      background: isSelected
                        ? 'rgba(201,168,76,0.08)'
                        : 'rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      '&:hover': {
                        borderColor: 'primary.dark',
                        background: 'rgba(201,168,76,0.05)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 0.25,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: isSelected ? 'primary.main' : 'text.primary',
                        }}
                      >
                        {bonus.label}
                      </Typography>
                      <Chip
                        label={`+${bonus.ratingValue} pts`}
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          height: 20,
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          color: isSelected ? 'primary.main' : 'text.secondary',
                          border: '1px solid',
                          background: 'transparent',
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>
                      {bonus.desc}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
            {atoBonus && (
              <Typography
                variant="caption"
                sx={{
                  mt: 1,
                  display: 'block',
                  color: 'primary.main',
                  opacity: 0.8,
                }}
              >
                Adjusted rating: {adjustedRating} / {opponentRatingNum}
              </Typography>
            )}
          </Box>
        )}

        <Divider sx={{ mb: 3, opacity: 0.3 }} />

        {/* ── Scenario ────────────────────────────────────────────────────── */}
        <SectionLabel>Scenario</SectionLabel>
        <Box
          sx={{
            mt: 1,
            mb: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {/* Random roll button — disabled if Ambush! bonus chosen */}
          <Button
            variant="outlined"
            startIcon={<CasinoIcon />}
            onClick={handleRollScenario}
            disabled={atoBonus === 'ambush'}
            fullWidth
            sx={{ justifyContent: 'flex-start', px: 2 }}
          >
            {atoBonus === 'ambush'
              ? 'Ambush! — Choose below'
              : 'Roll Random Scenario'}
          </Button>

          {rolledScenario && (
            <Box
              sx={{
                px: 2,
                py: 1.25,
                border: '1px solid',
                borderColor: 'primary.dark',
                borderRadius: 1,
                background: 'rgba(201,168,76,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <CasinoIcon
                sx={{ fontSize: 16, color: 'primary.main', opacity: 0.7 }}
              />
              <Typography sx={{ color: 'primary.main', fontWeight: 600 }}>
                {rolledScenario.label}
              </Typography>
            </Box>
          )}

          <Typography
            variant="caption"
            sx={{ textAlign: 'center', opacity: 0.4, fontStyle: 'italic' }}
          >
            — or choose manually —
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel>Select Scenario</InputLabel>
            <Select
              value={scenarioId}
              label="Select Scenario"
              onChange={(e) => handleManualScenario(e.target.value)}
            >
              {SCENARIOS.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* ── Start button ─────────────────────────────────────────────────── */}
        <Button
          variant="contained"
          fullWidth
          size="large"
          disabled={!canProceed}
          onClick={handleStart}
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            py: 1.5,
          }}
        >
          Begin Battle
        </Button>
      </Box>

      {/* ── Resume dialog ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={resumePrompt}
        title="Match In Progress"
        message={`You have an unfinished match against ${existingMatch?.scenarioLabel ?? 'an opponent'}. Would you like to resume it?`}
        confirmLabel="Resume"
        cancelLabel="Start New"
        onConfirm={handleResume}
        onCancel={() => setResumePrompt(false)}
      />

      {/* ── Abort dialog ─────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={showAbort}
        title="Cancel Setup"
        message="Return to company details? No match will be started."
        confirmLabel="Yes, Go Back"
        cancelLabel="Stay"
        onConfirm={() => navigate(`/companies/${companyId}`)}
        onCancel={() => setShowAbort(false)}
      />
    </Box>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontFamily: '"Cinzel Decorative", serif',
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'primary.main',
        opacity: 0.7,
      }}
    >
      {children}
    </Typography>
  )
}
