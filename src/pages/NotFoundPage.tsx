import { useNavigate } from 'react-router-dom'
import { Box, Button, Typography } from '@mui/material'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 4,
        textAlign: 'center',
      }}
    >
      <Typography variant="h2">Lost in Middle-earth</Typography>
      <Typography
        variant="body2"
        sx={{ fontStyle: 'italic', color: 'text.secondary' }}
      >
        The path you seek does not exist in these lands.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/')} sx={{ mt: 2 }}>
        Return Home
      </Button>
    </Box>
  )
}
