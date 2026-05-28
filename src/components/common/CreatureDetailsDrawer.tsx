/**
 * CreatureDetailsDrawer
 *
 * Slides up from the bottom to show full details for a creature.
 * Displays: stats grid (same format as MemberDetailsDrawer), special rules
 * as clickable chips with description popups, and creature description text.
 */

import { useState, type ReactNode } from 'react'
import {
  Box,
  Typography,
  Drawer,
  IconButton,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import creaturesData from '../../data/creatures.json'
import specialRulesData from '../../data/specialRules.json'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreatureData {
  id: string
  label: string
  keywords: string[]
  baseSize: number
  pointsCost: number
  influenceCost: number
  stats: {
    move: number
    fight: number
    shoot: number | null
    strength: number
    defence: number
    attacks: number
    wounds: number
    courage: number | null
    intelligence: number
  }
  specialRules: string[]
  description: string
  onTheirOwnPath: boolean
}

interface CreatureDetailsDrawerProps {
  creatureId: string | null
  open: boolean
  onClose: () => void
}

// ─── Data lookups ─────────────────────────────────────────────────────────────

const ALL_CREATURES = creaturesData as CreatureData[]

const CREATURES_BY_ID = ALL_CREATURES.reduce<Record<string, CreatureData>>((acc, c) => {
  acc[c.id] = c
  return acc
}, {})

// Rule description lookup by ID
const SPECIAL_RULES_BY_ID = (
  specialRulesData as Array<{ id: string; label: string; description: string }>
).reduce<Record<string, { label: string; description: string }>>((acc, r) => {
  acc[r.id] = { label: r.label, description: r.description }
  return acc
}, {})

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
  val: number | null,
  isTargetNumber: boolean,
  key: StatKey
): string {
  if (val === null) return '-'
  if (key === 'move') return `${val}"`
  if (isTargetNumber) return `${val}+`
  return `${val}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreatureDetailsDrawer({
  creatureId,
  open,
  onClose,
}: CreatureDetailsDrawerProps) {
  // Rule info popup state
  const [rulePopup, setRulePopup] = useState<{
    label: string
    description: string
  } | null>(null)

  const creature = creatureId ? CREATURES_BY_ID[creatureId] : null

  if (!creature) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: { borderRadius: '16px 16px 0 0', background: '#1a1008', p: 2 },
        }}
      >
        <Typography sx={{ textAlign: 'center', opacity: 0.4, py: 4 }}>
          No creature selected.
        </Typography>
      </Drawer>
    )
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
          <Typography
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '1.1rem',
              color: 'primary.main',
              lineHeight: 1.3,
            }}
          >
            {creature.label}
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
            {creature.keywords.map((kw) => (
              <Chip
                key={kw}
                label={kw.charAt(0).toUpperCase() + kw.slice(1)}
                size="small"
                sx={{
                  fontSize: '0.65rem',
                  borderColor: 'divider',
                  color: 'text.secondary',
                  border: '1px solid',
                  background: 'transparent',
                }}
              />
            ))}
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontStyle: 'normal' }}
            >
              {creature.pointsCost} pts
            </Typography>
          </Box>
        </Box>

        <IconButton
          onClick={onClose}
          size="small"
          sx={{ flexShrink: 0, mt: 0.5, color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Scrollable body */}
      <Box sx={{ overflow: 'auto', flex: 1, px: 2.5, py: 2 }}>
        {/* ── Stat grid ────────────────────────────────────────────────────── */}
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
            {STAT_DEFS.map(({ key, label, isTargetNumber }, idx) => {
              const val = creature.stats[key]
              return (
                <Box
                  key={key}
                  sx={{
                    flex: { xs: '0 0 20%', sm: 1 },
                    minWidth: 32,
                    textAlign: 'center',
                    py: 0.75,
                    px: 0.25,
                    borderLeft: idx === 0 ? 'none' : '1px solid',
                    borderColor: 'divider',
                    background: 'rgba(0,0,0,0.2)',
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
                      color: 'text.primary',
                      lineHeight: 1,
                    }}
                  >
                    {formatStatValue(val, isTargetNumber ?? false, key)}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* ── Special Rules ─────────────────────────────────────────────────── */}
        {creature.specialRules.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <SectionLabel>Special Rules</SectionLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
              {creature.specialRules.map((ruleId) => {
                const ruleData = SPECIAL_RULES_BY_ID[ruleId]
                const displayLabel = ruleData
                  ? ruleData.label
                  : ruleId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                const desc = ruleData?.description

                return (
                  <Chip
                    key={ruleId}
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
        )}

        {/* ── Description ──────────────────────────────────────────────────── */}
        {creature.description && (
          <Box sx={{ mb: 2.5 }}>
            <SectionLabel>Description</SectionLabel>
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                opacity: 0.85,
                lineHeight: 1.65,
                whiteSpace: 'pre-line',
              }}
            >
              {creature.description}
            </Typography>
          </Box>
        )}

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
                sx={{ opacity: 0.85, lineHeight: 1.65, whiteSpace: 'pre-line' }}
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
