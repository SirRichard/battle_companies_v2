/**
 * StepPathSelection — SRS §6.2.11
 *
 * Shown once per hero during company creation (Leader → Sergeant 1 → Sergeant 2).
 * Delegates the swipeable card UI to PathCardSelector.
 */

import { useState, useRef, useEffect } from 'react'
import { Box, Typography, Chip, useMediaQuery, useTheme } from '@mui/material'
import PathCardSelector from '../common/PathCardSelector'
import StickyPathHeader from './StickyPathHeader'
import { getUnitLabel, getWargearLabel } from '../../utils/labels'
import pathsData from '../../data/paths.json'

const TOTAL_PATHS = pathsData.length

interface Props {
  heroName: string
  heroRole: string
  baseUnitId: string
  equipment: string[]
  baseStats?: Record<string, number>
  selectedPathId: string | null
  onSelect: (pathId: string) => void
  onCardChange?: (pathId: string) => void
}

export default function StepPathSelection({
  heroName,
  heroRole,
  baseUnitId,
  equipment,
  baseStats,
  selectedPathId,
  onSelect,
  onCardChange,
}: Props) {
  // Viewport detection for conditional sticky header rendering
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  // Lifted card index state — shared with PathCardSelector (controlled mode)
  const [cardIndex, setCardIndex] = useState(() => {
    const idx = pathsData.findIndex((p: { id: string }) => p.id === selectedPathId)
    return idx >= 0 ? idx : 0
  })

  // Track whether the static header has scrolled out of view
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHidden, setHeaderHidden] = useState(false)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky header when static header is NOT intersecting (scrolled away)
        setHeaderHidden(!entry.isIntersecting)
      },
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Navigation helpers for sticky header
  const canGoPrev = cardIndex > 0
  const canGoNext = cardIndex < TOTAL_PATHS - 1
  const goToPrev = () => { if (canGoPrev) setCardIndex(cardIndex - 1) }
  const goToNext = () => { if (canGoNext) setCardIndex(cardIndex + 1) }
  const roleLabel = heroRole === 'leader' ? 'Leader' : 'Sergeant'

  // Clamp cardIndex to valid range before passing to sticky header
  const clampedIndex = Math.max(0, Math.min(cardIndex, TOTAL_PATHS - 1))

  const header = (
    <Box
      ref={headerRef}
      sx={{
        mb: { xs: 0, md: 2 },
        pb: 1.5,
        borderBottom: { xs: 'none', md: '1px solid' },
        borderColor: 'divider',
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexWrap: 'wrap',
        gap: { xs: 0.5, sm: 1.5 },
      }}
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
          mt: { xs: 0.5, sm: 0 },
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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: { xs: 0.75, sm: 0 } }}>
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
    <>
      {isMobile && headerHidden && (
        <StickyPathHeader
          heroName={heroName}
          roleLabel={roleLabel}
          unitTypeLabel={getUnitLabel(baseUnitId)}
          equipmentLabels={equipment.map(getWargearLabel)}
          currentPathName={(pathsData[clampedIndex] as { label: string }).label}
          currentIndex={clampedIndex}
          totalPaths={TOTAL_PATHS}
          onPrev={goToPrev}
          onNext={goToNext}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
        />
      )}
      <PathCardSelector
        selectedPathId={selectedPathId}
        onSelect={onSelect}
        onCardChange={onCardChange}
        baseStats={baseStats}
        headerSlot={header}
        cardIndex={cardIndex}
        onCardIndexChange={setCardIndex}
      />
    </>
  )
}
