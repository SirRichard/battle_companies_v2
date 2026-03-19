import { Outlet } from 'react-router-dom'
import { Box } from '@mui/material'
import DisclaimerDialog from './DisclaimerDialog'
import { useAppContext } from '../../context/AppContext'

export default function AppLayout() {
  const { hasSeenDisclaimer, markDisclaimerSeen, isLoading } = useAppContext()

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Box
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            color: 'primary.main',
            fontSize: '1.5rem',
            letterSpacing: '0.1em',
            animation: 'pulse 2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.4 },
            },
          }}
        >
          Battle Companies
        </Box>
        <Box
          sx={{
            color: 'text.secondary',
            fontStyle: 'italic',
            fontSize: '0.875rem',
          }}
        >
          Mustering the warband…
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <DisclaimerDialog
        open={!hasSeenDisclaimer}
        onAccept={markDisclaimerSeen}
      />
      <Outlet />
    </Box>
  )
}
