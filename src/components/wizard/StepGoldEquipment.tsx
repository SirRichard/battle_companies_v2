import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import baseUnitsData from '../../data/baseUnits.json'
import wargearData from '../../data/wargear.json'
import equipmentData from '../../data/equipment.json'
import creaturesData from '../../data/creatures.json'
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
  leaderId: string | null
  goldPurchases: Record<string, string[]> // tempId -> purchased wargear/equipment/creature ids
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

type EquipmentEntry = {
  id: string
  label: string
  rating?: number | [number, number]
  influenceCost?: number
  heroOnly?: boolean
  cavalryOnly?: boolean
  description?: string
}

type CreatureEntry = {
  id: string
  label: string
  pointsCost: number
  influenceCost?: number
  stats: Record<string, number | null>
  specialRules: string[]
  companyIds?: string[]
}

const WARGEAR_MAP = Object.fromEntries(
  (wargearData as WargearEntry[]).map((w) => [w.id, w])
)

export const NON_WEAPON_CATEGORIES = new Set([
  'armour_1', 'armour_2', 'armour_3', 'armour_4',
  'mount', 'shield', 'special',
])

const EQUIPMENT_MAP = Object.fromEntries(
  (equipmentData as EquipmentEntry[]).map((e) => [e.id, e])
)

const ALL_CREATURES = creaturesData as unknown as CreatureEntry[]

type BaseUnitEntry = {
  id: string
  baseWargear?: string[]
  wargearOptions?: { options: Array<{ wargear: string[] }> }
}

const BASE_UNITS_MAP = Object.fromEntries(
  (baseUnitsData as BaseUnitEntry[]).map((u) => [u.id, u])
)

export function getMemberWeapons(baseUnitId: string, memberEquipment: string[]): string[] {
  const baseEquip = BASE_UNITS_MAP[baseUnitId]?.baseWargear ?? []
  const combined = new Set([...baseEquip, ...memberEquipment])
  return [...combined].filter(id => {
    const wg = WARGEAR_MAP[id]
    return wg && !NON_WEAPON_CATEGORIES.has(wg.category ?? '')
  })
}

