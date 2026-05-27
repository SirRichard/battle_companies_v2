/**
 * MemberDetailsDrawer
 *
 * Slides up from the bottom to show full details for a single company member.
 * Covers: stats grid with colour-coded modifiers, wargear, M/W/F for heroes,
 * XP progress bar, injuries, special rules, point value, editable name.
 */

import { useState, useCallback, useEffect, type ReactNode } from 'react'
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
import ConfirmDialog from './ConfirmDialog'
import { DieFace } from './AnimatedDice'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import type { Member, StoredBaseUnitStats, Company, CompanyDefinition } from '../../models'
import { getUnitLabel, getWargearLabel, formatSpecialRule } from '../../utils/labels'
import { calcMemberRating } from '../../utils/rating'
import pathsData from '../../data/paths.json'
import baseUnitsData from '../../data/baseUnits.json'
import specialRulesData from '../../data/specialRules.json'
import heroicActionsData from '../../data/heroicActions.json'
import { calcEquipmentStatBonus } from '../../utils/equipmentBonuses'
import { CHANNELING_SPELLS } from '../wizard/StepSpellSelection'
import wargearData from '../../data/wargear.json'
import companiesData from '../../data/companies.json'


// ─── Company definition lookup ────────────────────────────────────────────────

const ALL_COMPANIES = companiesData as CompanyDefinition[]

// ─── Wargear category lookup ──────────────────────────────────────────────────

