import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Divider,
  Chip,
  Tab,
  Tabs,
  Fab,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
} from '@mui/material'
import { motion } from 'framer-motion'
import SportsMartialArtsIcon from '@mui/icons-material/SportsMartialArts'
import HistoryIcon from '@mui/icons-material/History'
import StorefrontIcon from '@mui/icons-material/Storefront'
import AddIcon from '@mui/icons-material/Add'
import PageHeader from '../components/common/PageHeader'
import MemberDetailsDrawer from '../components/common/MemberDetailsDrawer'
import { useAppContext } from '../context/AppContext'
import type {
  Company,
  CompanyDefinition,
  Member,
  StoredBaseUnitStats,
} from '../models'
import { getCompanyLabel, getUnitLabel, getWargearLabel } from '../utils/labels'
import { calcCompanyRating, calcMemberRating } from '../utils/rating'
import companiesData from '../data/companies.json'
import baseUnitsData from '../data/baseUnits.json'
import wargearData from '../data/wargear.json'
import equipmentData from '../data/equipment.json'
import creaturesData from '../data/creatures.json'
import wanderersData from '../data/wanderers.json'

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

  const companyDef = useMemo(
    () => COMPANIES_DEF.find((c) => c.id === company?.companyTypeId),
    [company]
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
                      isHero={true}
                      delay={i * 0.05}
                      onClick={() => setSelectedMember(member)}
                      baseStats={getStatsForUnit(member.baseUnitId)}
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
                      baseStats={getStatsForUnit(member.baseUnitId)}
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
        {activeTab === 2 && (
          <StoreTab
            company={company}
            companyDef={companyDef}
            saveCompany={saveCompany}
            getStatsForUnit={getStatsForUnit}
          />
        )}
      </Box>

      {/* FAB */}
      {activeTab === 0 && (
        <Fab
          variant="extended"
          size="medium"
          onClick={() => navigate(`/companies/${company.id}/match/setup`)}
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
        company={company}
        onSaveCompany={saveCompany}
      />
    </Box>
  )
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

interface MemberRowProps {
  key?: string
  member: Member
  isHero: boolean
  delay: number
  onClick: () => unknown
  baseStats?: StoredBaseUnitStats
}

function MemberRow({
  member,
  isHero,
  delay,
  onClick,
  baseStats,
}: MemberRowProps) {
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

      {(() => {
        // Always show base profile equipment + any additional purchased/assigned equipment
        const baseEquip =
          BASE_UNITS_RAW.find((u) => u.id === member.baseUnitId)
            ?.baseEquipment ?? []
        const displayWargear = Array.from(
          new Set([...baseEquip, ...(member.equipment ?? [])])
        )
        return displayWargear.length > 0 ? (
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
            {displayWargear.map((eq) => (
              <Chip
                key={eq}
                label={getWargearLabel(eq)}
                size="small"
                sx={{ fontSize: '0.6rem', height: 20 }}
              />
            ))}
          </Box>
        ) : null
      })()}

      {/* Rating badge */}
      {(() => {
        const rating = calcMemberRating(member, baseStats)
        return (
          <Box sx={{ flexShrink: 0, textAlign: 'right', minWidth: 28 }}>
            <Typography
              variant="caption"
              sx={{ opacity: 0.45, fontSize: '0.62rem', display: 'block' }}
            >
              {member.experience}xp
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontFamily: '"Cinzel Decorative", serif',
                color: 'primary.dark',
                fontSize: '0.62rem',
                display: 'block',
              }}
            >
              {rating}pts
            </Typography>
          </Box>
        )
      })()}
    </MotionBox>
  )
}

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryMatchCard({
  match,
  index,
}: {
  key?: string
  match: import('../models').MatchRecord
  index: number
}) {
  const [expanded, setExpanded] = useState(false)

  const resultColour =
    match.result === 'win'
      ? 'success.main'
      : match.result === 'loss'
        ? 'error.main'
        : 'divider'
  const resultTextColour =
    match.result === 'win'
      ? 'success.main'
      : match.result === 'loss'
        ? 'error.light'
        : 'text.secondary'

  const injuryLabel = (raw: string) =>
    raw.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  return (
    <MotionBox
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      sx={{
        mb: 1.5,
        border: '1px solid',
        borderRadius: 1,
        borderColor: resultColour,
        background: 'rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}
    >
      {/* Summary row — always visible, tappable */}
      <Box
        onClick={() => setExpanded((e) => !e)}
        sx={{
          p: 2,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          '&:hover': { background: 'rgba(255,255,255,0.03)' },
          userSelect: 'none',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {match.scenarioLabel ?? match.scenarioId.replace(/_/g, ' ')}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            {new Date(match.date).toLocaleDateString()} · vs{' '}
            {match.opponentRating} pts · +{match.influenceGained} IP
          </Typography>
        </Box>
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}
        >
          <Chip
            label={match.result.toUpperCase()}
            size="small"
            sx={{
              fontSize: '0.62rem',
              border: '1px solid',
              background: 'transparent',
              color: resultTextColour,
              borderColor: resultColour,
            }}
          />
          <Typography
            sx={{
              opacity: 0.4,
              fontSize: '0.75rem',
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'none',
            }}
          >
            ▼
          </Typography>
        </Box>
      </Box>

      {/* Expanded detail */}
      <Collapse in={expanded}>
        <Box
          sx={{ px: 2, pb: 2, borderTop: '1px solid', borderColor: 'divider' }}
        >
          {/* Meta row */}
          <Box
            sx={{ display: 'flex', gap: 2, mt: 1.5, mb: 1.5, flexWrap: 'wrap' }}
          >
            {[
              {
                label: 'Date',
                value: new Date(match.date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                }),
              },
              {
                label: 'Opponent Rating',
                value: `${match.opponentRating} pts`,
              },
              {
                label: 'Result',
                value:
                  match.result.charAt(0).toUpperCase() + match.result.slice(1),
              },
              {
                label: 'Scenario',
                value:
                  match.scenarioLabel ?? match.scenarioId.replace(/_/g, ' '),
              },
              {
                label: 'Influence Gained',
                value: `+${match.influenceGained} IP`,
              },
            ].map(({ label, value }) => (
              <Box key={label} sx={{ minWidth: 100 }}>
                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.5,
                    display: 'block',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: '0.58rem',
                  }}
                >
                  {label}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Casualties */}
          {match.casualties.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.5,
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontSize: '0.58rem',
                  mb: 0.75,
                }}
              >
                Casualties
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                {match.casualties.map((c) => (
                  <Box
                    key={c.memberId}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      px: 1,
                      py: 0.4,
                      borderRadius: 0.5,
                      background: 'rgba(192,58,43,0.08)',
                      border: '1px solid rgba(192,58,43,0.2)',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {c.memberName}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {injuryLabel(c.injuryResult)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* XP gained */}
          {match.xpGained.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.5,
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontSize: '0.58rem',
                  mb: 0.75,
                }}
              >
                XP Gained
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                {match.xpGained
                  .filter((x) => x.xp > 0)
                  .map((x) => (
                    <Box
                      key={x.memberId}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        px: 1,
                        py: 0.4,
                        borderRadius: 0.5,
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption">{x.memberName}</Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: '"Cinzel Decorative", serif',
                          color: 'primary.main',
                          fontWeight: 700,
                        }}
                      >
                        +{x.xp}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            </Box>
          )}

          {match.casualties.length === 0 &&
            match.xpGained.filter((x) => x.xp > 0).length === 0 && (
              <Typography
                variant="caption"
                sx={{ opacity: 0.5, fontStyle: 'italic' }}
              >
                No detailed records.
              </Typography>
            )}
        </Box>
      </Collapse>
    </MotionBox>
  )
}

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

  const sorted = company.matchHistory
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 3, maxWidth: 700, mx: 'auto' }}>
      {sorted.map((match, i) => (
        <HistoryMatchCard key={match.id} match={match} index={i} />
      ))}
    </Box>
  )
}

// ─── Store tab ────────────────────────────────────────────────────────────────

interface StoreTabProps {
  company: Company
  companyDef: CompanyDefinition | undefined
  saveCompany: (c: Company) => Promise<void>
  getStatsForUnit: (
    id: string
  ) => import('../models').StoredBaseUnitStats | undefined
}