function collectFromUnit(
  unitId: string,
  includeBase: boolean,
  out: Set<string>
) {
  const unit = BASE_UNITS_MAP[unitId]
  if (!unit) return
  if (includeBase) (unit.baseWargear ?? []).forEach((e) => out.add(e))
  for (const opt of unit.wargearOptions?.options ?? []) {
    opt.wargear.forEach((e) => out.add(e))
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
  // Find the lowest accessible armour tier above current — only show if it's
  // exactly one step up (no skipping tiers)
  let nextUpgrade: string | null = null
  let nextTier = Infinity
  for (const wId of accessible) {
    const tier = ARMOUR_TIER[wId]
    if (tier !== undefined && tier > currentTier && tier < nextTier) {
      nextUpgrade = wId
      nextTier = tier
    }
  }
  // Only offer the upgrade if it's a single step up
  if (nextTier !== currentTier + 1) return null
  return nextUpgrade
}

export function parseGoldEntry(entry: string): { itemId: string; parameter?: string } {
  const parts = entry.split('::')
  return parts.length === 2
    ? { itemId: parts[0], parameter: parts[1] }
    : { itemId: entry }
}

export function wargearLabel(id: string): string {
  const { itemId, parameter } = parseGoldEntry(id)
  if (itemId === 'envenom_weapon' && parameter) {
    const weaponLabel =
      WARGEAR_MAP[parameter]?.label ??
      parameter.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    return `Envenom Weapon (${weaponLabel})`
  }
  return (
    WARGEAR_MAP[itemId]?.label ??
    EQUIPMENT_MAP[itemId]?.label ??
    ALL_CREATURES.find((c) => c.id === itemId)?.label ??
    itemId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  )
}

export function goldCost(entry: string): number {
  const { itemId } = parseGoldEntry(entry)
  // Check wargear first
  const wg = WARGEAR_MAP[itemId]
  if (wg?.rating !== undefined) return wg.rating[0]
  // Check equipment
  const eq = EQUIPMENT_MAP[itemId]
  if (eq?.rating !== undefined) {
    const r = eq.rating
    return Array.isArray(r) ? r[0] : r
  }
  // Check creatures
  const cr = ALL_CREATURES.find((c) => c.id === itemId)
  if (cr) return cr.pointsCost
  return 1
}

function getAvailableCreatures(companyTypeId: string): CreatureEntry[] {
  return ALL_CREATURES.filter(
    (c) => !c.companyIds || c.companyIds.includes(companyTypeId)
  )
}

// ── Sort helpers ─────────────────────────────────────────────────────────────

function sortMembersForGold(
  members: RosterMember[],
  leaderId: string | null
): RosterMember[] {
  const heroes = members.filter((m) => m.isHero)
  const warriors = members.filter((m) => !m.isHero)
  const leader = heroes.find((h) => h.tempId === leaderId) ?? heroes[0] ?? null
  const sergeants = heroes
    .filter((h) => h.tempId !== leader?.tempId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const sortedWarriors = [...warriors].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  return [...(leader ? [leader] : []), ...sergeants, ...sortedWarriors]
}

function getMemberLabel(
  member: RosterMember,
  leaderId: string | null
): string {
  if (!member.isHero) return 'Warrior'
  return member.tempId === leaderId ? 'Leader' : 'Sergeant'
}

export default function StepGoldEquipment({
  gold,
  members,
  companyTypeId,
  leaderId,
  goldPurchases,
  onUpdate,
}: Props) {
  const [selectedTempId, setSelectedTempId] = useState<string | null>(null)
  const [heroTab, setHeroTab] = useState<
    Record<string, 'wargear' | 'equipment' | 'creatures'>
  >({})

  const sortedMembers = sortMembersForGold(members, leaderId)

  // Total gold remaining
  const totalSpent = Object.values(goldPurchases).reduce(
    (sum, items) => sum + items.reduce((s, id) => s + goldCost(id), 0),
    0
  )
  const goldRemaining = gold - totalSpent

  const selectedMember = sortedMembers.find((m) => m.tempId === selectedTempId)
  void selectedMember // used implicitly via selectedTempId

  const getPurchasedForMember = (tempId: string) => goldPurchases[tempId] ?? []

  const getAvailableWargearForMember = (member: RosterMember): WargearEntry[] => {
    const accessible = getAccessible(member, companyTypeId)
    const purchased = getPurchasedForMember(member.tempId)
    const allEquip = [...member.equipment, ...purchased]
    const armourUpgradeId = getBestArmourUpgrade(allEquip, accessible)

    return (wargearData as WargearEntry[]).filter((w) => {
      if (w.purchasable === false) return false
      if (w.rating === undefined) return false
      if (!accessible.has(w.id)) return false
      if (allEquip.includes(w.id)) return false
      if (w.category === 'equipment') return false // equipment items go in Equipment tab
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

  const getAvailableEquipmentForMember = (
    member: RosterMember
  ): EquipmentEntry[] => {
    const purchased = getPurchasedForMember(member.tempId)
    const allEquip = [...member.equipment, ...purchased]
    return (equipmentData as EquipmentEntry[]).filter((e) => {
      if (allEquip.includes(e.id)) return false
      if (e.cavalryOnly) return false
      if (e.heroOnly && !member.isHero) return false
      return true
    })
  }

  const handleBuy = (member: RosterMember, itemId: string) => {
    const cost = goldCost(itemId)
    if (cost > goldRemaining) return
    const current = getPurchasedForMember(member.tempId)
    onUpdate(member.tempId, [...current, itemId])
  }

  const handleRemove = (member: RosterMember, itemId: string) => {
    const current = getPurchasedForMember(member.tempId)
    onUpdate(
      member.tempId,
      current.filter((w) => w !== itemId)
    )
  }

  const getActiveTab = (
    tempId: string,
    isHero: boolean
  ): 'wargear' | 'equipment' | 'creatures' => {
    return heroTab[tempId] ?? 'wargear'
  }

  const setActiveTab = (
    tempId: string,
    tab: 'wargear' | 'equipment' | 'creatures'
  ) => {
    setHeroTab((prev) => ({ ...prev, [tempId]: tab }))
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
        {sortedMembers.map((member) => {
          const purchased = getPurchasedForMember(member.tempId)
          const isSelected = selectedTempId === member.tempId
          const activeTab = getActiveTab(member.tempId, member.isHero)
          const memberLabel = getMemberLabel(member, leaderId)

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
                    {memberLabel}
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
                      -{purchased.reduce((s, id) => s + goldCost(id), 0)} gp
                    </Typography>
                  )}
                  <Typography sx={{ opacity: 0.4, fontSize: '0.8rem' }}>
                    {isSelected ? '▲' : '▼'}
                  </Typography>
                </Box>
              </Box>

              {/* Expanded: tabs + content */}
              {isSelected && (
                <Box
                  sx={{
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {/* Tabs */}
                  <Tabs
                    value={activeTab}
                    onChange={(_, v) => setActiveTab(member.tempId, v)}
                    variant="fullWidth"
                    sx={{
                      minHeight: 36,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '& .MuiTab-root': {
                        minHeight: 36,
                        fontSize: '0.7rem',
                        py: 0.5,
                      },
                    }}
                  >
                    <Tab label="Wargear" value="wargear" />
                    <Tab label="Equipment" value="equipment" />
                    {member.isHero && (
                      <Tab label="Creatures" value="creatures" />
                    )}
                  </Tabs>

                  <Box sx={{ px: 1.5, pb: 1.5 }}>
                    {/* ── Wargear tab ── */}
                    {activeTab === 'wargear' && (
                      <WargearTabContent
                        member={member}
                        purchased={purchased}
                        available={getAvailableWargearForMember(member)}
                        goldRemaining={goldRemaining}
                        onBuy={handleBuy}
                        onRemove={handleRemove}
                      />
                    )}

                    {/* ── Equipment tab ── */}
                    {activeTab === 'equipment' && (
                      <EquipmentTabContent
                        member={member}
                        purchased={purchased}
                        available={getAvailableEquipmentForMember(member)}
                        goldRemaining={goldRemaining}
                        onBuy={handleBuy}
                        onRemove={handleRemove}
                      />
                    )}

                    {/* ── Creatures tab (heroes only) ── */}
                    {activeTab === 'creatures' && member.isHero && (
                      <CreaturesTabContent
                        member={member}
                        purchased={purchased}
                        creatures={getAvailableCreatures(companyTypeId)}
                        goldRemaining={goldRemaining}
                        onBuy={handleBuy}
                        onRemove={handleRemove}
                      />
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface TabContentProps {
  member: RosterMember
  purchased: string[]
  goldRemaining: number
  onBuy: (member: RosterMember, id: string) => void
  onRemove: (member: RosterMember, id: string) => void
}

function PurchasedChips({
  purchased,
  filterFn,
  member,
  onRemove,
}: {
  purchased: string[]
  filterFn: (id: string) => boolean
  member: RosterMember
  onRemove: (member: RosterMember, id: string) => void
}) {
  const filtered = purchased.filter(filterFn)
  if (filtered.length === 0) return null
  return (
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
        {filtered.map((id) => (
          <Chip
            key={id}
            label={`${wargearLabel(id)} (${goldCost(id)} gp)`}
            size="small"
            onDelete={() => onRemove(member, id)}
            sx={{
              fontSize: '0.68rem',
              borderColor: 'primary.dark',
              color: 'primary.light',
              '& .MuiChip-deleteIcon': { color: 'primary.dark' },
            }}
            variant="outlined"
          />
        ))}
      </Box>
    </Box>
  )
}

function WargearTabContent({
  member,
  purchased,
  available,
  goldRemaining,
  onBuy,
  onRemove,
}: TabContentProps & { available: WargearEntry[] }) {
  const isWargearId = (id: string) =>
    WARGEAR_MAP[id] !== undefined && WARGEAR_MAP[id].category !== 'equipment'

  return (
    <>
      <PurchasedChips
        purchased={purchased}
        filterFn={isWargearId}
        member={member}
        onRemove={onRemove}
      />
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    {isArmour ? `Upgrade to ${w.label}` : w.label}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!canAfford}
                    onClick={() => onBuy(member, w.id)}
                    sx={{ minWidth: 60, fontSize: '0.62rem', py: 0.5 }}
                  >
                    {cost} gp
                  </Button>
                </Box>
              )
            })}
          </Box>
        </>
      )}
    </>
  )
}

function EquipmentTabContent({
  member,
  purchased,
  available,
  goldRemaining,
  onBuy,
  onRemove,
}: TabContentProps & { available: EquipmentEntry[] }) {
  const isEquipmentId = (id: string) => {
    const { itemId } = parseGoldEntry(id)
    return EQUIPMENT_MAP[itemId] !== undefined
  }

  const [infoAnchor, setInfoAnchor] = useState<{ el: HTMLElement; description: string } | null>(null)
  const [envenomDialogOpen, setEnvenomDialogOpen] = useState(false)

  // Compute eligible weapons for envenom
  const alreadyEnvenomedWeapons = purchased
    .filter(p => p.startsWith('envenom_weapon::'))
    .map(p => parseGoldEntry(p).parameter!)

  const eligibleWeapons = getMemberWeapons(member.baseUnitId, [
    ...member.equipment,
    ...purchased.map(p => parseGoldEntry(p).itemId),
  ]).filter(wId => !alreadyEnvenomedWeapons.includes(wId))

  const handleEquipmentBuy = (equipMember: RosterMember, itemId: string) => {
    if (itemId === 'envenom_weapon') {
      setEnvenomDialogOpen(true)
    } else {
      onBuy(equipMember, itemId)
    }
  }

  const handleWeaponSelect = (weaponId: string) => {
    setEnvenomDialogOpen(false)
    onBuy(member, `envenom_weapon::${weaponId}`)
  }

  return (
    <>
      <PurchasedChips
        purchased={purchased}
        filterFn={isEquipmentId}
        member={member}
        onRemove={onRemove}
      />
      {available.length === 0 ? (
        <Typography
          variant="caption"
          sx={{ opacity: 0.4, display: 'block', mt: 1 }}
        >
          No equipment available for this member.
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {available.map((e) => {
              const cost = goldCost(e.id)
              const canAfford = cost <= goldRemaining
              const isEnvenom = e.id === 'envenom_weapon'
              const envenomDisabled = isEnvenom && eligibleWeapons.length === 0
              return (
                <Box
                  key={e.id}
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
                    opacity: canAfford && !envenomDisabled ? 1 : 0.38,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                      {e.label}
                    </Typography>
                    {e.description && (
                      <IconButton
                        size="small"
                        onClick={(event) =>
                          setInfoAnchor({ el: event.currentTarget, description: e.description! })
                        }
                        sx={{ p: 0.25 }}
                      >
                        <InfoOutlined sx={{ fontSize: '1rem', opacity: 0.6 }} />
                      </IconButton>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!canAfford || envenomDisabled}
                    onClick={() => handleEquipmentBuy(member, e.id)}
                    sx={{ minWidth: 60, fontSize: '0.62rem', py: 0.5 }}
                  >
                    {cost} gp
                  </Button>
                </Box>
              )
            })}
          </Box>
        </>
      )}

      <Popover
        open={infoAnchor !== null}
        anchorEl={infoAnchor?.el ?? null}
        onClose={() => setInfoAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, maxWidth: 320 }}>
          <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
            {infoAnchor?.description}
          </Typography>
        </Box>
      </Popover>

      {/* Envenom weapon selection dialog */}
      <Dialog
        open={envenomDialogOpen}
        onClose={() => setEnvenomDialogOpen(false)}
      >
        <DialogTitle sx={{ fontSize: '1rem' }}>
          Select Weapon to Envenom
        </DialogTitle>
        <DialogContent>
          <List>
            {eligibleWeapons.map((wId) => (
              <ListItemButton key={wId} onClick={() => handleWeaponSelect(wId)}>
                <ListItemText
                  primary={
                    WARGEAR_MAP[wId]?.label ??
                    wId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                  }
                />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CreaturesTabContent({
  member,
  purchased,
  creatures,
  goldRemaining,
  onBuy,
  onRemove,
}: TabContentProps & { creatures: CreatureEntry[] }) {
  const isCreatureId = (id: string) =>
    ALL_CREATURES.some((c) => c.id === id)

  const purchasedCreature = purchased.find(isCreatureId)
  const alreadyHasCreature = purchasedCreature !== undefined

  return (
    <>
      <PurchasedChips
        purchased={purchased}
        filterFn={isCreatureId}
        member={member}
        onRemove={onRemove}
      />
      {alreadyHasCreature ? (
        <Typography
          variant="caption"
          sx={{ opacity: 0.4, display: 'block', mt: 1 }}
        >
          This hero already has a creature.
        </Typography>
      ) : creatures.length === 0 ? (
        <Typography
          variant="caption"
          sx={{ opacity: 0.4, display: 'block', mt: 1 }}
        >
          No creatures available for this company.
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {creatures.map((c) => {
              const cost = c.pointsCost
              const canAfford = cost <= goldRemaining
              return (
                <Box
                  key={c.id}
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
                  <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {c.label}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.55, fontSize: '0.68rem' }}>
                      {`Mv ${c.stats.move}" · Fv ${c.stats.fight} · S ${c.stats.strength} · D ${c.stats.defence} · A ${c.stats.attacks} · W ${c.stats.wounds}`}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!canAfford}
                    onClick={() => onBuy(member, c.id)}
                    sx={{ minWidth: 60, fontSize: '0.62rem', py: 0.5 }}
                  >
                    {cost} gp
                  </Button>
                </Box>
              )
            })}
          </Box>
        </>
      )}
    </>
  )
}
