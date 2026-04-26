/**
 * MemberDetailsDrawer
 *
 * Slides up from the bottom to show full details for a single company member.
 * Covers: stats grid with colour-coded modifiers, wargear, M/W/F for heroes,
 * XP progress bar, injuries, special rules, point value, editable name.
 */

import { useState, useCallback, type ReactNode } from 'react'
import {
  Box,
  Typography,
  Drawer,
  SwipeableDrawer,
  IconButton,
  TextField,
  Chip,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Popover,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import type { Member, StoredBaseUnitStats, Company } from '../../models'
import { getUnitLabel, getWargearLabel } from '../../utils/labels'
import { calcMemberRating } from '../../utils/rating'
import pathsData from '../../data/paths.json'
import baseUnitsData from '../../data/baseUnits.json'
import specialRulesData from '../../data/specialRules.json'
import heroicActionsData from '../../data/heroicActions.json'
import { calcEquipmentStatBonus } from '../../utils/equipmentBonuses'

// ─── Path helpers ─────────────────────────────────────────────────────────────

interface PathDef {
  id: string
  label: string
  heroicAction?: string
}
const ALL_PATHS = pathsData as unknown as PathDef[]

// Labels that represent Heroic Actions stored inside member.specialRules
const HEROIC_ACTION_LABELS = new Set([
  'Heroic Accuracy',
  'Heroic Challenge',
  'Heroic Channelling',
  'Heroic Defence',
  'Heroic March',
  'Heroic Resolve',
  'Heroic Strength',
  'Heroic Strike',
  'Heroic Move',
  'Heroic Shoot',
  'Heroic Combat',
])

// Rule description lookup
const SPECIAL_RULES_MAP = (
  specialRulesData as Array<{ id: string; label: string; description: string }>
).reduce<Record<string, string>>((acc, r) => {
  acc[r.label] = r.description
  return acc
}, {})
const HEROIC_ACTIONS_MAP = (
  heroicActionsData as Array<{ id: string; label: string; description: string }>
).reduce<Record<string, string>>((acc, a) => {
  acc[a.label] = a.description
  return acc
}, {})

function getPathLabel(pathId: string): string {
  return (
    ALL_PATHS.find((p) => p.id === pathId)?.label ?? pathId.replace(/_/g, ' ')
  )
}

// ─── Base equipment lookup ────────────────────────────────────────────────────

const BASE_UNITS_RAW = baseUnitsData as Array<{
  id: string
  baseEquipment?: string[]
}>

function getBaseEquipment(baseUnitId: string): string[] {
  return BASE_UNITS_RAW.find((u) => u.id === baseUnitId)?.baseEquipment ?? []
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  member: Member | null
  baseStats: StoredBaseUnitStats | undefined
  open: boolean
  onClose: () => void
  onRename: (memberId: string, newName: string) => void
  company?: Company
  onSaveCompany?: (c: Company) => Promise<void>
}

// ─── Stat grid config ─────────────────────────────────────────────────────────

type StatKey =
  | 'move'
  | 'fight'
  | 'shoot'
  | 'strength'
  | 'defence'
  | 'attacks'
  | 'wounds'
  | 'courage'
  | 'intelligence'

const STAT_DEFS: { key: StatKey; label: string; isTargetNumber?: boolean }[] = [
  { key: 'move', label: 'Mv' },
  { key: 'fight', label: 'Fv' },
  { key: 'shoot', label: 'Sv', isTargetNumber: true },
  { key: 'strength', label: 'S' },
  { key: 'defence', label: 'D' },
  { key: 'attacks', label: 'A' },
  { key: 'wounds', label: 'W' },
  { key: 'courage', label: 'C', isTargetNumber: true },
  { key: 'intelligence', label: 'I', isTargetNumber: true },
]

function formatStatValue(
  val: number,
  isTargetNumber: boolean,
  key: StatKey
): string {
  if (key === 'move') return `${val}"`
  if (isTargetNumber) return `${val}+`
  return `${val}`
}

// ─── Injury display ───────────────────────────────────────────────────────────

const INJURY_LABELS: Record<string, string> = {
  arm_wound: 'Arm Wound',
  leg_wound: 'Leg Wound',
  broken_honour: 'Broken Honour',
  missing_next_game: 'Missing Next Game',
}

const INJURY_DESCRIPTIONS: Record<string, string> = {
  arm_wound: 'Cannot use shield, two-handed weapon, pike, or bow/crossbow.',
  leg_wound: 'Move value permanently reduced by 1".',
  broken_honour:
    'Cannot provide Stand Fast or affect allies with Heroic Actions.',
  missing_next_game: 'Will sit out the next battle.',
}

// ─── XP threshold ─────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 5

// ─── Component ────────────────────────────────────────────────────────────────

export default function MemberDetailsDrawer({
  member,
  baseStats,
  open,
  onClose,
  onRename,
  company,
  onSaveCompany,
}: Props) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  // snapshot of name when editing started — used for cancel/discard
  const [nameSnapshot, setNameSnapshot] = useState('')

  const handleEditName = () => {
    const current = member?.name ?? ''
    setNameInput(current)
    setNameSnapshot(current)
    setEditingName(true)
  }

  const handleSaveName = useCallback(() => {
    const trimmed = nameInput.trim()
    if (trimmed && member && trimmed !== member.name) {
      onRename(member.id, trimmed)
    }
    setEditingName(false)
  }, [nameInput, member, onRename])

  const handleCancelName = () => {
    setNameInput(nameSnapshot)
    setEditingName(false)
  }

  // Close button: cancel edit if editing, otherwise close drawer
  const handleCloseOrCancel = () => {
    if (editingName) {
      handleCancelName()
    } else {
      onClose()
    }
  }

  // ── Injury treatment state ──────────────────────────────────────────────────
  const [treatDialog, setTreatDialog] = useState<'options' | 'roll' | null>(
    null
  )
  const [treatType, setTreatType] = useState<
    'remove_warrior' | 'roll_hero' | 'miss_hero' | null
  >(null)
  const [treatTargetInjury, setTreatTargetInjury] = useState<string | null>(
    null
  )
  const [treatRollResult, setTreatRollResult] = useState<number | null>(null)
  const [treatAdjust, setTreatAdjust] = useState(0)

  const handleTreatConfirm = async () => {
    if (!member || !company || !onSaveCompany) return
    const influence = company.influence

    if (treatType === 'remove_warrior') {
      // 1 IP: remove missing_next_game from warrior
      const updated = {
        ...company,
        influence: influence - 1,
        members: company.members.map((m) =>
          m.id !== member.id
            ? m
            : {
                ...m,
                injuries: m.injuries.filter(
                  (inj) => inj.type !== 'missing_next_game'
                ),
              }
        ),
      }
      await onSaveCompany(updated)
    } else if (treatType === 'miss_hero') {
      // 1 IP: hero misses next game, removes one named injury
      const updated = {
        ...company,
        influence: influence - 1,
        members: company.members.map((m) =>
          m.id !== member.id
            ? m
            : {
                ...m,
                injuries: (() => {
                  const injs = [...m.injuries]
                  const idx = injs.findIndex(
                    (i) => i.type === treatTargetInjury
                  )
                  if (idx >= 0) injs.splice(idx, 1)
                  // add missing_next_game if not already there
                  if (!injs.find((i) => i.type === 'missing_next_game')) {
                    injs.push({ type: 'missing_next_game' as const, count: 1 })
                  }
                  return injs
                })(),
              }
        ),
      }
      await onSaveCompany(updated)
    } else if (treatType === 'roll_hero' && treatRollResult !== null) {
      const totalCost = 1 + treatAdjust
      if (treatRollResult + treatAdjust >= 5) {
        // success — remove the injury
        const updated = {
          ...company,
          influence: influence - totalCost,
          members: company.members.map((m) =>
            m.id !== member.id
              ? m
              : {
                  ...m,
                  injuries: (() => {
                    const injs = [...m.injuries]
                    const idx = injs.findIndex(
                      (i) => i.type === treatTargetInjury
                    )
                    if (idx >= 0) injs.splice(idx, 1)
                    return injs
                  })(),
                }
          ),
        }
        await onSaveCompany(updated)
      } else {
        // failure — just deduct influence
        await onSaveCompany({ ...company, influence: influence - totalCost })
      }
    }
    setTreatDialog(null)
    setTreatType(null)
    setTreatTargetInjury(null)
    setTreatRollResult(null)
    setTreatAdjust(0)
  }

  // ── Stat tooltip state ──────────────────────────────────────────────────────
  const [statAnchor, setStatAnchor] = useState<{
    el: HTMLElement
    key: string
  } | null>(null)

  // ── Rule info popup state ────────────────────────────────────────────────────
  const [rulePopup, setRulePopup] = useState<{
    label: string
    description: string
  } | null>(null)

  // Early return — all hooks must be declared above this point
  if (!member) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        PaperProps={{
          sx: { borderRadius: '16px 16px 0 0', background: '#1a1008', p: 2 },
        }}
      >
        <Typography sx={{ textAlign: 'center', opacity: 0.4, py: 4 }}>
          No member selected.
        </Typography>
      </SwipeableDrawer>
    )
  }

  const isHero = member.role !== 'warrior'
  const rating = calcMemberRating(member, baseStats)

  // Combined wargear: base equipment + assigned option / purchased wargear
  // De-duplicated while preserving order (base first, then assigned)
  const baseEquip = getBaseEquipment(member.baseUnitId)
  const assignedEquip = member.equipment ?? []
  const allWargear = Array.from(new Set([...baseEquip, ...assignedEquip]))

  // Equipment-derived stat bonuses (shield +1D, armour upgrade, etc.)
  const equipBonus = calcEquipmentStatBonus(
    member.equipment ?? [],
    member.baseUnitId,
    member.armourUpgraded,
    member.armourUpgrades
  )

  // Build effective stat values: base + increases + decreases (injuries) + equipment bonuses
  const base = baseStats?.stats

  // Compute path advancement totals per stat (for tooltip)
  const pathAdvances: Partial<Record<string, number>> = {}
  if (member.statIncreases) {
    for (const [key, val] of Object.entries(member.statIncreases)) {
      if (val && val !== 0) pathAdvances[key] = val
    }
  }

  const effectiveStats = base
    ? STAT_DEFS.map(({ key, label, isTargetNumber }) => {
        const baseVal = base[key] ?? 0
        const increase = (member.statIncreases ?? {})[key] ?? 0
        const decrease = (member.statDecreases ?? {})[key] ?? 0
        const eqBonus = key === 'defence' ? equipBonus.defence : 0
        const effectiveVal = baseVal + increase - decrease + eqBonus

        let colour: 'inherit' | 'success.main' | 'error.main' = 'inherit'
        if (isTargetNumber) {
          if (effectiveVal < baseVal) colour = 'success.main'
          else if (effectiveVal > baseVal) colour = 'error.main'
        } else {
          if (effectiveVal > baseVal) colour = 'success.main'
          else if (effectiveVal < baseVal) colour = 'error.main'
        }

        // Build breakdown lines for tooltip
        const breakdown: string[] = []
        if (increase !== 0) {
          const sign = isTargetNumber
            ? increase < 0
              ? '+'
              : '−'
            : increase > 0
              ? '+'
              : '−'
          const abs = Math.abs(increase)
          breakdown.push(`Path advancement: ${sign}${abs}`)
        }
        if (decrease !== 0) {
          breakdown.push(`Injuries: −${decrease}`)
        }
        if (key === 'defence' && eqBonus !== 0) {
          // Breakdown armour upgrades separately from shield
          const shieldBonus = (member.equipment ?? []).includes('shield')
            ? 1
            : 0
          const armourBonus = eqBonus - shieldBonus
          if (shieldBonus > 0) breakdown.push('Shield: +1')
          if (armourBonus > 0) {
            const upgrades =
              member.armourUpgrades ?? (member.armourUpgraded ? ['armour'] : [])
            if (upgrades.length > 0) {
              const wgLabel = upgrades[upgrades.length - 1]
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase())
              breakdown.push(`Upgrade to ${wgLabel}: +${armourBonus}`)
            } else {
              breakdown.push(`Armour upgrade: +${armourBonus}`)
            }
          }
        }

        return {
          key,
          label,
          isTargetNumber: isTargetNumber ?? false,
          baseVal,
          effectiveVal,
          colour,
          breakdown,
        }
      })
    : []

  // XP progress within current level
  const xpIntoLevel = member.experience % XP_PER_LEVEL
  const xpPct = (xpIntoLevel / XP_PER_LEVEL) * 100

  const roleLabel = (role: string) => {
    if (role === 'leader') return 'Leader'
    if (role === 'sergeant') return 'Sergeant'
    if (role === 'hero_in_making') return 'Hero in the Making'
    return 'Warrior'
  }

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={editingName ? undefined : onClose}
      PaperProps={{
        sx: {
          background: 'linear-gradient(160deg, #2E1E0A 0%, #1A0F05 100%)',
          border: '1px solid #4A3520',
          borderBottom: 'none',
          borderRadius: '12px 12px 0 0',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Drag handle */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          pt: 1.5,
          pb: 0.5,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{ width: 40, height: 4, borderRadius: 2, background: '#4A3520' }}
        />
      </Box>

      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          pt: 1,
          pb: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          flexShrink: 0,
          borderBottom: '1px solid #4A3520',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') handleCancelName()
                }}
                autoFocus
                size="small"
                sx={{ flex: 1 }}
                inputProps={{ maxLength: 40 }}
              />
              <IconButton
                size="small"
                onClick={handleSaveName}
                sx={{ color: 'success.main' }}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: '1.1rem',
                  color: 'primary.main',
                  lineHeight: 1.3,
                }}
              >
                {member.name}
              </Typography>
              <IconButton
                size="small"
                onClick={handleEditName}
                sx={{ color: 'text.secondary', p: 0.5 }}
              >
                <EditIcon sx={{ fontSize: '0.9rem' }} />
              </IconButton>
            </Box>
          )}
          <Typography
            variant="caption"
            sx={{ fontStyle: 'italic', color: 'text.secondary' }}
          >
            {getUnitLabel(member.baseUnitId)}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              mt: 0.5,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Chip
              label={roleLabel(member.role)}
              size="small"
              sx={{
                fontSize: '0.65rem',
                borderColor: isHero ? 'primary.main' : 'divider',
                color: isHero ? 'primary.main' : 'text.secondary',
                border: '1px solid',
                background: 'transparent',
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontStyle: 'normal' }}
            >
              {rating} pts
            </Typography>
          </Box>
        </Box>

        {/* Close / Cancel button — red while editing */}
        <IconButton
          onClick={handleCloseOrCancel}
          size="small"
          sx={{
            flexShrink: 0,
            mt: 0.5,
            color: editingName ? 'error.main' : 'text.secondary',
            transition: 'color 0.15s',
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Scrollable body */}
      <Box sx={{ overflow: 'auto', flex: 1, px: 2.5, py: 2 }}>
        {/* ── M / W / F (heroes only) ──────────────────────────────────────── */}
        {isHero && member.heroStats && (
          <Box sx={{ mb: 2.5 }}>
            <SectionLabel>Heroic Resources</SectionLabel>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                mt: 1,
                p: 1.5,
                border: '1px solid',
                borderColor: 'primary.dark',
                borderRadius: 1,
                background: 'rgba(201,168,76,0.04)',
                justifyContent: 'space-around',
              }}
            >
              {(['might', 'will', 'fate'] as const).map((stat) => (
                <Box key={stat} sx={{ textAlign: 'center' }}>
                  <Typography
                    sx={{
                      fontFamily: '"Cinzel Decorative", serif',
                      fontSize: '0.65rem',
                      letterSpacing: '0.1em',
                      color: 'primary.light',
                      opacity: 0.8,
                      textTransform: 'uppercase',
                      mb: 0.5,
                    }}
                  >
                    {stat}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: '"Cinzel Decorative", serif',
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      color: 'primary.main',
                      lineHeight: 1,
                    }}
                  >
                    {member.heroStats![stat]}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* ── Hero Path ───────────────────────────────────────────────────── */}
        {isHero && member.pathId && (
          <Box sx={{ mb: 2.5 }}>
            <SectionLabel>Heroic Path</SectionLabel>
            <Box
              sx={{
                mt: 1,
                px: 2,
                py: 1.25,
                border: '1px solid',
                borderColor: 'primary.dark',
                borderRadius: 1,
                background: 'rgba(201,168,76,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: '0.85rem',
                  color: 'primary.main',
                }}
              >
                {getPathLabel(member.pathId)}
              </Typography>
              <Typography
                variant="caption"
                sx={{ opacity: 0.55, fontStyle: 'normal' }}
              >
                {ALL_PATHS.find((p) => p.id === member.pathId)?.heroicAction
                  ? '+ Heroic Action'
                  : 'Universal Actions'}
              </Typography>
            </Box>
          </Box>
        )}

        {/* ── Stat grid ────────────────────────────────────────────────────── */}
        {effectiveStats.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <SectionLabel>Characteristics</SectionLabel>
            <Box
              sx={{
                display: 'flex',
                mt: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              {effectiveStats.map(
                (
                  {
                    key,
                    label,
                    isTargetNumber,
                    effectiveVal,
                    colour,
                    breakdown,
                  },
                  idx
                ) => (
                  <Box
                    key={key}
                    onClick={
                      breakdown.length > 0
                        ? (e) =>
                            setStatAnchor({
                              el: e.currentTarget as HTMLElement,
                              key,
                            })
                        : undefined
                    }
                    sx={{
                      flex: 1,
                      textAlign: 'center',
                      py: 0.75,
                      px: 0.25,
                      borderLeft: idx === 0 ? 'none' : '1px solid',
                      borderColor: 'divider',
                      background:
                        colour === 'success.main'
                          ? 'rgba(74,124,89,0.15)'
                          : colour === 'error.main'
                            ? 'rgba(192,57,43,0.15)'
                            : 'rgba(0,0,0,0.2)',
                      transition: 'background 0.15s',
                      cursor: breakdown.length > 0 ? 'pointer' : 'default',
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.56rem',
                        letterSpacing: '0.04em',
                        opacity: 0.55,
                        display: 'block',
                        mb: 0.3,
                        fontFamily: '"IM Fell English", serif',
                      }}
                    >
                      {label}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: '"Cinzel Decorative", serif',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: colour === 'inherit' ? 'text.primary' : colour,
                        lineHeight: 1,
                      }}
                    >
                      {formatStatValue(effectiveVal, isTargetNumber, key)}
                    </Typography>
                    {breakdown.length > 0 && (
                      <Box
                        sx={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background:
                            colour === 'inherit'
                              ? 'rgba(200,164,90,0.4)'
                              : colour,
                          mx: 'auto',
                          mt: 0.4,
                        }}
                      />
                    )}
                  </Box>
                )
              )}
            </Box>
            {effectiveStats.some((s) => s.colour !== 'inherit') && (
              <Box sx={{ display: 'flex', gap: 2, mt: 0.75, px: 0.25 }}>
                <Legend colour="success.main" label="Above base" />
                <Legend colour="error.main" label="Below base" />
                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.4,
                    fontStyle: 'normal',
                    ml: 'auto',
                    fontSize: '0.58rem',
                  }}
                >
                  Tap modified stat for details
                </Typography>
              </Box>
            )}
            {/* Stat breakdown popover */}
            <Popover
              open={!!statAnchor}
              anchorEl={statAnchor?.el}
              onClose={() => setStatAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
              PaperProps={{
                sx: {
                  background: 'linear-gradient(160deg,#1a1008 0%,#110a03 100%)',
                  border: '1px solid rgba(200,164,90,0.3)',
                  borderRadius: 1,
                  p: 1.5,
                  minWidth: 160,
                  maxWidth: 220,
                },
              }}
            >
              {statAnchor &&
                (() => {
                  const stat = effectiveStats.find(
                    (s) => s.key === statAnchor.key
                  )
                  if (!stat) return null
                  return (
                    <Box>
                      <Typography
                        sx={{
                          fontFamily: '"Cinzel Decorative", serif',
                          fontSize: '0.7rem',
                          color: 'primary.main',
                          mb: 1,
                        }}
                      >
                        {stat.label} breakdown
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          mb: 0.5,
                        }}
                      >
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                          Base
                        </Typography>
                        <Typography variant="caption">
                          {formatStatValue(
                            stat.baseVal,
                            stat.isTargetNumber,
                            stat.key
                          )}
                        </Typography>
                      </Box>
                      {stat.breakdown.map((line, i) => (
                        <Box
                          key={i}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 0.25,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ opacity: 0.75, flex: 1, mr: 1 }}
                          >
                            {line.split(':')[0]}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color:
                                line.includes('−') || line.includes('Injur')
                                  ? 'error.light'
                                  : 'success.light',
                            }}
                          >
                            {line.split(':')[1]?.trim()}
                          </Typography>
                        </Box>
                      ))}
                      <Box
                        sx={{
                          mt: 0.75,
                          pt: 0.75,
                          borderTop: '1px solid rgba(200,164,90,0.2)',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Total
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color:
                              stat.colour === 'inherit'
                                ? 'text.primary'
                                : stat.colour,
                          }}
                        >
                          {formatStatValue(
                            stat.effectiveVal,
                            stat.isTargetNumber,
                            stat.key
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  )
                })()}
            </Popover>
          </Box>
        )}

        {/* ── Wargear ───────────────────────────────────────────────────────── */}
        <Box sx={{ mb: 2.5 }}>
          <SectionLabel>Wargear</SectionLabel>
          {allWargear.length === 0 ? (
            <Typography
              variant="caption"
              sx={{
                opacity: 0.5,
                fontStyle: 'italic',
                mt: 0.5,
                display: 'block',
              }}
            >
              No wargear
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
              {allWargear.map((eq) => (
                <Chip
                  key={eq}
                  label={getWargearLabel(eq)}
                  size="small"
                  sx={{
                    fontSize: '0.72rem',
                    borderColor: 'divider',
                    color: 'text.secondary',
                    border: '1px solid',
                    background: 'transparent',
                  }}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* ── Heroic Actions ───────────────────────────────────────────────── */}
        {(() => {
          const heroicActions = member.specialRules.filter((r) =>
            HEROIC_ACTION_LABELS.has(r)
          )
          if (heroicActions.length === 0) return null
          return (
            <Box sx={{ mb: 2.5 }}>
              <SectionLabel>Heroic Actions</SectionLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                {heroicActions.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    size="small"
                    onClick={() => {
                      const desc = HEROIC_ACTIONS_MAP[r] ?? SPECIAL_RULES_MAP[r]
                      if (desc) setRulePopup({ label: r, description: desc })
                    }}
                    sx={{
                      fontSize: '0.72rem',
                      borderColor: 'rgba(201,168,76,0.5)',
                      color: 'primary.main',
                      border: '1px solid',
                      background: 'rgba(201,168,76,0.08)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </Box>
            </Box>
          )
        })()}

        {/* ── Special Rules ─────────────────────────────────────────────────── */}
        {(() => {
          const specialRules = member.specialRules.filter(
            (r) => !HEROIC_ACTION_LABELS.has(r)
          )
          if (specialRules.length === 0) return null
          return (
            <Box sx={{ mb: 2.5 }}>
              <SectionLabel>Special Rules</SectionLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                {specialRules.map((r) => {
                  const desc = SPECIAL_RULES_MAP[r] ?? HEROIC_ACTIONS_MAP[r]
                  return (
                    <Chip
                      key={r}
                      label={r}
                      size="small"
                      onClick={
                        desc
                          ? () => setRulePopup({ label: r, description: desc })
                          : undefined
                      }
                      sx={{
                        fontSize: '0.72rem',
                        borderColor: 'primary.dark',
                        color: 'primary.light',
                        border: '1px solid',
                        background: 'rgba(201,168,76,0.05)',
                        cursor: desc ? 'pointer' : 'default',
                      }}
                    />
                  )
                })}
              </Box>
            </Box>
          )
        })()}

        {/* ── Rule info popup ───────────────────────────────────────────────── */}
        {rulePopup && (
          <Dialog
            open
            onClose={() => setRulePopup(null)}
            PaperProps={{
              sx: {
                background: 'linear-gradient(160deg,#1a1008 0%,#110a03 100%)',
                border: '1px solid rgba(200,164,90,0.25)',
                borderRadius: 2,
                maxWidth: 340,
              },
            }}
          >
            <DialogTitle
              sx={{
                fontFamily: '"Cinzel Decorative", serif',
                fontSize: '0.8rem',
                color: 'primary.main',
                pb: 1,
              }}
            >
              {rulePopup.label}
            </DialogTitle>
            <DialogContent>
              <Typography
                variant="body2"
                sx={{ opacity: 0.85, lineHeight: 1.65 }}
              >
                {rulePopup.description}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 2 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setRulePopup(null)}
              >
                Close
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {/* ── Experience ───────────────────────────────────────────────────── */}
        <Box sx={{ mb: 2.5 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <SectionLabel>Experience</SectionLabel>
            <Typography
              variant="caption"
              sx={{ fontStyle: 'normal', color: 'text.secondary' }}
            >
              {member.experience} XP total ·{' '}
              {XP_PER_LEVEL - (member.experience % XP_PER_LEVEL)} until
              progression
            </Typography>
          </Box>
          <Box
            sx={{
              mt: 1,
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <LinearProgress
              variant="determinate"
              value={xpPct}
              sx={{ height: 6, borderRadius: 3, mb: 0.75 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography
                variant="caption"
                sx={{ fontStyle: 'normal', opacity: 0.5 }}
              >
                {member.experience % XP_PER_LEVEL} / {XP_PER_LEVEL} in current
                level
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontStyle: 'normal', opacity: 0.5 }}
              >
                Lifetime: {member.lifetimeExperience} XP
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ── Injuries ─────────────────────────────────────────────────────── */}
        <Box sx={{ mb: 2 }}>
          <SectionLabel>Injuries</SectionLabel>
          {member.injuries.length === 0 ? (
            <Box
              sx={{
                mt: 1,
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                background: 'rgba(0,0,0,0.2)',
                textAlign: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{ opacity: 0.5, fontStyle: 'italic' }}
              >
                No injuries — fighting fit
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}
            >
              {member.injuries.map((injury, i) => {
                const canTreat =
                  !!company && !!onSaveCompany && company.influence >= 1
                const isWarrior = member.role === 'warrior'
                const showTreatBtn =
                  canTreat &&
                  ((isWarrior && injury.type === 'missing_next_game') ||
                    (!isWarrior && injury.type !== 'missing_next_game'))
                return (
                  <Box
                    key={i}
                    sx={{
                      p: 1.5,
                      border: '1px solid',
                      borderColor:
                        injury.type === 'missing_next_game'
                          ? 'warning.main'
                          : 'error.main',
                      borderRadius: 1,
                      background:
                        injury.type === 'missing_next_game'
                          ? 'rgba(201,168,76,0.06)'
                          : 'rgba(192,57,43,0.06)',
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
                        sx={{
                          fontFamily: '"Cinzel Decorative", serif',
                          fontSize: '0.75rem',
                          color:
                            injury.type === 'missing_next_game'
                              ? 'warning.main'
                              : 'error.light',
                        }}
                      >
                        {INJURY_LABELS[injury.type] ?? injury.type}
                        {injury.count > 1 && ` (×${injury.count})`}
                      </Typography>
                      {showTreatBtn && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setTreatTargetInjury(injury.type)
                            setTreatDialog('options')
                          }}
                          sx={{
                            fontSize: '0.58rem',
                            py: 0.25,
                            px: 1,
                            minWidth: 0,
                            borderColor: 'primary.dark',
                            color: 'primary.light',
                          }}
                        >
                          Treat
                        </Button>
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.7, fontStyle: 'normal' }}
                    >
                      {INJURY_DESCRIPTIONS[injury.type]}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>

        {/* ── Injury treatment dialog ───────────────────────────────────────── */}
        {treatDialog && company && (
          <Dialog
            open
            PaperProps={{
              sx: {
                background: 'linear-gradient(160deg, #1a1008 0%, #110a03 100%)',
                border: '1px solid rgba(200,164,90,0.25)',
                borderRadius: 2,
              },
            }}
          >
            <DialogTitle
              sx={{
                fontFamily: '"Cinzel Decorative", serif',
                fontSize: '0.85rem',
                color: 'primary.main',
              }}
            >
              Treat Injury —{' '}
              {INJURY_LABELS[treatTargetInjury ?? ''] ?? treatTargetInjury}
            </DialogTitle>
            <DialogContent>
              {treatDialog === 'options' && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    minWidth: 260,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.65, display: 'block', mb: 0.5 }}
                  >
                    Company Influence: {company.influence} IP
                  </Typography>

                  {member.role === 'warrior' && (
                    <Box
                      onClick={() => setTreatType('remove_warrior')}
                      sx={{
                        p: 1.25,
                        border: '1px solid',
                        borderRadius: 1,
                        cursor: 'pointer',
                        borderColor:
                          treatType === 'remove_warrior'
                            ? 'primary.main'
                            : 'divider',
                        background:
                          treatType === 'remove_warrior'
                            ? 'rgba(201,168,76,0.08)'
                            : 'rgba(0,0,0,0.2)',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Remove Injury (1 IP)
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.6 }}>
                        Warrior returns to full duty.
                      </Typography>
                    </Box>
                  )}

                  {member.role !== 'warrior' && (
                    <>
                      <Box
                        onClick={() => setTreatType('roll_hero')}
                        sx={{
                          p: 1.25,
                          border: '1px solid',
                          borderRadius: 1,
                          cursor: 'pointer',
                          borderColor:
                            treatType === 'roll_hero'
                              ? 'primary.main'
                              : 'divider',
                          background:
                            treatType === 'roll_hero'
                              ? 'rgba(201,168,76,0.08)'
                              : 'rgba(0,0,0,0.2)',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Attempt Recovery — Roll D6 (1+ IP)
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                          Roll 5+ to remove injury. Spend extra IP to boost
                          roll.
                        </Typography>
                      </Box>
                      <Box
                        onClick={() => setTreatType('miss_hero')}
                        sx={{
                          p: 1.25,
                          border: '1px solid',
                          borderRadius: 1,
                          cursor: 'pointer',
                          borderColor:
                            treatType === 'miss_hero'
                              ? 'primary.main'
                              : 'divider',
                          background:
                            treatType === 'miss_hero'
                              ? 'rgba(201,168,76,0.08)'
                              : 'rgba(0,0,0,0.2)',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Send to Healers (1 IP)
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                          Hero misses next game but the injury is removed.
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>
              )}

              {treatDialog === 'roll' && treatType === 'roll_hero' && (
                <Box sx={{ minWidth: 260 }}>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', opacity: 0.65, mb: 1.5 }}
                  >
                    Boost roll with extra IP (max +3, 1 IP each). Need 5+ to
                    succeed.
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ minWidth: 32, p: 0.5 }}
                      disabled={treatAdjust <= 0}
                      onClick={() => setTreatAdjust((a) => Math.max(0, a - 1))}
                    >
                      −
                    </Button>
                    <Typography
                      sx={{
                        fontFamily: '"Cinzel Decorative", serif',
                        minWidth: 32,
                        textAlign: 'center',
                        color:
                          treatAdjust > 0 ? 'primary.main' : 'text.secondary',
                      }}
                    >
                      {treatAdjust > 0 ? `+${treatAdjust}` : '0'}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ minWidth: 32, p: 0.5 }}
                      disabled={
                        treatAdjust >= 3 ||
                        company.influence < 1 + treatAdjust + 1
                      }
                      onClick={() => setTreatAdjust((a) => Math.min(3, a + 1))}
                    >
                      +
                    </Button>
                    <Typography variant="caption" sx={{ opacity: 0.5, ml: 1 }}>
                      Total: {1 + treatAdjust} IP
                    </Typography>
                  </Box>
                  {treatRollResult === null ? (
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() =>
                        setTreatRollResult(Math.floor(Math.random() * 6) + 1)
                      }
                      sx={{
                        fontFamily: '"Cinzel Decorative", serif',
                        fontSize: '0.62rem',
                      }}
                    >
                      Roll D6
                    </Button>
                  ) : (
                    <Box
                      sx={{
                        textAlign: 'center',
                        p: 1.5,
                        border: '1px solid',
                        borderColor:
                          treatRollResult + treatAdjust >= 5
                            ? 'success.main'
                            : 'error.main',
                        borderRadius: 1,
                        background:
                          treatRollResult + treatAdjust >= 5
                            ? 'rgba(46,204,113,0.06)'
                            : 'rgba(192,57,43,0.06)',
                      }}
                    >
                      <Typography
                        sx={{
                          fontFamily: '"Cinzel Decorative", serif',
                          fontSize: '1.4rem',
                          color:
                            treatRollResult + treatAdjust >= 5
                              ? 'success.light'
                              : 'error.light',
                        }}
                      >
                        {treatRollResult}
                        {treatAdjust > 0 &&
                          ` + ${treatAdjust} = ${treatRollResult + treatAdjust}`}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {treatRollResult + treatAdjust >= 5
                          ? '✓ Success — injury removed!'
                          : '✗ Failed — injury remains.'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setTreatDialog(null)
                  setTreatType(null)
                  setTreatRollResult(null)
                  setTreatAdjust(0)
                }}
              >
                Cancel
              </Button>
              {treatDialog === 'options' &&
                treatType &&
                treatType !== 'roll_hero' && (
                  <Button
                    variant="contained"
                    size="small"
                    disabled={!treatType}
                    onClick={handleTreatConfirm}
                    sx={{
                      fontFamily: '"Cinzel Decorative", serif',
                      fontSize: '0.62rem',
                    }}
                  >
                    Confirm ({1} IP)
                  </Button>
                )}
              {treatDialog === 'options' && treatType === 'roll_hero' && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => setTreatDialog('roll')}
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '0.62rem',
                  }}
                >
                  Next →
                </Button>
              )}
              {treatDialog === 'roll' && treatRollResult !== null && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleTreatConfirm}
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '0.62rem',
                  }}
                >
                  Confirm ({1 + treatAdjust} IP)
                </Button>
              )}
            </DialogActions>
          </Dialog>
        )}

        {/* Bottom safe area */}
        <Box sx={{ height: 16 }} />
      </Box>
    </Drawer>
  )
}

// ─── Small sub-components ─────────────────────────────────────────────────────

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

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: colour,
          opacity: 0.8,
        }}
      />
      <Typography
        variant="caption"
        sx={{ fontSize: '0.6rem', opacity: 0.6, fontStyle: 'normal' }}
      >
        {label}
      </Typography>
    </Box>
  )
}