function StoreTab({
  company,
  companyDef,
  saveCompany,
  getStatsForUnit,
}: StoreTabProps) {
  const [section, setSection] = useState<
    'reinforcements' | 'wargear' | 'equipment' | 'creatures' | 'wanderers'
  >('reinforcements')
  const [rollResult, setRollResult] = useState<ReinforcementResult | null>(null)
  const [_isRolling, setIsRolling] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState(0) // standard table adjust
  const [baseRollValue, setBaseRollValue] = useState<number | null>(null)
  const [specialPending, setSpecialPending] = useState(false) // awaiting confirmation to proceed
  const [onSpecialTable, setOnSpecialTable] = useState(false) // currently on special table
  const [specialBaseRoll, setSpecialBaseRoll] = useState<number | null>(null)
  const [specialAdjust, setSpecialAdjust] = useState(0) // adjust spent on special table
  const [msg, setMsg] = useState<string | null>(null)

  // Wargear purchase state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  // Name dialog for new recruits
  const [nameDialog, setNameDialog] = useState<{
    members: Array<{ baseUnitId: string; equipment: string[] }>
    pendingResult: ReinforcementResult
    chosenEquipment?: string[]
  } | null>(null)
  const [pendingNames, setPendingNames] = useState<string[]>([])
  const [limitWarning, setLimitWarning] = useState<string | null>(null)

  if (!companyDef) return null

  const cost = companyDef.reinforcementCost
  const canAffordRoll = company.influence >= cost
  const maxCompanySize = companyDef.maxCompanySize ?? 15
  const atMax = company.members.length >= maxCompanySize

  // ── Roll on reinforcement table ─────────────────────────────────────────────

  function rollOnTable(
    table: import('../models').ReinforcementEntry[],
    rawRoll: number
  ): ReinforcementResult {
    const row = table.find((r) => r.roll.includes(rawRoll))
    if (!row || row.result === 'none') return { type: 'none', roll: rawRoll }
    if (row.result === 'unit') {
      return {
        type: 'unit',
        roll: rawRoll,
        baseUnitId: row.baseUnitId!,
        equipment: row.equipment ?? [],
        rare: row.rare,
      }
    }
    if (row.result === 'choice') {
      return {
        type: 'choice',
        roll: rawRoll,
        baseUnitId: row.baseUnitId!,
        rare: row.rare,
      }
    }
    if (row.result === 'special') {
      return { type: 'special', roll: rawRoll }
    }
    if (row.result === 'choiceFromTable') {
      const includeRolls: number[] = row.includeRolls ?? []
      const options = includeRolls
        .map((r) => rollOnTable(table, r))
        .filter((r) => r.type !== 'none' && r.type !== 'special')
      return { type: 'choiceFromMultiple', roll: rawRoll, options }
    }
    if (row.result === 'choiceFromPool') {
      const pool: Array<{ baseUnitId: string; rare?: number }> = row.pool ?? []
      const options = pool.map((p) => ({
        type: 'unit' as const,
        roll: rawRoll,
        baseUnitId: p.baseUnitId,
        equipment: [],
        rare: p.rare,
      }))
      return { type: 'choiceFromMultiple', roll: rawRoll, options }
    }
    if (row.result === 'pair') {
      const units: Array<{ baseUnitId: string }> = row.units ?? []
      return {
        type: 'pair',
        roll: rawRoll,
        units: units.map((u) => u.baseUnitId),
        rare: row.rare,
      }
    }
    return { type: 'none', roll: rawRoll }
  }

  const hasSpecialTable = !!(
    companyDef.specialTable && companyDef.specialTable.length > 0
  )
  const totalAdjustSpent = adjustAmount + specialAdjust

  // Standard table: show result, but intercept 'special' → show confirmation instead
  const applyRoll = (base: number, adjust: number) => {
    if (!companyDef) return
    const finalRoll = Math.max(1, Math.min(6, base + adjust))
    const result = rollOnTable(companyDef.reinforcementTable, finalRoll)
    if (result.type === 'special' && hasSpecialTable) {
      // Don't auto-roll special table — flag as pending confirmation
      setSpecialPending(true)
      setRollResult({ type: 'special', roll: finalRoll })
    } else {
      setSpecialPending(false)
      setRollResult(result)
    }
  }

  // Called when user confirms they want to proceed to the special table
  const handleConfirmSpecial = () => {
    if (!companyDef?.specialTable) return
    const specialRoll = Math.floor(Math.random() * 6) + 1
    const specialResult = rollOnTable(
      companyDef.specialTable as import('../models').ReinforcementEntry[],
      specialRoll
    )
    setSpecialPending(false)
    setOnSpecialTable(true)
    setSpecialBaseRoll(specialRoll)
    setSpecialAdjust(0)
    setRollResult({ ...specialResult, fromSpecial: true })
  }

  // Adjust the special table roll (uses remaining influence after standard cost)
  const applySpecialRoll = (base: number, adjust: number) => {
    if (!companyDef?.specialTable) return
    const finalRoll = Math.max(1, Math.min(6, base + adjust))
    const specialResult = rollOnTable(
      companyDef.specialTable as import('../models').ReinforcementEntry[],
      finalRoll
    )
    setRollResult({ ...specialResult, fromSpecial: true })
  }

  const handleRoll = () => {
    if (!companyDef || !canAffordRoll || atMax) return
    setIsRolling(true)
    setAdjustAmount(0)
    setSpecialPending(false)
    setOnSpecialTable(false)
    setSpecialBaseRoll(null)
    setSpecialAdjust(0)
    const base = Math.floor(Math.random() * 6) + 1
    setBaseRollValue(base)
    applyRoll(base, 0)
    setIsRolling(false)
  }

  const handleDismissRoll = () => {
    setRollResult(null)
    setAdjustAmount(0)
    setBaseRollValue(null)
    setSpecialPending(false)
    setOnSpecialTable(false)
    setSpecialBaseRoll(null)
    setSpecialAdjust(0)
  }

  const countOfUnit = (baseUnitId: string) =>
    company.members.filter((m) => m.baseUnitId === baseUnitId).length

  // ── Limit helpers ────────────────────────────────────────────────────────────
  const WARGEAR_RAW_MAP = (
    wargearData as Array<{ id: string; category: string }>
  ).reduce<Record<string, string>>((acc, w) => {
    acc[w.id] = w.category
    return acc
  }, {})
  const BASE_UNITS_MAP = (
    baseUnitsData as Array<{
      id: string
      baseEquipment?: string[]
      keywords?: string[]
    }>
  ).reduce<Record<string, { baseEquipment: string[]; keywords: string[] }>>(
    (acc, u) => {
      acc[u.id] = {
        baseEquipment: u.baseEquipment ?? [],
        keywords: u.keywords ?? [],
      }
      return acc
    },
    {}
  )

  const getBowLimit = (): number => {
    for (const rule of companyDef?.companySpecialRules ?? []) {
      for (const o of (rule as any).limitOverrides ?? []) {
        if (o.bowLimit != null) return o.bowLimit
      }
    }
    return 1 / 3
  }

  const getCavalryLimit = (): number => {
    for (const rule of companyDef?.companySpecialRules ?? []) {
      for (const o of (rule as any).limitOverrides ?? []) {
        if (o.cavalryLimit != null) return o.cavalryLimit
      }
    }
    return 1 / 3
  }

  const getBowExemptions = (): string[] => {
    for (const rule of companyDef?.companySpecialRules ?? []) {
      const ex = (rule as any).limitExemptions?.bow
      if (ex) return ex
    }
    return []
  }

  const getCavalryExemptions = (): string[] => {
    for (const rule of companyDef?.companySpecialRules ?? []) {
      const ex = (rule as any).limitExemptions?.cavalry
      if (ex) return ex
    }
    return []
  }

  const hasBowEquipment = (
    baseUnitId: string,
    equipment: string[]
  ): boolean => {
    const baseEquip = BASE_UNITS_MAP[baseUnitId]?.baseEquipment ?? []
    return [...baseEquip, ...equipment].some(
      (e) => WARGEAR_RAW_MAP[e] === 'bow'
    )
  }

  const hasCavalryKeyword = (
    baseUnitId: string,
    equipment: string[]
  ): boolean => {
    const isMount = equipment.some((e) => WARGEAR_RAW_MAP[e] === 'mount')
    const keywords = BASE_UNITS_MAP[baseUnitId]?.keywords ?? []
    return isMount || keywords.includes('cavalry')
  }

  const countBowMembers = (
    extraMembers: Array<{ baseUnitId: string; equipment: string[] }> = []
  ): number => {
    const exemptions = getBowExemptions()
    const all = [
      ...company.members.map((m) => ({
        baseUnitId: m.baseUnitId,
        equipment: m.equipment,
      })),
      ...extraMembers,
    ]
    return all.filter(
      (m) =>
        !exemptions.includes(m.baseUnitId) &&
        hasBowEquipment(m.baseUnitId, m.equipment)
    ).length
  }

  const countCavalryMembers = (
    extraMembers: Array<{ baseUnitId: string; equipment: string[] }> = []
  ): number => {
    const exemptions = getCavalryExemptions()
    const all = [
      ...company.members.map((m) => ({
        baseUnitId: m.baseUnitId,
        equipment: m.equipment,
      })),
      ...extraMembers,
    ]
    return all.filter(
      (m) =>
        !exemptions.includes(m.baseUnitId) &&
        hasCavalryKeyword(m.baseUnitId, m.equipment)
    ).length
  }

  const wouldExceedBowLimit = (
    newMembers: Array<{ baseUnitId: string; equipment: string[] }>
  ): boolean => {
    const total = company.members.length + newMembers.length
    const bows = countBowMembers(newMembers)
    return bows / total > getBowLimit() + 0.001
  }

  const wouldExceedCavalryLimit = (
    newMembers: Array<{ baseUnitId: string; equipment: string[] }>
  ): boolean => {
    const total = company.members.length + newMembers.length
    const cav = countCavalryMembers(newMembers)
    return cav / total > getCavalryLimit() + 0.001
  }

  const wouldExceedThrowingLimit = (
    newMembers: Array<{ baseUnitId: string; equipment: string[] }>
  ): boolean => {
    const total = company.members.length + newMembers.length
    const throwing = [
      ...company.members.map((m) => ({
        baseUnitId: m.baseUnitId,
        equipment: m.equipment,
      })),
      ...newMembers,
    ].filter((m) => {
      const baseEquip = BASE_UNITS_MAP[m.baseUnitId]?.baseEquipment ?? []
      return [...baseEquip, ...m.equipment].some(
        (e) => WARGEAR_RAW_MAP[e] === 'throwing'
      )
    }).length
    return throwing / total > 1 / 3 + 0.001
  }

  const isRareLimitReached = (result: ReinforcementResult) => {
    if (result.type === 'unit' || result.type === 'choice') {
      if (result.rare && countOfUnit(result.baseUnitId!) >= result.rare)
        return true
    }
    if (result.type === 'pair') {
      for (const uid of result.units ?? []) {
        if (result.rare && countOfUnit(uid) >= result.rare) return true
      }
    }
    return false
  }

  const confirmRecruitment = (
    finalResult: ReinforcementResult,
    chosenEquipment?: string[]
  ) => {
    if (!finalResult || finalResult.type === 'none') return

    // Build the candidate new members (equipment only, no id/name yet)
    const candidates: Array<{ baseUnitId: string; equipment: string[] }> = []
    if (finalResult.type === 'unit') {
      candidates.push({
        baseUnitId: finalResult.baseUnitId!,
        equipment: finalResult.equipment ?? [],
      })
    } else if (finalResult.type === 'choice') {
      candidates.push({
        baseUnitId: finalResult.baseUnitId!,
        equipment: chosenEquipment ?? [],
      })
    } else if (finalResult.type === 'pair') {
      for (const uid of finalResult.units ?? [])
        candidates.push({ baseUnitId: uid, equipment: [] })
    }

    // Check limits
    if (wouldExceedBowLimit(candidates)) {
      setLimitWarning(
        'Adding this unit would exceed the bow limit (max 1/3 of company).'
      )
      return
    }
    if (wouldExceedThrowingLimit(candidates)) {
      setLimitWarning(
        'Adding this unit would exceed the throwing weapon limit (max 1/3 of company).'
      )
      return
    }
    if (wouldExceedCavalryLimit(candidates)) {
      setLimitWarning(
        'Adding this unit would exceed the cavalry limit (max 1/3 of company).'
      )
      return
    }

    // Open name dialog
    setLimitWarning(null)
    setPendingNames(candidates.map((c) => getUnitLabel(c.baseUnitId)))
    setNameDialog({
      members: candidates,
      pendingResult: finalResult,
      chosenEquipment,
    })
  }

  const finaliseRecruitment = async () => {
    if (!nameDialog) return
    const { v4: uuidv4 } = await import('uuid')

    const newMembers: import('../models').Member[] = nameDialog.members.map(
      (c, i) => ({
        id: uuidv4(),
        name: pendingNames[i]?.trim() || getUnitLabel(c.baseUnitId),
        baseUnitId: c.baseUnitId,
        role: 'warrior' as import('../models').MemberRole,
        equipment: c.equipment,
        experience: 0,
        lifetimeExperience: 0,
        injuries: [],
        specialRules: [],
        statIncreases: {},
        statDecreases: {},
      })
    )

    await saveCompany({
      ...company,
      influence: company.influence - cost - totalAdjustSpent,
      members: [...company.members, ...newMembers],
    })
    setNameDialog(null)
    setPendingNames([])
    setRollResult(null)
    setAdjustAmount(0)
    setBaseRollValue(null)
    setMsg(`Recruited ${newMembers.map((m) => m.name).join(' & ')}!`)
    setTimeout(() => setMsg(null), 3000)
  }

  // ── Wargear purchase ────────────────────────────────────────────────────────

  const WARGEAR_LIST = wargearData as Array<{
    id: string
    label: string
    category: string
    influenceCost?: number
    rating?: [number, number]
    purchasable?: boolean
  }>

  const purchasableWargear = WARGEAR_LIST.filter(
    (w) =>
      w.purchasable !== false &&
      w.influenceCost !== undefined &&
      w.influenceCost > 0
  )

  // ── Accessible wargear helpers ────────────────────────────────────────────

  // Extract every baseUnitId referenced in a company's tables/advancements
  const getCompanyBaseUnitIds = (): Set<string> => {
    const ids = new Set<string>()
    const addFromEntry = (entry: any) => {
      if (entry.baseUnitId) ids.add(entry.baseUnitId)
      if (entry.toBaseUnitId) ids.add(entry.toBaseUnitId)
      if (entry.fromBaseUnitId) ids.add(entry.fromBaseUnitId)
      if (entry.units)
        (entry.units as any[]).forEach(
          (u: any) => u.baseUnitId && ids.add(u.baseUnitId)
        )
      if (entry.pool)
        (entry.pool as any[]).forEach(
          (u: any) => u.baseUnitId && ids.add(u.baseUnitId)
        )
    }
    for (const entry of companyDef?.startingRoster ?? []) addFromEntry(entry)
    for (const entry of companyDef?.reinforcementTable ?? [])
      addFromEntry(entry)
    for (const entry of (companyDef as any)?.specialTable ?? [])
      addFromEntry(entry)
    for (const entry of companyDef?.advancements ?? []) addFromEntry(entry)
    return ids
  }

  // Armour tier ranking
  const ARMOUR_TIER: Record<string, number> = {
    light_armour: 1,
    armour: 2,
    heavy_armour: 3,
    dwarf_armour: 3,
    heavy_dwarf_armour: 4,
  }

  // Get the wargear IDs accessible to a member (options-only for warriors,
  // all baseEquipment+options across all company units for heroes)
  const getAccessibleWargearIds = (member: Member): Set<string> => {
    const BASE_UNITS_FULL = baseUnitsData as Array<{
      id: string
      baseEquipment?: string[]
      equipmentOptions?: { options: Array<{ equipment: string[] }> }
    }>

    const collectFromUnit = (
      unitId: string,
      includeBase: boolean,
      out: Set<string>
    ) => {
      const unit = BASE_UNITS_FULL.find((u) => u.id === unitId)
      if (!unit) return
      if (includeBase) (unit.baseEquipment ?? []).forEach((e) => out.add(e))
      for (const opt of unit.equipmentOptions?.options ?? []) {
        opt.equipment.forEach((e) => out.add(e))
      }
    }

    const isHero = member.role !== 'warrior'
    const accessible = new Set<string>()

    if (!isHero) {
      // Warriors: only their own equipmentOptions
      collectFromUnit(member.baseUnitId, false, accessible)
    } else {
      // Heroes: baseEquipment + options from all units across the company
      const companyUnitIds = getCompanyBaseUnitIds()
      for (const unitId of companyUnitIds) {
        collectFromUnit(unitId, true, accessible)
      }
    }

    return accessible
  }

  // Determine armour upgrade eligibility for a member
  const getArmourUpgrade = (
    member: Member,
    accessible: Set<string>
  ): string | null => {
    // Current highest armour tier on the member
    const allEquip = [
      ...(BASE_UNITS_MAP[member.baseUnitId]?.baseEquipment ?? []),
      ...member.equipment,
    ]
    const currentTier = allEquip.reduce(
      (best, e) => Math.max(best, ARMOUR_TIER[e] ?? 0),
      0
    )
    if (currentTier === 0) return null // no armour at all — only show if accessible

    // Find the lowest-tier accessible armour above current
    let bestUpgrade: string | null = null
    let bestTier = currentTier
    for (const wId of accessible) {
      const tier = ARMOUR_TIER[wId]
      if (tier !== undefined && tier > bestTier) {
        bestUpgrade = wId
        bestTier = tier
      }
    }
    return bestUpgrade
  }

  const handleBuyWargear = async (
    memberId: string,
    wargearId: string,
    influenceCost: number
  ) => {
    if (company.influence < influenceCost) return
    const member = company.members.find((m) => m.id === memberId)
    if (!member) return
    const isArmourUpgrade = ARMOUR_TIER[wargearId] !== undefined
    const newEquipment = [...member.equipment, wargearId]
    const candidate = { baseUnitId: member.baseUnitId, equipment: newEquipment }
    // Enforce bow/throwing/cavalry limits
    if (
      WARGEAR_RAW_MAP[wargearId] === 'bow' &&
      wouldExceedBowLimit([
        { baseUnitId: member.baseUnitId, equipment: [wargearId] },
      ])
    ) {
      setMsg('Cannot purchase — would exceed bow limit (1/3 of company).')
      setTimeout(() => setMsg(null), 3500)
      return
    }
    if (
      WARGEAR_RAW_MAP[wargearId] === 'throwing' &&
      wouldExceedThrowingLimit([
        { baseUnitId: member.baseUnitId, equipment: [wargearId] },
      ])
    ) {
      setMsg(
        'Cannot purchase — would exceed throwing weapon limit (1/3 of company).'
      )
      setTimeout(() => setMsg(null), 3500)
      return
    }
    if (
      WARGEAR_RAW_MAP[wargearId] === 'mount' &&
      wouldExceedCavalryLimit([candidate])
    ) {
      setMsg('Cannot purchase — would exceed cavalry limit (1/3 of company).')
      setTimeout(() => setMsg(null), 3500)
      return
    }
    void candidate
    const updated: Company = {
      ...company,
      influence: company.influence - influenceCost,
      members: company.members.map((m) => {
        if (m.id !== memberId) return m
        const updatedMember = { ...m, equipment: newEquipment }
        // Track armour upgrade in armourUpgrades[] for tooltip breakdown
        if (isArmourUpgrade) {
          updatedMember.armourUpgrades = [
            ...(m.armourUpgrades ?? []),
            wargearId,
          ]
          updatedMember.armourUpgraded = true // keep legacy flag in sync
        }
        return updatedMember
      }),
    }
    await saveCompany(updated)
    setMsg(`Purchased ${getWargearLabel(wargearId)}!`)
    setTimeout(() => setMsg(null), 2500)
  }

  const selectedMember = company.members.find((m) => m.id === selectedMemberId)

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 3, maxWidth: 600, mx: 'auto' }}>
      {/* Section toggle */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 3, flexWrap: 'wrap' }}>
        {(
          [
            'reinforcements',
            'wargear',
            'equipment',
            'creatures',
            'wanderers',
          ] as const
        ).map((s) => (
          <Box
            key={s}
            onClick={() => setSection(s)}
            sx={{
              flex: '1 1 auto',
              minWidth: 68,
              py: 1,
              textAlign: 'center',
              cursor: 'pointer',
              borderRadius: 1,
              border: '1px solid',
              borderColor: section === s ? 'primary.main' : 'divider',
              background:
                section === s ? 'rgba(201,168,76,0.08)' : 'rgba(0,0,0,0.15)',
              transition: 'all 0.15s',
            }}
          >
            <Typography
              sx={{
                fontFamily: '"Cinzel Decorative", serif',
                fontSize: '0.56rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: section === s ? 'primary.main' : 'text.secondary',
              }}
            >
              {s === 'reinforcements'
                ? 'Reinforce'
                : s === 'wargear'
                  ? 'Wargear'
                  : s === 'equipment'
                    ? 'Equipment'
                    : s === 'creatures'
                      ? 'Creatures'
                      : 'Wanderers'}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Snack message */}
      {msg && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            border: '1px solid',
            borderColor: 'success.main',
            borderRadius: 1,
            background: 'rgba(46,204,113,0.08)',
          }}
        >
          <Typography variant="body2" sx={{ color: 'success.light' }}>
            {msg}
          </Typography>
        </Box>
      )}

      {/* ── REINFORCEMENTS ───────────────────────────────────────────── */}
      {section === 'reinforcements' && (
        <Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              mb: 2,
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              background: 'rgba(0,0,0,0.15)',
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{ opacity: 0.6, display: 'block' }}
              >
                Influence
              </Typography>
              <Typography
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  color: 'primary.main',
                  fontWeight: 700,
                }}
              >
                {company.influence} IP
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography
                variant="caption"
                sx={{ opacity: 0.6, display: 'block' }}
              >
                Company Size
              </Typography>
              <Typography
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  color: atMax ? 'error.light' : 'text.primary',
                  fontWeight: 700,
                }}
              >
                {company.members.length} / {maxCompanySize}
              </Typography>
            </Box>
          </Box>

          {atMax && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                border: '1px solid',
                borderColor: 'error.dark',
                borderRadius: 1,
                background: 'rgba(192,58,43,0.08)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'error.light' }}>
                Company is at maximum size.
              </Typography>
            </Box>
          )}
          {limitWarning && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                border: '1px solid',
                borderColor: 'warning.dark',
                borderRadius: 1,
                background: 'rgba(201,168,76,0.08)',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: 'warning.light', flex: 1 }}
                >
                  {limitWarning}
                </Typography>
                <Button
                  size="small"
                  onClick={() => setLimitWarning(null)}
                  sx={{ minWidth: 0, ml: 1, p: 0.25, opacity: 0.6 }}
                >
                  ✕
                </Button>
              </Box>
            </Box>
          )}

          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={!canAffordRoll || atMax}
            onClick={handleRoll}
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '0.65rem',
              mb: 2,
            }}
          >
            Roll for Reinforcement ({cost} IP)
          </Button>

          {/* Roll result + adjuster (shown after rolling) */}
          {rollResult && (
            <Box>
              {/* ── Special table confirmation prompt ── */}
              {specialPending && (
                <Box
                  sx={{
                    mb: 1.5,
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'primary.dark',
                    borderRadius: 1,
                    background: 'rgba(201,168,76,0.06)',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ mb: 0.5, fontWeight: 600, color: 'primary.main' }}
                  >
                    Roll on Special Chart?
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.7, display: 'block', mb: 1.5 }}
                  >
                    Your adjusted roll reached 6. Proceed to the Special Chart?
                    You cannot return to the standard table after confirming.
                    {adjustAmount > 0 &&
                      ` (${adjustAmount} IP spent on this roll)`}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleConfirmSpecial}
                      sx={{
                        fontFamily: '"Cinzel Decorative", serif',
                        fontSize: '0.6rem',
                      }}
                    >
                      Proceed
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleDismissRoll}
                      sx={{ fontSize: '0.6rem', opacity: 0.7 }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              )}

              {/* ── Normal result card (hidden while awaiting special confirmation) ── */}
              {!specialPending && (
                <ReinforcementResultCard
                  result={rollResult}
                  company={company}
                  companyDef={companyDef}
                  countOfUnit={countOfUnit}
                  isRareLimitReached={isRareLimitReached}
                  onConfirm={confirmRecruitment}
                  onDismiss={handleDismissRoll}
                />
              )}

              {/* ── Standard table adjuster (only when NOT yet on special table) ── */}
              {!onSpecialTable &&
                !specialPending &&
                baseRollValue !== null &&
                (() => {
                  // Max adjust on standard table: cap at 3 but also block reaching 6 if no special table
                  const maxAdjust = hasSpecialTable
                    ? Math.min(3, 6 - baseRollValue) // allow reaching 6 (special)
                    : Math.min(3, 5 - baseRollValue) // block reaching 6 (no special table)
                  const canIncrease =
                    adjustAmount < maxAdjust &&
                    company.influence >= cost + adjustAmount + 1
                  const showAdjuster =
                    adjustAmount > 0 || company.influence >= cost + 1
                  if (!showAdjuster) return null
                  return (
                    <Box
                      sx={{
                        mt: 1.5,
                        p: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        background: 'rgba(0,0,0,0.15)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.6, display: 'block', mb: 0.75 }}
                      >
                        Rolled {baseRollValue}
                        {adjustAmount > 0
                          ? ` → ${Math.min(6, baseRollValue + adjustAmount)}`
                          : ''}{' '}
                        · Adjust with Influence (1 IP per pip):
                      </Typography>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ minWidth: 32, p: 0.5 }}
                          disabled={adjustAmount <= 0}
                          onClick={() => {
                            const next = Math.max(0, adjustAmount - 1)
                            setAdjustAmount(next)
                            applyRoll(baseRollValue, next)
                          }}
                        >
                          −
                        </Button>
                        <Typography
                          sx={{
                            fontFamily: '"Cinzel Decorative", serif',
                            minWidth: 32,
                            textAlign: 'center',
                            color:
                              adjustAmount > 0
                                ? 'primary.main'
                                : 'text.secondary',
                          }}
                        >
                          {adjustAmount > 0 ? `+${adjustAmount}` : '0'}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ minWidth: 32, p: 0.5 }}
                          disabled={!canIncrease}
                          onClick={() => {
                            const next = Math.min(maxAdjust, adjustAmount + 1)
                            setAdjustAmount(next)
                            applyRoll(baseRollValue, next)
                          }}
                        >
                          +
                        </Button>
                        <Typography
                          variant="caption"
                          sx={{ opacity: 0.5, ml: 1 }}
                        >
                          Extra cost: {adjustAmount} IP
                          {!hasSpecialTable &&
                          baseRollValue + adjustAmount >= 5 &&
                          adjustAmount < maxAdjust
                            ? ' (capped — no special table)'
                            : ''}
                        </Typography>
                      </Box>
                    </Box>
                  )
                })()}

              {/* ── Special table adjuster (only when ON special table) ── */}
              {onSpecialTable &&
                specialBaseRoll !== null &&
                !specialPending &&
                (() => {
                  const remainingInfluence =
                    company.influence - cost - adjustAmount // IP left after standard roll
                  const maxSpecialAdjust = Math.min(
                    3 - adjustAmount,
                    remainingInfluence
                  )
                  const canIncrease =
                    specialAdjust < maxSpecialAdjust &&
                    remainingInfluence > specialAdjust
                  const showAdjuster =
                    specialAdjust > 0 || remainingInfluence >= 1
                  if (!showAdjuster) return null
                  return (
                    <Box
                      sx={{
                        mt: 1.5,
                        p: 1.5,
                        border: '1px solid',
                        borderColor: 'primary.dark',
                        borderRadius: 1,
                        background: 'rgba(201,168,76,0.04)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          opacity: 0.6,
                          display: 'block',
                          mb: 0.75,
                          color: 'primary.light',
                        }}
                      >
                        Special Chart · Rolled {specialBaseRoll}
                        {specialAdjust > 0
                          ? ` → ${Math.min(6, specialBaseRoll + specialAdjust)}`
                          : ''}{' '}
                        · Adjust with remaining Influence (1 IP per pip):
                      </Typography>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ minWidth: 32, p: 0.5 }}
                          disabled={specialAdjust <= 0}
                          onClick={() => {
                            const next = Math.max(0, specialAdjust - 1)
                            setSpecialAdjust(next)
                            applySpecialRoll(specialBaseRoll, next)
                          }}
                        >
                          −
                        </Button>
                        <Typography
                          sx={{
                            fontFamily: '"Cinzel Decorative", serif',
                            minWidth: 32,
                            textAlign: 'center',
                            color:
                              specialAdjust > 0
                                ? 'primary.main'
                                : 'text.secondary',
                          }}
                        >
                          {specialAdjust > 0 ? `+${specialAdjust}` : '0'}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ minWidth: 32, p: 0.5 }}
                          disabled={!canIncrease}
                          onClick={() => {
                            const next = Math.min(
                              maxSpecialAdjust,
                              specialAdjust + 1
                            )
                            setSpecialAdjust(next)
                            applySpecialRoll(specialBaseRoll, next)
                          }}
                        >
                          +
                        </Button>
                        <Typography
                          variant="caption"
                          sx={{ opacity: 0.5, ml: 1 }}
                        >
                          Extra cost: {specialAdjust} IP ·{' '}
                          {remainingInfluence - specialAdjust} remaining
                        </Typography>
                      </Box>
                    </Box>
                  )
                })()}
            </Box>
          )}

          {/* Name dialog */}
          {nameDialog && (
            <Dialog
              open
              maxWidth="xs"
              fullWidth
              PaperProps={{
                sx: {
                  background:
                    'linear-gradient(160deg, #1a1008 0%, #110a03 100%)',
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
                Name Your Recruit{nameDialog.members.length > 1 ? 's' : ''}
              </DialogTitle>
              <DialogContent>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', opacity: 0.6, mb: 1.5 }}
                >
                  Give{' '}
                  {nameDialog.members.length > 1
                    ? 'your new recruits'
                    : 'your new recruit'}{' '}
                  a name. You can always rename them later.
                </Typography>
                {nameDialog.members.map((c, i) => (
                  <Box key={i} sx={{ mb: 1.5 }}>
                    {nameDialog.members.length > 1 && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', opacity: 0.5, mb: 0.5 }}
                      >
                        {getUnitLabel(c.baseUnitId)}
                      </Typography>
                    )}
                    <TextField
                      fullWidth
                      size="small"
                      label={
                        nameDialog.members.length === 1
                          ? getUnitLabel(c.baseUnitId)
                          : `Recruit ${i + 1}`
                      }
                      value={pendingNames[i] ?? ''}
                      onChange={(e) =>
                        setPendingNames((prev) => {
                          const n = [...prev]
                          n[i] = e.target.value
                          return n
                        })
                      }
                      inputProps={{ maxLength: 40 }}
                      sx={{
                        '& .MuiOutlinedInput-root': { fontFamily: 'inherit' },
                      }}
                    />
                  </Box>
                ))}
              </DialogContent>
              <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setNameDialog(null)
                    setPendingNames([])
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={finaliseRecruitment}
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '0.62rem',
                  }}
                >
                  Recruit
                </Button>
              </DialogActions>
            </Dialog>
          )}

          {/* Reinforcement table reference */}
          <Box sx={{ mt: 3 }}>
            <Typography
              variant="caption"
              sx={{
                opacity: 0.5,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontSize: '0.58rem',
                display: 'block',
                mb: 1,
              }}
            >
              Table Reference
            </Typography>
            {companyDef.reinforcementTable.map((row, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  mb: 0.5,
                  opacity: 0.6,
                  fontSize: '0.7rem',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    minWidth: 32,
                    color: 'primary.light',
                  }}
                >
                  {row.roll.join('-')}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>
                  {row.result === 'none'
                    ? 'No reinforcement'
                    : row.result === 'special'
                      ? 'Roll on Special Chart'
                      : row.result === 'choiceFromTable'
                        ? 'Choice from results'
                        : row.result === 'choiceFromPool'
                          ? 'Choice from pool'
                          : row.result === 'pair'
                            ? (row.units
                                ?.map(
                                  (u: any) =>
                                    `${getUnitLabel(u.baseUnitId)}${(u as any).equipment?.length ? ' with ' + (u as any).equipment.map(getWargearLabel).join(' & ') : ''}`
                                )
                                .join(' & ') ?? '—')
                            : row.baseUnitId
                              ? `${getUnitLabel(row.baseUnitId)}` +
                                (row.result === 'choice' && row.baseUnitId
                                  ? ' with choice of option'
                                  : row.equipment?.length
                                    ? ' with ' +
                                      row.equipment
                                        .map(getWargearLabel)
                                        .join(' & ')
                                    : '') +
                                (row.rare ? ` (Rare ${row.rare})` : '') +
                                (row.count && row.count > 1
                                  ? ` ×${row.count}`
                                  : '')
                              : '—'}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* ── WARGEAR ──────────────────────────────────────────────────── */}
      {section === 'wargear' && (
        <Box>
          <Typography
            variant="caption"
            sx={{ opacity: 0.6, display: 'block', mb: 1.5 }}
          >
            Select a company member to purchase wargear for:
          </Typography>

          {/* Member selector */}
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}
          >
            {company.members.map((m) => (
              <Box
                key={m.id}
                onClick={() =>
                  setSelectedMemberId(m.id === selectedMemberId ? null : m.id)
                }
                sx={{
                  px: 1.5,
                  py: 1,
                  border: '1px solid',
                  borderColor:
                    selectedMemberId === m.id ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  background:
                    selectedMemberId === m.id
                      ? 'rgba(201,168,76,0.06)'
                      : 'rgba(0,0,0,0.15)',
                  transition: 'all 0.15s',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color:
                        selectedMemberId === m.id
                          ? 'primary.main'
                          : 'text.primary',
                    }}
                  >
                    {m.name}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.5 }}>
                    {getUnitLabel(m.baseUnitId)} · {m.role}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Wargear list for selected member */}
          {selectedMember && (
            <Box>
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.6,
                  display: 'block',
                  mb: 1,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontSize: '0.58rem',
                }}
              >
                {selectedMember.name}
              </Typography>

              {/* Current equipment */}
              {(() => {
                const currentEquip = [
                  ...(BASE_UNITS_MAP[selectedMember.baseUnitId]
                    ?.baseEquipment ?? []),
                  ...selectedMember.equipment,
                ]
                return currentEquip.length > 0 ? (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        opacity: 0.45,
                        display: 'block',
                        mb: 0.5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontSize: '0.56rem',
                      }}
                    >
                      Current Equipment
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {currentEquip.map((eq, i) => (
                        <Box
                          key={`${eq}-${i}`}
                          sx={{
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'rgba(200,164,90,0.25)',
                            background: 'rgba(0,0,0,0.2)',
                            fontSize: '0.68rem',
                            color: 'text.secondary',
                          }}
                        >
                          {getWargearLabel(eq)}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : null
              })()}

              <Typography
                variant="caption"
                sx={{
                  opacity: 0.45,
                  display: 'block',
                  mb: 0.75,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontSize: '0.56rem',
                }}
              >
                Available to Purchase
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {(() => {
                  const accessible = getAccessibleWargearIds(selectedMember)
                  const armourUpgradeId = getArmourUpgrade(
                    selectedMember,
                    accessible
                  )
                  const allMemberEquip = [
                    ...(BASE_UNITS_MAP[selectedMember.baseUnitId]
                      ?.baseEquipment ?? []),
                    ...selectedMember.equipment,
                  ]

                  const filtered = purchasableWargear.filter((w) => {
                    // Must be in accessible set for this member
                    if (!accessible.has(w.id)) return false
                    // Already equipped (base or chosen)
                    if (allMemberEquip.includes(w.id)) return false
                    // Only one mount
                    if (
                      w.category === 'mount' &&
                      selectedMember.equipment.some(
                        (e) => WARGEAR_RAW_MAP[e] === 'mount'
                      )
                    )
                      return false
                    // Armour: only show if it is the valid upgrade tier; suppress all others
                    if (ARMOUR_TIER[w.id] !== undefined) {
                      return w.id === armourUpgradeId
                    }
                    return true
                  })

                  if (filtered.length === 0) {
                    return (
                      <Typography
                        variant="body2"
                        sx={{ opacity: 0.5, textAlign: 'center', py: 2 }}
                      >
                        All available wargear already equipped.
                      </Typography>
                    )
                  }

                  return filtered.map((w) => {
                    const cost = w.influenceCost!
                    const canAfford = company.influence >= cost
                    const wouldViolateBow =
                      w.category === 'bow' &&
                      wouldExceedBowLimit([
                        {
                          baseUnitId: selectedMember.baseUnitId,
                          equipment: [w.id],
                        },
                      ])
                    const wouldViolateThrowing =
                      w.category === 'throwing' &&
                      wouldExceedThrowingLimit([
                        {
                          baseUnitId: selectedMember.baseUnitId,
                          equipment: [w.id],
                        },
                      ])
                    const wouldViolateCavalry =
                      w.category === 'mount' &&
                      wouldExceedCavalryLimit([
                        {
                          baseUnitId: selectedMember.baseUnitId,
                          equipment: [...selectedMember.equipment, w.id],
                        },
                      ])
                    const limitViolation = wouldViolateBow
                      ? 'Bow limit'
                      : wouldViolateThrowing
                        ? 'Throwing limit'
                        : wouldViolateCavalry
                          ? 'Cavalry limit'
                          : null
                    const blocked = !canAfford || !!limitViolation
                    const isArmourUpgrade = ARMOUR_TIER[w.id] !== undefined
                    return (
                      <Box
                        key={w.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1.5,
                          py: 1,
                          border: '1px solid',
                          borderColor: limitViolation
                            ? 'warning.dark'
                            : 'divider',
                          borderRadius: 1,
                          background: 'rgba(0,0,0,0.15)',
                          opacity: blocked ? 0.45 : 1,
                        }}
                      >
                        <Box>
                          <Typography variant="body2">
                            {isArmourUpgrade
                              ? `Upgrade to ${w.label}`
                              : w.label}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.5 }}>
                            {limitViolation
                              ? `${w.category} · ${limitViolation} reached`
                              : w.category}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={blocked}
                          onClick={() =>
                            handleBuyWargear(selectedMember.id, w.id, cost)
                          }
                          sx={{ minWidth: 70, fontSize: '0.62rem' }}
                        >
                          {cost} IP
                        </Button>
                      </Box>
                    )
                  })
                })()}
              </Box>
              <Box
                sx={{
                  mt: 1.5,
                  px: 1,
                  py: 0.75,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  background: 'rgba(0,0,0,0.1)',
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.5 }}>
                  Company Influence: {company.influence} IP
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ── EQUIPMENT ────────────────────────────────────────────────── */}
      {section === 'equipment' && (
        <EquipmentSection company={company} saveCompany={saveCompany} />
      )}

      {/* ── CREATURES ────────────────────────────────────────────────── */}
      {section === 'creatures' && (
        <CreaturesSection company={company} saveCompany={saveCompany} />
      )}

      {/* ── WANDERERS ────────────────────────────────────────────────── */}
      {section === 'wanderers' && (
        <WanderersSection company={company} saveCompany={saveCompany} />
      )}
    </Box>
  )
}

