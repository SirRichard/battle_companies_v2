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
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useAppContext } from '../context/AppContext'
import { TOOLKIT_KITS } from './MatchSetupPage'
import type { ToolkitItem } from '../models/match'
import wargearData from '../data/wargear.json'
import baseUnitsData from '../data/baseUnits.json'
import { getWargearLabel } from '../utils/labels'
import type { Member } from '../models'

// ─── Data helpers ──────────────────────────────────────────────────────────────

const WARGEAR_RAW = wargearData as Array<{
  id: string
  label: string
  category?: string
}>

const BASE_UNITS_RAW = baseUnitsData as Array<{
  id: string
  label: string
  baseEquipment?: string[]
}>

function getItemLabel(id: string): string {
  return (
    WARGEAR_RAW.find((w) => w.id === id)?.label ??
    id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

function rankLabel(role: string): string {
  switch (role) {
    case 'leader': return 'Leader'
    case 'sergeant': return 'Sergeant'
    case 'hero_in_making': return 'Hero in the Making'
    default: return 'Warrior'
  }
}

function memberWargear(member: Member): string {
  const baseUnit = BASE_UNITS_RAW.find((u) => u.id === member.baseUnitId)
  const baseEquipment = baseUnit?.baseEquipment ?? []
  const allIds = Array.from(new Set([...baseEquipment, ...member.equipment]))
  return allIds.map(getWargearLabel).join(', ')
}

// ─── Envenom Weapon helpers ────────────────────────────────────────────────────

/**
 * Categories that are NOT weapons — items in these categories are excluded
 * from the Envenom Weapon weapon selection dialog.
 */
const NON_WEAPON_CATEGORIES = new Set([
  'armour_1', 'armour_2', 'armour_3', 'armour_4',
  'mount', 'shield', 'special',
])

/**
 * Returns all weapon-category items carried by a member (union of baseEquipment
 * and member.equipment, filtered to weapon categories from wargear.json).
 */
function getMemberWeapons(member: Member): string[] {
  const baseUnit = BASE_UNITS_RAW.find((u) => u.id === member.baseUnitId)
  const baseEquipment = baseUnit?.baseEquipment ?? []
  const allEquipment = Array.from(new Set([...baseEquipment, ...member.equipment]))
  return allEquipment.filter((itemId) => {
    const wgEntry = WARGEAR_RAW.find((w) => w.id === itemId)
    if (!wgEntry) return false
    return !NON_WEAPON_CATEGORIES.has(wgEntry.category ?? '')
  })
}

/**
 * Returns the weapon options available for a new Envenom Weapon assignment to
 * a member, excluding weapons already envenomed for that member in the current
 * assignments array.
 */
function getAvailableEnvenomOptions(
  member: Member,
  assignments: Array<{ memberId: string; parameter?: string }>,
  kitItems: string[]
): string[] {
  const allWeapons = getMemberWeapons(member)
  const alreadyEnvenomed = new Set(
    assignments
      .map((a, i) => ({ a, itemId: kitItems[i] }))
      .filter(
        ({ a, itemId }) =>
          a.memberId === member.id && itemId === 'envenom_weapon' && a.parameter
      )
      .map(({ a }) => a.parameter!)
  )
  return allWeapons.filter((w) => !alreadyEnvenomed.has(w))
}

// Items that need a parameter (weapon selection for Envenom Weapon etc.)
// Note: envenom_weapon now uses dynamic options derived from the member's equipment.
const PARAMETERISED_ITEMS: Record<
  string,
  { prompt: string; options: string[] }
> = {}

function getParamLabel(_itemId: string, paramValue: string): string {
  return getWargearLabel(paramValue)
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

  // Partial-assignment confirmation dialog state
  const [confirmPartialOpen, setConfirmPartialOpen] = useState(false)

  // Param dialog state
  const [paramDialog, setParamDialog] = useState<{
    itemIndex: number
    memberId: string
  } | null>(null)
  const [paramValue, setParamValue] = useState('')
  const [dynamicParamOptions, setDynamicParamOptions] = useState<string[] | null>(null)

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
    if (itemId === 'envenom_weapon' && memberId) {
      const member = activeMembers.find((m) => m.id === memberId)
      if (!member) return
      const options = getAvailableEnvenomOptions(member, assignments, kit!.items)
      if (options.length === 0) return // disabled — no eligible weapons
      setParamDialog({ itemIndex, memberId })
      setParamValue(options[0])
      setDynamicParamOptions(options)
    } else if (PARAMETERISED_ITEMS[itemId] && memberId) {
      // Need parameter — open dialog
      setParamDialog({ itemIndex, memberId })
      setParamValue(PARAMETERISED_ITEMS[itemId].options[0])
      setDynamicParamOptions(null)
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
    setDynamicParamOptions(null)
  }

  const handleProceed = async () => {
    if (!kit) return

    if (!allAssigned) {
      setConfirmPartialOpen(true)
      return
    }

    const match = await loadActiveMatch(companyId!)
    if (!match) return

    const toolkitItems: ToolkitItem[] = assignments
      .filter((a) => a.memberId !== '')
      .map((a, i) => ({
        memberId: a.memberId,
        itemId: kit.items[i],
        parameter: a.parameter,
      }))

    const updatedMatch = { ...match, toolkitItems }
    await saveActiveMatch(updatedMatch)

    // If wanderer ATO bonus is also selected, go to wanderer selection next
    if (updatedMatch.atoBonuses.includes('wanderer')) {
      navigate(`/companies/${companyId}/match/wanderer`)
    } else {
      navigate(`/companies/${companyId}/match`)
    }
  }

  const handleConfirmPartial = async () => {
    if (!kit) return
    setConfirmPartialOpen(false)

    const match = await loadActiveMatch(companyId!)
    if (!match) return

    const assignedItems = assignments
      .map((a, i) => ({ a, itemId: kit.items[i] }))
      .filter(({ a }) => a.memberId !== '')

    const toolkitItems: ToolkitItem[] = assignedItems.map(({ a, itemId }) => ({
      memberId: a.memberId,
      itemId,
      parameter: a.parameter,
    }))

    const updatedMatch = { ...match, toolkitItems }
    await saveActiveMatch(updatedMatch)

    if (updatedMatch.atoBonuses.includes('wanderer')) {
      navigate(`/companies/${companyId}/match/wanderer`)
    } else {
      navigate(`/companies/${companyId}/match`)
    }
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
            {!assignments.some((a) => a.memberId !== '') && (
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
                Assign items to members. Unassigned items will be lost.
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {kit.items.map((itemId, i) => {
                const a = assignments[i] ?? { memberId: '' }
                const isEnvenomWeapon = itemId === 'envenom_weapon'
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
                        {activeMembers.map((m) => {
                          // For envenom_weapon, check eligibility per member
                          let disabledReason: string | null = null
                          if (isEnvenomWeapon) {
                            const memberWeapons = getMemberWeapons(m)
                            if (memberWeapons.length === 0) {
                              disabledReason = 'No eligible weapons'
                            } else {
                              const available = getAvailableEnvenomOptions(m, assignments, kit.items)
                              if (available.length === 0) {
                                disabledReason = 'All weapons already envenomed'
                              }
                            }
                          }
                          return (
                            <MenuItem
                              key={m.id}
                              value={m.id}
                              disabled={disabledReason !== null}
                            >
                              <Box>
                                <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                                  {m.name} · {rankLabel(m.role)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'text.secondary', lineHeight: 1.2, display: 'block' }}
                                >
                                  {memberWargear(m) || '—'}
                                </Typography>
                                {disabledReason && (
                                  <Typography
                                    variant="caption"
                                    sx={{ color: 'warning.main', lineHeight: 1.2, display: 'block' }}
                                  >
                                    {disabledReason}
                                  </Typography>
                                )}
                              </Box>
                            </MenuItem>
                          )
                        })}
                      </Select>
                    </FormControl>
                  </Box>
                )
              })}
            </Box>

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                disabled={!kit}
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
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Partial-assignment confirmation dialog ── */}
      <ConfirmDialog
        open={confirmPartialOpen}
        title="Unassigned Items"
        message="Not all kit items have been assigned. Unassigned items will be lost and cannot be recovered. Do you want to proceed anyway?"
        confirmLabel="Proceed Anyway"
        onConfirm={handleConfirmPartial}
        onCancel={() => setConfirmPartialOpen(false)}
      />

      {/* ── Parameter dialog ── */}
      {paramDialog && kit && (        <Dialog
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
              {kit.items[paramDialog.itemIndex] === 'envenom_weapon'
                ? 'Which weapon gains Poisoned Attacks?'
                : PARAMETERISED_ITEMS[kit.items[paramDialog.itemIndex]]?.prompt}
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Weapon</InputLabel>
              <Select
                value={paramValue}
                label="Weapon"
                onChange={(e) => setParamValue(e.target.value)}
              >
                {(
                  dynamicParamOptions ??
                  PARAMETERISED_ITEMS[kit.items[paramDialog.itemIndex]]?.options ??
                  []
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {getWargearLabel(opt)}
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
                setDynamicParamOptions(null)
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
