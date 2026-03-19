import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Box,
  Divider,
} from '@mui/material'

interface Props {
  open: boolean
  onAccept: () => void
}

export default function DisclaimerDialog({ open, onAccept }: Props) {
  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        Battle Companies
        <Typography
          variant="caption"
          display="block"
          sx={{ fontStyle: 'italic', mt: 0.5 }}
        >
          A Companion App
        </Typography>
      </DialogTitle>

      <Divider sx={{ mx: 3, borderColor: 'primary.dark' }} />

      <DialogContent sx={{ pt: 3 }}>
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            mb: 2,
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontStyle: 'italic', lineHeight: 1.8 }}
          >
            This is an unofficial, fan-made tool and is not affiliated with,
            endorsed by, or connected to Games Workshop Ltd. in any way.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.8 }}>
            Middle-earth Strategy Battle Game, Battle Companies, and all related
            names, characters, and imagery are the intellectual property of
            Games Workshop Ltd. and/or Middle-earth Enterprises.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.8 }}>
            This app does not include copyrighted game statistics. You must own
            a copy of the official Battle Companies rulebook to use this
            application.
          </Typography>
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontStyle: 'italic' }}
        >
          By continuing, you confirm that you own the relevant official
          rulebooks and understand that this is a free, unofficial fan tool.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center' }}>
        <Button
          variant="contained"
          onClick={onAccept}
          size="large"
          sx={{ minWidth: 180 }}
        >
          I Understand — Continue
        </Button>
      </DialogActions>
    </Dialog>
  )
}
