/**
 * PathCardSelector — shared swipeable path card UI.
 *
 * Used by:
 *   - StepPathSelection (company creation wizard)
 *   - PostMatchSummaryPage hero advancement dialog (when warrior becomes hero)
 *
 * Props:
 *   selectedPathId   — currently selected path id (or null)
 *   onSelect         — called when user taps "Choose This Path"
 *   baseStats        — optional: unit stats for computing concrete ceilings
 *   headerSlot       — optional React node rendered above the nav row
 */

import React, { useState, useRef, useEffect } from 'react'
import { Box, Typography, Button, Chip, Divider } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { motion, AnimatePresence } from 'framer-motion'
import pathsData from '../../data/paths.json'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathDef {
  id: string
  label: string
  heroicAction?: string
  startingBonus?: { type: string; description: string }
  maximums: Record<string, Record<string, number | undefined>>
  progression: Array<{
    roll: number
    type: string
    label?: string
    description?: string
    options?: unknown[]
  }>
}

interface Props {
  selectedPathId: string | null
  onSelect: (pathId: string) => void
  onCardChange?: (pathId: string) => void
  baseStats?: Record<string, number>
  headerSlot?: React.ReactNode
  cardIndex?: number
  onCardIndexChange?: (index: number) => void
  /** Show an inline "Choose This Path" button on each card (used by post-match dialog) */
  showSelectButton?: boolean
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PATHS = pathsData as unknown as PathDef[]

const HEROIC_ACTION_LABELS: Record<string, string> = {
  heroic_accuracy: 'Heroic Accuracy',
  heroic_challenge: 'Heroic Challenge',
  heroic_channeling: 'Heroic Channelling',
  heroic_defence: 'Heroic Defence',
  heroic_march: 'Heroic March',
  heroic_resolve: 'Heroic Resolve',
  heroic_strength: 'Heroic Strength',
  heroic_strike: 'Heroic Strike',
}

const PATH_DESCRIPTIONS: Record<string, string> = {
  path_of_the_tactician:
    'A master of momentum and battlefield positioning, controlling the flow of every engagement.',
  path_of_the_sharpshooter:
    'A deadly marksman who looses arrows with preternatural speed and precision.',
  path_of_the_soldier:
    'A ferocious warrior who wins the day through sheer aggression and relentless fighting spirit.',
  path_of_the_marksman:
    'A patient hunter whose every arrow finds its mark, even through the thickest of mêlées.',
  path_of_the_claimant:
    'A duelist who thrives against mighty foes, growing stronger with every worthy opponent slain.',
  path_of_the_sorcerer:
    'A wielder of arcane power who bends fate through the careful casting of magical arts.',
  path_of_the_shieldbearer:
    'An ironclad bulwark who turns defence into strength, protecting allies through unyielding resolve.',
  path_of_the_ranger:
    'A swift ranger who traverses any terrain with ease and rallies allies to move as one.',
  path_of_the_warlord:
    'A commanding leader whose presence alone steels the hearts of all who fight alongside them.',
  path_of_the_berserker:
    'A powerhouse warrior who strikes with devastating force, breaking enemies with raw might.',
  path_of_the_duelist:
    'A bladesman of unsurpassed skill whose fight value strikes fear into all who face them.',
}

const SIGNATURE_STAT: Record<string, string> = {
  path_of_the_tactician: 'Will',
  path_of_the_sharpshooter: 'Shoot Value',
  path_of_the_soldier: 'Fight Value',
  path_of_the_marksman: 'Shoot Value',
  path_of_the_claimant: 'Might',
  path_of_the_sorcerer: 'Will',
  path_of_the_shieldbearer: 'Defence',
  path_of_the_ranger: 'Move',
  path_of_the_warlord: 'Courage & Intelligence',
  path_of_the_berserker: 'Strength',
  path_of_the_duelist: 'Fight Value',
}

// ─── Ceiling helpers ──────────────────────────────────────────────────────────

const RELATIVE_STAT_KEYS = [
  'move',
  'fight',
  'shoot',
  'strength',
  'defence',
  'courage',
  'intelligence',
] as const
const ABSOLUTE_STAT_KEYS = [
  'attacks',
  'wounds',
  'might',
  'will',
  'fate',
] as const
const HERO_START: Record<string, number> = {
  might: 1,
  will: 1,
  fate: 1,
  attacks: 1,
  wounds: 1,
}

const CEILING_STATS: Array<{
  key: string
  label: string
  isTargetNumber?: boolean
}> = [
  { key: 'move', label: 'Mv' },
  { key: 'fight', label: 'Fv' },
  { key: 'shoot', label: 'Sv', isTargetNumber: true },
  { key: 'strength', label: 'S' },
  { key: 'defence', label: 'D' },
  { key: 'attacks', label: 'A' },
  { key: 'wounds', label: 'W' },
  { key: 'might', label: 'M' },
  { key: 'will', label: 'Wi' },
  { key: 'fate', label: 'F' },
]

interface PathMaximums {
  relative?: Record<string, number>
  absolute?: Record<string, number>
}

function computeCeilings(
  maximums: PathMaximums,
  baseStats: Record<string, number> | undefined
): Array<{
  key: string
  label: string
  ceiling: string
  isHighlighted: boolean
}> {
  return CEILING_STATS.map(({ key, label, isTargetNumber }) => {
    const rel = maximums.relative ?? {}
    const abs = maximums.absolute ?? {}
    let ceiling: number | null = null
    let isHighlighted = false

    if (
      RELATIVE_STAT_KEYS.includes(key as (typeof RELATIVE_STAT_KEYS)[number])
    ) {
      if (key in rel) {
        if (baseStats) {
          const base = baseStats[key] ?? 0
          ceiling = base + rel[key]
          isHighlighted = rel[key] > 1
        } else {
          const display = isTargetNumber ? `-${rel[key]}` : `+${rel[key]}`
          return { key, label, ceiling: display, isHighlighted: rel[key] > 1 }
        }
      } else if (key in abs) {
        ceiling = abs[key]
        isHighlighted = true
      }
    } else if (
      ABSOLUTE_STAT_KEYS.includes(key as (typeof ABSOLUTE_STAT_KEYS)[number])
    ) {
      if (key in abs) {
        ceiling = abs[key]
        isHighlighted = ceiling > (HERO_START[key] ?? 1)
      }
    }

    if (ceiling === null)
      return { key, label, ceiling: '—', isHighlighted: false }
    const display = isTargetNumber ? `${ceiling}+` : String(ceiling)
    return { key, label, ceiling: display, isHighlighted }
  })
}

function getUniqueRules(
  path: PathDef
): Array<{ label: string; description: string }> {
  return path.progression
    .filter((e) => [2, 3, 11, 12].includes(e.roll) && e.label && e.description)
    .map((e) => ({ label: e.label!, description: e.description! }))
}

interface MasterOption {
  label: string
  description?: string
}

function getMasterAbility(path: PathDef): MasterOption[] | null {
  const roll7 = path.progression.find((e) => e.roll === 7)
  if (!roll7) return null
  if (roll7.type === 'choice' && Array.isArray(roll7.options)) {
    const results: MasterOption[] = []
    for (const opt of roll7.options as Array<Record<string, unknown>>) {
      if (opt.label) {
        results.push({ label: opt.label as string, description: opt.description as string | undefined })
      } else if (opt.type === 'stat' && Array.isArray(opt.options)) {
        const statNames = (opt.options as string[]).map(
          (s) => s.charAt(0).toUpperCase() + s.slice(1)
        )
        results.push({ label: `+1 ${statNames.join(' or ')}` })
      } else if (opt.type === 'choice' && Array.isArray(opt.options)) {
        const subDescs = (opt.options as Array<{ description?: string }>)
          .map((sub) => sub.description)
          .filter(Boolean)
        results.push({ label: subDescs.join(' / ') || 'Choice' })
      }
    }
    return results.length > 0 ? results : null
  }
  if (roll7.label) return [{ label: roll7.label, description: roll7.description }]
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PathCardSelector({
  selectedPathId,
  onSelect,
  onCardChange,
  baseStats,
  headerSlot,
  cardIndex: controlledIndex,
  onCardIndexChange,
  showSelectButton = false,
}: Props) {
  // Controlled mode: both cardIndex and onCardIndexChange provided
  const isControlled = controlledIndex !== undefined && onCardIndexChange !== undefined

  const [internalIndex, setInternalIndex] = useState(() => {
    const idx = PATHS.findIndex((p) => p.id === selectedPathId)
    return idx >= 0 ? idx : 0
  })
  const [direction, setDirection] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const cardIndex = isControlled ? controlledIndex : internalIndex

  // Notify parent of the initially-viewed path on mount
  useEffect(() => {
    onCardChange?.(PATHS[cardIndex].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= PATHS.length) return
    setDirection(idx > cardIndex ? 1 : -1)
    if (isControlled) {
      onCardIndexChange(idx)
    } else {
      setInternalIndex(idx)
    }
    onCardChange?.(PATHS[idx].id)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 40) goTo(cardIndex + (delta > 0 ? 1 : -1))
    touchStartX.current = null
  }

  const path = PATHS[cardIndex]
  const isSelected = selectedPathId === path.id
  const masterAbility = getMasterAbility(path)
  const uniqueRules = getUniqueRules(path)

  const cardVariants = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.22, ease: 'easeOut' as const },
    },
    exit: (d: number) => ({
      x: d > 0 ? -60 : 60,
      opacity: 0,
      transition: { duration: 0.18 },
    }),
  }

  return (
    <Box>
      {/* Header slot + nav */}
      <Box
        sx={{
          pb: { xs: 1, md: 0 },
          mb: { xs: 1, md: 0 },
        }}
      >
        {headerSlot}

        {/* Navigation row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 0, md: 1.5 } }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => goTo(cardIndex - 1)}
            disabled={cardIndex === 0}
            sx={{ minWidth: 36, p: 0.5, minHeight: 36 }}
          >
            <ChevronLeftIcon />
          </Button>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography
              sx={{
                fontFamily: '"Cinzel Decorative", serif',
                fontSize: { xs: '0.82rem', md: '0.9rem' },
                color: 'primary.main',
                lineHeight: 1.3,
              }}
            >
              {path.label}
            </Typography>
            <Typography
              variant="caption"
              sx={{ opacity: 0.55, fontStyle: 'normal' }}
            >
              {cardIndex + 1} of {PATHS.length}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={() => goTo(cardIndex + 1)}
            disabled={cardIndex === PATHS.length - 1}
            sx={{ minWidth: 36, p: 0.5, minHeight: 36 }}
          >
            <ChevronRightIcon />
          </Button>
        </Box>
      </Box>

      {/* Swipeable card */}
      <Box
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        sx={{ overflow: 'hidden', position: 'relative' }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={path.id}
            custom={direction}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <Box
              sx={{
                border: '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                borderRadius: 1,
                background: isSelected
                  ? 'rgba(201,168,76,0.06)'
                  : 'linear-gradient(160deg, #2A1A0A 0%, #1A0F05 100%)',
                overflow: 'hidden',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              {/* Card header */}
              <Box
                sx={{
                  px: 2.5,
                  pt: 2,
                  pb: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 0.75,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"Cinzel Decorative", serif',
                      fontSize: '1rem',
                      color: 'primary.main',
                      lineHeight: 1.3,
                    }}
                  >
                    {path.label}
                  </Typography>
                  {isSelected && (
                    <Chip
                      label="Selected"
                      size="small"
                      icon={
                        <AutoAwesomeIcon
                          sx={{ fontSize: '0.75rem !important' }}
                        />
                      }
                      sx={{
                        fontSize: '0.62rem',
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        border: '1px solid',
                        background: 'transparent',
                      }}
                    />
                  )}
                </Box>
                <Typography
                  variant="body2"
                  sx={{ fontStyle: 'italic', opacity: 0.75, lineHeight: 1.6 }}
                >
                  {PATH_DESCRIPTIONS[path.id]}
                </Typography>
                {path.heroicAction && (
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={`Grants: ${HEROIC_ACTION_LABELS[path.heroicAction] ?? path.heroicAction}`}
                      size="small"
                      sx={{
                        fontSize: '0.65rem',
                        background: 'rgba(201,168,76,0.12)',
                        borderColor: 'primary.dark',
                        color: 'primary.light',
                        border: '1px solid',
                      }}
                    />
                  </Box>
                )}
                {path.startingBonus && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.75,
                      opacity: 0.65,
                      fontStyle: 'normal',
                    }}
                  >
                    ✦ {path.startingBonus.description}
                  </Typography>
                )}
              </Box>

              {/* Card body */}
              <Box sx={{ px: 2.5, py: 1.5 }}>
                {masterAbility && masterAbility.length > 0 && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography
                      sx={{
                        fontSize: '0.62rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        opacity: 0.5,
                        mb: 0.5,
                        fontFamily: '"IM Fell English", serif',
                      }}
                    >
                      Signature{masterAbility.length > 1 ? ' (choose one)' : ''}
                    </Typography>
                    {masterAbility.map((opt, idx) => (
                      <Typography
                        key={idx}
                        variant="body2"
                        sx={{ color: 'primary.light', fontStyle: 'italic', mb: idx < masterAbility.length - 1 ? 0.5 : 0 }}
                      >
                        {masterAbility.length > 1 && (
                          <Box component="span" sx={{ opacity: 0.5 }}>
                            {'• '}
                          </Box>
                        )}
                        {opt.label}
                      </Typography>
                    ))}
                    {SIGNATURE_STAT[path.id] && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.5, opacity: 0.5, fontStyle: 'normal' }}
                      >
                        Improves {SIGNATURE_STAT[path.id]}
                      </Typography>
                    )}
                  </Box>
                )}

                {(() => {
                  const ceilings = computeCeilings(
                    path.maximums as PathMaximums,
                    baseStats
                  )
                  const hasCeilings = ceilings.some((c) => c.ceiling !== '—')
                  if (!hasCeilings) return null
                  return (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography
                        sx={{
                          fontSize: '0.62rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          opacity: 0.5,
                          mb: 0.75,
                          fontFamily: '"IM Fell English", serif',
                        }}
                      >
                        {baseStats ? 'Stat Ceilings' : 'Maximum Gains'}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}
                      >
                        {ceilings
                          .filter((c) => c.ceiling !== '—')
                          .map((c, idx) => (
                            <Box
                              key={c.key}
                              sx={{
                                flex: 1,
                                textAlign: 'center',
                                py: 0.5,
                                borderLeft: idx === 0 ? 'none' : '1px solid',
                                borderColor: 'divider',
                                background: c.isHighlighted
                                  ? 'rgba(201,168,76,0.07)'
                                  : 'transparent',
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: '0.55rem',
                                  opacity: 0.45,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  lineHeight: 1.2,
                                }}
                              >
                                {c.label}
                              </Typography>
                              <Typography
                                sx={{
                                  fontFamily: '"Cinzel Decorative", serif',
                                  fontSize: '0.75rem',
                                  color: c.isHighlighted
                                    ? 'primary.main'
                                    : 'text.secondary',
                                  lineHeight: 1.3,
                                  fontWeight: c.isHighlighted ? 700 : 400,
                                }}
                              >
                                {c.ceiling}
                              </Typography>
                            </Box>
                          ))}
                      </Box>
                      {!baseStats && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            mt: 0.5,
                            opacity: 0.4,
                            fontStyle: 'normal',
                          }}
                        >
                          Relative gains shown. Exact ceilings visible once
                          stats are recorded.
                        </Typography>
                      )}
                    </Box>
                  )
                })()}

                <Divider sx={{ mb: 1.5, opacity: 0.3 }} />

                <Typography
                  sx={{
                    fontSize: '0.62rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    opacity: 0.5,
                    mb: 1,
                    fontFamily: '"IM Fell English", serif',
                  }}
                >
                  Path Special Rules
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {uniqueRules.map((rule) => (
                    <Box key={rule.label}>
                      <Typography
                        sx={{
                          fontFamily: '"Cinzel Decorative", serif',
                          fontSize: '0.7rem',
                          color: 'text.primary',
                          mb: 0.2,
                        }}
                      >
                        {rule.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          opacity: 0.65,
                          fontStyle: 'normal',
                          lineHeight: 1.5,
                          display: 'block',
                        }}
                      >
                        {rule.description}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Select button (post-match dialog only) */}
              {showSelectButton && (
                <Box sx={{ px: 2.5, pb: 2, pt: 1 }}>
                  <Button
                    fullWidth
                    variant={isSelected ? 'outlined' : 'contained'}
                    onClick={() => onSelect(path.id)}
                    sx={{ minHeight: 44 }}
                  >
                    {isSelected ? 'Path Chosen ✔' : 'Choose This Path'}
                  </Button>
                </Box>
              )}
            </Box>
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Dot indicators */}
      <Box
        sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mt: 1.5 }}
      >
        {PATHS.map((p, i) => (
          <Box
            key={p.id}
            onClick={() => goTo(i)}
            sx={{
              width: i === cardIndex ? 16 : 6,
              height: 6,
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'all 0.2s',
              bgcolor:
                p.id === selectedPathId
                  ? 'primary.main'
                  : i === cardIndex
                    ? 'rgba(200,164,90,0.6)'
                    : 'rgba(200,164,90,0.2)',
            }}
          />
        ))}
      </Box>
    </Box>
  )
}