const WARGEAR_CATEGORY_MAP = (
  wargearData as Array<{ id: string; category?: string }>
).reduce<Record<string, string>>((acc, w) => {
  if (w.category) acc[w.id] = w.category
  return acc
}, {})

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
// Also index by ID for parameterised rule description lookup
const SPECIAL_RULES_BY_ID = (
  specialRulesData as Array<{ id: string; label: string; description: string }>
).reduce<Record<string, string>>((acc, r) => {
  acc[r.id] = r.description
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

/**
 * Format a wargear/equipment entry for display.
 * Detects parameterised "envenom_weapon::<weaponId>" pattern and renders as
 * "Envenom Weapon (WeaponLabel)". Falls back to getWargearLabel for plain IDs.
 */
function formatWargearEntry(entry: string): string {
  if (entry.startsWith('envenom_weapon::')) {
    const weaponId = entry.slice('envenom_weapon::'.length)
    if (weaponId) {
      return `Envenom Weapon (${getWargearLabel(weaponId)})`
    }
    return 'Envenom Weapon'
  }
  return getWargearLabel(entry)
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
  type TreatStage = 'options' | 'rolling' | 'ip_prompt' | 'confirm'
  const [treatStage, setTreatStage] = useState<TreatStage | null>(null)
  const [treatType, setTreatType] = useState<
    'remove_missing' | 'roll_hero' | 'miss_hero' | null
  >(null)
  const [treatTargetInjury, setTreatTargetInjury] = useState<string | null>(
    null
  )
  const [rolledValue, setRolledValue] = useState<number | null>(null)
  const [treatAdjust, setTreatAdjust] = useState(0)
  // Animated die state for the rolling stage
  const [animDieValue, setAnimDieValue] = useState<number>(1)
  const [dieSettled, setDieSettled] = useState(false)

  const handleTreatConfirm = async () => {
    if (!member || !company || !onSaveCompany) return
    const influence = company.influence

    if (treatType === 'remove_missing') {
      // 1 IP: remove missing_next_game from any member (hero or warrior)
      const updated = {
        ...company,
        influence: influence - 1,
        members: company.members.map((m) =>
          m.id !== member.id
            ? m
            : {
                ...m,
                injuries: m.injuries.filter(
                  (i) => i.type !== 'missing_next_game'
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
    } else if (treatType === 'roll_hero' && rolledValue !== null) {
      const totalCost = 1 + treatAdjust
      if (rolledValue + treatAdjust >= 5) {
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
    setTreatStage(null)
    setTreatType(null)
    setTreatTargetInjury(null)
    setRolledValue(null)
    setTreatAdjust(0)
    setDieSettled(false)
  }



  // Animated die effect — runs when treatStage transitions to 'rolling'
  useEffect(() => {
    if (treatStage !== 'rolling') return
    const finalRoll = Math.floor(Math.random() * 6) + 1
    setRolledValue(finalRoll)
    setDieSettled(false)
    let count = 0
    const totalFlashes = 10
    const flash = () => {
      count++
      const delay = 80 + (count / totalFlashes) * 240
      if (count < totalFlashes) {
        setAnimDieValue(Math.floor(Math.random() * 6) + 1)
        setTimeout(flash, delay)
      } else {
        setAnimDieValue(finalRoll)
        setDieSettled(true)
        // Transition to ip_prompt after a short pause
        setTimeout(() => setTreatStage('ip_prompt'), 400)
      }
    }
    setTimeout(flash, 80)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treatStage])

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

  // ── Wargear edit mode state ───────────────────────────────────────────────
  const [wargearEditMode, setWargearEditMode] = useState(false)
  const [removeConfirmItem, setRemoveConfirmItem] = useState<string | null>(null)

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

  // Synthesize envenom weapon entries from ownedEquipment + specialRules
  // companyFactory stores envenom as ownedEquipment=['envenom_weapon'] +
  // specialRules=[{ id: 'poisoned_attacks', parameter: weaponId }]
  const envenomWargearEntries: string[] = []
  if ((member.ownedEquipment ?? []).includes('envenom_weapon')) {
    for (const rule of member.specialRules) {
      if (
        typeof rule === 'object' &&
        rule.id === 'poisoned_attacks' &&
        typeof rule.parameter === 'string'
      ) {
        envenomWargearEntries.push(`envenom_weapon::${rule.parameter}`)
      }
    }
  }

  const allWargear = Array.from(new Set([...baseEquip, ...assignedEquip, ...envenomWargearEntries]))

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
                flexWrap: 'wrap',
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
                      flex: { xs: '0 0 20%', sm: 1 },
                      minWidth: 32,
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionLabel>Wargear</SectionLabel>
            {isHero && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {!wargearEditMode && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setWargearEditMode(true)}
                    sx={{ fontSize: '0.6rem', py: 0.25, px: 1, minWidth: 0, borderColor: 'primary.dark', color: 'primary.light' }}
                  >
                    Edit
                  </Button>
                )}
                {wargearEditMode && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => setWargearEditMode(false)}
                    sx={{ fontSize: '0.6rem', py: 0.25, px: 1, minWidth: 0 }}
                  >
                    Done
                  </Button>
                )}
              </Box>
            )}
          </Box>
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
              {allWargear.map((eq) => {
                const isRemovable =
                  wargearEditMode &&
                  assignedEquip.includes(eq) &&
                  !baseEquip.includes(eq) &&
                  !WARGEAR_CATEGORY_MAP[eq]?.startsWith('armour')
                return (
                  <Box key={eq} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Chip
                      label={formatWargearEntry(eq)}
                      size="small"
                      sx={{
                        fontSize: '0.72rem',
                        borderColor: isRemovable ? 'error.main' : 'divider',
                        color: isRemovable ? 'error.light' : 'text.secondary',
                        border: '1px solid',
                        background: 'transparent',
                      }}
                    />
                    {isRemovable && (
                      <IconButton
                        size="small"
                        onClick={() => setRemoveConfirmItem(eq)}
                        sx={{ color: 'error.main', p: 0.25, fontSize: '0.9rem', lineHeight: 1 }}
                      >
                        ×
                      </IconButton>
                    )}
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>

        {/* ── Hero Upgrades ─────────────────────────────────────────────────── */}
        {isHero && company && (() => {
          const companyDef = ALL_COMPANIES.find((c) => c.id === company.companyTypeId)
          if (!companyDef || companyDef.heroUpgrade.length === 0) return null
          const ownedUpgrades = companyDef.heroUpgrade.filter((u) =>
            member.equipment.includes(u.id)
          )
          if (ownedUpgrades.length === 0) return null
          return (
            <Box sx={{ mb: 2.5 }}>
              <SectionLabel>Company Hero Upgrades</SectionLabel>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                {ownedUpgrades.map((upgrade) => (
                  <Box
                    key={upgrade.id}
                    sx={{
                      px: 1.5,
                      py: 1,
                      border: '1px solid',
                      borderColor: 'primary.dark',
                      borderRadius: 1,
                      background: 'rgba(201,168,76,0.04)',
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: '"Cinzel Decorative", serif',
                        fontSize: '0.75rem',
                        color: 'primary.main',
                        mb: 0.25,
                      }}
                    >
                      {upgrade.label}
                    </Typography>
                    {upgrade.description && (
                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.7, display: 'block' }}
                      >
                        {upgrade.description}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )
        })()}

        {/* ── Heroic Actions ───────────────────────────────────────────────── */}
        {(() => {
          const heroicActions = member.specialRules.filter((r) =>
            typeof r === 'string' && HEROIC_ACTION_LABELS.has(r)
          ) as string[]
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
          // Include both plain string rules (non-heroic) and parameterised object rules
          // Filter out poisoned_attacks entries that correspond to envenom weapons
          // (those are already displayed in the wargear section)
          const hasEnvenomWeapon = (member.ownedEquipment ?? []).includes('envenom_weapon')
          const specialRules = member.specialRules.filter(
            (r) => {
              if (typeof r === 'string') return !HEROIC_ACTION_LABELS.has(r)
              // Filter out poisoned_attacks from envenom weapons (shown as wargear instead)
              if (
                hasEnvenomWeapon &&
                r.id === 'poisoned_attacks' &&
                typeof r.parameter === 'string'
              ) {
                return false
              }
              return true
            }
          )
          if (specialRules.length === 0) return null
          return (
            <Box sx={{ mb: 2.5 }}>
              <SectionLabel>Special Rules</SectionLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                {specialRules.map((r, idx) => {
                  const displayLabel = formatSpecialRule(r)
                  // For object entries, look up description by ID; for plain strings, by label
                  const ruleId = typeof r === 'string' ? undefined : r.id
                  const desc = ruleId
                    ? SPECIAL_RULES_BY_ID[ruleId]
                    : (SPECIAL_RULES_MAP[displayLabel] ?? HEROIC_ACTIONS_MAP[displayLabel])
                  const key = typeof r === 'string' ? r : `${r.id}-${idx}`
                  return (
                    <Chip
                      key={key}
                      label={displayLabel}
                      size="small"
                      onClick={
                        desc
                          ? () => setRulePopup({ label: displayLabel, description: desc })
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

        {/* ── Magical Powers ────────────────────────────────────────────────── */}
        {(member.spells?.length ?? 0) > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <SectionLabel>Magical Powers</SectionLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1 }}>
              {member.spells!.map((spellId) => {
                const spell = CHANNELING_SPELLS.find((s) => s.id === spellId)
                if (!spell) return null
                const improvements = (member.spellImprovements ?? {})[spellId] ?? 0
                const baseValue = parseInt(spell.castingValue)
                const effectiveValue = baseValue - improvements
                return (
                  <Box
                    key={spellId}
                    sx={{
                      px: 1.5,
                      py: 1,
                      border: '1px solid',
                      borderColor: 'primary.dark',
                      borderRadius: 1,
                      background: 'rgba(201,168,76,0.04)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: '"IM Fell English", serif',
                        fontSize: '0.875rem',
                        color: 'primary.light',
                      }}
                    >
                      {spell.label}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {improvements > 0 && (
                        <Typography
                          variant="caption"
                          sx={{ opacity: 0.45, textDecoration: 'line-through', fontFamily: '"Cinzel Decorative", serif', fontSize: '0.65rem' }}
                        >
                          {baseValue}+
                        </Typography>
                      )}
                      <Typography
                        sx={{
                          fontFamily: '"Cinzel Decorative", serif',
                          fontSize: '0.75rem',
                          color: improvements > 0 ? 'success.light' : 'primary.main',
                          fontWeight: 700,
                        }}
                      >
                        {effectiveValue}+
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
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
            {member.experience >= 5 && (
              <Chip
                label="Ready to Advance"
                size="small"
                sx={{
                  mt: 0.75,
                  fontSize: '0.65rem',
                  background: 'rgba(201,168,76,0.15)',
                  color: 'primary.main',
                  border: '1px solid',
                  borderColor: 'primary.main',
                }}
              />
            )}
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
                  (injury.type === 'missing_next_game' ||
                    (!isWarrior &&
                      ['arm_wound', 'leg_wound', 'broken_honour'].includes(
                        injury.type
                      )))
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
                            setTreatStage('options')
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
        {treatStage && company && (
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
              {/* ── Options stage ── */}
              {treatStage === 'options' && (
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

                  {treatTargetInjury === 'missing_next_game' ? (
                    <Box
                      onClick={() => setTreatType('remove_missing')}
                      sx={{
                        p: 1.25,
                        border: '1px solid',
                        borderRadius: 1,
                        cursor: 'pointer',
                        borderColor:
                          treatType === 'remove_missing'
                            ? 'primary.main'
                            : 'divider',
                        background:
                          treatType === 'remove_missing'
                            ? 'rgba(201,168,76,0.08)'
                            : 'rgba(0,0,0,0.2)',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Remove (1 IP)
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.6 }}>
                        Member returns to full duty.
                      </Typography>
                    </Box>
                  ) : (
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
                          Attempt Recovery — Roll D6 (1 IP)
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

              {/* ── Rolling stage — animated D6 ── */}
              {treatStage === 'rolling' && (
                <Box sx={{ minWidth: 260, textAlign: 'center' }}>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', opacity: 0.65, mb: 2 }}
                  >
                    Rolling D6 for recovery…
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <DieFace value={animDieValue} size={64} />
                  </Box>
                  {dieSettled && rolledValue !== null && (
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.6, display: 'block' }}
                    >
                      Settling…
                    </Typography>
                  )}
                </Box>
              )}

              {/* ── IP prompt stage ── */}
              {treatStage === 'ip_prompt' && rolledValue !== null && (
                <Box sx={{ minWidth: 260 }}>
                  {/* Show the settled die */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                    <DieFace value={rolledValue} size={56} />
                  </Box>
                  {/* Roll result summary */}
                  <Box
                    sx={{
                      textAlign: 'center',
                      p: 1.25,
                      border: '1px solid',
                      borderColor:
                        rolledValue + treatAdjust >= 5
                          ? 'success.main'
                          : 'error.main',
                      borderRadius: 1,
                      background:
                        rolledValue + treatAdjust >= 5
                          ? 'rgba(46,204,113,0.06)'
                          : 'rgba(192,57,43,0.06)',
                      mb: 1.5,
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: '"Cinzel Decorative", serif',
                        fontSize: '1.1rem',
                        color:
                          rolledValue + treatAdjust >= 5
                            ? 'success.light'
                            : 'error.light',
                      }}
                    >
                      {rolledValue}
                      {treatAdjust > 0 &&
                        ` + ${treatAdjust} = ${rolledValue + treatAdjust}`}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      {rolledValue + treatAdjust >= 5
                        ? '✓ Success — injury removed!'
                        : '✗ Failed — injury remains.'}
                    </Typography>
                  </Box>
                  {/* IP balance */}
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.65, display: 'block', mb: 1 }}
                  >
                    Company Influence: {company.influence} IP
                  </Typography>
                  {/* Post-roll IP boost controls — only shown on failure */}
                  {rolledValue + treatAdjust < 5 && (
                    <Box
                      sx={{
                        p: 1.25,
                        border: '1px solid',
                        borderColor: 'primary.dark',
                        borderRadius: 1,
                        background: 'rgba(201,168,76,0.04)',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                        Boost roll with IP (1 IP = +1)
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ minWidth: 28, p: 0.5 }}
                          disabled={treatAdjust <= 0}
                          onClick={() => setTreatAdjust((a) => Math.max(0, a - 1))}
                        >
                          −
                        </Button>
                        <Typography
                          sx={{
                            fontFamily: '"Cinzel Decorative", serif',
                            minWidth: 28,
                            textAlign: 'center',
                            fontSize: '0.8rem',
                            color: treatAdjust > 0 ? 'primary.main' : 'text.secondary',
                          }}
                        >
                          {treatAdjust > 0 ? `+${treatAdjust}` : '0'}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ minWidth: 28, p: 0.5 }}
                          disabled={company.influence < 1 + treatAdjust + 1}
                          onClick={() => setTreatAdjust((a) => a + 1)}
                        >
                          +
                        </Button>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                          Total: {rolledValue + treatAdjust} → {rolledValue + treatAdjust >= 5 ? 'Success' : 'Fail'}
                        </Typography>
                      </Box>
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
                  setTreatStage(null)
                  setTreatType(null)
                  setRolledValue(null)
                  setTreatAdjust(0)
                  setDieSettled(false)
                }}
              >
                Cancel
              </Button>

              {/* Options stage: confirm non-roll types */}
              {treatStage === 'options' &&
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
                    Confirm (1 IP)
                  </Button>
                )}

              {/* Options stage: proceed to roll */}
              {treatStage === 'options' && treatType === 'roll_hero' && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => { setTreatAdjust(0); setTreatStage('rolling') }}
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '0.62rem',
                  }}
                >
                  Roll D6 →
                </Button>
              )}

              {/* IP prompt stage: accept result */}
              {treatStage === 'ip_prompt' && rolledValue !== null && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleTreatConfirm}
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '0.62rem',
                  }}
                >
                  Accept Result ({1 + treatAdjust} IP)
                </Button>
              )}
            </DialogActions>
          </Dialog>
        )}

        {/* ── Wargear remove confirm dialog ─────────────────────────────────── */}
        <ConfirmDialog
          open={removeConfirmItem !== null}
          title="Remove Wargear"
          message={`Remove "${getWargearLabel(removeConfirmItem ?? '')}" from ${member.name}? This cannot be undone.`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          dangerous
          onConfirm={async () => {
            if (!removeConfirmItem || !company || !onSaveCompany) {
              setRemoveConfirmItem(null)
              return
            }
            const updatedMembers = company.members.map((m) =>
              m.id !== member.id
                ? m
                : { ...m, equipment: (m.equipment ?? []).filter((e) => e !== removeConfirmItem) }
            )
            await onSaveCompany({ ...company, members: updatedMembers })
            setRemoveConfirmItem(null)
          }}
          onCancel={() => setRemoveConfirmItem(null)}
        />

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
