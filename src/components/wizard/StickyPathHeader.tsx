import ReactDOM from 'react-dom'
import { Box, IconButton, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

export interface StickyPathHeaderProps {
  heroName: string
  roleLabel: string
  unitTypeLabel: string
  equipmentLabels: string[]
  currentPathName: string
  currentIndex: number
  totalPaths: number
  onPrev: () => void
  onNext: () => void
  canGoPrev: boolean
  canGoNext: boolean
}

export default function StickyPathHeader({
  heroName,
  roleLabel,
  unitTypeLabel,
  equipmentLabels,
  currentPathName,
  currentIndex,
  totalPaths,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
}: StickyPathHeaderProps) {
  // SSR/test safety: bail if document.body unavailable
  if (typeof document === 'undefined' || !document.body) {
    return null
  }

  const content = (
    <Box
      data-testid="sticky-path-header"
      sx={{
        position: 'fixed',
        top: 56,
        left: 0,
        right: 0,
        zIndex: 5,
        backgroundColor: 'rgba(26,15,5,0.98)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        px: 2,
        py: '4px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* Hero_Info_Line */}
      <Typography
        data-testid="hero-info-line"
        variant="body2"
        sx={{
          fontSize: '0.75rem',
          whiteSpace: 'normal',
          textAlign: 'center',
          py: '4px',
        }}
      >
        {heroName || 'Hero'} · {roleLabel} · {unitTypeLabel}
        {equipmentLabels.length > 0 && ` · ${equipmentLabels.join(', ')}`}
      </Typography>

      {/* Path_Nav_Line */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          py: '4px',
        }}
      >
        <IconButton
          size="small"
          disabled={!canGoPrev}
          onClick={onPrev}
          aria-label="Previous path"
          sx={{
            p: 0.5,
            color: 'primary.main',
            border: '1px solid',
            borderColor: canGoPrev ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.15)',
            borderRadius: 1,
            opacity: canGoPrev ? 1 : 0.4,
            '&:hover': { background: 'rgba(201,168,76,0.1)' },
          }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Typography
          variant="body2"
          sx={{ fontSize: '0.75rem', mx: 1.5 }}
        >
          {currentPathName} ({currentIndex + 1} of {totalPaths})
        </Typography>
        <IconButton
          size="small"
          disabled={!canGoNext}
          onClick={onNext}
          aria-label="Next path"
          sx={{
            p: 0.5,
            color: 'primary.main',
            border: '1px solid',
            borderColor: canGoNext ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.15)',
            borderRadius: 1,
            opacity: canGoNext ? 1 : 0.4,
            '&:hover': { background: 'rgba(201,168,76,0.1)' },
          }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  )

  return ReactDOM.createPortal(content, document.body)
}
