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
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  FormControlLabel,
  Snackbar,
  Alert,
} from '@mui/material'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import PageHeader from '../components/common/PageHeader'
import ConfirmDialog from '../components/common/ConfirmDialog'
import MemberMatchCard from '../components/match/MemberMatchCard'
import ChipDetailPopover from '../components/match/ChipDetailPopover'
import { useAppContext } from '../context/AppContext'
import { memberOwnsDwarvenBrew, hasTemporaryDwarvenBrew, dwarvenBrewIntelligenceTestPasses } from '../utils/dwarvenBrew'
import { calcBreakPoint, isCompanyBroken } from '../utils/companyRules'
import type { Company, CompanyDefinition } from '../models'
import type { ActiveMatchState, MemberMatchState } from '../models/match'
import type { PostMatchData } from '../models/postmatch'
import type { ChipPopupContent } from '../utils/chipDescription'
import wanderersData from '../data/wanderers.json'
import companiesData from '../data/companies.json'



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
  wanderer: 4,
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

interface DwarvenBrewState {
  /** Whether a permanent brew prompt has been shown/resolved */
  promptResolved: boolean
  /** Whether the player elected to use their permanent brew */
  elected: boolean
  /** Intelligence test result (null if not yet rolled) */
  intelligenceTestResult: number | null
  /** Whether the test passed (brew retained) or failed (brew removed post-match) */
  testPassed: boolean | null
  /** Member ID of the brew owner */
  ownerMemberId: string | null
}