// ─── WanderersSection ─────────────────────────────────────────────────────────

interface WandererDef {
  id: string
  label: string
  pointsCost: number
  influenceCost: number
  keywords: string[]
  stats: Record<string, number | null>
  equipment: string[]
  heroicActions: string[]
  specialRules: Array<string | { id: string; parameter?: number }>
  keywordNote?: string
}

const ALL_WANDERERS = wanderersData as unknown as WandererDef[]

function WanderersSection({
  company,
  saveCompany,
}: {
  company: Company
  saveCompany: (c: Company) => Promise<void>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const hasWanderer = !!company.wandererId

  const handleHire = async (w: WandererDef) => {
    if (hasWanderer || company.influence < w.influenceCost) return
    await saveCompany({
      ...company,
      influence: company.influence - w.influenceCost,
      wandererId: w.id,
    })
    setMsg(`${w.label} joins your company!`)
    setTimeout(() => setMsg(null), 3000)
  }

  const handleDismiss = async () => {
    await saveCompany({ ...company, wandererId: undefined })
    setMsg('Wanderer dismissed.')
    setTimeout(() => setMsg(null), 3000)
  }

  const currentWanderer = ALL_WANDERERS.find((w) => w.id === company.wandererId)

  const STAT_KEYS = [
    'move',
    'fight',
    'shoot',
    'strength',
    'defence',
    'attacks',
    'wounds',
    'courage',
    'intelligence',
  ]
  const STAT_LABELS: Record<string, string> = {
    move: 'Mv',
    fight: 'Fv',
    shoot: 'Sv',
    strength: 'S',
    defence: 'D',
    attacks: 'A',
    wounds: 'W',
    courage: 'C',
    intelligence: 'I',
  }
  const TARGET_NUMBER_STATS = new Set(['shoot', 'courage', 'intelligence'])

  function fmtStat(key: string, val: number | null): string {
    if (val === null || val === 0) return '—'
    if (key === 'move') return `${val}"`
    if (TARGET_NUMBER_STATS.has(key)) return `${val}+`
    return `${val}`
  }

  return (
    <Box>
      {msg && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            border: '1px solid',
            borderColor: 'success.main',
            borderRadius: 1,
            background: 'rgba(46,204,113,0.08)',
          }}
        >
          <Typography variant="body2" sx={{ color: 'success.light' }}>
            {msg}
          </Typography>
        </Box>
      )}

      {/* Current wanderer banner */}
      {currentWanderer && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            border: '1px solid',
            borderColor: 'primary.dark',
            borderRadius: 1,
            background: 'rgba(201,168,76,0.06)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: 'primary.main' }}
              >
                {currentWanderer.label}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>
                Currently travelling with your company
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={handleDismiss}
              sx={{
                fontSize: '0.6rem',
                color: 'error.light',
                borderColor: 'error.dark',
              }}
            >
              Dismiss
            </Button>
          </Box>
        </Box>
      )}

      {hasWanderer && (
        <Box
          sx={{
            mb: 2,
            p: 1,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            textAlign: 'center',
          }}
        >
          <Typography
            variant="caption"
            sx={{ opacity: 0.5, fontStyle: 'italic' }}
          >
            You may only have one wanderer at a time. Dismiss them to hire
            another.
          </Typography>
        </Box>
      )}

      <Typography
        variant="caption"
        sx={{
          opacity: 0.5,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: '0.58rem',
          display: 'block',
          mb: 1,
        }}
      >
        Available Wanderers
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {ALL_WANDERERS.map((w) => {
          const canAfford = company.influence >= w.influenceCost
          const isExpanded = expandedId === w.id
          const isHired = company.wandererId === w.id

          return (
            <Box
              key={w.id}
              sx={{
                border: '1px solid',
                borderColor: isExpanded ? 'primary.dark' : 'divider',
                borderRadius: 1,
                background: 'rgba(0,0,0,0.15)',
                overflow: 'hidden',
              }}
            >
              {/* Header row */}
              <Box
                onClick={() => setExpandedId(isExpanded ? null : w.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.5,
                  py: 1,
                  cursor: 'pointer',
                }}
              >
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: isHired ? 'primary.main' : 'text.primary',
                    }}
                  >
                    {w.label} {isHired && '✓'}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.55 }}>
                    {w.keywords.join(', ')} · {w.influenceCost} IP
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant={isHired ? 'outlined' : 'contained'}
                  disabled={
                    (hasWanderer && !isHired) || (!canAfford && !isHired)
                  }
                  onClick={(e) => {
                    e.stopPropagation()
                    handleHire(w)
                  }}
                  sx={{
                    fontSize: '0.6rem',
                    minWidth: 60,
                    opacity:
                      (hasWanderer && !isHired) || (!canAfford && !isHired)
                        ? 0.4
                        : 1,
                  }}
                >
                  {isHired ? 'Hired' : `${w.influenceCost} IP`}
                </Button>
              </Box>

              {/* Expanded details */}
              {isExpanded && (
                <Box
                  sx={{
                    px: 1.5,
                    pb: 1.5,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {/* Stats grid */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(9, 1fr)',
                      gap: 0.25,
                      mt: 1,
                      mb: 1,
                    }}
                  >
                    {STAT_KEYS.map((k) => (
                      <Box key={k} sx={{ textAlign: 'center' }}>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            opacity: 0.45,
                            fontSize: '0.55rem',
                            fontFamily: '"Cinzel Decorative", serif',
                          }}
                        >
                          {STAT_LABELS[k]}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontSize: '0.72rem', fontWeight: 600 }}
                        >
                          {fmtStat(k, w.stats[k] as number | null)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {/* M/W/F */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    {(['might', 'will', 'fate'] as const).map((k) => (
                      <Box
                        key={k}
                        sx={{
                          textAlign: 'center',
                          flex: 1,
                          p: 0.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 0.5,
                          background: 'rgba(0,0,0,0.2)',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            opacity: 0.45,
                            fontSize: '0.55rem',
                            textTransform: 'uppercase',
                          }}
                        >
                          {k[0]}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 700, color: 'primary.light' }}
                        >
                          {w.stats[k] ?? 1}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {/* Equipment */}
                  {w.equipment.length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', opacity: 0.65, mb: 0.5 }}
                    >
                      <strong>Gear:</strong>{' '}
                      {w.equipment.map((e) => getWargearLabel(e)).join(', ')}
                    </Typography>
                  )}
                  {/* Heroic actions */}
                  {w.heroicActions.length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', opacity: 0.65, mb: 0.5 }}
                    >
                      <strong>Heroic:</strong>{' '}
                      {w.heroicActions
                        .map((h) =>
                          h
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (l) => l.toUpperCase())
                        )
                        .join(', ')}
                    </Typography>
                  )}
                  {/* Special rules */}
                  {w.specialRules.length > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', opacity: 0.65, mb: 0.5 }}
                    >
                      <strong>Special:</strong>{' '}
                      {w.specialRules
                        .map((r) =>
                          typeof r === 'string'
                            ? r.replace(/_/g, ' ')
                            : r.id.replace(/_/g, ' ')
                        )
                        .join(', ')}
                    </Typography>
                  )}
                  {/* Keyword note */}
                  {w.keywordNote && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        opacity: 0.45,
                        fontStyle: 'italic',
                        mt: 0.5,
                      }}
                    >
                      {w.keywordNote}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>

      <Box
        sx={{
          mt: 1.5,
          px: 1,
          py: 0.75,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          background: 'rgba(0,0,0,0.1)',
        }}
      >
        <Typography variant="caption" sx={{ opacity: 0.5 }}>
          Company Influence: {company.influence} IP · Wanderers cannot purchase
          additional wargear from the armoury.
        </Typography>
      </Box>
    </Box>
  )
}

