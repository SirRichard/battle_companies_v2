import { useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Divider, Chip } from '@mui/material'
import { motion } from 'framer-motion'
import PageHeader from '../components/common/PageHeader'
import { useAppContext } from '../context/AppContext'
import type { CompanyDefinition } from '../models'
import { getCompanyLabel, getUnitLabel, getWargearLabel } from '../utils/labels'
import companiesData from '../data/companies.json'
import baseUnitsData from '../data/baseUnits.json'
import wargearData from '../data/wargear.json'

const COMPANIES_DEF = companiesData as CompanyDefinition[]
const BASE_UNITS_RAW = baseUnitsData as Array<{
  id: string
  baseEquipment: string[]
}>
const WARGEAR_RAW = wargearData as Array<{ id: string; category: string }>

function getRequiredUnitIds(companyTypeId: string): string[] {
  const def = COMPANIES_DEF.find((c) => c.id === companyTypeId)
  if (!def) return []
  const ids = new Set<string>()
  for (const entry of def.startingRoster) ids.add(entry.baseUnitId)
  for (const adv of def.advancements) {
    ids.add(adv.fromBaseUnitId)
    ids.add(adv.toBaseUnitId)
  }
  for (const row of def.reinforcementTable) {
    if (row.baseUnitId) ids.add(row.baseUnitId)
  }
  // Include mounts needed by any of those units
  for (const uid of Array.from(ids)) {
    const unit = BASE_UNITS_RAW.find((u) => u.id === uid)
    if (unit) {
      for (const eq of unit.baseEquipment) {
        if (WARGEAR_RAW.some((w) => w.id === eq && w.category === 'mount')) {
          ids.add(eq)
        }
      }
    }
  }
  return Array.from(ids)
}

const MotionBox = motion(Box)

export default function CompanyDetailsPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { companies, setActiveCompany, activeCompany, getStatsForUnit } =
    useAppContext()

  const company = companies.find((c) => c.id === companyId) ?? activeCompany

  useEffect(() => {
    if (company) setActiveCompany(company)
  }, [company, setActiveCompany])

  // Check that all required stats exist for this company; redirect if not
  const hasMissingStats = useMemo(() => {
    if (!company) return false
    const required = getRequiredUnitIds(company.companyTypeId)
    return required.some((id) => !getStatsForUnit(id))
  }, [company, getStatsForUnit])

  useEffect(() => {
    if (!company) return
    // Explicit redirect from new company creation
    if (searchParams.get('statsRequired') === 'true') {
      navigate(`/stats?companyId=${company.id}`, { replace: true })
      return
    }
    // Stats missing for this company — send to entry before showing details
    if (hasMissingStats) {
      navigate(`/stats?companyId=${company.id}`, { replace: true })
    }
  }, [company, searchParams, hasMissingStats, navigate])

  if (!company) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h4">Company not found.</Typography>
        <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Home
        </Button>
      </Box>
    )
  }

  const heroes = company.members.filter((m) => m.role !== 'warrior')
  const warriors = company.members.filter((m) => m.role === 'warrior')

  const roleLabel = (role: string) => {
    if (role === 'leader') return 'Leader'
    if (role === 'sergeant') return 'Sergeant'
    if (role === 'hero_in_making') return 'Hero in the Making'
    return 'Warrior'
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title={company.name}
        subtitle={getCompanyLabel(company.companyTypeId)}
        backTo="/companies"
      />

      {/* Stats bar */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.5,
          display: 'flex',
          gap: 3,
          flexWrap: 'wrap',
          borderBottom: '1px solid',
          borderColor: 'divider',
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        {[
          {
            label: 'Influence',
            value: `${company.influence} IP`,
            highlight: true,
          },
          {
            label: 'Record',
            value: `${company.wins}W / ${company.draws}D / ${company.losses}L`,
          },
          { label: 'Members', value: `${company.members.length}` },
          { label: 'Gold', value: `${company.gold}` },
        ].map(({ label, value, highlight }) => (
          <Box key={label}>
            <Typography
              variant="caption"
              sx={{ opacity: 0.6, display: 'block' }}
            >
              {label}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: highlight ? 'primary.main' : 'text.primary',
              }}
            >
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          flex: 1,
          px: { xs: 2, sm: 3 },
          py: 3,
          maxWidth: 700,
          width: '100%',
          mx: 'auto',
        }}
      >
        {/* Heroes */}
        {heroes.length > 0 && (
          <MotionBox
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Typography variant="h3" sx={{ mb: 1.5 }}>
              Heroes
            </Typography>
            <Divider sx={{ mb: 2, opacity: 0.4 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {heroes.map((member) => (
                <Box
                  key={member.id}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor:
                      member.role === 'leader'
                        ? 'primary.main'
                        : 'primary.dark',
                    borderRadius: 1,
                    background: 'rgba(201,168,76,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h6">{member.name}</Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                    >
                      {getUnitLabel(member.baseUnitId)}
                    </Typography>
                  </Box>
                  <Chip
                    label={roleLabel(member.role)}
                    size="small"
                    sx={{
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      border: '1px solid',
                      background: 'transparent',
                      fontSize: '0.7rem',
                    }}
                  />
                  {member.heroStats && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {(['might', 'will', 'fate'] as const).map((stat) => (
                        <Box key={stat} sx={{ textAlign: 'center' }}>
                          <Typography
                            variant="caption"
                            sx={{
                              opacity: 0.6,
                              display: 'block',
                              textTransform: 'uppercase',
                              fontSize: '0.6rem',
                            }}
                          >
                            {stat[0]}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, color: 'primary.light' }}
                          >
                            {member.heroStats![stat]}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </MotionBox>
        )}

        {/* Warriors */}
        {warriors.length > 0 && (
          <MotionBox
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            sx={{ mt: 3 }}
          >
            <Typography variant="h3" sx={{ mb: 1.5 }}>
              Warriors
            </Typography>
            <Divider sx={{ mb: 2, opacity: 0.4 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {warriors.map((member) => (
                <Box
                  key={member.id}
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h6">{member.name}</Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                    >
                      {getUnitLabel(member.baseUnitId)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {member.equipment.map((eq) => (
                      <Chip
                        key={eq}
                        label={getWargearLabel(eq)}
                        size="small"
                        sx={{ fontSize: '0.65rem' }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </MotionBox>
        )}

        {/* Placeholder notice for Phase 2 */}
        <Box
          sx={{
            mt: 4,
            p: 2,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            textAlign: 'center',
            opacity: 0.5,
          }}
        >
          <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
            Full roster management, match tracking, and post-battle sequence
            coming in Phase 2 onwards.
            <br />
            Stats entry is available from the home screen.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
