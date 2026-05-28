import Popover from '@mui/material/Popover'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ChipPopupContent } from '../../utils/chipDescription'

export interface ChipDetailPopoverProps {
  anchorEl: HTMLElement | null
  content: ChipPopupContent | null
  onClose: () => void
}

/**
 * Page-level MUI Popover for displaying equipment/special rule chip descriptions.
 * Open when both anchorEl and content are non-null.
 * Closes on outside click or Escape key (MUI Popover default behavior).
 */
export default function ChipDetailPopover({
  anchorEl,
  content,
  onClose,
}: ChipDetailPopoverProps) {
  const open = Boolean(anchorEl) && Boolean(content)

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      disableRestoreFocus
    >
      <Box sx={{ p: 2, maxWidth: 300 }}>
        <Typography variant="subtitle2" gutterBottom>
          {content?.label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {content?.description}
        </Typography>
      </Box>
    </Popover>
  )
}
