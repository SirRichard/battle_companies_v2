import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Divider, Chip, Tab, Tabs, Fab } from '@mui/material'
import { motion } from 'framer-motion'
import SportsMartialArtsIcon from '@mui/icons-material/SportsMartialArts'
import HistoryIcon from '@mui/icons-material/History'
import StorefrontIcon from '@mui/icons-material/Storefront'
import AddIcon from '@mui/icons-material/Add'
import PageHeader from '../components/common/PageHeader'
import MemberDetailsDrawer from '../components/common/MemberDetailsDrawer'
import { useAppContext } from '../context/AppContext'
import type { Company, CompanyDefinition, Member } from '../models'
import { getCompanyLabel, getUnitLabel, getWargearLabel } from '../utils/labels'
import { calcCompanyRating } from '../utils/rating'
import companiesData from '../data/companies.json'
import baseUnitsData from '../data/baseUnits.json'
import wargearData from '../data/wargear.json'

const COMPANIES_DEF = companiesData as CompanyDefinition[]
const BASE_UNITS_RAW = baseUnitsData as Array<{
  id: string
  baseEquipment: string[]
}>
const WARGEAR_RAW = wargearData as Array<{ id: string; category: string }>

const MotionBox = motion(Box)

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
  for (const uid of Array.from(ids)) {
    const unit = BASE_UNITS_RAW.find((u) => u.id === uid)
    if (unit) {
      for (const eq of unit.baseEquipment) {
        if (WARGEAR_RAW.some((w) => w.id === eq && w.category === 'mount'))
          ids.add(eq)
      }
    }
  }
  return Array.from(ids)
}

const ROLE_ORDER: Record<string, number> = {
  leader: 0,
  sergeant: 1,
  hero_in_making: 2,
  warrior: 3,
}

function roleLabel(role: string): string {
  if (role === 'leader') return 'Leader'
  if (role === 'sergeant') return 'Sergeant'
  if (role === 'hero_in_making') return 'Hero in the Making'
  return ''
}

