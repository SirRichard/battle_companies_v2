/**
 * MemberMatchCard — extracted from MatchTrackingPage.
 *
 * Renders a single member's match card with responsive collapse behavior:
 * - md+ (≥900px): all content flat, no Collapse, no chevron
 * - xs/sm (<900px): PrimaryInfoRow always visible, secondary info in MUI Collapse
 *
 * Hero roles: leader, sergeant, hero_in_making
 */

import { useState, useRef } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Button,
  Divider,
  Collapse,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { motion } from 'framer-motion'
import PrimaryInfoRow from './PrimaryInfoRow'
import StatGrid from './StatGrid'
import { getWargearLabel, formatSpecialRule } from '../../utils/labels'
import { calcEquipmentStatBonus } from '../../utils/equipmentBonuses'
import { getDwarvenBrewCourageBonus } from '../../utils/dwarvenBrew'
import { isPostMatchOnlyItem } from '../../utils/itemConsumption'
import { synthesizeEnvenomChips, filterEnvenomFromRules } from '../../utils/envenomSynthesis'
import { getChipDescription } from '../../utils/chipDescription'
import type { MemberMatchState, ToolkitItem } from '../../models/match'
import type { MemberStats } from '../../models'
import type { ChipPopupContent } from '../../utils/chipDescription'
import wargearData from '../../data/wargear.json'
import equipmentData from '../../data/equipment.json'

const MotionBox = motion(Box)

// ─── Toolkit helpers ──────────────────────────────────────────────────────────

function getToolkitItemLabel(item: { itemId: string; parameter?: string }): string {
  const baseLabel = getWargearLabel(item.itemId)
  if (item.parameter) {
    return `${baseLabel} (${getWargearLabel(item.parameter)})`
  }
  return baseLabel
}

function isConsumable(itemId: string): boolean {
  const wargearItem = (wargearData as Array<{ id: string; consumable?: boolean }>).find(
    (w) => w.id === itemId
  )
  if (wargearItem) return wargearItem.consumable ?? false
  const equipItem = (equipmentData as Array<{ id: string; consumable?: boolean }>).find(
    (e) => e.id === itemId
  )
  return equipItem?.consumable ?? false
}

