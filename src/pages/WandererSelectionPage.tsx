/**
 * WandererSelectionPage
 *
 * Shown when the "Wanderer" ATO bonus is selected (and toolkit is not, or after
 * toolkit assignment). The user picks a wanderer for this match only — the
 * selection is TEMPORARY and stored in ActiveMatchState.members, not in
 * company.wandererId.
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Chip,
} from '@mui/material'
import PageHeader from '../components/common/PageHeader'
import { useAppContext } from '../context/AppContext'
import wanderersData from '../data/wanderers.json'
import type { MemberMatchState } from '../models/match'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WandererEntry {
  id: string
  label: string
  influenceCost: number
  stats: {
    move: number
    fight: number
    shoot: number
    strength: number
    defence: number
    attacks: number
    wounds: number
    courage: number
    intelligence: number
    might: number
    will: number
    fate: number
  }
  equipment: string[]
}

const WANDERERS = wanderersData as WandererEntry[]

// ─── Component ────────────────────────────────────────────────────────────────

export default function WandererSelectionPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const { companies, loadActiveMatch, saveActiveMatch } = useAppContext()

  const company = companies.find((c) => c.id === companyId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hasToolkit, setHasToolkit] = useState(false)

  // Load active match to determine back navigation
  useEffect(() => {
    if (!companyId) return
    loadActiveMatch(companyId).then((m) => {
      if (m) {
        setHasToolkit(m.atoBonuses.includes('toolkit'))
      }
    })
  }, [companyId, loadActiveMatch])

  const handleBack = () => {
    if (hasToolkit) {
      navigate(`/companies/${companyId}/match/toolkit`)
    } else {
      navigate(`/companies/${companyId}/match/setup`)
    }
  }

  const handleConfirm = async () => {
    if (!selectedId || !companyId) return

    const wandererProfile = WANDERERS.find((w) => w.id === selectedId)
    if (!wandererProfile) return

    const match = await loadActiveMatch(companyId)
    if (!match) return

    // Create a synthetic MemberMatchState for the ATO wanderer
    const wandererMember: MemberMatchState = {
      memberId: wandererProfile.id,
      memberName: wandererProfile.label,
      baseUnitId: wandererProfile.id,
      role: 'wanderer',
      equipment: wandererProfile.equipment,
      xpCounterGains: 0,
      isCasualty: false,
      mightMax: wandererProfile.stats.might,
      willMax: wandererProfile.stats.will,
      fateMax: wandererProfile.stats.fate,
      mightCurrent: wandererProfile.stats.might,
      willCurrent: wandererProfile.stats.will,
      fateCurrent: wandererProfile.stats.fate,
    }

    // Append to match members (do NOT set company.wandererId)
    const updatedMatch = {
      ...match,
      members: [...match.members, wandererMember],
    }

    await saveActiveMatch(updatedMatch)
    navigate(`/companies/${companyId}/match`)
  }

  if (!company) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Company not found.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Choose a Wanderer"
        subtitle={company.name}
        onBack={handleBack}
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
        <Typography
          variant="caption"
          sx={{
            opacity: 0.55,
            fontStyle: 'italic',
            display: 'block',
            mb: 2,
          }}
        >
          Select a wanderer to join your company for this match only. They will
          not be permanently hired.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
          {WANDERERS.map((w) => {
            const isSelected = selectedId === w.id
            return (
              <Box
                key={w.id}
                onClick={() => setSelectedId(w.id)}
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
                  '&:hover': {
                    borderColor: 'primary.dark',
                    background: 'rgba(201,168,76,0.05)',
                  },
                }}
              >
                {/* Name + influence cost */}
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
                    {w.label}
                  </Typography>
                  <Chip
                    label={`${w.influenceCost} IP`}
                    size="small"
                    sx={{
                      fontSize: '0.65rem',
                      height: 20,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      color: isSelected ? 'primary.main' : 'text.secondary',
                      border: '1px solid',
                      background: 'transparent',
                    }}
                  />
                </Box>

                {/* Key stats: M/W/F */}
                <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                  {[
                    { label: 'Might', value: w.stats.might },
                    { label: 'Will', value: w.stats.will },
                    { label: 'Fate', value: w.stats.fate },
                  ].map(({ label, value }) => (
                    <Box
                      key={label}
                      sx={{
                        textAlign: 'center',
                        minWidth: 40,
                        px: 0.5,
                        py: 0.25,
                        border: '1px solid',
                        borderColor: 'primary.dark',
                        borderRadius: 0.5,
                        background: 'rgba(201,168,76,0.04)',
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
                        }}
                      >
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* Brief stat summary: Fv / Sv / S / D */}
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.55, display: 'block' }}
                >
                  Fv {w.stats.fight} / Sv {w.stats.shoot}+ / S{w.stats.strength} / D{w.stats.defence} · {w.stats.attacks}A {w.stats.wounds}W
                </Typography>
              </Box>
            )
          })}
        </Box>

        <Button
          variant="contained"
          fullWidth
          size="large"
          disabled={!selectedId}
          onClick={handleConfirm}
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            py: 1.5,
          }}
        >
          Confirm Wanderer
        </Button>
        {!selectedId && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              opacity: 0.5,
              mt: 0.75,
            }}
          >
            Select a wanderer to proceed.
          </Typography>
        )}
      </Box>
    </Box>
  )
}
