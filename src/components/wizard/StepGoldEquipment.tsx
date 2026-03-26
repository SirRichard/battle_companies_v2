import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import baseUnitsData from '../../data/baseUnits.json'
import wargearData from '../../data/wargear.json'
import companiesData from '../../data/companies.json'

interface RosterMember {
  tempId: string
  name: string
  baseUnitId: string
  equipment: string[] // from startingRoster
  isHero: boolean
}

interface Props {
  gold: number
  members: RosterMember[]
  companyTypeId: string
  goldPurchases: Record<string, string[]> // tempId -> purchased wargear ids
  onUpdate: (tempId: string, wargearIds: string[]) => void
}

// ── Armour tier map ──────────────────────────────────────────────────────────
const ARMOUR_TIER: Record<string, number> = {
  light_armour: 1,
  armour: 2,
  heavy_armour: 3,
  dwarf_armour: 3,
  heavy_dwarf_armour: 4,
}

type WargearEntry = {
  id: string
  label: string
  category: string
  influenceCost?: number
  rating?: [number, number]
  purchasable?: boolean
}

const WARGEAR_MAP = Object.fromEntries(
  (wargearData as WargearEntry[]).map((w) => [w.id, w])
)

type BaseUnitEntry = {
  id: string
  baseEquipment?: string[]
  equipmentOptions?: { options: Array<{ equipment: string[] }> }
}

const BASE_UNITS_MAP = Object.fromEntries(
  (baseUnitsData as BaseUnitEntry[]).map((u) => [u.id, u])
)

function collectFromUnit(
  unitId: string,
  includeBase: boolean,
  out: Set<string>
) {
  const unit = BASE_UNITS_MAP[unitId]
  if (!unit) return
  if (includeBase) (unit.baseEquipment ?? []).forEach((e) => out.add(e))
  for (const opt of unit.equipmentOptions?.options ?? []) {
    opt.equipment.forEach((e) => out.add(e))
  }
}

function getCompanyUnitIds(companyTypeId: string): Set<string> {
  const ids = new Set<string>()
  const company = (companiesData as any[]).find((c) => c.id === companyTypeId)
  if (!company) return ids
  const addEntry = (e: any) => {
    if (e.baseUnitId) ids.add(e.baseUnitId)
    if (e.toBaseUnitId) ids.add(e.toBaseUnitId)
    if (e.fromBaseUnitId) ids.add(e.fromBaseUnitId)
    if (e.units)
      (e.units as any[]).forEach(
        (u: any) => u.baseUnitId && ids.add(u.baseUnitId)
      )
    if (e.pool)
      (e.pool as any[]).forEach(
        (u: any) => u.baseUnitId && ids.add(u.baseUnitId)
      )
  }
  for (const e of company.startingRoster ?? []) addEntry(e)
  for (const e of company.reinforcementTable ?? []) addEntry(e)
  for (const e of (company as any).specialTable ?? []) addEntry(e)
  for (const e of company.advancements ?? []) addEntry(e)
  return ids
}

function getAccessible(
  member: RosterMember,
  companyTypeId: string
): Set<string> {
  const out = new Set<string>()
  if (!member.isHero) {
    collectFromUnit(member.baseUnitId, false, out)
  } else {
    const ids = getCompanyUnitIds(companyTypeId)
    for (const uid of ids) collectFromUnit(uid, true, out)
  }
  return out
}

function getBestArmourUpgrade(
  allEquip: string[],
  accessible: Set<string>
): string | null {
  const currentTier = allEquip.reduce(
    (b, e) => Math.max(b, ARMOUR_TIER[e] ?? 0),
    0
  )
  if (currentTier === 0) return null
  let best: string | null = null
  let bestTier = currentTier
  for (const wId of accessible) {
    const tier = ARMOUR_TIER[wId]
    if (tier !== undefined && tier > bestTier) {
      best = wId
      bestTier = tier
    }
  }
  return best
}

function wargearLabel(id: string): string {
  return (
    WARGEAR_MAP[id]?.label ??
    id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  )
}

function goldCost(wargearId: string): number {
  return WARGEAR_MAP[wargearId]?.rating?.[0] ?? 1
}

