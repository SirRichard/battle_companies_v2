/**
 * StepPathSelection — SRS §6.2.11
 *
 * Shown once per hero during company creation (Leader → Sergeant 1 → Sergeant 2).
 * Delegates the swipeable card UI to PathCardSelector.
 */

import { Box, Typography, Chip } from '@mui/material'
import PathCardSelector from '../common/PathCardSelector'
import { getUnitLabel, getWargearLabel } from '../../utils/labels'

interface Props {
  heroName: string
  heroRole: string
  baseUnitId: string
  equipment: string[]
  baseStats?: Record<string, number>
  selectedPathId: string | null
  onSelect: (pathId: string) => void
}

export default function StepPathSelection({
  heroName,
  heroRole,
  baseUnitId,
  equipment,
  baseStats,
  selectedPathId,
  onSelect,
}: Props) {
  const roleLabel = heroRole === 'leader' ? 'Leader' : 'Sergeant'

  const header = (
    <Box
      sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Typography variant="body2" sx={{ opacity: 0.6, fontStyle: 'italic' }}>
        Choosing path for
      </Typography>
      <Typography
        sx={{
          fontFamily: '"Cinzel Decorative", serif',
          fontSize: '1rem',
          color: 'primary.main',
        }}
      >
        {heroName}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 0.5,
          mt: 0.5,
        }}
      >
        <Typography variant="caption" sx={{ opacity: 0.65 }}>
          {roleLabel}
        </Typography>
        {baseUnitId && (
          <>
            <Typography variant="caption" sx={{ opacity: 0.35 }}>
              ·
            </Typography>
            <Typography
              variant="caption"
              sx={{ opacity: 0.8, fontStyle: 'italic' }}
            >
              {getUnitLabel(baseUnitId)}
            </Typography>
          </>
        )}
      </Box>
      {equipment.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
          {equipment.map((eq) => (
            <Chip
              key={eq}
              label={getWargearLabel(eq)}
              size="small"
              sx={{
                fontSize: '0.62rem',
                height: 20,
                background: 'rgba(201,168,76,0.06)',
                border: '1px solid rgba(201,168,76,0.2)',
                color: 'text.secondary',
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  )

  return (
    <PathCardSelector
      selectedPathId={selectedPathId}
      onSelect={onSelect}
      baseStats={baseStats}
      headerSlot={header}
    />
  )
}
