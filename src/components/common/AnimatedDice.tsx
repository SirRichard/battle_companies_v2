/**
 * AnimatedDice — animates a 2D6 roll and settles on a final value.
 * Used in post-match injury resolution and hero advancement screens.
 */

import { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  /** The final settled value (2-12). Pass null to keep animating. */
  finalValue: number | null
  /** Size in px of each die face. Default 44. */
  dieSize?: number
  /** Called when the animation finishes settling. Passes the individual die values. */
  onSettled?: (die1: number, die2: number) => void
  /** Label shown below the dice (e.g. hero name). */
  label?: string
}

const MotionBox = motion(Box)

function DieFace({ value, size }: { value: number; size: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        border: '2px solid',
        borderColor: 'primary.main',
        borderRadius: 1.5,
        background: 'linear-gradient(145deg, #2a1a0a 0%, #1a0f03 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow:
          '0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(201,168,76,0.15)',
      }}
    >
      <Typography
        sx={{
          fontFamily: '"Cinzel Decorative", serif',
          fontSize: size * 0.38,
          fontWeight: 700,
          color: 'primary.main',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

export { DieFace }
export default function AnimatedDice({
  finalValue,
  dieSize = 48,
  onSettled,
  label,
}: Props) {
  const [die1, setDie1] = useState(Math.ceil(Math.random() * 6))
  const [die2, setDie2] = useState(Math.ceil(Math.random() * 6))
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (finalValue === null) {
      // Keep rolling
      const interval = setInterval(() => {
        setDie1(Math.ceil(Math.random() * 6))
        setDie2(Math.ceil(Math.random() * 6))
      }, 80)
      return () => clearInterval(interval)
    }

    // Slow down and settle
    setSettled(false)
    let count = 0
    const totalFlashes = 10
    const flash = () => {
      count++
      const delay = 80 + (count / totalFlashes) * 240
      if (count < totalFlashes) {
        setDie1(Math.ceil(Math.random() * 6))
        setDie2(Math.ceil(Math.random() * 6))
        setTimeout(flash, delay)
      } else {
        // Split finalValue across two dice (randomise the split)
        const d1 = Math.max(
          1,
          Math.min(6, Math.ceil(Math.random() * (finalValue - 1)))
        )
        const d2 = finalValue - d1
        const clampedD2 = Math.max(1, Math.min(6, d2))
        const adjustedD1 = finalValue - clampedD2
        const finalD1 = Math.max(1, Math.min(6, adjustedD1))
        const finalD2 = clampedD2
        setDie1(finalD1)
        setDie2(finalD2)
        setSettled(true)
        onSettled?.(finalD1, finalD2)
      }
    }
    setTimeout(flash, 80)
  }, [finalValue])

  const total = die1 + die2

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <MotionBox
          animate={!settled ? { rotate: [0, -8, 8, 0] } : { rotate: 0 }}
          transition={
            !settled ? { repeat: Infinity, duration: 0.3 } : { duration: 0.1 }
          }
        >
          <DieFace value={die1} size={dieSize} />
        </MotionBox>

        <Typography
          sx={{
            fontSize: '1.1rem',
            opacity: 0.5,
            fontFamily: '"Cinzel Decorative", serif',
          }}
        >
          +
        </Typography>

        <MotionBox
          animate={!settled ? { rotate: [0, 8, -8, 0] } : { rotate: 0 }}
          transition={
            !settled
              ? { repeat: Infinity, duration: 0.3, delay: 0.15 }
              : { duration: 0.1 }
          }
        >
          <DieFace value={die2} size={dieSize} />
        </MotionBox>

        <Typography
          sx={{
            fontSize: '1.1rem',
            opacity: 0.5,
            fontFamily: '"Cinzel Decorative", serif',
          }}
        >
          =
        </Typography>

        <AnimatePresence mode="wait">
          <MotionBox
            key={settled ? 'settled' : 'rolling'}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Box
              sx={{
                width: dieSize + 8,
                height: dieSize,
                border: '2px solid',
                borderColor: settled ? 'primary.main' : 'rgba(201,168,76,0.3)',
                borderRadius: 1.5,
                background: settled
                  ? 'linear-gradient(145deg, #3a2510 0%, #2a1a08 100%)'
                  : 'rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: settled ? '0 0 12px rgba(201,168,76,0.25)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: dieSize * 0.4,
                  fontWeight: 700,
                  color: settled ? 'primary.main' : 'text.secondary',
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                {total}
              </Typography>
            </Box>
          </MotionBox>
        </AnimatePresence>
      </Box>

      {label && (
        <Typography
          variant="caption"
          sx={{ opacity: 0.6, fontStyle: 'italic' }}
        >
          {label}
        </Typography>
      )}
    </Box>
  )
}