// ─── ReinforcementResult type ─────────────────────────────────────────────────

interface ReinforcementResult {
  type: 'none' | 'unit' | 'choice' | 'special' | 'choiceFromMultiple' | 'pair'
  roll: number
  baseUnitId?: string
  equipment?: string[]
  rare?: number
  units?: string[]
  options?: ReinforcementResult[]
  fromSpecial?: boolean
}

// ─── ReinforcementResultCard ──────────────────────────────────────────────────

interface RRCardProps {
  result: ReinforcementResult
  company: Company
  companyDef: CompanyDefinition
  countOfUnit: (id: string) => number
  isRareLimitReached: (r: ReinforcementResult) => boolean
  onConfirm: (result: ReinforcementResult, chosenEquipment?: string[]) => void
  onDismiss: () => void
}

function ReinforcementResultCard({
  result,
  company,
  companyDef,
  countOfUnit,
  isRareLimitReached,
  onConfirm,
  onDismiss,
}: RRCardProps) {
  const [chosenOption, setChosenOption] = useState<number | null>(null)
  const [chosenEquipment, setChosenEquipment] = useState<string[]>([])

  // For 'choice' results: get valid equipment options from unit profile
  const BASE_UNITS_DATA = baseUnitsData as Array<{
    id: string
    label: string
    baseEquipment?: string[]
    equipmentOptions?: {
      selectionRule: string
      options: Array<{
        id: string
        label: string
        equipment: string[]
        pointsCost: number
      }>
    }
  }>

  const unitForChoice =
    result.type === 'choice'
      ? BASE_UNITS_DATA.find((u) => u.id === result.baseUnitId)
      : null
  const choiceOptions = unitForChoice?.equipmentOptions?.options ?? []
  const isRareLimited = isRareLimitReached(result)

  const activeResult: ReinforcementResult =
    result.type === 'choiceFromMultiple' && chosenOption !== null
      ? result.options![chosenOption]
      : result

  const isReady = () => {
    if (result.type === 'none') return false
    if (isRareLimited) return false
    if (result.type === 'choice')
      return chosenEquipment.length > 0 || choiceOptions.length === 0
    if (result.type === 'choiceFromMultiple') {
      if (chosenOption === null) return false
      const chosen = result.options![chosenOption]
      if (chosen.type === 'choice')
        return chosenEquipment.length > 0 || choiceOptions.length === 0
      return true
    }
    return true
  }

  const handleConfirm = () => {
    const toConfirm =
      result.type === 'choiceFromMultiple' && chosenOption !== null
        ? result.options![chosenOption]
        : result
    onConfirm(
      toConfirm,
      chosenEquipment.length > 0 ? chosenEquipment : undefined
    )
  }

  return (
    <Box
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'primary.dark',
        borderRadius: 1,
        background: 'rgba(201,168,76,0.04)',
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.65rem',
            color: 'primary.main',
          }}
        >
          {result.fromSpecial ? 'Special Chart' : 'Reinforcement'} Result
        </Typography>
        <Typography
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.8rem',
            color: 'primary.light',
          }}
        >
          Roll: {result.roll}
        </Typography>
      </Box>

      {result.type === 'none' && (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          No reinforcement steps forward.
        </Typography>
      )}

      {(result.type === 'unit' || result.type === 'choice') && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {getUnitLabel(result.baseUnitId!)}
            {result.equipment && result.equipment.length > 0 && (
              <Typography
                component="span"
                variant="caption"
                sx={{ opacity: 0.6, ml: 1 }}
              >
                with{' '}
                {result.equipment.map((e) => getWargearLabel(e)).join(', ')}
              </Typography>
            )}
          </Typography>
          {result.rare && (
            <Typography
              variant="caption"
              sx={{ display: 'block', opacity: 0.6, mb: 0.5 }}
            >
              Rare {result.rare} — currently have{' '}
              {countOfUnit(result.baseUnitId!)}
            </Typography>
          )}
          {isRareLimited && (
            <Typography
              variant="caption"
              sx={{ color: 'error.light', display: 'block', mb: 1 }}
            >
              Rare limit reached — cannot recruit another.
            </Typography>
          )}
          {/* Equipment choice */}
          {result.type === 'choice' && choiceOptions.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography
                variant="caption"
                sx={{ opacity: 0.6, display: 'block', mb: 0.75 }}
              >
                Choose equipment option:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {choiceOptions.map((opt) => (
                  <Box
                    key={opt.id}
                    onClick={() => setChosenEquipment(opt.equipment)}
                    sx={{
                      px: 1.25,
                      py: 0.75,
                      border: '1px solid',
                      borderRadius: 0.75,
                      cursor: 'pointer',
                      borderColor:
                        JSON.stringify(chosenEquipment) ===
                        JSON.stringify(opt.equipment)
                          ? 'primary.main'
                          : 'divider',
                      background:
                        JSON.stringify(chosenEquipment) ===
                        JSON.stringify(opt.equipment)
                          ? 'rgba(201,168,76,0.08)'
                          : 'rgba(0,0,0,0.15)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {opt.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {result.type === 'pair' && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {result.units?.map((u) => getUnitLabel(u)).join(' & ')}
          </Typography>
          {isRareLimited && (
            <Typography
              variant="caption"
              sx={{ color: 'error.light', display: 'block', mb: 1 }}
            >
              Rare limit reached for one or more members of this pair.
            </Typography>
          )}
        </Box>
      )}

      {result.type === 'choiceFromMultiple' && (
        <Box>
          <Typography
            variant="caption"
            sx={{ opacity: 0.6, display: 'block', mb: 1 }}
          >
            Choose one to recruit:
          </Typography>
          {result.options?.map((opt, i) => {
            const limited = isRareLimitReached(opt)
            return (
              <Box
                key={i}
                onClick={() => !limited && setChosenOption(i)}
                sx={{
                  mb: 0.5,
                  px: 1.25,
                  py: 0.75,
                  border: '1px solid',
                  borderRadius: 0.75,
                  cursor: limited ? 'not-allowed' : 'pointer',
                  borderColor: chosenOption === i ? 'primary.main' : 'divider',
                  background:
                    chosenOption === i
                      ? 'rgba(201,168,76,0.08)'
                      : 'rgba(0,0,0,0.1)',
                  opacity: limited ? 0.4 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                  {getUnitLabel(opt.baseUnitId ?? '')}
                  {opt.equipment &&
                    opt.equipment.length > 0 &&
                    ` with ${opt.equipment.map((e) => getWargearLabel(e)).join(', ')}`}
                  {opt.rare && ` (Rare ${opt.rare})`}
                  {limited && ' — Rare limit reached'}
                </Typography>
              </Box>
            )
          })}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={onDismiss}
          sx={{ flex: 1 }}
        >
          Dismiss
        </Button>
        <Button
          variant="contained"
          size="small"
          disabled={!isReady()}
          onClick={handleConfirm}
          sx={{
            flex: 2,
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.62rem',
          }}
        >
          Recruit
        </Button>
      </Box>
    </Box>
  )
}

// ─── EquipmentSection ─────────────────────────────────────────────────────────

interface EquipmentDef {
  id: string
  label: string
  size: 'large' | 'small'
  rating: number | number[]
  influenceCost: number
  description?: string
  heroOnly?: boolean
  alignment?: string
}

const ALL_EQUIPMENT = equipmentData as unknown as EquipmentDef[]

function EquipmentSection({
  company,
  saveCompany,
}: {
  company: Company
  saveCompany: (c: Company) => Promise<void>
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const selectedMember = company.members.find((m) => m.id === selectedMemberId)

  const handleBuy = async (memberId: string, equipId: string, cost: number) => {
    if (company.influence < cost) return
    const member = company.members.find((m) => m.id === memberId)
    if (!member) return

    const eq = ALL_EQUIPMENT.find((e) => e.id === equipId)
    if (!eq) return

    // Check large/small capacity: member can carry 1 large + 1 small (or backpack extends small)
    const currentLarge = (member.ownedEquipment ?? []).filter((id) => {
      const e = ALL_EQUIPMENT.find((x) => x.id === id)
      return e?.size === 'large'
    }).length
    const currentSmall = (member.ownedEquipment ?? []).filter((id) => {
      const e = ALL_EQUIPMENT.find((x) => x.id === id)
      return e?.size === 'small'
    }).length
    const hasBackpack = (member.ownedEquipment ?? []).includes('backpack')
    const maxSmall = hasBackpack ? 4 : 1

    if (eq.size === 'large' && currentLarge >= 1) {
      setMsg('Cannot purchase — already carrying one Large item.')
      setTimeout(() => setMsg(null), 3000)
      return
    }
    if (eq.size === 'small' && currentSmall >= maxSmall) {
      setMsg(`Cannot purchase — already carrying ${maxSmall} Small item(s).`)
      setTimeout(() => setMsg(null), 3000)
      return
    }

    const updated: Company = {
      ...company,
      influence: company.influence - cost,
      members: company.members.map((m) =>
        m.id === memberId
          ? { ...m, ownedEquipment: [...(m.ownedEquipment ?? []), equipId] }
          : m
      ),
    }
    await saveCompany(updated)
    setMsg(`Purchased ${eq.label}!`)
    setTimeout(() => setMsg(null), 2500)
  }

  const alignment = company.alignment ?? 'good'

  const availableEquipment = ALL_EQUIPMENT.filter((eq) => {
    if (!eq.influenceCost) return false
    if (eq.alignment === 'evil' && alignment !== 'evil') return false
    if (eq.alignment === 'good' && alignment !== 'good') return false
    return true
  })

  return (
    <Box>
      {msg && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            border: '1px solid',
            borderColor: 'success.main',
            borderRadius: 1,
            background: 'rgba(46,204,113,0.08)',
          }}
        >
          <Typography variant="body2" sx={{ color: 'success.light' }}>
            {msg}
          </Typography>
        </Box>
      )}

      <Typography
        variant="caption"
        sx={{ opacity: 0.6, display: 'block', mb: 1.5 }}
      >
        Select a company member to purchase Equipment for:
      </Typography>

      {/* Member selector */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
        {company.members.map((m) => {
          const isHero = m.role !== 'warrior'
          return (
            <Box
              key={m.id}
              onClick={() =>
                setSelectedMemberId(m.id === selectedMemberId ? null : m.id)
              }
              sx={{
                px: 1.5,
                py: 1,
                border: '1px solid',
                borderColor:
                  selectedMemberId === m.id ? 'primary.main' : 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                background:
                  selectedMemberId === m.id
                    ? 'rgba(201,168,76,0.06)'
                    : 'rgba(0,0,0,0.15)',
                transition: 'all 0.15s',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color:
                      selectedMemberId === m.id
                        ? 'primary.main'
                        : 'text.primary',
                  }}
                >
                  {m.name}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.5 }}>
                  {isHero ? m.role : 'Warrior'}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>

      {selectedMember &&
        (() => {
          const isHero = selectedMember.role !== 'warrior'
          const owned = selectedMember.ownedEquipment ?? []
          const currentLarge = owned.filter(
            (id) => ALL_EQUIPMENT.find((e) => e.id === id)?.size === 'large'
          ).length
          const currentSmall = owned.filter(
            (id) => ALL_EQUIPMENT.find((e) => e.id === id)?.size === 'small'
          ).length
          const hasBackpack = owned.includes('backpack')
          const maxSmall = hasBackpack ? 4 : 1
          const filtered = availableEquipment.filter((eq) => {
            if (eq.heroOnly && !isHero) return false
            if (owned.includes(eq.id)) return false
            return true
          })

          return (
            <Box>
              {owned.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      opacity: 0.45,
                      display: 'block',
                      mb: 0.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontSize: '0.56rem',
                    }}
                  >
                    Current Equipment
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {owned.map((id) => {
                      const eq = ALL_EQUIPMENT.find((e) => e.id === id)
                      return (
                        <Chip
                          key={id}
                          label={`${eq?.size === 'large' ? '◈' : '◇'} ${eq?.label ?? id}`}
                          size="small"
                          sx={{
                            fontSize: '0.68rem',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid',
                            borderColor: 'divider',
                            color: 'text.secondary',
                          }}
                        />
                      )
                    })}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.45, display: 'block', mt: 0.5 }}
                  >
                    Large: {currentLarge}/1 · Small: {currentSmall}/{maxSmall}
                  </Typography>
                </Box>
              )}

              <Typography
                variant="caption"
                sx={{
                  opacity: 0.45,
                  display: 'block',
                  mb: 0.75,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontSize: '0.56rem',
                }}
              >
                Available to Purchase
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {filtered.length === 0 ? (
                  <Typography
                    variant="body2"
                    sx={{ opacity: 0.5, textAlign: 'center', py: 2 }}
                  >
                    No equipment available.
                  </Typography>
                ) : (
                  filtered.map((eq) => {
                    const canAfford = company.influence >= eq.influenceCost
                    const wouldExceedLarge =
                      eq.size === 'large' && currentLarge >= 1
                    const wouldExceedSmall =
                      eq.size === 'small' && currentSmall >= maxSmall
                    const blocked =
                      !canAfford || wouldExceedLarge || wouldExceedSmall
                    const limitMsg = wouldExceedLarge
                      ? 'Large limit'
                      : wouldExceedSmall
                        ? 'Small limit'
                        : null
                    return (
                      <Box
                        key={eq.id}
                        sx={{
                          px: 1.5,
                          py: 1,
                          border: '1px solid',
                          borderColor: limitMsg ? 'warning.dark' : 'divider',
                          borderRadius: 1,
                          background: 'rgba(0,0,0,0.15)',
                          opacity: blocked ? 0.5 : 1,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                          }}
                        >
                          <Box sx={{ flex: 1, mr: 1 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {eq.label}
                              </Typography>
                              <Chip
                                label={eq.size}
                                size="small"
                                sx={{
                                  fontSize: '0.55rem',
                                  height: 16,
                                  background: 'transparent',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  color: 'text.secondary',
                                }}
                              />
                              {eq.heroOnly && (
                                <Chip
                                  label="Hero"
                                  size="small"
                                  sx={{
                                    fontSize: '0.55rem',
                                    height: 16,
                                    background: 'rgba(201,168,76,0.08)',
                                    border: '1px solid',
                                    borderColor: 'primary.dark',
                                    color: 'primary.light',
                                  }}
                                />
                              )}
                            </Box>
                            {eq.description && (
                              <Typography
                                variant="caption"
                                sx={{
                                  opacity: 0.6,
                                  display: 'block',
                                  mt: 0.25,
                                  lineHeight: 1.4,
                                }}
                              >
                                {eq.description.length > 100
                                  ? eq.description.slice(0, 100) + '…'
                                  : eq.description}
                              </Typography>
                            )}
                            {limitMsg && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'warning.main',
                                  display: 'block',
                                  mt: 0.25,
                                }}
                              >
                                {limitMsg} reached
                              </Typography>
                            )}
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={blocked}
                            onClick={() =>
                              handleBuy(
                                selectedMember.id,
                                eq.id,
                                eq.influenceCost
                              )
                            }
                            sx={{
                              minWidth: 62,
                              fontSize: '0.62rem',
                              flexShrink: 0,
                            }}
                          >
                            {eq.influenceCost} IP
                          </Button>
                        </Box>
                      </Box>
                    )
                  })
                )}
              </Box>
              <Box
                sx={{
                  mt: 1.5,
                  px: 1,
                  py: 0.75,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  background: 'rgba(0,0,0,0.1)',
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.5 }}>
                  Company Influence: {company.influence} IP
                </Typography>
              </Box>
            </Box>
          )
        })()}
    </Box>
  )
}

// ─── CreaturesSection ─────────────────────────────────────────────────────────

interface CreatureDef {
  id: string
  label: string
  pointsCost: number
  influenceCost: number
  keywords: string[]
  stats: Record<string, number | null>
  specialRules: string[]
  description?: string
}

const ALL_CREATURES = creaturesData as unknown as CreatureDef[]

function CreaturesSection({
  company,
  saveCompany,
}: {
  company: Company
  saveCompany: (c: Company) => Promise<void>
}) {
  const [msg, setMsg] = useState<string | null>(null)

  // Only Leader and Sergeants can have creatures; one per hero
  const eligibleHeroes = company.members.filter(
    (m) => m.role === 'leader' || m.role === 'sergeant'
  )

  const handleBuy = async (
    memberId: string,
    creatureId: string,
    cost: number
  ) => {
    if (company.influence < cost) return
    const member = company.members.find((m) => m.id === memberId)
    if (!member) return
    if (member.creatureId) {
      setMsg('This hero already has a creature.')
      setTimeout(() => setMsg(null), 3000)
      return
    }
    const updated: Company = {
      ...company,
      influence: company.influence - cost,
      members: company.members.map((m) =>
        m.id === memberId ? { ...m, creatureId } : m
      ),
    }
    await saveCompany(updated)
    const creature = ALL_CREATURES.find((c) => c.id === creatureId)
    setMsg(`${creature?.label ?? creatureId} attached!`)
    setTimeout(() => setMsg(null), 2500)
  }

  return (
    <Box>
      {msg && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            border: '1px solid',
            borderColor: 'success.main',
            borderRadius: 1,
            background: 'rgba(46,204,113,0.08)',
          }}
        >
          <Typography variant="body2" sx={{ color: 'success.light' }}>
            {msg}
          </Typography>
        </Box>
      )}

      <Typography
        variant="caption"
        sx={{ opacity: 0.6, display: 'block', mb: 1 }}
      >
        Creatures can only be attached to your Leader or Sergeants — one per
        hero.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {eligibleHeroes.map((hero) => {
          const existingCreature = hero.creatureId
            ? ALL_CREATURES.find((c) => c.id === hero.creatureId)
            : null
          return (
            <Box
              key={hero.id}
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                background: 'rgba(0,0,0,0.15)',
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: 'primary.light', mb: 1 }}
              >
                {hero.name}{' '}
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ opacity: 0.6 }}
                >
                  ({hero.role})
                </Typography>
              </Typography>

              {existingCreature ? (
                <Box
                  sx={{
                    px: 1.25,
                    py: 1,
                    border: '1px solid',
                    borderColor: 'primary.dark',
                    borderRadius: 1,
                    background: 'rgba(201,168,76,0.05)',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: 'primary.main', fontWeight: 600 }}
                  >
                    {existingCreature.label}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    Attached creature
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}
                >
                  {ALL_CREATURES.map((creature) => {
                    const canAfford =
                      company.influence >= creature.influenceCost
                    return (
                      <Box
                        key={creature.id}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          px: 1.25,
                          py: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          opacity: canAfford ? 1 : 0.5,
                        }}
                      >
                        <Box sx={{ flex: 1, mr: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {creature.label}
                          </Typography>
                          <Box
                            sx={{
                              display: 'flex',
                              gap: 0.5,
                              mt: 0.25,
                              flexWrap: 'wrap',
                            }}
                          >
                            {creature.specialRules.map((r) => (
                              <Chip
                                key={String(r)}
                                label={String(r).replace(/_/g, ' ')}
                                size="small"
                                sx={{
                                  fontSize: '0.58rem',
                                  height: 16,
                                  background: 'transparent',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  color: 'text.secondary',
                                }}
                              />
                            ))}
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'flex',
                              gap: 1.5,
                              mt: 0.5,
                              opacity: 0.55,
                            }}
                          >
                            {`Mv ${creature.stats.move}" · Fv ${creature.stats.fight} · S ${creature.stats.strength} · D ${creature.stats.defence} · A ${creature.stats.attacks} · W ${creature.stats.wounds}`}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canAfford}
                          onClick={() =>
                            handleBuy(
                              hero.id,
                              creature.id,
                              creature.influenceCost
                            )
                          }
                          sx={{
                            minWidth: 62,
                            fontSize: '0.62rem',
                            flexShrink: 0,
                          }}
                        >
                          {creature.influenceCost} IP
                        </Button>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          )
        })}

        {eligibleHeroes.length === 0 && (
          <Typography
            variant="body2"
            sx={{ opacity: 0.5, textAlign: 'center', py: 2 }}
          >
            No Leader or Sergeants in company yet.
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          mt: 2,
          px: 1,
          py: 0.75,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          background: 'rgba(0,0,0,0.1)',
        }}
      >
        <Typography variant="caption" sx={{ opacity: 0.5 }}>
          Company Influence: {company.influence} IP
        </Typography>
      </Box>
    </Box>
  )
}