export default function CompanyDetailsPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    companies,
    setActiveCompany,
    activeCompany,
    getStatsForUnit,
    saveCompany,
  } = useAppContext()

  const [activeTab, setActiveTab] = useState(0)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  const company: Company | null =
    companies.find((c) => c.id === companyId) ?? activeCompany

  useEffect(() => {
    if (company) setActiveCompany(company)
  }, [company, setActiveCompany])

  const hasMissingStats = useMemo(() => {
    if (!company) return false
    return getRequiredUnitIds(company.companyTypeId).some(
      (id) => !getStatsForUnit(id)
    )
  }, [company, getStatsForUnit])

  useEffect(() => {
    if (!company) return
    if (searchParams.get('statsRequired') === 'true') {
      navigate(`/stats?companyId=${company.id}`, { replace: true })
      return
    }
    if (hasMissingStats)
      navigate(`/stats?companyId=${company.id}`, { replace: true })
  }, [company, searchParams, hasMissingStats, navigate])

  const companyRating = useMemo(
    () => (company ? calcCompanyRating(company.members, getStatsForUnit) : 0),
    [company, getStatsForUnit]
  )

  const handleRename = useCallback(
    async (memberId: string, newName: string) => {
      if (!company) return
      const updated: Company = {
        ...company,
        members: company.members.map((m) =>
          m.id === memberId ? { ...m, name: newName } : m
        ),
      }
      await saveCompany(updated)
      setSelectedMember(updated.members.find((m) => m.id === memberId) ?? null)
    },
    [company, saveCompany]
  )

  if (!company) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h4">Company not found.</Typography>
      </Box>
    )
  }

  const heroes = company.members
    .filter((m) => m.role !== 'warrior')
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
  const warriors = company.members.filter((m) => m.role === 'warrior')

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
          gap: { xs: 2, sm: 3 },
          flexWrap: 'wrap',
          borderBottom: '1px solid',
          borderColor: 'divider',
          background: 'rgba(0,0,0,0.2)',
          flexShrink: 0,
        }}
      >
        {[
          { label: 'Rating', value: `${companyRating}`, highlight: true },
          { label: 'Influence', value: `${company.influence} IP` },
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

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
          background: 'rgba(0,0,0,0.15)',
          '& .MuiTab-root': {
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.65rem',
            letterSpacing: '0.08em',
            minHeight: 44,
            color: 'text.secondary',
            '&.Mui-selected': { color: 'primary.main' },
          },
          '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
        }}
      >
        <Tab
          icon={<SportsMartialArtsIcon sx={{ fontSize: '1rem' }} />}
          iconPosition="start"
          label="Roster"
        />
        <Tab
          icon={<HistoryIcon sx={{ fontSize: '1rem' }} />}
          iconPosition="start"
          label="History"
        />
        <Tab
          icon={<StorefrontIcon sx={{ fontSize: '1rem' }} />}
          iconPosition="start"
          label="Store"
        />
      </Tabs>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {/* ── ROSTER ── */}
        {activeTab === 0 && (
          <Box
            sx={{
              px: { xs: 2, sm: 3 },
              py: 3,
              maxWidth: 700,
              mx: 'auto',
              pb: 10,
            }}
          >
            {heroes.length > 0 && (
              <MotionBox
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Typography variant="h3" sx={{ mb: 1.5 }}>
                  Heroes
                </Typography>
                <Divider sx={{ mb: 2, opacity: 0.4 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {heroes.map((member, i) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      isHero
                      delay={i * 0.05}
                      onClick={() => setSelectedMember(member)}
                    />
                  ))}
                </Box>
              </MotionBox>
            )}

            {warriors.length > 0 && (
              <MotionBox
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: heroes.length > 0 ? 0.1 : 0,
                }}
                sx={{ mt: heroes.length > 0 ? 3 : 0 }}
              >
                <Typography variant="h3" sx={{ mb: 1.5 }}>
                  Warriors
                </Typography>
                <Divider sx={{ mb: 2, opacity: 0.4 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {warriors.map((member, i) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      isHero={false}
                      delay={i * 0.04}
                      onClick={() => setSelectedMember(member)}
                    />
                  ))}
                </Box>
              </MotionBox>
            )}
          </Box>
        )}

        {/* ── HISTORY ── */}
        {activeTab === 1 && <HistoryTab company={company} />}

        {/* ── STORE ── */}
        {activeTab === 2 && <StoreTab />}
      </Box>

      {/* FAB */}
      {activeTab === 0 && (
        <Fab
          variant="extended"
          size="medium"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'linear-gradient(180deg, #D4A84C 0%, #8B6914 100%)',
            border: '1px solid #C9A84C',
            color: '#1A0F05',
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.65rem',
            letterSpacing: '0.08em',
            gap: 0.75,
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            '&:hover': {
              background: 'linear-gradient(180deg, #E8CC7A 0%, #A07820 100%)',
            },
          }}
        >
          <AddIcon sx={{ fontSize: '1.1rem' }} />
          Start Match
        </Fab>
      )}

      <MemberDetailsDrawer
        member={selectedMember}
        baseStats={
          selectedMember
            ? getStatsForUnit(selectedMember.baseUnitId)
            : undefined
        }
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        onRename={handleRename}
      />
    </Box>
  )
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: Member
  isHero: boolean
  delay: number
  onClick: () => void
}

