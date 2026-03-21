/**
 * MatchTrackingPage
 *
 * Active match screen. Shows all participating members with:
 *   - Full stat block (all 9 stats + M/W/F for heroes)
 *   - M/W/F interactive +/− buttons for heroes
 *   - XP counter (increment / decrement)
 *   - Casualty toggle
 *   - Reroll counter (if ATO reroll bonus active)
 *
 * Sort order: Leader → Sergeants (alpha) → Heroes in Making (alpha) → Warriors (alpha)
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import { motion } from 'framer-motion'
import PageHeader from '../components/common/PageHeader'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useAppContext } from '../context/AppContext'
import { getUnitLabel, getWargearLabel } from '../utils/labels'
import { calcCompanyRating } from '../utils/rating'
import { calcEquipmentStatBonus } from '../utils/equipmentBonuses'
import type { ActiveMatchState, MemberMatchState } from '../models/match'
import type { Company, MatchRecord } from '../models'
import { v4 as uuidv4 } from 'uuid'

const MotionBox = motion(Box)

// ─── XP hint content ──────────────────────────────────────────────────────────

const XP_REASONS = [
  'Inflicted at least one wound on an enemy (even if recovered via Fate)',
  'Slew a Hero or Monster',
  'Prevented a wound by spending a Fate point',
  'Passed a Courage test for being Broken',
  'Carried or was within range of an Objective at game end',
  'Declared MVP by the opposing player',
]

// ─── Sort order ───────────────────────────────────────────────────────────────

const ROLE_ORDER: Record<string, number> = {
  leader: 0,
  sergeant: 1,
  hero_in_making: 2,
  warrior: 3,
}

function sortMembers(members: MemberMatchState[]): MemberMatchState[] {
  return [...members].sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 3
    const rb = ROLE_ORDER[b.role] ?? 3
    if (ra !== rb) return ra - rb
    return a.memberName.localeCompare(b.memberName)
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchTrackingPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const {
    companies,
    getStatsForUnit,
    saveActiveMatch,
    loadActiveMatch,
    clearActiveMatch,
    saveCompany,
  } = useAppContext()

  const company = companies.find((c) => c.id === companyId)

  const [match, setMatch] = useState<ActiveMatchState | null>(null)
  const [showAbort, setShowAbort] = useState(false)
  const [showEndMatch, setShowEndMatch] = useState(false)
  const [result, setResult] = useState<'win' | 'draw' | 'loss' | ''>('')
  const [showXpHint, setShowXpHint] = useState(false)
  const [rerollConfirm, setRerollConfirm] = useState(false)

  // Load active match from DB on mount
  useEffect(() => {
    if (!companyId) return
    loadActiveMatch(companyId).then((m) => {
      if (m) setMatch(m)
      else navigate(`/companies/${companyId}/match/setup`, { replace: true })
    })
  }, [companyId, loadActiveMatch, navigate])

  // Persist match state whenever it changes
  useEffect(() => {
    if (match) saveActiveMatch(match)
  }, [match, saveActiveMatch])

  const updateMember = useCallback(
    (memberId: string, patch: Partial<MemberMatchState>) => {
      setMatch((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.memberId === memberId ? { ...m, ...patch } : m
          ),
        }
      })
    },
    []
  )

  const handleUseReroll = () => {
    if (!match || match.rerollsRemaining <= 0) return
    const newCount = match.rerollsRemaining - 1
    if (newCount === 0) {
      setRerollConfirm(true)
    } else {
      setMatch((prev) =>
        prev ? { ...prev, rerollsRemaining: newCount } : prev
      )
    }
  }

  const handleConfirmLastReroll = () => {
    setMatch((prev) => (prev ? { ...prev, rerollsRemaining: 0 } : prev))
    setRerollConfirm(false)
  }

  const handleEndMatch = async () => {
    if (!company || !match || !result) return

    const companyRating = calcCompanyRating(company.members, getStatsForUnit)

    // Calculate influence gained
    let influenceGained = 2 // base participation
    if (result === 'win') influenceGained += 2
    else if (result === 'draw') influenceGained += 1

    // ATO influence bonus
    if (match.atoBonus === 'influence') {
      influenceGained += result === 'win' ? 2 : 1
    }

    // Build XP gained array — participation (+1) + counter gains
    const xpGained = match.members.map((mm) => ({
      memberId: mm.memberId,
      memberName: mm.memberName,
      xp: 1 + mm.xpCounterGains,
    }))

    // ATO experience bonus
    const xpBonus =
      match.atoBonus === 'experience' ? (result === 'win' ? 2 : 1) : 0
    const xpGainedWithBonus = xpGained.map((x) => ({
      ...x,
      xp: x.xp + xpBonus,
    }))

    const record: MatchRecord = {
      id: uuidv4(),
      date: new Date().toISOString(),
      result,
      opponentRating: match.opponentRating,
      scenarioId: match.scenarioId,
      scenarioLabel: match.scenarioLabel,
      influenceGained,
      casualties: match.members
        .filter((m) => m.isCasualty)
        .map((m) => ({
          memberId: m.memberId,
          memberName: m.memberName,
          injuryResult: 'pending',
        })),
      xpGained: xpGainedWithBonus,
    }

    // Update company: apply XP, influence, win/draw/loss record
    const updatedMembers = company.members.map((m) => {
      const gain = xpGainedWithBonus.find((x) => x.memberId === m.id)
      if (!gain) return m
      const xpAdd = gain.xp
      return {
        ...m,
        experience: m.experience + xpAdd,
        lifetimeExperience: m.lifetimeExperience + xpAdd,
      }
    })

    const updatedCompany: Company = {
      ...company,
      members: updatedMembers,
      influence: company.influence + influenceGained,
      wins: company.wins + (result === 'win' ? 1 : 0),
      draws: company.draws + (result === 'draw' ? 1 : 0),
      losses: company.losses + (result === 'loss' ? 1 : 0),
      matchHistory: [...company.matchHistory, record],
      lastPlayedAt: new Date().toISOString(),
    }

    await saveCompany(updatedCompany)
    await clearActiveMatch(company.id)
    navigate(`/companies/${company.id}`)
  }

  const handleAbort = async () => {
    if (companyId) await clearActiveMatch(companyId)
    navigate(`/companies/${companyId}`)
  }

  if (!match || !company) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ opacity: 0.6 }}>Loading match…</Typography>
      </Box>
    )
  }

  const sorted = sortMembers(match.members)

  // XP help button passed to PageHeader
  const xpHelpButton = (
    <IconButton
      onClick={() => setShowXpHint(true)}
      sx={{
        color: 'primary.main',
        minWidth: 44,
        minHeight: 44,
        border: '1px solid',
        borderColor: 'rgba(201,168,76,0.35)',
        borderRadius: 1,
        '&:hover': { background: 'rgba(201,168,76,0.1)' },
      }}
      aria-label="XP guide"
    >
      <HelpOutlineIcon />
    </IconButton>
  )

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title={match.scenarioLabel}
        subtitle={`vs. ${match.opponentRating} pts`}
        onBack={() => setShowAbort(true)}
        action={xpHelpButton}
      />

      {/* ── Reroll counter ─────────────────────────────────────────────────── */}
      {match.atoBonus === 'reroll' && match.rerollsRemaining > 0 && (
        <Box
          sx={{
            px: 3,
            py: 1,
            background: 'rgba(201,168,76,0.08)',
            borderBottom: '1px solid',
            borderColor: 'primary.dark',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: 'primary.main', fontWeight: 600 }}
          >
            REROLLS REMAINING
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              sx={{
                fontFamily: '"Cinzel Decorative", serif',
                fontSize: '1.2rem',
                color: 'primary.main',
              }}
            >
              {match.rerollsRemaining}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={handleUseReroll}
              sx={{ fontSize: '0.65rem', py: 0.25, px: 1, minHeight: 0 }}
            >
              Use
            </Button>
          </Box>
        </Box>
      )}

      {/* ── Member list ────────────────────────────────────────────────────── */}
      <Box
        sx={{ flex: 1, overflow: 'auto', px: { xs: 2, sm: 3 }, py: 2, pb: 12 }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {sorted.map((mm, i) => (
            <MemberMatchCard
              key={mm.memberId}
              mm={mm}
              delay={i * 0.04}
              baseStats={getStatsForUnit(mm.baseUnitId)?.stats}
              onXpChange={(delta) =>
                updateMember(mm.memberId, {
                  xpCounterGains: Math.max(0, mm.xpCounterGains + delta),
                })
              }
              onCasualtyToggle={() =>
                updateMember(mm.memberId, { isCasualty: !mm.isCasualty })
              }
              onMwfChange={(stat, delta) => {
                const maxKey = `${stat}Max` as keyof MemberMatchState
                const curKey = `${stat}Current` as keyof MemberMatchState
                const max = mm[maxKey] as number | null
                const cur = mm[curKey] as number | null
                if (max === null || cur === null) return
                const next = Math.max(0, Math.min(max, cur + delta))
                updateMember(mm.memberId, {
                  [curKey]: next,
                } as Partial<MemberMatchState>)
              }}
            />
          ))}
        </Box>
      </Box>

      {/* ── End Match persistent footer ────────────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          background: 'linear-gradient(0deg, #110a03 80%, transparent)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Button
          variant="contained"
          size="large"
          startIcon={<EmojiEventsIcon />}
          onClick={() => setShowEndMatch(true)}
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            py: 1.5,
            px: 4,
            minWidth: 220,
          }}
        >
          End Match
        </Button>
      </Box>

      {/* ── End Match dialog ───────────────────────────────────────────────── */}
      <Dialog
        open={showEndMatch}
        onClose={() => setShowEndMatch(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            background: 'linear-gradient(160deg, #1a1008 0%, #110a03 100%)',
            border: '1px solid rgba(200,164,90,0.25)',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>Record Result</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7 }}>
            How did your company fare?
          </Typography>
          <RadioGroup
            value={result}
            onChange={(e) => setResult(e.target.value as typeof result)}
          >
            {[
              { value: 'win', label: 'Victory', colour: 'success.main' },
              { value: 'draw', label: 'Draw', colour: 'text.secondary' },
              { value: 'loss', label: 'Defeat', colour: 'error.main' },
            ].map((opt) => (
              <FormControlLabel
                key={opt.value}
                value={opt.value}
                control={
                  <Radio
                    size="small"
                    sx={{
                      color: 'rgba(200,164,90,0.4)',
                      '&.Mui-checked': { color: 'primary.main' },
                    }}
                  />
                }
                label={
                  <Typography
                    variant="body2"
                    sx={{
                      color: result === opt.value ? opt.colour : 'text.primary',
                      fontWeight: result === opt.value ? 700 : 400,
                    }}
                  >
                    {opt.label}
                  </Typography>
                }
                sx={{
                  mx: 0,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor:
                    result === opt.value ? 'primary.dark' : 'transparent',
                  background:
                    result === opt.value
                      ? 'rgba(201,168,76,0.06)'
                      : 'transparent',
                  mb: 0.5,
                  transition: 'all 0.15s',
                }}
              />
            ))}
          </RadioGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setShowEndMatch(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!result}
            onClick={handleEndMatch}
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '0.65rem',
            }}
          >
            Confirm & Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── XP hint dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={showXpHint}
        onClose={() => setShowXpHint(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            background: 'linear-gradient(160deg, #1a1008 0%, #110a03 100%)',
            border: '1px solid rgba(200,164,90,0.25)',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>XP is earned for…</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {XP_REASONS.map((r, i) => (
              <Box
                key={i}
                sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
              >
                <Typography
                  sx={{
                    color: 'primary.main',
                    fontWeight: 700,
                    lineHeight: 1.5,
                    flexShrink: 0,
                  }}
                >
                  ·
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {r}
                </Typography>
              </Box>
            ))}
          </Box>
          <Divider sx={{ my: 2, opacity: 0.3 }} />
          <Typography
            variant="caption"
            sx={{ opacity: 0.55, fontStyle: 'italic' }}
          >
            +1 XP for participation is added automatically for all members.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setShowXpHint(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Last reroll confirmation ───────────────────────────────────────── */}
      <ConfirmDialog
        open={rerollConfirm}
        title="Last Reroll"
        message="This is your last reroll. Use it?"
        confirmLabel="Use It"
        cancelLabel="Keep It"
        onConfirm={handleConfirmLastReroll}
        onCancel={() => setRerollConfirm(false)}
      />

      {/* ── Abort confirmation ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={showAbort}
        title="Abandon Match?"
        message="This will discard the current match entirely. The company will not receive any XP or influence."
        confirmLabel="Abandon"
        cancelLabel="Keep Playing"
        onConfirm={handleAbort}
        onCancel={() => setShowAbort(false)}
      />
    </Box>
  )
}

// ─── MemberMatchCard ──────────────────────────────────────────────────────────

interface CardProps {
  mm: MemberMatchState
  delay: number
  baseStats: Record<string, number> | undefined
  onXpChange: (delta: number) => void
  onCasualtyToggle: () => void
  onMwfChange: (stat: 'might' | 'will' | 'fate', delta: number) => void
}

// All 9 stats in display order
const ALL_STATS: { key: string; label: string }[] = [
  { key: 'move', label: 'Mv' },
  { key: 'fight', label: 'Fv' },
  { key: 'shoot', label: 'Sv' },
  { key: 'strength', label: 'S' },
  { key: 'defence', label: 'D' },
  { key: 'attacks', label: 'A' },
  { key: 'wounds', label: 'W' },
  { key: 'courage', label: 'C' },
  { key: 'intelligence', label: 'I' },
]

function MemberMatchCard({
  mm,
  delay,
  baseStats,
  onXpChange,
  onCasualtyToggle,
  onMwfChange,
}: CardProps) {
  const isHero = mm.role !== 'warrior'
  const equipBonus = calcEquipmentStatBonus(mm.equipment, mm.baseUnitId)

  const roleLabel =
    mm.role === 'leader'
      ? 'Leader'
      : mm.role === 'sergeant'
        ? 'Sgt'
        : mm.role === 'hero_in_making'
          ? 'Hero'
          : null

  const hasHeroStats = isHero && mm.mightMax !== null

  // Format a stat value for display
  const formatStat = (key: string, raw: number): string => {
    if (key === 'shoot' || key === 'courage' || key === 'intelligence') {
      return `${raw}+`
    }
    if (key === 'defence' && equipBonus.defence) {
      return String(raw + equipBonus.defence)
    }
    if (key === 'move') return `${raw}"`
    return String(raw)
  }

  return (
    <MotionBox
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay }}
      sx={{
        border: '1px solid',
        borderColor: mm.isCasualty
          ? 'error.main'
          : mm.role === 'leader'
            ? 'primary.main'
            : isHero
              ? 'primary.dark'
              : 'divider',
        borderRadius: 1,
        p: 1.5,
        background: mm.isCasualty
          ? 'rgba(192,57,43,0.06)'
          : isHero
            ? 'rgba(201,168,76,0.03)'
            : 'transparent',
        opacity: mm.isCasualty ? 0.65 : 1,
        transition: 'all 0.15s',
      }}
    >
      {/* Row 1: name + role chip + casualty toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          mb: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              variant="h6"
              sx={{
                lineHeight: 1.2,
                textDecoration: mm.isCasualty ? 'line-through' : 'none',
                opacity: mm.isCasualty ? 0.6 : 1,
              }}
            >
              {mm.memberName}
            </Typography>
            {roleLabel && (
              <Chip
                label={roleLabel}
                size="small"
                sx={{
                  fontSize: '0.6rem',
                  height: 18,
                  borderColor:
                    mm.role === 'leader' ? 'primary.main' : 'primary.dark',
                  color:
                    mm.role === 'leader' ? 'primary.main' : 'primary.light',
                  border: '1px solid',
                  background: 'transparent',
                }}
              />
            )}
            {mm.isCasualty && (
              <Chip
                label="Casualty"
                size="small"
                sx={{
                  fontSize: '0.6rem',
                  height: 18,
                  background: 'rgba(192,57,43,0.15)',
                  color: 'error.light',
                  border: '1px solid',
                  borderColor: 'error.main',
                }}
              />
            )}
          </Box>
          <Typography
            variant="caption"
            sx={{ fontStyle: 'italic', color: 'text.secondary' }}
          >
            {getUnitLabel(mm.baseUnitId)}
          </Typography>
        </Box>

        <Button
          size="small"
          variant={mm.isCasualty ? 'contained' : 'outlined'}
          color={mm.isCasualty ? 'error' : 'inherit'}
          onClick={onCasualtyToggle}
          sx={{
            fontSize: '0.6rem',
            py: 0.25,
            px: 1,
            minHeight: 0,
            flexShrink: 0,
            ml: 1,
          }}
        >
          {mm.isCasualty ? 'Revive' : 'Casualty'}
        </Button>
      </Box>

      {/* Row 2: Full stat block */}
      {baseStats && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {ALL_STATS.map(({ key, label }) => {
            const raw = baseStats[key]
            if (raw === undefined || raw === null) return null
            const display = formatStat(key, raw)
            const highlighted = key === 'defence' && equipBonus.defence > 0
            return (
              <Box
                key={key}
                sx={{
                  textAlign: 'center',
                  minWidth: 30,
                  px: 0.5,
                  py: 0.25,
                  border: '1px solid',
                  borderColor: highlighted ? 'primary.dark' : 'divider',
                  borderRadius: 0.5,
                  background: highlighted
                    ? 'rgba(201,168,76,0.08)'
                    : 'rgba(0,0,0,0.2)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.5rem',
                    opacity: 0.5,
                    display: 'block',
                    lineHeight: 1,
                  }}
                >
                  {label}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    lineHeight: 1.3,
                  }}
                >
                  {display}
                </Typography>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Row 3: M/W/F for heroes — interactive */}
      {hasHeroStats && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1, maxWidth: 440 }}>
          {(['might', 'will', 'fate'] as const).map((stat) => {
            const curKey = `${stat}Current` as keyof MemberMatchState
            const maxKey = `${stat}Max` as keyof MemberMatchState
            const cur = mm[curKey] as number
            const max = mm[maxKey] as number
            const label =
              stat === 'might' ? 'Might' : stat === 'will' ? 'Will' : 'Fate'
            const depleted = cur === 0
            const full = cur === max
            return (
              <Box
                key={stat}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  border: '1px solid',
                  borderColor: depleted
                    ? 'rgba(192,57,43,0.5)'
                    : 'primary.dark',
                  borderRadius: 1,
                  py: 0.75,
                  px: 0.5,
                  background: depleted
                    ? 'rgba(192,57,43,0.06)'
                    : 'rgba(201,168,76,0.04)',
                  minWidth: 0,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.55rem',
                    opacity: 0.55,
                    lineHeight: 1,
                    mb: 0.5,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <IconButton
                    onClick={() => onMwfChange(stat, -1)}
                    disabled={cur <= 0}
                    sx={{
                      p: 0,
                      width: 36,
                      height: 36,
                      border: '1px solid',
                      borderColor:
                        cur <= 0
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(192,57,43,0.4)',
                      borderRadius: 0.75,
                      color: 'error.light',
                      '&:hover': { background: 'rgba(192,57,43,0.15)' },
                      '&.Mui-disabled': { opacity: 0.25 },
                    }}
                  >
                    <RemoveIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <Box sx={{ textAlign: 'center', minWidth: 32 }}>
                    <Typography
                      sx={{
                        fontFamily: '"Cinzel Decorative", serif',
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: depleted
                          ? 'error.light'
                          : full
                            ? 'primary.main'
                            : 'text.primary',
                        lineHeight: 1,
                      }}
                    >
                      {cur}
                    </Typography>
                    <Typography
                      sx={{ fontSize: '0.55rem', opacity: 0.4, lineHeight: 1 }}
                    >
                      / {max}
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={() => onMwfChange(stat, 1)}
                    disabled={cur >= max}
                    sx={{
                      p: 0,
                      width: 36,
                      height: 36,
                      border: '1px solid',
                      borderColor:
                        cur >= max
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(201,168,76,0.4)',
                      borderRadius: 0.75,
                      color: 'primary.light',
                      '&:hover': { background: 'rgba(201,168,76,0.15)' },
                      '&.Mui-disabled': { opacity: 0.25 },
                    }}
                  >
                    <AddIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Row 4: equipment chips */}
      {mm.equipment.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {mm.equipment.map((eq) => (
            <Chip
              key={eq}
              label={getWargearLabel(eq)}
              size="small"
              sx={{ fontSize: '0.6rem', height: 18 }}
            />
          ))}
        </Box>
      )}

      <Divider sx={{ opacity: 0.2, mb: 1 }} />

      {/* Row 5: XP counter */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          XP gained this match
          <Typography
            component="span"
            variant="caption"
            sx={{ opacity: 0.45, ml: 0.5 }}
          >
            (+1 participation added at end)
          </Typography>
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onXpChange(-1)}
            disabled={mm.xpCounterGains === 0}
            sx={{
              p: 0.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 0.5,
            }}
          >
            <RemoveIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <Typography
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '1.1rem',
              color: mm.xpCounterGains > 0 ? 'primary.main' : 'text.secondary',
              minWidth: 28,
              textAlign: 'center',
              lineHeight: 1,
            }}
          >
            {mm.xpCounterGains}
          </Typography>
          <IconButton
            size="small"
            onClick={() => onXpChange(1)}
            sx={{
              p: 0.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 0.5,
            }}
          >
            <AddIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      </Box>
    </MotionBox>
  )
}
