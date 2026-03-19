import { useNavigate } from 'react-router-dom'
import { Box, IconButton, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

interface Props {
  title: string
  subtitle?: string
  backTo?: string
  onBack?: () => void
  action?: React.ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  backTo,
  onBack,
  action,
}: Props) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (backTo) {
      navigate(backTo)
    } else {
      navigate(-1)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: { xs: 2, sm: 3 },
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        background:
          'linear-gradient(180deg, rgba(42,26,10,0.95) 0%, rgba(26,15,5,0.95) 100%)',
        backdropFilter: 'blur(4px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        minHeight: 64,
      }}
    >
      {(backTo || onBack) && (
        <IconButton
          onClick={handleBack}
          sx={{
            color: 'primary.main',
            minWidth: 44,
            minHeight: 44,
            '&:hover': { background: 'rgba(201,168,76,0.1)' },
          }}
          aria-label="Back"
        >
          <ArrowBackIcon />
        </IconButton>
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: '1.1rem', sm: '1.4rem' },
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  )
}
