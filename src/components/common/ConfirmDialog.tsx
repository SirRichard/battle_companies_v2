import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  dangerous?: boolean
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  dangerous = false,
}: Props) {
  return (
    <Dialog open={open} maxWidth="xs" fullWidth onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button variant="outlined" onClick={onCancel} sx={{ minHeight: 44 }}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{
            minHeight: 44,
            ...(dangerous && {
              background: 'linear-gradient(180deg, #C0392B 0%, #8B1A10 100%)',
              borderColor: '#C0392B',
              color: '#fff',
              '&:hover': {
                background: 'linear-gradient(180deg, #E74C3C 0%, #A0201A 100%)',
              },
            }),
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
