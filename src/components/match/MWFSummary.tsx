import { Box, Typography } from '@mui/material'

export interface MWFSummaryProps {
  might: number | null
  will: number | null
  fate: number | null
}

/**
 * MWFSummary — compact inline read-only display of Might/Will/Fate values.
 * Used in PrimaryInfoRow at sm breakpoint for hero members.
 * Only renders if at least one value is non-null.
 */
export default function MWFSummary({ might, will, fate }: MWFSummaryProps) {
  if (might === null && will === null && fate === null) return null

  const stats = [
    { label: 'M', value: might },
    { label: 'W', value: will },
    { label: 'F', value: fate },
  ]

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {stats.map(
        (s) =>
          s.value !== null && (
            <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <Typography
                component="span"
                sx={{
                  fontSize: '0.6rem',
                  opacity: 0.55,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                {s.label}
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: s.value === 0 ? 'error.light' : 'primary.main',
                  lineHeight: 1,
                }}
              >
                {s.value}
              </Typography>
            </Box>
          )
      )}
    </Box>
  )
}
