/**
 * ToolkitAssignmentPage
 *
 * Shown between MatchSetupPage and MatchTrackingPage when the Toolkit ATO bonus
 * is selected. User picks a kit, then assigns each item to a company member.
 * Parameterised items (e.g. Envenom Weapon) prompt for their parameter.
 * All items must be assigned before proceeding.
 */

import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import PageHeader from '../components/common/PageHeader'
import { useAppContext } from '../context/AppContext'
import { TOOLKIT_KITS } from './MatchSetupPage'
import type { ToolkitItem } from '../models/match'
import wargearData from '../data/wargear.json'

// ─── Data helpers ──────────────────────────────────────────────────────────────

const WARGEAR_RAW = wargearData as Array<{
  id: string
  label: string
  category?: string
}>

function getItemLabel(id: string): string {
  return (
    WARGEAR_RAW.find((w) => w.id === id)?.label ??
    id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

// Items that need a parameter (weapon selection for Envenom Weapon etc.)
const PARAMETERISED_ITEMS: Record<
  string,
  { prompt: string; options: string[] }
> = {
  envenom_weapon: {
    prompt: 'Which weapon gains Poisoned Attacks?',
    options: [
      'hand_weapon',
      'spear',
      'two_handed_weapon',
      'bow',
      'throwing_weapon',
    ],
  },
}

function getParamLabel(itemId: string, paramValue: string): string {
  return paramValue.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ToolkitAssignmentPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const { companies, loadActiveMatch, saveActiveMatch } = useAppContext()

  const company = companies.find((c) => c.id === companyId)

  // Selected kit
  const [kitId, setKitId] = useState<string | null>(null)
  const kit = TOOLKIT_KITS.find((k) => k.id === kitId)

  // assignments[i] = { memberId, parameter? }
  const [assignments, setAssignments] = useState<
    Array<{ memberId: string; parameter?: string }>
  >([])

  // Param dialog state
  const [paramDialog, setParamDialog] = useState<{
    itemIndex: number
    memberId: string
  } | null>(null)
  const [paramValue, setParamValue] = useState('')

  // Initialise assignments array when kit changes
  useEffect(() => {
    if (kit) {
      setAssignments(kit.items.map(() => ({ memberId: '' })))
    }
  }, [kitId])

  if (!company)
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Company not found.</Typography>
      </Box>
    )

  const activeMembers = company.members.filter(
    (m) => !m.injuries.some((i) => i.type === 'missing_next_game')
  )

  const allAssigned = kit
    ? assignments.length === kit.items.length &&
      assignments.every((a) => a.memberId !== '')
    : false

  const handleAssign = (itemIndex: number, memberId: string) => {
    const itemId = kit?.items[itemIndex] ?? ''
    const paramSpec = PARAMETERISED_ITEMS[itemId]
    if (paramSpec && memberId) {
      // Need parameter — open dialog
      setParamDialog({ itemIndex, memberId })
      setParamValue(paramSpec.options[0])
    } else {
      setAssignments((prev) => {
        const next = [...prev]
        next[itemIndex] = { memberId, parameter: undefined }
        return next
      })
    }
  }

  const handleParamConfirm = () => {
    if (!paramDialog) return
    setAssignments((prev) => {
      const next = [...prev]
      next[paramDialog.itemIndex] = {
        memberId: paramDialog.memberId,
        parameter: paramValue,
      }
      return next
    })
    setParamDialog(null)
  }

  const handleProceed = async () => {
    if (!kit || !allAssigned) return
    const match = await loadActiveMatch(companyId!)
    if (!match) return

    const toolkitItems: ToolkitItem[] = assignments.map((a, i) => ({
      memberId: a.memberId,
      itemId: kit.items[i],
      parameter: a.parameter,
    }))

    await saveActiveMatch({ ...match, toolkitItems })
    navigate(`/companies/${companyId}/match`)
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Assign Kit Items"
        subtitle={company.name}
        onBack={() => navigate(`/companies/${companyId}/match/setup`)}
      />

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: { xs: 2, sm: 3 },
          py: 3,
          maxWidth: 560,
          mx: 'auto',
          width: '100%',
        }}
      >
        {/* ── Kit selection ── */}
        <SectionLabel>Choose a Kit</SectionLabel>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            mt: 1,
            mb: 3,
          }}
        >
          {TOOLKIT_KITS.map((k) => {
            const isSelected = kitId === k.id
            return (
              <Box
                key={k.id}
                onClick={() => setKitId(k.id)}
                sx={{
                  p: 1.5,
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  background: isSelected
                    ? 'rgba(201,168,76,0.08)'
                    : 'rgba(0,0,0,0.15)',
                  transition: 'all 0.15s',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: isSelected ? 'primary.main' : 'text.primary',
                    mb: 0.5,
                  }}
                >
                  {k.label}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {Array.from(new Set(k.items)).map((itemId) => {
                    const count = k.items.filter((i) => i === itemId).length
                    return (
                      <Chip
                        key={itemId}
                        label={`${count > 1 ? `${count}× ` : ''}${getItemLabel(itemId)}`}
                        size="small"
                        sx={{
                          fontSize: '0.62rem',
                          height: 18,
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid',
                          borderColor: 'divider',
                          color: 'text.secondary',
                        }}
                      />
                    )
                  })}
                </Box>
              </Box>
            )
          })}
        </Box>

        {/* ── Item assignments ── */}
        {kit && (
          <Box>
            <Divider sx={{ mb: 2, opacity: 0.3 }} />
            <SectionLabel>Assign Items to Members</SectionLabel>
            <Typography
              variant="caption"
              sx={{
                opacity: 0.55,
                fontStyle: 'italic',
                display: 'block',
                mt: 0.5,
                mb: 2,
              }}
            >
              All items must be assigned. Items are lost when the match ends.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {kit.items.map((itemId, i) => {
                const a = assignments[i] ?? { memberId: '' }
                const memberName = activeMembers.find(
                  (m) => m.id === a.memberId
                )?.name
                const paramSpec = PARAMETERISED_ITEMS[itemId]
                return (
                  <Box
                    key={i}
                    sx={{
                      p: 1.5,
                      border: '1px solid',
                      borderColor: a.memberId ? 'primary.dark' : 'divider',
                      borderRadius: 1,
                      background: 'rgba(0,0,0,0.15)',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 0.75,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {getItemLabel(itemId)}
                      </Typography>
                      {a.memberId && a.parameter && (
                        <Chip
                          label={getParamLabel(itemId, a.parameter)}
                          size="small"
                          sx={{
                            fontSize: '0.62rem',
                            height: 18,
                            background: 'rgba(201,168,76,0.1)',
                            border: '1px solid',
                            borderColor: 'primary.dark',
                            color: 'primary.light',
                          }}
                        />
                      )}
                    </Box>
                    <FormControl fullWidth size="small">
                      <InputLabel>Assign to…</InputLabel>
                      <Select
                        value={a.memberId}
                        label="Assign to…"
                        onChange={(e) => handleAssign(i, e.target.value)}
                      >
                        <MenuItem value="">
                          <em>— unassigned —</em>
                        </MenuItem>
                        {activeMembers.map((m) => (
                          <MenuItem key={m.id} value={m.id}>
                            {m.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {paramSpec && a.memberId && !a.parameter && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'warning.main',
                          display: 'block',
                          mt: 0.5,
                        }}
                      >
                        Tap member to configure parameter.
                      </Typography>
                    )}
                  </Box>
                )
              })}
            </Box>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                disabled={!allAssigned}
                onClick={handleProceed}
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: '0.75rem',
                  letterSpacing: '0.08em',
                  py: 1.5,
                }}
              >
                Begin Battle
              </Button>
              {!allAssigned && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    textAlign: 'center',
                    opacity: 0.5,
                    mt: 0.75,
                  }}
                >
                  Assign all items to proceed.
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Parameter dialog ── */}
      {paramDialog && kit && (
        <Dialog
          open
          PaperProps={{
            sx: {
              background: 'linear-gradient(160deg,#1a1008 0%,#110a03 100%)',
              border: '1px solid rgba(200,164,90,0.25)',
              borderRadius: 2,
            },
          }}
        >
          <DialogTitle
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '0.85rem',
              color: 'primary.main',
            }}
          >
            Configure {getItemLabel(kit.items[paramDialog.itemIndex])}
          </DialogTitle>
          <DialogContent>
            <Typography
              variant="caption"
              sx={{ display: 'block', opacity: 0.65, mb: 1.5 }}
            >
              {PARAMETERISED_ITEMS[kit.items[paramDialog.itemIndex]]?.prompt}
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Weapon</InputLabel>
              <Select
                value={paramValue}
                label="Weapon"
                onChange={(e) => setParamValue(e.target.value)}
              >
                {(
                  PARAMETERISED_ITEMS[kit.items[paramDialog.itemIndex]]
                    ?.options ?? []
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {getParamLabel('', opt)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setParamDialog(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleParamConfirm}
              sx={{
                fontFamily: '"Cinzel Decorative", serif',
                fontSize: '0.62rem',
              }}
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontFamily: '"Cinzel Decorative", serif',
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'primary.main',
        opacity: 0.7,
      }}
    >
      {children}
    </Typography>
  )
}
