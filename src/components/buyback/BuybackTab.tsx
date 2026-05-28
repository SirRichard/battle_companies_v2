import { useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListSubheader,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import RestoreIcon from '@mui/icons-material/Restore'
import type { Member, RemovalEntry } from '../../models'
import { groupRemovalLog } from '../../utils/removalLog'
import { wouldExceedCapacity } from '../../utils/equipmentCapacity'
import wargearData from '../../data/wargear.json'
import equipmentData from '../../data/equipment.json'

const WARGEAR = wargearData as Array<{ id: string; label: string }>
const EQUIPMENT = equipmentData as Array<{ id: string; label: string }>

export interface BuybackTabProps {
  removalLog: RemovalEntry[] | undefined
  members: Member[]
  onRestore: (entryId: string) => void
}

/** Resolve an item ID to a human-readable label. */
function getItemLabel(itemId: string, itemType: 'wargear' | 'equipment'): string {
  if (itemType === 'wargear') {
    return WARGEAR.find((w) => w.id === itemId)?.label ?? humanise(itemId)
  }
  // Equipment: check equipment.json first, then wargear.json as fallback
  return (
    EQUIPMENT.find((e) => e.id === itemId)?.label ??
    WARGEAR.find((w) => w.id === itemId)?.label ??
    humanise(itemId)
  )
}

function humanise(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

/** Simple relative time formatter (no external dependency). */
function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then

  if (isNaN(then)) return 'unknown'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`

  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

export default function BuybackTab({ removalLog, members, onRestore }: BuybackTabProps) {
  const log = removalLog ?? []
  const grouped = useMemo(() => groupRemovalLog(log), [log])

  const memberMap = useMemo(() => {
    const map = new Map<string, Member>()
    for (const m of members) map.set(m.id, m)
    return map
  }, [members])

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 3, maxWidth: 900, mx: 'auto' }}>
      {/* Persistent info banner */}
      <Alert severity="info" sx={{ mb: 2 }}>
        Items in the buyback log are cleared when a match is completed.
      </Alert>

      {/* Empty state */}
      {log.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body1" sx={{ opacity: 0.6 }}>
            No items available for buyback.
          </Typography>
        </Box>
      )}

      {/* Grouped list */}
      {grouped.length > 0 && (
        <List disablePadding>
          {grouped.map((group) => (
            <Box key={group.memberName}>
              <ListSubheader
                disableSticky
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: '0.75rem',
                  letterSpacing: '0.05em',
                  background: 'transparent',
                  color: 'text.secondary',
                  px: 0,
                  pt: 2,
                  pb: 0.5,
                }}
              >
                {group.memberName}
              </ListSubheader>
              {group.entries.map((entry) => {
                const member = memberMap.get(entry.memberId)
                const memberGone = !member
                const capacityExceeded =
                  !memberGone && wouldExceedCapacity(member!, entry.itemId, entry.itemType)
                const disabled = memberGone || capacityExceeded

                return (
                  <ListItem
                    key={entry.id}
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      px: 1,
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ListItemText
                        primary={getItemLabel(entry.itemId, entry.itemType)}
                        secondary={formatRelativeTime(entry.removedAt)}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      <Chip
                        label={entry.itemType}
                        size="small"
                        sx={{ fontSize: '0.6rem', height: 20 }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RestoreIcon sx={{ fontSize: '0.9rem' }} />}
                        disabled={disabled}
                        onClick={() => onRestore(entry.id)}
                        sx={{ flexShrink: 0, fontSize: '0.65rem' }}
                      >
                        Restore
                      </Button>
                    </Box>
                    {/* Inline disabled messages */}
                    {memberGone && (
                      <Typography
                        variant="caption"
                        color="error"
                        sx={{ mt: 0.5, pl: 1 }}
                      >
                        Member no longer in company
                      </Typography>
                    )}
                    {capacityExceeded && (
                      <Typography
                        variant="caption"
                        color="warning.main"
                        sx={{ mt: 0.5, pl: 1 }}
                      >
                        Insufficient equipment capacity
                      </Typography>
                    )}
                  </ListItem>
                )
              })}
            </Box>
          ))}
        </List>
      )}
    </Box>
  )
}