// All 9 stats in display order
const ALL_STATS: { key: string; label: string }[] = [
  { key: 'move', label: 'Mv' },
  { key: 'fight', label: 'Fv' },
  { key: 'shoot', label: 'Sv' },
  { key: 'strength', label: 'S' },
  { key: 'defence', label: 'D' },
  { key: 'attacks', label: 'A' },
  { key: 'wounds', label: 'W' },
  { key: 'courage', label: 'C' },
  { key: 'intelligence', label: 'I' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MemberMatchCardProps {
  mm: MemberMatchState
  delay: number
  baseStats: Record<string, number> | undefined
  statIncreases: Partial<MemberStats>
  statDecreases: Partial<MemberStats>
  specialRules: Array<string | { id: string; parameter: string | number }>
  toolkitItems: ToolkitItem[]
  permanentBrewUsed: boolean
  isAtoWanderer?: boolean
  onXpChange: (delta: number) => void
  onCasualtyToggle: () => void
  onMwfChange: (stat: string, delta: number) => void
  onUseToolkitItem: (itemId: string) => void
  onRemoveToolkitItem: (itemId: string) => void
  onChipTap: (anchorEl: HTMLElement, content: ChipPopupContent) => void
}

const HERO_ROLES = new Set(['leader', 'sergeant', 'hero_in_making'])

export default function MemberMatchCard({
  mm,
  delay,
  baseStats,
  statIncreases,
  statDecreases,
  specialRules,
  toolkitItems,
  permanentBrewUsed,
  isAtoWanderer,
  onXpChange,
  onCasualtyToggle,
  onMwfChange,
  onUseToolkitItem,
  onRemoveToolkitItem,
  onChipTap,
}: MemberMatchCardProps) {
  const [expanded, setExpanded] = useState(false)
  const lastToggleRef = useRef(0)

  const handleToggle = () => {
    const now = Date.now()
    if (now - lastToggleRef.current < 100) return // debounce 100ms
    lastToggleRef.current = now
    setExpanded((prev) => !prev)
  }

  const theme = useTheme()
  const isMd = useMediaQuery(theme.breakpoints.up('md'))
  const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md'))
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))

  const isHero = HERO_ROLES.has(mm.role)
  const equipBonus = calcEquipmentStatBonus(mm.equipment, mm.baseUnitId)
  const hasHeroStats = isHero && mm.mightMax !== null

  const collapsePanelId = `collapse-panel-${mm.memberId}`

  // ── Stat helpers ────────────────────────────────────────────────────────────

  const isTargetNumber = (key: string) =>
    key === 'shoot' || key === 'courage' || key === 'intelligence'

  const effectiveVal = (key: string, raw: number): number => {
    const inc = (statIncreases as Record<string, number | undefined>)[key] ?? 0
    const dec = (statDecreases as Record<string, number | undefined>)[key] ?? 0
    const eq = key === 'defence' ? equipBonus.defence : 0
    const brewBonus =
      key === 'courage' ? getDwarvenBrewCourageBonus(toolkitItems, permanentBrewUsed) : 0
    return raw + inc - dec + eq + brewBonus
  }

  const formatStat = (key: string, raw: number): string => {
    const val = effectiveVal(key, raw)
    if (key === 'move') return `${val}"`
    if (isTargetNumber(key)) return `${val}+`
    return String(val)
  }

  const statColour = (key: string, raw: number): string | undefined => {
    const base = raw + (key === 'defence' ? equipBonus.defence : 0)
    const eff = effectiveVal(key, raw)
    if (eff === base) return undefined
    if (isTargetNumber(key)) return eff < base ? '#2ecc71' : '#e74c3c'
    return eff > base ? '#2ecc71' : '#e74c3c'
  }

  // ── Secondary content renderer ─────────────────────────────────────────────

  const renderMwfControls = () => (
    <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, mb: 1, mt: 1, maxWidth: 440 }}>
      {(['might', 'will', 'fate'] as const).map((stat) => {
        const curKey = `${stat}Current` as keyof MemberMatchState
        const maxKey = `${stat}Max` as keyof MemberMatchState
        const cur = mm[curKey] as number
        const max = mm[maxKey] as number
        const label =
          stat === 'might' ? 'Might' : stat === 'will' ? 'Will' : 'Fate'
        const depleted = cur === 0
        const full = cur === max
        return (
          <Box
            key={stat}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              border: '1px solid',
              borderColor: depleted
                ? 'rgba(192,57,43,0.5)'
                : 'primary.dark',
              borderRadius: 1,
              py: { xs: 0.5, sm: 0.75 },
              px: { xs: 0.25, sm: 0.5 },
              background: depleted
                ? 'rgba(192,57,43,0.06)'
                : 'rgba(201,168,76,0.04)',
              minWidth: 0,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.55rem',
                opacity: 0.55,
                lineHeight: 1,
                mb: 0.5,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.25, sm: 0.5 } }}>
              <IconButton
                onClick={() => onMwfChange(stat, -1)}
                disabled={cur <= 0}
                sx={{
                  p: 0,
                  width: { xs: 28, sm: 36 },
                  height: { xs: 28, sm: 36 },
                  border: '1px solid',
                  borderColor:
                    cur <= 0
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(192,57,43,0.4)',
                  borderRadius: 0.75,
                  color: 'error.light',
                  '&:hover': { background: 'rgba(192,57,43,0.15)' },
                  '&.Mui-disabled': { opacity: 0.25 },
                }}
              >
                <RemoveIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
              </IconButton>
              <Box sx={{ textAlign: 'center', minWidth: { xs: 24, sm: 32 } }}>
                <Typography
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: { xs: '0.9rem', sm: '1.1rem' },
                    fontWeight: 700,
                    color: depleted
                      ? 'error.light'
                      : full
                        ? 'primary.main'
                        : 'text.primary',
                    lineHeight: 1,
                  }}
                >
                  {cur}
                </Typography>
                <Typography
                  sx={{ fontSize: '0.55rem', opacity: 0.4, lineHeight: 1 }}
                >
                  / {max}
                </Typography>
              </Box>
              <IconButton
                onClick={() => onMwfChange(stat, 1)}
                disabled={cur >= max}
                sx={{
                  p: 0,
                  width: { xs: 28, sm: 36 },
                  height: { xs: 28, sm: 36 },
                  border: '1px solid',
                  borderColor:
                    cur >= max
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(201,168,76,0.4)',
                  borderRadius: 0.75,
                  color: 'primary.light',
                  '&:hover': { background: 'rgba(201,168,76,0.15)' },
                  '&.Mui-disabled': { opacity: 0.25 },
                }}
              >
                <AddIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
              </IconButton>
            </Box>
          </Box>
        )
      })}
    </Box>
  )

  const renderSecondaryContent = () => (
    <>
      {/* Stat block */}
      {baseStats && isXs && (
        <StatGrid
          baseStats={baseStats}
          statIncreases={statIncreases}
          statDecreases={statDecreases}
          equipmentBonuses={{ defence: equipBonus.defence }}
        />
      )}
      {baseStats && !isXs && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {ALL_STATS.map(({ key, label }) => {
            const raw = baseStats[key]
            if (raw === undefined || raw === null) return null
            const display = formatStat(key, raw)
            const colour = statColour(key, raw)
            const highlighted =
              !!colour || (key === 'defence' && equipBonus.defence > 0)
            return (
              <Box
                key={key}
                sx={{
                  textAlign: 'center',
                  minWidth: { xs: 32, sm: 30 },
                  maxWidth: 48,
                  flex: { xs: '0 0 calc(20% - 4px)', sm: 1 },
                  px: 0.5,
                  py: 0.25,
                  border: '1px solid',
                  borderColor: colour
                    ? colour === '#2ecc71'
                      ? 'success.dark'
                      : 'error.dark'
                    : highlighted
                      ? 'primary.dark'
                      : 'divider',
                  borderRadius: 0.5,
                  background: colour
                    ? colour === '#2ecc71'
                      ? 'rgba(46,204,113,0.08)'
                      : 'rgba(231,76,60,0.08)'
                    : highlighted
                      ? 'rgba(201,168,76,0.08)'
                      : 'rgba(0,0,0,0.2)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.5rem',
                    opacity: 0.5,
                    display: 'block',
                    lineHeight: 1,
                  }}
                >
                  {label}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    lineHeight: 1.3,
                    color: colour ?? 'inherit',
                  }}
                >
                  {display}
                </Typography>
              </Box>
            )
          })}
        </Box>
      )}

      {/* M/W/F interactive controls for heroes (skip at sm — shown outside collapse) */}
      {hasHeroStats && !isSm && renderMwfControls()}

      {/* Equipment chips */}
      {(() => {
        const envenomChips = synthesizeEnvenomChips(specialRules)
        const allEquipment = [...mm.equipment, ...envenomChips]
        if (allEquipment.length === 0) return null
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {allEquipment.map((eq) => (
              <Chip
                key={eq}
                label={getWargearLabel(eq)}
                size="small"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  onChipTap(e.currentTarget, getChipDescription(eq, 'wargear'))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onChipTap(e.currentTarget, getChipDescription(eq, 'wargear'))
                  }
                }}
                sx={{ fontSize: '0.6rem', height: 18, cursor: 'pointer' }}
              />
            ))}
          </Box>
        )
      })()}

      {/* Special rules chips */}
      {(() => {
        const filteredRules = filterEnvenomFromRules(specialRules)
        if (filteredRules.length === 0) return null
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {filteredRules.map((r, idx) => {
              const label = formatSpecialRule(r)
              const key = typeof r === 'string' ? r : `${r.id}-${idx}`
              const ruleId = typeof r === 'string' ? r : r.id
              const parameter = typeof r === 'object' ? String(r.parameter) : undefined
              return (
                <Chip
                  key={key}
                  label={label}
                  size="small"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    onChipTap(e.currentTarget, getChipDescription(ruleId, 'specialRule', parameter))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onChipTap(e.currentTarget, getChipDescription(ruleId, 'specialRule', parameter))
                    }
                  }}
                  sx={{
                    fontSize: '0.6rem',
                    height: 18,
                    borderColor: 'primary.dark',
                    color: 'primary.light',
                    border: '1px solid',
                    background: 'rgba(201,168,76,0.05)',
                    cursor: 'pointer',
                  }}
                />
              )
            })}
          </Box>
        )
      })()}

      {/* Toolkit items */}
      {(() => {
        const memberToolkit = toolkitItems.filter((t) => t.memberId === mm.memberId)
        if (memberToolkit.length === 0) return null
        return (
          <Box sx={{ mb: 1 }}>
            <Typography
              variant="caption"
              sx={{ opacity: 0.55, display: 'block', mb: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
              Toolkit
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {memberToolkit.map((item) => {
                const used = mm.usedToolkitItems?.includes(item.itemId) ?? false
                if (isPostMatchOnlyItem(item.itemId)) {
                  return (
                    <Chip
                      key={item.itemId}
                      label={getToolkitItemLabel(item)}
                      size="small"
                      sx={{
                        fontSize: '0.6rem',
                        height: 18,
                        borderColor: 'primary.dark',
                        color: 'primary.light',
                        border: '1px solid',
                        background: 'rgba(201,168,76,0.05)',
                      }}
                    />
                  )
                }
                if (isConsumable(item.itemId)) {
                  if (used) {
                    return (
                      <Box key={item.itemId} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '0.6rem', textDecoration: 'line-through', opacity: 0.5, color: 'text.secondary' }}>
                          {getToolkitItemLabel(item)}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => onRemoveToolkitItem(item.itemId)}
                          sx={{ fontSize: '0.55rem', py: 0.25, px: 0.75, minHeight: 0 }}
                        >
                          Remove
                        </Button>
                      </Box>
                    )
                  }
                  return (
                    <Button
                      key={item.itemId}
                      size="small"
                      variant="outlined"
                      onClick={() => onUseToolkitItem(item.itemId)}
                      sx={{
                        fontSize: '0.6rem',
                        py: 0.25,
                        px: 1,
                        minHeight: 0,
                        borderColor: 'primary.dark',
                        color: 'primary.light',
                      }}
                    >
                      {getToolkitItemLabel(item)} · Use
                    </Button>
                  )
                }
                return (
                  <Chip
                    key={item.itemId}
                    label={getToolkitItemLabel(item)}
                    size="small"
                    sx={{ fontSize: '0.6rem', height: 18 }}
                  />
                )
              })}
            </Box>
          </Box>
        )
      })()}
    </>
  )

  // ── XP row (only for non-ATO wanderers) ────────────────────────────────────

  const renderXpRow = () => {
    if (isAtoWanderer) return null
    return (
      <>
        <Divider sx={{ opacity: 0.2, mb: 1 }} />
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 0.5, sm: 0 },
          }}
        >
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            XP gained this match
            <Typography
              component="span"
              variant="caption"
              sx={{ opacity: 0.45, ml: 0.5 }}
            >
              (+1 participation added at end)
            </Typography>
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => onXpChange(-1)}
              disabled={mm.xpCounterGains === 0}
              sx={{
                p: 0.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 0.5,
              }}
            >
              <RemoveIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <Typography
              sx={{
                fontFamily: '"Cinzel Decorative", serif',
                fontSize: '1.1rem',
                color: mm.xpCounterGains > 0 ? 'primary.main' : 'text.secondary',
                minWidth: 28,
                textAlign: 'center',
                lineHeight: 1,
              }}
            >
              {mm.xpCounterGains}
            </Typography>
            <IconButton
              size="small"
              onClick={() => onXpChange(1)}
              sx={{
                p: 0.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 0.5,
              }}
            >
              <AddIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>
      </>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <MotionBox
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay }}
      sx={{
        border: '1px solid',
        borderColor: mm.isCasualty
          ? 'error.main'
          : mm.role === 'leader'
            ? 'primary.main'
            : isHero
              ? 'primary.dark'
              : 'divider',
        borderRadius: 1,
        p: { xs: 1, sm: 1.5 },
        background: mm.isCasualty
          ? 'rgba(192,57,43,0.06)'
          : isHero
            ? 'rgba(201,168,76,0.03)'
            : 'transparent',
        opacity: mm.isCasualty ? 0.65 : 1,
        transition: 'all 0.15s',
      }}
    >
      {/* PrimaryInfoRow — always visible */}
      <PrimaryInfoRow
        mm={mm}
        expanded={expanded}
        onToggle={handleToggle}
        onXpChange={onXpChange}
        onCasualtyToggle={onCasualtyToggle}
        onMwfChange={onMwfChange}
        showMwfSummary={false}
        showMwfControls={isSm && isHero}
        showXpCounter={!isMd}
        showChevron={!isMd}
      />

      {/* md+: render all content flat (no Collapse) */}
      {isMd && (
        <Box sx={{ mt: 1 }}>
          {renderSecondaryContent()}
          {renderXpRow()}
        </Box>
      )}

      {/* xs/sm: wrap secondary content in Collapse */}
      {!isMd && (
        <Collapse
          in={expanded}
          timeout="auto"
          unmountOnExit={false}
        >
          <Box
            id={collapsePanelId}
            aria-hidden={!expanded}
            sx={{ mt: 1 }}
          >
            {renderSecondaryContent()}
          </Box>
        </Collapse>
      )}
    </MotionBox>
  )
}
