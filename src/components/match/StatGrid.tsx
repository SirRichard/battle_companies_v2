import { Box, Typography } from '@mui/material'
import type { MemberStats } from '../../models'

/**
 * Ordered stat definitions for the 9-stat grid.
 * Row 1: Mv, Fv, Sv, S, D (columns 1–5)
 * Row 2: A, W, C, I (columns 1–4), column 5 empty
 */
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

export interface StatGridProps {
  baseStats: Record<string, number>
  statIncreases: Partial<MemberStats>
  statDecreases: Partial<MemberStats>
  equipmentBonuses: Partial<MemberStats>
}

/** Target-number stats where lower is better */
const isTargetNumber = (key: string) =>
  key === 'shoot' || key === 'courage' || key === 'intelligence'

/**
 * StatGrid — CSS Grid layout for 9 stats on xs viewport.
 * 5 columns, 2 rows. Each cell: label above value, center-aligned.
 * Reuses stat formatting/colouring logic from MemberMatchCard.
 */
export default function StatGrid({
  baseStats,
  statIncreases,
  statDecreases,
  equipmentBonuses,
}: StatGridProps) {
  const effectiveVal = (key: string, raw: number): number => {
    const inc = (statIncreases as Record<string, number | undefined>)[key] ?? 0
    const dec = (statDecreases as Record<string, number | undefined>)[key] ?? 0
    const eq = (equipmentBonuses as Record<string, number | undefined>)[key] ?? 0
    return raw + inc - dec + eq
  }

  const formatStat = (key: string, raw: number): string => {
    const val = effectiveVal(key, raw)
    if (key === 'move') return `${val}"`
    if (isTargetNumber(key)) return `${val}+`
    return String(val)
  }

  const statColour = (key: string, raw: number): string | undefined => {
    const eq = (equipmentBonuses as Record<string, number | undefined>)[key] ?? 0
    const base = raw + eq
    const eff = effectiveVal(key, raw)
    if (eff === base) return undefined
    // For target-numbers: lower is better → green when eff < base
    if (isTargetNumber(key)) return eff < base ? '#2ecc71' : '#e74c3c'
    return eff > base ? '#2ecc71' : '#e74c3c'
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gridTemplateRows: 'auto auto',
        gap: 0.5,
        mb: 1,
      }}
    >
      {ALL_STATS.map(({ key, label }) => {
        const raw = baseStats[key]
        if (raw === undefined || raw === null) return null
        const display = formatStat(key, raw)
        const colour = statColour(key, raw)
        const eqBonus = (equipmentBonuses as Record<string, number | undefined>)[key] ?? 0
        const highlighted = !!colour || eqBonus > 0
        return (
          <Box
            key={key}
            sx={{
              textAlign: 'center',
              px: 0.5,
              py: 0.25,
              border: '1px solid',
              borderColor: colour
                ? colour === '#2ecc71'
                  ? 'success.dark'
                  : 'error.dark'
                : highlighted
                  ? 'primary.dark'
                  : 'divider',
              borderRadius: 0.5,
              background: colour
                ? colour === '#2ecc71'
                  ? 'rgba(46,204,113,0.08)'
                  : 'rgba(231,76,60,0.08)'
                : highlighted
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
                color: colour ?? 'inherit',
              }}
            >
              {display}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