function MemberRow({ member, isHero, delay, onClick }: MemberRowProps) {
  const hasMissingNextGame = member.injuries.some(
    (i) => i.type === 'missing_next_game'
  )
  const otherInjuries = member.injuries.filter(
    (i) => i.type !== 'missing_next_game'
  )

  return (
    <MotionBox
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay }}
      onClick={onClick}
      sx={{
        p: isHero ? 2 : 1.5,
        border: '1px solid',
        borderColor: isHero
          ? member.role === 'leader'
            ? 'primary.main'
            : 'primary.dark'
          : 'divider',
        borderRadius: 1,
        background: isHero ? 'rgba(201,168,76,0.04)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        opacity: hasMissingNextGame ? 0.5 : 1,
        transition: 'border-color 0.15s, background 0.15s, opacity 0.15s',
        '&:hover': {
          borderColor: isHero ? 'primary.main' : 'rgba(200,164,90,0.4)',
          background: 'rgba(201,168,76,0.06)',
        },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
            {member.name}
          </Typography>
          {hasMissingNextGame && (
            <Chip
              label="Injured"
              size="small"
              sx={{
                fontSize: '0.6rem',
                background: 'rgba(192,57,43,0.15)',
                color: 'error.light',
                border: '1px solid',
                borderColor: 'error.main',
                height: 18,
              }}
            />
          )}
          {otherInjuries.map((inj, i) => (
            <Chip
              key={i}
              label={
                inj.type === 'arm_wound'
                  ? '🦾 Arm'
                  : inj.type === 'leg_wound'
                    ? '🦿 Leg'
                    : '⚔️ Honour'
              }
              size="small"
              sx={{
                fontSize: '0.6rem',
                background: 'rgba(192,57,43,0.1)',
                color: 'error.light',
                border: '1px solid',
                borderColor: 'error.dark',
                height: 18,
              }}
            />
          ))}
        </Box>
        <Typography
          variant="caption"
          sx={{ fontStyle: 'italic', color: 'text.secondary' }}
        >
          {getUnitLabel(member.baseUnitId)}
        </Typography>
      </Box>

      {isHero && roleLabel(member.role) && (
        <Chip
          label={roleLabel(member.role)}
          size="small"
          sx={{
            flexShrink: 0,
            fontSize: '0.62rem',
            borderColor:
              member.role === 'leader' ? 'primary.main' : 'primary.dark',
            color: member.role === 'leader' ? 'primary.main' : 'primary.light',
            border: '1px solid',
            background: 'transparent',
          }}
        />
      )}

      {isHero && member.heroStats && (
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          {(['might', 'will', 'fate'] as const).map((stat) => (
            <Box key={stat} sx={{ textAlign: 'center', minWidth: 18 }}>
              <Typography
                sx={{
                  fontSize: '0.55rem',
                  opacity: 0.5,
                  display: 'block',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                {stat[0]}
              </Typography>
              <Typography
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: '0.8rem',
                  color: 'primary.light',
                  lineHeight: 1.2,
                }}
              >
                {member.heroStats![stat]}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {!isHero && member.equipment.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            flexShrink: 0,
            maxWidth: 180,
          }}
        >
          {member.equipment.map((eq) => (
            <Chip
              key={eq}
              label={getWargearLabel(eq)}
              size="small"
              sx={{ fontSize: '0.6rem', height: 20 }}
            />
          ))}
        </Box>
      )}

      <Typography
        variant="caption"
        sx={{
          flexShrink: 0,
          fontStyle: 'normal',
          opacity: 0.45,
          fontSize: '0.65rem',
          minWidth: 28,
          textAlign: 'right',
        }}
      >
        {member.experience}xp
      </Typography>
    </MotionBox>
  )
}

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab({ company }: { company: Company }) {
  if (company.matchHistory.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          px: 4,
          textAlign: 'center',
          opacity: 0.6,
        }}
      >
        <HistoryIcon sx={{ fontSize: 48, mb: 2, color: 'primary.dark' }} />
        <Typography variant="h4" sx={{ mb: 1 }}>
          No Battles Recorded
        </Typography>
        <Typography variant="body2" sx={{ fontStyle: 'italic', maxWidth: 280 }}>
          Your company's deeds have yet to be inscribed in the annals of
          history. Start a match to begin your campaign record.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 3, maxWidth: 700, mx: 'auto' }}>
      {company.matchHistory
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((match, i) => (
          <MotionBox
            key={match.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            sx={{
              p: 2,
              mb: 1.5,
              border: '1px solid',
              borderRadius: 1,
              borderColor:
                match.result === 'win'
                  ? 'success.main'
                  : match.result === 'loss'
                    ? 'error.main'
                    : 'divider',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="h6">
                {match.scenarioId.replace(/_/g, ' ')}
              </Typography>
              <Chip
                label={match.result.toUpperCase()}
                size="small"
                sx={{
                  fontSize: '0.65rem',
                  border: '1px solid',
                  background: 'transparent',
                  color:
                    match.result === 'win'
                      ? 'success.main'
                      : match.result === 'loss'
                        ? 'error.light'
                        : 'text.secondary',
                  borderColor:
                    match.result === 'win'
                      ? 'success.main'
                      : match.result === 'loss'
                        ? 'error.main'
                        : 'divider',
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              {new Date(match.date).toLocaleDateString()} · Opponent:{' '}
              {match.opponentRating} pts · +{match.influenceGained} IP
            </Typography>
          </MotionBox>
        ))}
    </Box>
  )
}

// ─── Store tab ────────────────────────────────────────────────────────────────

function StoreTab() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
        px: 4,
        textAlign: 'center',
        opacity: 0.55,
      }}
    >
      <StorefrontIcon sx={{ fontSize: 48, mb: 2, color: 'primary.dark' }} />
      <Typography variant="h4" sx={{ mb: 1 }}>
        The Armoury
      </Typography>
      <Typography variant="body2" sx={{ fontStyle: 'italic', maxWidth: 300 }}>
        Reinforcements, wanderers, and equipment purchases will be available
        here once the campaign systems are ready.
      </Typography>
    </Box>
  )
}