export default function StepGoldEquipment({
  gold,
  members,
  companyTypeId,
  goldPurchases,
  onUpdate,
}: Props) {
  const [selectedTempId, setSelectedTempId] = useState<string | null>(null)

  // Total gold remaining
  const totalSpent = Object.values(goldPurchases).reduce(
    (sum, items) => sum + items.reduce((s, wId) => s + goldCost(wId), 0),
    0
  )
  const goldRemaining = gold - totalSpent

  const selectedMember = members.find((m) => m.tempId === selectedTempId)

  const getPurchasedForMember = (tempId: string) => goldPurchases[tempId] ?? []

  const getAvailableForMember = (member: RosterMember): WargearEntry[] => {
    const accessible = getAccessible(member, companyTypeId)
    const purchased = getPurchasedForMember(member.tempId)
    const allEquip = [...member.equipment, ...purchased]
    const armourUpgradeId = getBestArmourUpgrade(allEquip, accessible)

    return (wargearData as WargearEntry[]).filter((w) => {
      if (w.purchasable === false) return false
      if (w.rating === undefined) return false
      if (!accessible.has(w.id)) return false
      if (allEquip.includes(w.id)) return false
      // Only one mount
      if (
        w.category === 'mount' &&
        allEquip.some((e) => WARGEAR_MAP[e]?.category === 'mount')
      )
        return false
      // Armour: only the valid upgrade
      if (ARMOUR_TIER[w.id] !== undefined) return w.id === armourUpgradeId
      return true
    })
  }

  const handleBuy = (member: RosterMember, wargearId: string) => {
    const cost = goldCost(wargearId)
    if (cost > goldRemaining) return
    const current = getPurchasedForMember(member.tempId)
    onUpdate(member.tempId, [...current, wargearId])
  }

  const handleRemove = (member: RosterMember, wargearId: string) => {
    const current = getPurchasedForMember(member.tempId)
    onUpdate(
      member.tempId,
      current.filter((w) => w !== wargearId)
    )
  }

  return (
    <Box>
      <Typography
        variant="body2"
        sx={{ fontStyle: 'italic', opacity: 0.7, mb: 0.5 }}
      >
        Your company starts with{' '}
        <strong style={{ color: '#c8a45a' }}>{gold} Gold</strong> to spend on
        additional equipment for your members. Warriors may only take equipment
        from their own profile options; heroes may choose from any wargear
        available across the company.
      </Typography>

      {/* Gold remaining banner */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          mb: 2.5,
          borderRadius: 1,
          border: '1px solid',
          borderColor: goldRemaining === 0 ? 'success.dark' : 'primary.dark',
          background:
            goldRemaining === 0
              ? 'rgba(46,204,113,0.06)'
              : 'rgba(201,168,76,0.06)',
        }}
      >
        <Typography
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.65rem',
            letterSpacing: '0.06em',
            opacity: 0.7,
          }}
        >
          Gold Remaining
        </Typography>
        <Typography
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            fontWeight: 700,
            color: goldRemaining === 0 ? 'success.light' : 'primary.main',
            fontSize: '1.1rem',
          }}
        >
          {goldRemaining}
        </Typography>
      </Box>

      {/* Member list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {members.map((member) => {
          const purchased = getPurchasedForMember(member.tempId)
          const available = getAvailableForMember(member)
          const isSelected = selectedTempId === member.tempId

          return (
            <Box
              key={member.tempId}
              sx={{
                border: '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                borderRadius: 1.5,
                overflow: 'hidden',
                background: isSelected
                  ? 'rgba(201,168,76,0.04)'
                  : 'rgba(0,0,0,0.15)',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Member header — always visible */}
              <Box
                onClick={() =>
                  setSelectedTempId(isSelected ? null : member.tempId)
                }
                sx={{
                  px: 1.5,
                  py: 1.25,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: isSelected ? 'primary.main' : 'text.primary',
                    }}
                  >
                    {member.name}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.5 }}>
                    {member.isHero
                      ? member.tempId === members.find((m) => m.isHero)?.tempId
                        ? 'Leader'
                        : 'Sergeant'
                      : 'Warrior'}
                    {' · '}
                    {member.baseUnitId
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {purchased.length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'success.light', opacity: 0.8 }}
                    >
                      -{purchased.reduce((s, w) => s + goldCost(w), 0)} gp
                    </Typography>
                  )}
                  <Typography sx={{ opacity: 0.4, fontSize: '0.8rem' }}>
                    {isSelected ? '▲' : '▼'}
                  </Typography>
                </Box>
              </Box>

              {/* Expanded: purchased chips + available to buy */}
              {isSelected && (
                <Box
                  sx={{
                    px: 1.5,
                    pb: 1.5,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {/* Currently purchased */}
                  {purchased.length > 0 && (
                    <Box sx={{ mt: 1, mb: 1.5 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          opacity: 0.5,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontSize: '0.58rem',
                          display: 'block',
                          mb: 0.75,
                        }}
                      >
                        Purchased
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {purchased.map((wId) => (
                          <Chip
                            key={wId}
                            label={`${wargearLabel(wId)} (${goldCost(wId)} gp)`}
                            size="small"
                            onDelete={() => handleRemove(member, wId)}
                            sx={{
                              fontSize: '0.68rem',
                              borderColor: 'primary.dark',
                              color: 'primary.light',
                              '& .MuiChip-deleteIcon': {
                                color: 'primary.dark',
                              },
                            }}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Available to buy */}
                  {available.length === 0 ? (
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.4, display: 'block', mt: 1 }}
                    >
                      No further wargear available for this member.
                    </Typography>
                  ) : (
                    <>
                      <Typography
                        variant="caption"
                        sx={{
                          opacity: 0.5,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontSize: '0.58rem',
                          display: 'block',
                          mt: 1,
                          mb: 0.75,
                        }}
                      >
                        Available
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.5,
                        }}
                      >
                        {available.map((w) => {
                          const cost = goldCost(w.id)
                          const canAfford = cost <= goldRemaining
                          const isArmour = ARMOUR_TIER[w.id] !== undefined
                          return (
                            <Box
                              key={w.id}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: 1.25,
                                py: 0.75,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                background: 'rgba(0,0,0,0.1)',
                                opacity: canAfford ? 1 : 0.38,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontSize: '0.8rem' }}
                              >
                                {isArmour ? `Upgrade to ${w.label}` : w.label}
                              </Typography>
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={!canAfford}
                                onClick={() => handleBuy(member, w.id)}
                                sx={{
                                  minWidth: 60,
                                  fontSize: '0.62rem',
                                  py: 0.5,
                                }}
                              >
                                {cost} gp
                              </Button>
                            </Box>
                          )
                        })}
                      </Box>
                    </>
                  )}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
