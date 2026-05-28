import { Box, Typography, Chip, Button, IconButton } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MWFSummary from './MWFSummary'
import type { MemberMatchState } from '../../models/match'

export interface PrimaryInfoRowProps {
  mm: MemberMatchState
  expanded: boolean
  onToggle: () => void
  onXpChange: (delta: number) => void
  onCasualtyToggle: () => void
  onMwfChange?: (stat: string, delta: number) => void
  showMwfSummary: boolean
  showMwfControls: boolean
  showXpCounter: boolean
  showChevron: boolean
}

function getRoleLabel(role: string, short: boolean): string | null {
  switch (role) {
    case 'leader':
      return short ? 'L' : 'Leader'
    case 'sergeant':
      return short ? 'S' : 'Sgt'
    case 'hero_in_making':
      return short ? 'H' : 'Hero'
    case 'wanderer':
      return short ? 'W' : 'Wanderer'
    default:
      return null
  }
}

/**
 * PrimaryInfoRow — always-visible row in a MemberMatchCard.
 * Shows member name, role chip, XP counter (+/−), casualty button,
 * optional MWF summary (sm heroes), and optional expand chevron (xs/sm).
 */
export default function PrimaryInfoRow({
  mm,
  expanded,
  onToggle,
  onXpChange,
  onCasualtyToggle,
  onMwfChange,
  showMwfSummary,
  showMwfControls,
  showXpCounter,
  showChevron,
}: PrimaryInfoRowProps) {
  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const roleLabel = getRoleLabel(mm.role, isXs)
  const ariaLabel = expanded
    ? `Collapse details for ${mm.memberName}`
    : `Expand details for ${mm.memberName}`
  const collapsePanelId = `collapse-panel-${mm.memberId}`

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
      }}
    >
      {/* Name + role chip */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
        <Typography
          variant="h6"
          sx={{
            lineHeight: 1.2,
            textDecoration: mm.isCasualty ? 'line-through' : 'none',
            opacity: mm.isCasualty ? 0.6 : 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {mm.memberName}
        </Typography>
        {roleLabel && (
          <Chip
            label={roleLabel}
            size="small"
            sx={{
              fontSize: '0.7rem',
              height: 18,
              borderColor: mm.role === 'leader' ? 'primary.main' : 'primary.dark',
              color: mm.role === 'leader' ? 'primary.main' : 'primary.light',
              border: '1px solid',
              background: 'transparent',
            }}
          />
        )}
      </Box>

      {/* MWF Summary (read-only, if enabled) */}
      {showMwfSummary && (
        <MWFSummary
          might={mm.mightCurrent}
          will={mm.willCurrent}
          fate={mm.fateCurrent}
        />
      )}

      {/* Compact inline M/W/F controls (sm breakpoint) */}
      {showMwfControls && onMwfChange && mm.mightMax !== null && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {(['might', 'will', 'fate'] as const).map((stat) => {
            const cur = mm[`${stat}Current` as keyof MemberMatchState] as number
            const max = mm[`${stat}Max` as keyof MemberMatchState] as number
            const label = stat === 'might' ? 'M' : stat === 'will' ? 'W' : 'F'
            const depleted = cur === 0
            return (
              <Box key={stat} sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <IconButton
                  size="small"
                  onClick={() => onMwfChange(stat, -1)}
                  disabled={cur <= 0}
                  aria-label={`Decrease ${stat} for ${mm.memberName}`}
                  sx={{
                    p: 0,
                    width: 20,
                    height: 20,
                    border: '1px solid',
                    borderColor: cur <= 0 ? 'rgba(255,255,255,0.1)' : 'rgba(192,57,43,0.4)',
                    borderRadius: 0.5,
                    color: 'error.light',
                    '&.Mui-disabled': { opacity: 0.25 },
                  }}
                >
                  <RemoveIcon sx={{ fontSize: 10 }} />
                </IconButton>
                <Typography
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: depleted ? 'error.light' : cur === max ? 'primary.main' : 'text.primary',
                    minWidth: 14,
                    textAlign: 'center',
                    lineHeight: 1,
                  }}
                >
                  <Typography
                    component="span"
                    sx={{ fontSize: '1rem', opacity: 0.5, mr: '1px' }}
                  >
                    {label}
                  </Typography>
                  {cur}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => onMwfChange(stat, 1)}
                  disabled={cur >= max}
                  aria-label={`Increase ${stat} for ${mm.memberName}`}
                  sx={{
                    p: 0,
                    width: 20,
                    height: 20,
                    border: '1px solid',
                    borderColor: cur >= max ? 'rgba(255,255,255,0.1)' : 'rgba(201,168,76,0.4)',
                    borderRadius: 0.5,
                    color: 'primary.light',
                    '&.Mui-disabled': { opacity: 0.25 },
                  }}
                >
                  <AddIcon sx={{ fontSize: 10 }} />
                </IconButton>
              </Box>
            )
          })}
        </Box>
      )}

      {/* XP counter (small screens only — md+ shows it at bottom) */}
      {showXpCounter && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={() => onXpChange(-1)}
          disabled={mm.xpCounterGains === 0}
          aria-label={`Decrease XP for ${mm.memberName}`}
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
          aria-label={`Increase XP for ${mm.memberName}`}
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
      )}

      {/* Casualty button */}
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
        }}
      >
        {mm.isCasualty ? 'Revive' : 'Casualty'}
      </Button>

      {/* Expand chevron (xs/sm only) */}
      {showChevron && (
        <IconButton
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={ariaLabel}
          aria-controls={collapsePanelId}
          sx={{
            p: 0.5,
            transition: 'transform 200ms ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
      )}
    </Box>
  )
}
