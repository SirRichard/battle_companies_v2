import { Box, Typography, Button } from '@mui/material'
import { motion } from 'framer-motion'
import { FACTIONS } from '../../constants'
import type { Alignment } from '../../models'

interface Props {
  alignment: Alignment
  value: string | null
  onChange: (factionId: string) => void
  onAdvance?: () => void
}

export default function StepFaction({
  alignment,
  value,
  onChange,
  onAdvance,
}: Props) {
  const available = FACTIONS.filter((f) => f.alignment === alignment)

  const handleSelect = (factionId: string) => {
    onChange(factionId)
    onAdvance?.()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        variant="body2"
        sx={{ fontStyle: 'italic', opacity: 0.7, mb: 1 }}
      >
        Choose the realm your company hails from.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
        }}
      >
        {available.map((faction, i) => (
          <motion.div
            key={faction.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
          >
            <Button
              fullWidth
              onClick={() => handleSelect(faction.id)}
              sx={{
                py: 1.75,
                px: 2.5,
                height: '100%',
                minHeight: 56,
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid',
                borderColor:
                  value === faction.id
                    ? 'primary.main'
                    : 'rgba(200,164,90,0.18)',
                background:
                  value === faction.id
                    ? 'rgba(200,164,90,0.12)'
                    : 'transparent',
                borderRadius: 1,
                transition: 'all 0.18s ease',
                '&:hover': {
                  borderColor: 'rgba(200,164,90,0.55)',
                  background: 'rgba(200,164,90,0.06)',
                },
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.88rem',
                  fontWeight: value === faction.id ? 700 : 500,
                  letterSpacing: '0.05em',
                  color: value === faction.id ? 'primary.main' : 'text.primary',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                {faction.label}
              </Typography>
            </Button>
          </motion.div>
        ))}
      </Box>
    </Box>
  )
}
