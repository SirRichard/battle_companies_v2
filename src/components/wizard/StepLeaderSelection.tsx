import { Box, Typography, Chip } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import { motion } from 'framer-motion'
import { getUnitLabel, formatEquipment } from '../../utils/labels'
import type { CompanyDefinition } from '../../models'
import { generateTempMemberIds } from '../../services/company/companyFactory'

interface Props {
  companyDef: CompanyDefinition
  memberNames: Record<string, string>
  leaderId: string | null
  sergeantIds: string[]
  onSelectLeader: (tempId: string) => void
  onToggleSergeant: (tempId: string) => void
  forcedLeaderId?: string | null
  forcedSergeantIds?: string[]
}

const MAX_SERGEANTS = 2

export default function StepLeaderSelection({
  companyDef,
  memberNames,
  leaderId,
  sergeantIds,
  onSelectLeader,
  onToggleSergeant,
  forcedLeaderId = null,
  forcedSergeantIds = [],
}: Props) {
  const tempIds = generateTempMemberIds(companyDef)

  // Build member display list
  let idx = 0
  const members: Array<{
    tempId: string
    displayName: string
    unitLabel: string
    equipment: string[]
  }> = []

  for (const entry of companyDef.startingRoster) {
    const unitLabel = getUnitLabel(entry.baseUnitId)

    for (let i = 0; i < entry.count; i++) {
      const tempId = tempIds[idx]
      const customName = memberNames[tempId]
      const displayName = customName?.trim() || `Warrior #${idx + 1}`
      members.push({
        tempId,
        displayName,
        unitLabel,
        equipment: entry.equipment ?? [],
      })
      idx++
    }
  }

  const getRole = (tempId: string) => {
    if (tempId === leaderId) return 'leader'
    if (sergeantIds.includes(tempId)) return 'sergeant'
    return null
  }

  const handleClick = (tempId: string) => {
    const role = getRole(tempId)

    if (role === 'leader') {
      // Clicking the leader deselects them
      onSelectLeader('')
    } else if (role === 'sergeant') {
      // Clicking a sergeant removes them
      onToggleSergeant(tempId)
    } else if (!leaderId) {
      // No leader yet — assign leader
      onSelectLeader(tempId)
    } else if (sergeantIds.length < MAX_SERGEANTS) {
      // Leader exists, need sergeants — assign sergeant
      onToggleSergeant(tempId)
    }
    // If both slots filled, tapping a warrior does nothing (must deselect first)
  }

  const heroesNeeded = (leaderId ? 0 : 1) + (MAX_SERGEANTS - sergeantIds.length)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.7 }}>
        Choose 1 Leader and 2 Sergeants from your starting roster. Heroes
        receive 1 Might, 1 Will, and 1 Fate. Tap a member to assign them.
      </Typography>

      {/* Progress indicator */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          p: 1.5,
          background: 'rgba(200,164,90,0.05)',
          border: '1px solid rgba(200,164,90,0.12)',
          borderRadius: 1,
          flexWrap: 'wrap',
        }}
      >
        <HeroSlot label="Leader" filled={!!leaderId} />
        <HeroSlot label="Sergeant I" filled={sergeantIds.length >= 1} />
        <HeroSlot label="Sergeant II" filled={sergeantIds.length >= 2} />
        {heroesNeeded > 0 && (
          <Typography
            variant="caption"
            sx={{
              opacity: 0.5,
              fontStyle: 'italic',
              alignSelf: 'center',
              ml: 'auto',
            }}
          >
            {heroesNeeded} more to select
          </Typography>
        )}
      </Box>

      {/* Member list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {members.map((member, i) => {
          const role = getRole(member.tempId)
          const isHero = !!role
          const isLeader = role === 'leader'
          const isSergeant = role === 'sergeant'
          const allFilled = !!leaderId && sergeantIds.length >= MAX_SERGEANTS
          const isDisabled = !isHero && allFilled

          const isLockedLeader = member.tempId === forcedLeaderId
          const isLockedSergeant = forcedSergeantIds.includes(member.tempId)
          const isLocked = isLockedLeader || isLockedSergeant

          return (
            <motion.div
              key={member.tempId}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
            >
              <Box
                onClick={() => !isDisabled && !isLocked && handleClick(member.tempId)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 2,
                  py: 1.5,
                  border: '1px solid',
                  borderColor: isLeader
                    ? '#c8a45a'
                    : isSergeant
                      ? 'rgba(200,164,90,0.5)'
                      : 'rgba(200,164,90,0.14)',
                  borderRadius: 1,
                  background: isLeader
                    ? 'rgba(200,164,90,0.12)'
                    : isSergeant
                      ? 'rgba(200,164,90,0.07)'
                      : 'transparent',
                  cursor: isLocked ? 'default' : isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.4 : 1,
                  transition: 'all 0.18s',
                  '&:hover': isDisabled || isLocked
                    ? {}
                    : {
                        borderColor: isHero
                          ? 'rgba(200,64,90,0.3)'
                          : 'rgba(200,164,90,0.4)',
                        background: isHero
                          ? 'rgba(192,57,43,0.08)'
                          : 'rgba(200,164,90,0.05)',
                      },
                }}
              >
                {/* Role icon */}
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '1px solid',
                    borderColor: isLeader
                      ? 'primary.main'
                      : isSergeant
                        ? 'rgba(200,164,90,0.5)'
                        : 'rgba(200,164,90,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: isHero
                      ? 'rgba(200,164,90,0.15)'
                      : 'transparent',
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.65rem',
                      color: isHero ? 'primary.main' : 'text.disabled',
                      fontWeight: 700,
                    }}
                  >
                    {isLeader ? 'L' : isSergeant ? 'S' : '·'}
                  </Typography>
                </Box>

                {/* Name and type */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.88rem',
                      fontWeight: isHero ? 600 : 400,
                      color: isHero ? 'text.primary' : 'text.secondary',
                      lineHeight: 1.3,
                    }}
                  >
                    {member.displayName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.5, lineHeight: 1 }}
                  >
                    {member.unitLabel}
                    {member.equipment.length > 0 && (
                      <> · {formatEquipment(member.equipment)}</>
                    )}
                  </Typography>
                </Box>

                {/* Role badge */}
                {isHero && (
                  <Chip
                    label={isLeader ? 'Leader' : 'Sergeant'}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontFamily: '"Cinzel", serif',
                      letterSpacing: '0.04em',
                      bgcolor: isLeader
                        ? 'rgba(200,164,90,0.2)'
                        : 'rgba(200,164,90,0.1)',
                      borderColor: isLeader
                        ? 'primary.main'
                        : 'rgba(200,164,90,0.4)',
                      color: 'primary.main',
                    }}
                  />
                )}

                {/* Lock indicator for forced roles */}
                {isLocked && (
                  <LockIcon
                    sx={{
                      fontSize: '0.95rem',
                      color: 'primary.main',
                      opacity: 0.7,
                      flexShrink: 0,
                    }}
                  />
                )}

                {/* M/W/F badge for heroes */}
                {isHero && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.7rem',
                      color: 'primary.dark',
                      opacity: 0.8,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    M1 W1 F1
                  </Typography>
                )}
              </Box>
            </motion.div>
          )
        })}
      </Box>

      {heroesNeeded === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Typography
            sx={{
              textAlign: 'center',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.82rem',
              color: 'primary.main',
              opacity: 0.8,
              fontStyle: 'italic',
              mt: 1,
            }}
          >
            Your heroes are chosen. The company is ready to march.
          </Typography>
        </motion.div>
      )}
    </Box>
  )
}

// ─── HeroSlot ────────────────────────────────────────────────────────────────

function HeroSlot({ label, filled }: { label: string; filled: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          border: '1px solid',
          borderColor: filled ? 'primary.main' : 'rgba(200,164,90,0.3)',
          bgcolor: filled ? 'primary.main' : 'transparent',
          transition: 'all 0.2s',
          boxShadow: filled ? '0 0 6px rgba(200,164,90,0.4)' : 'none',
        }}
      />
      <Typography
        variant="caption"
        sx={{
          fontFamily: '"Cinzel", serif',
          fontSize: '0.7rem',
          letterSpacing: '0.04em',
          color: filled ? 'primary.main' : 'text.disabled',
          transition: 'color 0.2s',
        }}
      >
        {label}
      </Typography>
    </Box>
  )
}
