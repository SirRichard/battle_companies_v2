/**
 * MatchSetupPage
 *
 * Step 1 of the match flow:
 *   1. Enter opponent rating
 *   2. If underdog by ≥15pts → Against the Odds multi-select bonus selection
 *   3. Scenario pick (manual dropdown OR random roll)
 *   4. Navigate to ToolkitAssignmentPage (if toolkit selected) or MatchTrackingPage
 */

import { useState, useEffect, type ReactNode } from 'react'
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
import CheckIcon from '@mui/icons-material/Check'
import PageHeader from '../components/common/PageHeader'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useAppContext } from '../context/AppContext'
import { calcCompanyRating } from '../utils/rating'
import wanderersData from '../data/wanderers.json'
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

export const TOOLKIT_KITS: { id: string; label: string; items: string[] }[] = [
  {
    id: 'healers',
    label: "Healer's Kit",
    items: [
      'wondrous_cram',
      'wondrous_cram',
      'wondrous_cram',
      'wondrous_cram',
      'wondrous_cram',
      'healing_herbs',
      'healing_herbs',
    ],
  },
  {
    id: 'explorer',
    label: "Explorer's Kit",
    items: [
      'scroll_of_hidden_paths',
      'mountain_boots',
      'mountain_boots',
      'mountain_boots',
      'woodland_belt',
      'woodland_belt',
      'woodland_belt',
      'map',
    ],
  },
  {
    id: 'scholar',
    label: "Scholar's Kit",
    items: [
      'ring_of_warding',
      'badge_of_courage',
      'lucky_talisman',
      'seeing_stone',
    ],
  },
  {
    id: 'hunter',
    label: "Hunter's Kit",
    items: [
      'envenom_weapon',
      'envenom_weapon',
      'envenom_weapon',
      'envenom_weapon',
      'envenom_weapon',
      'trophy_pelt',
      'concealing_cloak',
    ],
  },
  {
    id: 'raider',
    label: "Raider's Kit",
    items: [
      'torching_brand',
      'torching_brand',
      'torching_brand',
      'torching_brand',
      'torching_brand',
      'climbing_ropes',
      'climbing_ropes',
      'climbing_ropes',
      'climbing_ropes',
      'climbing_ropes',
      'dwarven_brew',
    ],
  },
]

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
    id: 'toolkit',
    label: 'Tool Kit',
    desc: 'Temporarily equip your models from a kit for this match.',
    ratingValue: 30,
  },
  {
    id: 'wanderer',
    label: 'Wanderer',
    desc: 'Temporarily recruit a Wanderer for the match.',
    ratingValue: 45,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Count how many 'toolkit' entries exist in the atoBonuses array */
export function getToolkitCount(bonuses: AtoBonusType[]): number {
  return bonuses.filter((b) => b === 'toolkit').length
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchSetupPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const { companies, getStatsForUnit, saveActiveMatch, loadActiveMatch } =
    useAppContext()

  const company = companies.find((c) => c.id === companyId)
  const wanderers = wanderersData as Array<{ id: string; pointsCost: number }>
  const companyWanderer = company?.wandererId
    ? wanderers.find((w) => w.id === company.wandererId)
    : undefined
  const companyRating = company
    ? calcCompanyRating(
        company.members,
        getStatsForUnit,
        companyWanderer ? { pointsCost: companyWanderer.pointsCost } : undefined
      )
    : 0

  // ── State ──────────────────────────────────────────────────────────────────
  const [opponentRating, setOpponentRating] = useState('')
  const [atoBonuses, setAtoBonuses] = useState<AtoBonusType[]>([])
  const [scenarioId, setScenarioId] = useState('')
  const [rolledScenario, setRolledScenario] = useState<ScenarioDef | null>(null)
  const [showAbort, setShowAbort] = useState(false)
  const [resumePrompt, setResumePrompt] = useState(false)
  const [existingMatch, setExistingMatch] = useState<ActiveMatchState | null>(
    null
  )

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

  const totalAtoBonusRating = atoBonuses.reduce((sum, id) => {
    return sum + (ATO_BONUSES.find((b) => b.id === id)?.ratingValue ?? 0)
  }, 0)
  const adjustedRating = companyRating + totalAtoBonusRating
  const activeScenario =
    rolledScenario ?? SCENARIOS.find((s) => s.id === scenarioId)
  const canProceed =
    !isNaN(opponentRatingNum) &&
    opponentRatingNum > 0 &&
    activeScenario !== undefined

  const handleRollScenario = () => {
    const s = rollScenario()
    setRolledScenario(s)
    setScenarioId(s.id)
  }

  const handleManualScenario = (id: string) => {
    setScenarioId(id)
    setRolledScenario(null)
  }

  const handleAtoToggle = (id: AtoBonusType) => {
    if (id === 'toolkit') {
      // Toolkit uses counter-based increment (click = +1)
      handleToolkitIncrement()
      return
    }
    setAtoBonuses((prev) => {
      const already = prev.includes(id)
      if (already) return prev.filter((b) => b !== id)
      // Check would not exceed opponent rating
      const newTotal =
        prev.reduce(
          (sum, b) =>
            sum + (ATO_BONUSES.find((x) => x.id === b)?.ratingValue ?? 0),
          0
        ) + (ATO_BONUSES.find((b) => b.id === id)?.ratingValue ?? 0)
      if (companyRating + newTotal > opponentRatingNum) return prev
      return [...prev, id]
    })
  }

  const handleToolkitIncrement = () => {
    setAtoBonuses((prev) => {
      const count = getToolkitCount(prev)
      if (count >= 5) return prev // max 5
      // Check budget: adding another toolkit (+30) would exceed opponent rating
      const currentTotal = prev.reduce(
        (sum, b) =>
          sum + (ATO_BONUSES.find((x) => x.id === b)?.ratingValue ?? 0),
        0
      )
      if (companyRating + currentTotal + 30 > opponentRatingNum) return prev
      return [...prev, 'toolkit']
    })
  }

  const handleToolkitDecrement = () => {
    setAtoBonuses((prev) => {
      const count = getToolkitCount(prev)
      if (count <= 0) return prev
      // Remove one 'toolkit' entry (last occurrence)
      const idx = prev.lastIndexOf('toolkit')
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
  }

  const handleStart = async () => {
    if (!company || !activeScenario) return

    const activeMembers = company.members.filter(
      (m) => !m.injuries.some((i) => i.type === 'missing_next_game')
    )

    const wanderersTyped = wanderersData as Array<{
      id: string
      label: string
      pointsCost: number
      stats: Record<string, number>
      equipment: string[]
    }>

    const match: ActiveMatchState = {
      companyId: company.id,
      opponentRating: opponentRatingNum,
      scenarioId: activeScenario.id,
      scenarioLabel: activeScenario.label,
      atoBonuses,
      rerollsRemaining: atoBonuses.includes('reroll') ? 2 : 0,
      toolkitItems: [], // filled in ToolkitAssignmentPage if toolkit selected
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

    // Append wanderer as a synthetic MemberMatchState if one is hired
    if (company.wandererId) {
      const wandererProfile = wanderersTyped.find(
        (w) => w.id === company.wandererId
      )
      if (wandererProfile) {
        match.members.push({
          memberId: company.wandererId,
          memberName: wandererProfile.label,
          baseUnitId: company.wandererId,
          role: 'wanderer',
          equipment: wandererProfile.equipment,
          xpCounterGains: 0,
          isCasualty: false,
          mightMax: wandererProfile.stats.might ?? null,
          willMax: wandererProfile.stats.will ?? null,
          fateMax: wandererProfile.stats.fate ?? null,
          mightCurrent: wandererProfile.stats.might ?? null,
          willCurrent: wandererProfile.stats.will ?? null,
          fateCurrent: wandererProfile.stats.fate ?? null,
        })
      } else {
        console.warn(
          `[MatchSetup] Wanderer ID "${company.wandererId}" not found in wanderers.json — skipping wanderer in match roster.`
        )
      }
    }

    await saveActiveMatch(match)

    // Navigate based on selected ATO bonuses
    if (atoBonuses.includes('toolkit')) {
      // Toolkit page will handle wanderer navigation if needed
      navigate(`/companies/${company.id}/match/toolkit`)
    } else if (atoBonuses.includes('wanderer')) {
      navigate(`/companies/${company.id}/match/wanderer`)
    } else {
      navigate(`/companies/${company.id}/match`)
    }
  }

  const handleResume = () => navigate(`/companies/${companyId}/match`)

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
        {/* ── Your rating ── */}
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

        {/* ── Opponent rating ── */}
        <SectionLabel>Opponent's Rating</SectionLabel>
        <TextField
          fullWidth
          placeholder="Enter opponent's company rating"
          value={opponentRating}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, '')
            setOpponentRating(v)
            setAtoBonuses([])
          }}
          type="number"
          inputProps={{ min: 1 }}
          sx={{ mt: 1, mb: 3 }}
        />

        {/* ── Against the Odds ── */}
        {isUnderdog && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SectionLabel>Against the Odds</SectionLabel>
              <Tooltip title="Select one or more bonuses. Your adjusted rating cannot exceed your opponent's.">
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
              Outrated by {ratingDiff} pts. Select bonuses — adjusted rating
              cannot exceed opponent's.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {ATO_BONUSES.filter(
                (bonus) => bonus.ratingValue <= ratingDiff
              ).map((bonus) => {
                const isToolkit = bonus.id === 'toolkit'
                const toolkitCount = getToolkitCount(atoBonuses)
                const isSelected = isToolkit
                  ? toolkitCount > 0
                  : atoBonuses.includes(bonus.id)
                const wouldExceed =
                  !isSelected &&
                  companyRating + totalAtoBonusRating + bonus.ratingValue >
                    opponentRatingNum
                // For toolkit: disabled if at max 5 OR budget insufficient for +30
                const toolkitDisabled = isToolkit
                  ? toolkitCount >= 5 ||
                    companyRating + totalAtoBonusRating + 30 > opponentRatingNum
                  : false
                const disabled = isToolkit ? toolkitDisabled && !isSelected : wouldExceed
                return (
                  <Box
                    key={bonus.id}
                    onClick={() => {
                      if (isToolkit) {
                        if (!toolkitDisabled) handleToolkitIncrement()
                      } else {
                        if (!disabled) handleAtoToggle(bonus.id)
                      }
                    }}
                    onContextMenu={(e) => {
                      if (isToolkit && toolkitCount > 0) {
                        e.preventDefault()
                        handleToolkitDecrement()
                      }
                    }}
                    sx={{
                      p: 1.5,
                      border: '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      background: isSelected
                        ? 'rgba(201,168,76,0.08)'
                        : 'rgba(0,0,0,0.15)',
                      cursor:
                        (isToolkit ? toolkitDisabled && toolkitCount === 0 : disabled)
                          ? 'default'
                          : 'pointer',
                      opacity:
                        (isToolkit ? toolkitDisabled && toolkitCount === 0 : disabled)
                          ? 0.4
                          : 1,
                      transition: 'all 0.15s',
                      '&:hover':
                        !(isToolkit ? toolkitDisabled && toolkitCount === 0 : disabled)
                          ? {
                              borderColor: 'primary.dark',
                              background: 'rgba(201,168,76,0.05)',
                            }
                          : {},
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
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                        }}
                      >
                        {isSelected && (
                          <CheckIcon
                            sx={{ fontSize: 14, color: 'primary.main' }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: isSelected ? 'primary.main' : 'text.primary',
                          }}
                        >
                          {bonus.label}
                        </Typography>
                        {isToolkit && toolkitCount > 0 && (
                          <Chip
                            label={`×${toolkitCount}`}
                            size="small"
                            data-testid="toolkit-count-badge"
                            sx={{
                              fontSize: '0.65rem',
                              height: 18,
                              minWidth: 28,
                              color: 'primary.main',
                              borderColor: 'primary.main',
                              border: '1px solid',
                              background: 'rgba(201,168,76,0.12)',
                              fontWeight: 700,
                            }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {isToolkit && toolkitCount > 0 && (
                          <Chip
                            label="−"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToolkitDecrement()
                            }}
                            sx={{
                              fontSize: '0.8rem',
                              height: 20,
                              minWidth: 24,
                              cursor: 'pointer',
                              color: 'text.secondary',
                              borderColor: 'divider',
                              border: '1px solid',
                              background: 'rgba(0,0,0,0.2)',
                              '&:hover': {
                                background: 'rgba(201,168,76,0.1)',
                                borderColor: 'primary.main',
                              },
                            }}
                          />
                        )}
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
                    </Box>
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>
                      {bonus.desc}
                    </Typography>
                    {isToolkit && toolkitCount > 0 && (
                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.5, display: 'block', mt: 0.5, fontStyle: 'italic' }}
                      >
                        Right-click or tap "−" to remove one kit
                      </Typography>
                    )}
                  </Box>
                )
              })}
            </Box>
            {atoBonuses.length > 0 && (
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

        {/* ── Scenario ── */}
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
          <Button
            variant="outlined"
            startIcon={<CasinoIcon />}
            onClick={handleRollScenario}
            disabled={atoBonuses.includes('ambush')}
            fullWidth
            sx={{ justifyContent: 'flex-start', px: 2 }}
          >
            {atoBonuses.includes('ambush')
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

        {/* ── Start button ── */}
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
          {atoBonuses.includes('toolkit')
            ? `Next: Assign Kit Items (${getToolkitCount(atoBonuses)}) →`
            : atoBonuses.includes('wanderer')
              ? 'Next: Choose Wanderer →'
              : 'Begin Battle'}
        </Button>
      </Box>

      <ConfirmDialog
        open={resumePrompt}
        title="Match In Progress"
        message={`You have an unfinished match against ${existingMatch?.scenarioLabel ?? 'an opponent'}. Would you like to resume it?`}
        confirmLabel="Resume"
        cancelLabel="Start New"
        onConfirm={handleResume}
        onCancel={() => setResumePrompt(false)}
      />

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

function SectionLabel({ children }: { children: ReactNode }) {
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
