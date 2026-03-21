/**
 * MemberDetailsDrawer
 *
 * Slides up from the bottom to show full details for a single company member.
 * Covers: stats grid with colour-coded modifiers, equipment, M/W/F for heroes,
 * XP progress bar, injuries, special rules, point value, editable name.
 */

import { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Drawer,
  IconButton,
  TextField,
  Chip,
  LinearProgress,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import type { Member, StoredBaseUnitStats } from '../../models'
import { getUnitLabel, getWargearLabel } from '../../utils/labels'
import { calcMemberRating } from '../../utils/rating'
import pathsData from '../../data/paths.json'

// ─── Path helpers ─────────────────────────────────────────────────────────────

interface PathDef {
  id: string
  label: string
  heroicAction?: string
}
const ALL_PATHS = pathsData as unknown as PathDef[]

function getPathLabel(pathId: string): string {
  return (
    ALL_PATHS.find((p) => p.id === pathId)?.label ?? pathId.replace(/_/g, ' ')
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  member: Member | null
  baseStats: StoredBaseUnitStats | undefined
  open: boolean
  onClose: () => void
  onRename: (memberId: string, newName: string) => void
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
}: Props) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  const handleEditName = () => {
    setNameInput(member?.name ?? '')
    setEditingName(true)
  }

  const handleSaveName = useCallback(() => {
    const trimmed = nameInput.trim()
    if (trimmed && member && trimmed !== member.name) {
      onRename(member.id, trimmed)
    }
    setEditingName(false)
  }, [nameInput, member, onRename])

  if (!member) return null

  const isHero = member.role !== 'warrior'
  const rating = calcMemberRating(member, baseStats)

  // Build effective stat values: base + increases + decreases (injuries)
  const base = baseStats?.stats
  const effectiveStats = base
    ? STAT_DEFS.map(({ key, label, isTargetNumber }) => {
        const baseVal = base[key] ?? 0
        const increase = (member.statIncreases ?? {})[key] ?? 0
        const decrease = (member.statDecreases ?? {})[key] ?? 0
        const effectiveVal = baseVal + increase - decrease

        // Colour: target-number stats improve by going DOWN, regular stats improve by going UP
        let colour: 'inherit' | 'success.main' | 'error.main' = 'inherit'
        if (isTargetNumber) {
          if (effectiveVal < baseVal) colour = 'success.main'
          else if (effectiveVal > baseVal) colour = 'error.main'
        } else {
          if (effectiveVal > baseVal) colour = 'success.main'
          else if (effectiveVal < baseVal) colour = 'error.main'
        }

        return {
          key,
          label,
          isTargetNumber: isTargetNumber ?? false,
          baseVal,
          effectiveVal,
          colour,
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
      onClose={onClose}
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
                  if (e.key === 'Escape') setEditingName(false)
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

        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary', flexShrink: 0, mt: 0.5 }}
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
                ({ key, label, isTargetNumber, effectiveVal, colour }, idx) => (
                  <Box
                    key={key}
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
                  </Box>
                )
              )}
            </Box>
            {effectiveStats.some((s) => s.colour !== 'inherit') && (
              <Box sx={{ display: 'flex', gap: 2, mt: 0.75, px: 0.25 }}>
                <Legend colour="success.main" label="Above base" />
                <Legend colour="error.main" label="Below base" />
              </Box>
            )}
          </Box>
        )}

        {/* ── Equipment ────────────────────────────────────────────────────── */}
        <Box sx={{ mb: 2.5 }}>
          <SectionLabel>Equipment</SectionLabel>
          {member.equipment.length === 0 ? (
            <Typography
              variant="caption"
              sx={{
                opacity: 0.5,
                fontStyle: 'italic',
                mt: 0.5,
                display: 'block',
              }}
            >
              No equipment
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
              {member.equipment.map((eq) => (
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

        {/* ── Special Rules ─────────────────────────────────────────────────── */}
        {member.specialRules.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <SectionLabel>Special Rules</SectionLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
              {member.specialRules.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  size="small"
                  sx={{
                    fontSize: '0.72rem',
                    borderColor: 'primary.dark',
                    color: 'primary.light',
                    border: '1px solid',
                    background: 'rgba(201,168,76,0.05)',
                  }}
                />
              ))}
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
              {member.injuries.map((injury, i) => (
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
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.7, fontStyle: 'normal' }}
                  >
                    {INJURY_DESCRIPTIONS[injury.type]}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Bottom safe area */}
        <Box sx={{ height: 16 }} />
      </Box>
    </Drawer>
  )
}

// ─── Small sub-components ─────────────────────────────────────────────────────

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
