import { Box, Typography, Button } from '@mui/material'
import { motion } from 'framer-motion'
import type { Alignment } from '../../models'
import { ALIGNMENTS } from '../../constants'

interface Props {
  value: Alignment | null
  onChange: (alignment: Alignment) => void
  onAdvance?: () => void
}

export default function StepAlignment({ value, onChange, onAdvance }: Props) {
  const handleSelect = (alignment: Alignment) => {
    onChange(alignment)
    onAdvance?.()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography
        variant="body2"
        sx={{ fontStyle: 'italic', opacity: 0.7, mb: 1 }}
      >
        All Battle Companies are aligned with either the Free Peoples or the
        Shadow. This determines which factions are available to you.
      </Typography>

      {ALIGNMENTS.map((opt, i) => (
        <motion.div
          key={opt.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
        >
          <Button
            fullWidth
            onClick={() => handleSelect(opt.id)}
            sx={{
              py: 2.5,
              px: 3,
              height: 'auto',
              flexDirection: 'column',
              alignItems: 'flex-start',
              textAlign: 'left',
              border: '1px solid',
              borderColor:
                value === opt.id ? opt.colour : 'rgba(200,164,90,0.18)',
              background:
                value === opt.id
                  ? `rgba(${opt.id === 'good' ? '74,124,89' : '139,58,42'},0.12)`
                  : 'transparent',
              borderRadius: 1,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: opt.colour,
                background: `rgba(${opt.id === 'good' ? '74,124,89' : '139,58,42'},0.08)`,
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                width: '100%',
                mb: 0.75,
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: opt.colour,
                  flexShrink: 0,
                  boxShadow:
                    value === opt.id ? `0 0 8px ${opt.colour}` : 'none',
                  transition: 'box-shadow 0.2s',
                }}
              />
              <Typography
                sx={{
                  fontFamily: '"Cinzel", serif',
                  fontSize: '1rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: value === opt.id ? opt.colour : 'text.primary',
                }}
              >
                {opt.label}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontFamily: '"Crimson Text", serif',
                fontSize: '0.9rem',
                fontStyle: 'italic',
                color: 'text.secondary',
                lineHeight: 1.5,
                pl: 2.5,
              }}
            >
              {opt.flavour}
            </Typography>
          </Button>
        </motion.div>
      ))}
    </Box>
  )
}
