import { useNavigate } from 'react-router-dom'
import { Box, Button, Typography, Divider } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import EditIcon from '@mui/icons-material/Edit'
import { motion } from 'framer-motion'

const MotionBox = motion(Box)

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        py: 6,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 50% 30%, rgba(139,105,20,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 70%, rgba(139,58,42,0.08) 0%, transparent 60%)
          `,
          pointerEvents: 'none',
        },
      }}
    >
      {/* Decorative corner marks */}
      {['top left', 'top right', 'bottom left', 'bottom right'].map((pos) => (
        <Box
          key={pos}
          sx={{
            position: 'absolute',
            width: 40,
            height: 40,
            borderTop: pos.includes('top') ? '2px solid' : 'none',
            borderBottom: pos.includes('bottom') ? '2px solid' : 'none',
            borderLeft: pos.includes('left') ? '2px solid' : 'none',
            borderRight: pos.includes('right') ? '2px solid' : 'none',
            borderColor: 'primary.dark',
            opacity: 0.4,
            top: pos.includes('top') ? 24 : 'auto',
            bottom: pos.includes('bottom') ? 24 : 'auto',
            left: pos.includes('left') ? 24 : 'auto',
            right: pos.includes('right') ? 24 : 'auto',
          }}
        />
      ))}

      <MotionBox
        variants={container}
        initial="hidden"
        animate="show"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          width: '100%',
          maxWidth: 400,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Title block */}
        <MotionBox variants={item} sx={{ textAlign: 'center', mb: 2 }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '1.8rem', sm: '2.4rem' },
              textShadow: '0 0 40px rgba(201,168,76,0.3)',
              mb: 1,
            }}
          >
            Battle Companies
          </Typography>
          <Divider
            sx={{
              width: 160,
              mx: 'auto',
              borderColor: 'primary.dark',
              '&::before, &::after': { borderColor: 'primary.dark' },
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                background: 'primary.main',
                borderRadius: '50%',
                bgcolor: 'primary.main',
              }}
            />
          </Divider>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 1.5,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontSize: '0.7rem',
              color: 'text.secondary',
            }}
          >
            MESBG Companion App
          </Typography>
        </MotionBox>

        {/* Primary actions */}
        <MotionBox
          variants={item}
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<AddIcon />}
            onClick={() => navigate('/companies/new')}
            sx={{ py: 1.5 }}
          >
            New Company
          </Button>

          <Button
            variant="outlined"
            size="large"
            fullWidth
            startIcon={<FolderOpenIcon />}
            onClick={() => navigate('/companies')}
            sx={{ py: 1.5 }}
          >
            Load Company
          </Button>
        </MotionBox>

        {/* Secondary action */}
        <MotionBox variants={item} sx={{ width: '100%' }}>
          <Divider sx={{ mb: 2, opacity: 0.4 }} />
          <Button
            variant="text"
            fullWidth
            startIcon={<EditIcon />}
            onClick={() => navigate('/stats')}
            sx={{
              py: 1,
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' },
            }}
          >
            Edit Base Unit Stats
          </Button>
        </MotionBox>

        {/* Legal note */}
        <MotionBox variants={item}>
          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              display: 'block',
              opacity: 0.5,
              lineHeight: 1.6,
            }}
          >
            An unofficial fan tool. Not affiliated with Games Workshop.
            <br />
            Requires ownership of official rulebooks.
          </Typography>
        </MotionBox>
      </MotionBox>
    </Box>
  )
}