export default function MatchTrackingPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const {
    companies,
    getStatsForUnit,
    saveCompany,
    saveActiveMatch,
    loadActiveMatch,
    clearActiveMatch,
  } = useAppContext()

  const company = companies.find((c) => c.id === companyId)

  const [match, setMatch] = useState<ActiveMatchState | null>(null)
  const [showAbort, setShowAbort] = useState(false)
  const [showEndMatch, setShowEndMatch] = useState(false)
  const [result, setResult] = useState<'win' | 'draw' | 'loss' | ''>('')
  const [showXpHint, setShowXpHint] = useState(false)
  const [rerollConfirm, setRerollConfirm] = useState(false)

  // ── Permanent Dwarven Brew state ────────────────────────────────────────────
  const [dwarvenBrew, setDwarvenBrew] = useState<DwarvenBrewState>({
    promptResolved: true,
    elected: false,
    intelligenceTestResult: null,
    testPassed: null,
    ownerMemberId: null,
  })
  const [brewSnackbar, setBrewSnackbar] = useState<{ open: boolean; passed: boolean }>({
    open: false,
    passed: false,
  })

  // ── Chip popover state (page-level single instance) ─────────────────────────
  const [chipPopover, setChipPopover] = useState<{
    anchorEl: HTMLElement | null
    content: ChipPopupContent | null
  }>({ anchorEl: null, content: null })

  const handleChipTap = useCallback((anchorEl: HTMLElement, content: ChipPopupContent) => {
    // Dismiss existing popup before showing new one (req 8.8)
    setChipPopover({ anchorEl, content })
  }, [])

  // Load active match from DB on mount
  useEffect(() => {
    if (!companyId) return
    loadActiveMatch(companyId).then((m) => {
      if (m) {
        setMatch(m)

        // ── Permanent Dwarven Brew detection ──────────────────────────────────
        // If no temporary brew in toolkit, check if any company member owns one permanently
        if (!hasTemporaryDwarvenBrew(m.toolkitItems) && company) {
          const brewOwner = company.members.find((member) => memberOwnsDwarvenBrew(member))
          if (brewOwner) {
            setDwarvenBrew({
              promptResolved: false,
              elected: false,
              intelligenceTestResult: null,
              testPassed: null,
              ownerMemberId: brewOwner.id,
            })
          }
        }
      } else {
        navigate(`/companies/${companyId}/match/setup`, { replace: true })
      }
    })
  }, [companyId, loadActiveMatch, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

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

    // Calculate influence gained
    let influenceBase = 2 // participation
    if (result === 'win') influenceBase += 2
    else if (result === 'draw') influenceBase += 1
    if (match.atoBonuses.includes('influence'))
      influenceBase += result === 'win' ? 2 : 1

    // Build XP per member (participation + counter gains)
    // ATO experience bonus applies only to members who participated (not missing/injured)
    const xpBonus = match.atoBonuses.includes('experience')
      ? result === 'win'
        ? 2
        : 1
      : 0

    // Collect wanderer IDs from wanderers.json to identify ATO wanderers
    const wandererIds = new Set(
      (wanderersData as Array<{ id: string }>).map((w) => w.id)
    )
    // An ATO wanderer is one whose memberId is a wanderer ID but is NOT in company.members
    const companyMemberIds = new Set(company.members.map((m) => m.id))
    const isAtoWanderer = (memberId: string) =>
      wandererIds.has(memberId) && !companyMemberIds.has(memberId)

    const xpGained = match.members
      .filter((mm) => !isAtoWanderer(mm.memberId))
      .map((mm) => ({
        memberId: mm.memberId,
        memberName: mm.memberName,
        xp: 1 + mm.xpCounterGains + xpBonus, // all match members are participants
      }))

    // Apply XP to company members now (injuries applied in post-match)
    const updatedMembers = company.members.map((m) => {
      const gain = xpGained.find((x) => x.memberId === m.id)
      if (!gain) return m
      return {
        ...m,
        experience: m.experience + gain.xp,
        lifetimeExperience: m.lifetimeExperience + gain.xp,
      }
    })

    // Remove dwarven brew if intelligence test failed
    if (dwarvenBrew.testPassed === false && dwarvenBrew.ownerMemberId) {
      const ownerIdx = updatedMembers.findIndex((m) => m.id === dwarvenBrew.ownerMemberId)
      if (ownerIdx !== -1) {
        updatedMembers[ownerIdx] = {
          ...updatedMembers[ownerIdx],
          ownedEquipment: (updatedMembers[ownerIdx].ownedEquipment ?? []).filter(
            (e) => e !== 'dwarven_brew'
          ),
        }
      }
    }

    // Update W/D/L and influence; clear removalLog on match completion (Req 5.1)
    const updatedCompany: Company = {
      ...company,
      members: updatedMembers,
      influence: company.influence + influenceBase,
      wins: company.wins + (result === 'win' ? 1 : 0),
      draws: company.draws + (result === 'draw' ? 1 : 0),
      losses: company.losses + (result === 'loss' ? 1 : 0),
      lastPlayedAt: new Date().toISOString(),
      removalLog: [],
    }

    await saveCompany(updatedCompany)
    await clearActiveMatch(company.id)

    const postMatchData: PostMatchData = {
      companyId: company.id,
      result,
      opponentRating: match.opponentRating,
      scenarioId: match.scenarioId,
      scenarioLabel: match.scenarioLabel,
      atoBonuses: match.atoBonuses,
      influenceBase,
      casualties: match.members
        .filter((m) => m.isCasualty && !isAtoWanderer(m.memberId))
        .map((m) => ({
          memberId: m.memberId,
          memberName: m.memberName,
          role: m.role,
          baseUnitId: m.baseUnitId,
          isHero: m.role !== 'warrior',
        })),
      xpGained,
      toolkitItems: match.toolkitItems,
    }

    navigate(`/companies/${company.id}/post-match`, {
      state: { postMatchData },
    })
  }

  const handleRemoveToolkitItem = (memberId: string, itemId: string) => {
    setMatch((prev) =>
      prev
        ? {
            ...prev,
            toolkitItems: prev.toolkitItems.filter(
              (t) => !(t.memberId === memberId && t.itemId === itemId)
            ),
          }
        : prev
    )
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

  // ── Break point calculation ────────────────────────────────────────────────
  const COMPANIES_DEF = companiesData as CompanyDefinition[]
  const companyDef = COMPANIES_DEF.find((c) => c.id === company.companyTypeId)
  const startingMemberCount = match.members.length
  const breakPoint = companyDef
    ? calcBreakPoint(companyDef, startingMemberCount)
    : Math.floor(startingMemberCount / 2)
  const activeMemberCount = match.members.filter((m) => !m.isCasualty).length
  const isBroken = isCompanyBroken(breakPoint, activeMemberCount)

  // Build a lookup for wanderer stats from wanderers.json
  const wanderersTyped = wanderersData as Array<{
    id: string
    label: string
    stats: Record<string, number>
    specialRules?: Array<string | { id: string; parameter: string | number }>
  }>
  const wandererStatsMap = new Map(
    wanderersTyped.map((w) => [w.id, w.stats])
  )
  const wandererSpecialRulesMap = new Map(
    wanderersTyped.map((w) => [w.id, w.specialRules ?? []])
  )

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
      {match.atoBonuses.includes('reroll') && match.rerollsRemaining > 0 && (
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

      {/* ── Break point banner (sticky below page header) ──────────────────── */}
      <Box
        sx={{
          px: 3,
          py: 1,
          background: isBroken
            ? 'rgba(192,57,43,0.12)'
            : 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid',
          borderColor: isBroken ? 'error.main' : 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'sticky',
          top: { xs: 64, sm: 82 },
          zIndex: 9,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: isBroken ? 'error.main' : 'text.secondary',
            fontWeight: 600,
            letterSpacing: '0.08em',
          }}
        >
          BREAK POINT
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '1rem',
              color: isBroken ? 'error.main' : 'text.primary',
            }}
          >
            {activeMemberCount} / {startingMemberCount}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: isBroken ? 'error.main' : 'text.secondary',
              fontWeight: isBroken ? 700 : 400,
            }}
          >
            {isBroken ? 'BROKEN' : `(threshold: ${breakPoint})`}
          </Typography>
        </Box>
      </Box>

      {/* ── Member list ────────────────────────────────────────────────────── */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, pb: 12 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {sorted.map((mm, i) => {
            const companyMember = company?.members.find(
              (m) => m.id === mm.memberId
            )
            const baseStats =
              getStatsForUnit(mm.baseUnitId)?.stats ??
              (mm.role === 'wanderer'
                ? wandererStatsMap.get(mm.memberId)
                : undefined)
            // Special rules: from company member (may include parameterised objects) or wanderer data
            const specialRules: Array<string | { id: string; parameter: string | number }> =
              companyMember?.specialRules ??
              (mm.role === 'wanderer' ? wandererSpecialRulesMap.get(mm.memberId) ?? [] : [])
            return (
              <MemberMatchCard
                key={mm.memberId}
                mm={mm}
                delay={i * 0.04}
                baseStats={baseStats}
                statIncreases={companyMember?.statIncreases ?? {}}
                statDecreases={companyMember?.statDecreases ?? {}}
                specialRules={specialRules}
                toolkitItems={match.toolkitItems}
                permanentBrewUsed={dwarvenBrew.elected}
                isAtoWanderer={
                  wanderersTyped.some((w) => w.id === mm.memberId) &&
                  !company.members.some((m) => m.id === mm.memberId)
                }
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
                onUseToolkitItem={(itemId) =>
                  updateMember(mm.memberId, {
                    usedToolkitItems: [...(mm.usedToolkitItems ?? []), itemId],
                  })
                }
                onRemoveToolkitItem={(itemId) =>
                  handleRemoveToolkitItem(mm.memberId, itemId)
                }
                onChipTap={handleChipTap}
              />
            )
          })}
        </Box>
      </Box>

      {/* ── End Match persistent footer ────────────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          p: { xs: 1.5, sm: 2 },
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
            fontSize: { xs: '0.65rem', sm: '0.75rem' },
            letterSpacing: '0.08em',
            py: { xs: 1, sm: 1.5 },
            px: { xs: 2.5, sm: 4 },
            minWidth: { xs: 'auto', sm: 220 },
            maxWidth: '90vw',
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

      {/* ── Dwarven Brew use prompt ────────────────────────────────────────── */}
      <Dialog
        open={!dwarvenBrew.promptResolved && dwarvenBrew.ownerMemberId !== null && !dwarvenBrew.elected}
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
        <DialogTitle>Use Dwarven Brew?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1, opacity: 0.85 }}>
            <strong>
              {company.members.find((m) => m.id === dwarvenBrew.ownerMemberId)?.name ?? 'A member'}
            </strong>{' '}
            owns a Dwarven Brew.
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Using it grants <strong>+1 Courage</strong> to all company members for this game.
            An Intelligence Test will be required to determine if the keg runs dry.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="outlined"
            onClick={() =>
              setDwarvenBrew((prev) => ({ ...prev, promptResolved: true, elected: false }))
            }
          >
            Decline
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              setDwarvenBrew((prev) => ({ ...prev, elected: true }))
            }
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '0.65rem',
            }}
          >
            Use
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dwarven Brew Intelligence Test dialog ──────────────────────────── */}
      <Dialog
        open={dwarvenBrew.elected && dwarvenBrew.intelligenceTestResult === null}
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
        <DialogTitle>Intelligence Test</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1, opacity: 0.85 }}>
            <strong>
              {company.members.find((m) => m.id === dwarvenBrew.ownerMemberId)?.name ?? 'The owner'}
            </strong>{' '}
            must pass an Intelligence test to keep the Dwarven Brew.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, opacity: 0.7 }}>
            Roll a D6. Need{' '}
            <strong>
              {(() => {
                const owner = company.members.find((m) => m.id === dwarvenBrew.ownerMemberId)
                const ownerStats = owner ? getStatsForUnit(owner.baseUnitId)?.stats : undefined
                const intStat = ownerStats?.intelligence ?? 4
                return `${intStat}+`
              })()}
            </strong>{' '}
            to pass.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5, 6].map((roll) => (
              <Button
                key={roll}
                variant="outlined"
                onClick={() => {
                  const owner = company.members.find((m) => m.id === dwarvenBrew.ownerMemberId)
                  const ownerStats = owner ? getStatsForUnit(owner.baseUnitId)?.stats : undefined
                  const intStat = ownerStats?.intelligence ?? 4
                  const passed = dwarvenBrewIntelligenceTestPasses(roll, intStat)
                  setDwarvenBrew((prev) => ({
                    ...prev,
                    intelligenceTestResult: roll,
                    testPassed: passed,
                    promptResolved: true,
                  }))
                  setBrewSnackbar({ open: true, passed })
                }}
                sx={{
                  minWidth: 48,
                  minHeight: 48,
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  borderColor: 'primary.dark',
                  color: 'primary.main',
                  '&:hover': { background: 'rgba(201,168,76,0.12)' },
                }}
              >
                {roll}
              </Button>
            ))}
          </Box>
        </DialogContent>
      </Dialog>

      {/* ── Chip detail popover (single page-level instance) ─────────────── */}
      <ChipDetailPopover
        anchorEl={chipPopover.anchorEl}
        content={chipPopover.content}
        onClose={() => setChipPopover({ anchorEl: null, content: null })}
      />

      {/* ── Dwarven Brew outcome snackbar ──────────────────────────────────── */}
      <Snackbar
        open={brewSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setBrewSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={brewSnackbar.passed ? 'success' : 'warning'}
          onClose={() => setBrewSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {brewSnackbar.passed
            ? 'Intelligence test passed! The Dwarven Brew is retained.'
            : 'Intelligence test failed — the keg has run dry. Brew will be removed after the match.'}
        </Alert>
      </Snackbar>
    </Box>
  )
}


