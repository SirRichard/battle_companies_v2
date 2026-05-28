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
  IconButton,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import PageHeader from '../components/common/PageHeader'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { getProceedButtonLabel } from '../utils/proceedButtonLabel'
import { useAppContext } from '../context/AppContext'
import { TOOLKIT_KITS, getToolkitCount } from './MatchSetupPage'
import type { ToolkitItem } from '../models/match'
import wargearData from '../data/wargear.json'
import baseUnitsData from '../data/baseUnits.json'
import equipmentData from '../data/equipment.json'
import { getWargearLabel, formatSpecialRule } from '../utils/labels'
import { getItemIneligibilityReason } from '../utils/kitEligibility'
import type { Member } from '../models'

// ─── Data helpers ──────────────────────────────────────────────────────────────

const EQUIPMENT_RAW = equipmentData as Array<{
  id: string
  label: string
  description?: string
  grantsSpecialRules?: Array<string | { id: string; parameter: string | number }>
}>

const WARGEAR_RAW = wargearData as Array<{
  id: string
  label: string
  category?: string
}>

const BASE_UNITS_RAW = baseUnitsData as Array<{
  id: string
  label: string
  baseWargear?: string[]
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
  const baseWargear = baseUnit?.baseWargear ?? []
  const allIds = Array.from(new Set([...baseWargear, ...member.equipment]))
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
 * Returns all weapon-category items carried by a member (union of baseWargear
 * and member.equipment, filtered to weapon categories from wargear.json).
 */
function getMemberWeapons(member: Member): string[] {
  const baseUnit = BASE_UNITS_RAW.find((u) => u.id === member.baseUnitId)
  const baseWargear = baseUnit?.baseWargear ?? []
  const allEquipment = Array.from(new Set([...baseWargear, ...member.equipment]))
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

  // Active match state (loaded on mount for button label derivation)
  const [match, setMatch] = useState<Awaited<ReturnType<typeof loadActiveMatch>>>(null)

  // ── Multi-kit state management ──
  const [currentKitIndex, setCurrentKitIndex] = useState(0)
  const [accumulatedItems, setAccumulatedItems] = useState<ToolkitItem[]>([])
  const [selectedKitIds, setSelectedKitIds] = useState<string[]>([])

  // Derive total kits from match atoBonuses
  const totalKits = match ? getToolkitCount(match.atoBonuses) : 1

  // Selected kit
  const [kitId, setKitId] = useState<string | null>(null)
  const kit = TOOLKIT_KITS.find((k) => k.id === kitId)

  // Kit selection is locked while a kit is actively being assigned
  const kitSelectionLocked = kitId !== null

  // assignments[i] = { memberId, parameter? }
  const [assignments, setAssignments] = useState<
    Array<{ memberId: string; parameter?: string }>
  >([])

  // Kit info dialog state — tracks which kit's info dialog is open (null = closed)
  const [infoDialogKit, setInfoDialogKit] = useState<string | null>(null)

  // Partial-assignment confirmation dialog state
  const [confirmPartialOpen, setConfirmPartialOpen] = useState(false)

  // Param dialog state
  const [paramDialog, setParamDialog] = useState<{
    itemIndex: number
    memberId: string
  } | null>(null)
  const [paramValue, setParamValue] = useState('')
  const [dynamicParamOptions, setDynamicParamOptions] = useState<string[] | null>(null)

  // Load active match on mount to derive button label from atoBonuses
  useEffect(() => {
    if (companyId) {
      loadActiveMatch(companyId).then((m) => setMatch(m ?? null))
    }
  }, [companyId])

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

  const buttonLabel = getProceedButtonLabel(match?.atoBonuses ?? [])

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

  /** Save all accumulated items to match state and navigate to next page */
  const finalizeAndNavigate = async (allItems: ToolkitItem[]) => {
    const currentMatch = await loadActiveMatch(companyId!)
    if (!currentMatch) return

    const updatedMatch = { ...currentMatch, toolkitItems: allItems }
    await saveActiveMatch(updatedMatch)

    if (updatedMatch.atoBonuses.includes('wanderer')) {
      navigate(`/companies/${companyId}/match/wanderer`)
    } else {
      navigate(`/companies/${companyId}/match`)
    }
  }

  /** Advance to next kit or finalize if all kits done */
  const advanceKit = async (currentItems: ToolkitItem[]) => {
    const newAccumulated = [...accumulatedItems, ...currentItems]
    const newSelectedKitIds = [...selectedKitIds, kitId!]
    const nextIndex = currentKitIndex + 1

    setAccumulatedItems(newAccumulated)
    setSelectedKitIds(newSelectedKitIds)
    setCurrentKitIndex(nextIndex)

    if (nextIndex === totalKits) {
      // All kits assigned — save and navigate
      await finalizeAndNavigate(newAccumulated)
    } else {
      // More kits to assign — reset kit selection for next round
      setKitId(null)
      setAssignments([])
    }
  }

  const handleProceed = async () => {
    if (!kit || !allAssigned) return

    const toolkitItems: ToolkitItem[] = assignments
      .filter((a) => a.memberId !== '')
      .map((a, i) => ({
        memberId: a.memberId,
        itemId: kit.items[i],
        parameter: a.parameter,
      }))

    await advanceKit(toolkitItems)
  }

  const handleConfirmPartial = async () => {
    // Kept for backward compat but no longer reachable in multi-kit flow
    // (confirm button is disabled when not all assigned)
    if (!kit) return
    setConfirmPartialOpen(false)

    const assignedItems = assignments
      .map((a, i) => ({ a, itemId: kit.items[i] }))
      .filter(({ a }) => a.memberId !== '')

    const toolkitItems: ToolkitItem[] = assignedItems.map(({ a, itemId }) => ({
      memberId: a.memberId,
      itemId,
      parameter: a.parameter,
    }))

    await advanceKit(toolkitItems)
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
        {/* ── Progress indicator (multi-kit only) ── */}
        {totalKits > 1 && (
          <Typography
            data-testid="kit-progress-indicator"
            variant="body2"
            sx={{
              textAlign: 'center',
              mb: 2,
              fontWeight: 600,
              color: 'primary.main',
              opacity: 0.85,
              letterSpacing: '0.03em',
            }}
          >
            Kit {currentKitIndex + 1} of {totalKits}
          </Typography>
        )}

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
            const isPreviouslySelected = selectedKitIds.includes(k.id)
            const isDisabled = isPreviouslySelected || kitSelectionLocked
            return (
              <Box
                key={k.id}
                onClick={() => {
                  if (!isDisabled) setKitId(k.id)
                }}
                sx={{
                  p: 1.5,
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: isDisabled ? 'default' : 'pointer',
                  opacity: isPreviouslySelected ? 0.4 : kitSelectionLocked && !isSelected ? 0.6 : 1,
                  background: isSelected
                    ? 'rgba(201,168,76,0.08)'
                    : 'rgba(0,0,0,0.15)',
                  transition: 'all 0.15s',
                  pointerEvents: isDisabled ? 'none' : 'auto',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: isSelected ? 'primary.main' : 'text.primary',
                    }}
                  >
                    {k.label}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label={`Info about ${k.label}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setInfoDialogKit(k.id)
                    }}
                    sx={{ color: 'text.secondary' }}
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Box>
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

                          // Check duplicate/ownership eligibility (skip if already disabled by envenom logic)
                          if (!disabledReason) {
                            const currentAssignments = assignments.map((asg, idx) => ({
                              memberId: asg.memberId,
                              itemId: kit.items[idx],
                            }))
                            const memberOwned = m.ownedEquipment ?? []
                            const ineligibility = getItemIneligibilityReason(
                              m.id,
                              itemId,
                              currentAssignments,
                              memberOwned
                            )
                            if (ineligibility) {
                              disabledReason = ineligibility
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
                disabled={!allAssigned}
                onClick={handleProceed}
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: '0.75rem',
                  letterSpacing: '0.08em',
                  py: 1.5,
                }}
              >
                {currentKitIndex < totalKits - 1 ? 'Confirm Kit' : buttonLabel}
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

      {/* ── Kit Info Dialog ── */}
      {infoDialogKit && (() => {
        const infoKit = TOOLKIT_KITS.find((k) => k.id === infoDialogKit)
        if (!infoKit) return null
        return (
          <KitInfoDialog
            open
            onClose={() => setInfoDialogKit(null)}
            kit={infoKit}
          />
        )
      })()}
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

// ─── Kit Info Dialog ──────────────────────────────────────────────────────────

interface KitInfoDialogProps {
  open: boolean
  onClose: () => void
  kit: { id: string; label: string; items: string[] }
}

function KitInfoDialog({ open, onClose, kit }: KitInfoDialogProps) {
  // Derive unique items with quantity counts
  const itemCounts = new Map<string, number>()
  for (const itemId of kit.items) {
    itemCounts.set(itemId, (itemCounts.get(itemId) ?? 0) + 1)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          background: 'linear-gradient(160deg,#1a1008 0%,#110a03 100%)',
          border: '1px solid rgba(200,164,90,0.25)',
          borderRadius: 2,
          maxWidth: 420,
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
        {kit.label}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {Array.from(itemCounts.entries()).map(([itemId, count]) => {
            const equipEntry = EQUIPMENT_RAW.find((e) => e.id === itemId)
            const label = getItemLabel(itemId)
            const displayLabel = count > 1 ? `${count}× ${label}` : label

            // Determine description: equipment.description → formatted grantsSpecialRules → fallback
            let description: string
            if (equipEntry?.description) {
              description = equipEntry.description
            } else if (
              equipEntry?.grantsSpecialRules &&
              equipEntry.grantsSpecialRules.length > 0
            ) {
              description =
                'Grants: ' +
                equipEntry.grantsSpecialRules.map(formatSpecialRule).join(', ')
            } else {
              description = 'No description available'
            }

            return (
              <Box key={itemId}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, mb: 0.25 }}
                >
                  {displayLabel}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.4 }}
                >
                  {description}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button variant="outlined" size="small" onClick={onClose} autoFocus>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
