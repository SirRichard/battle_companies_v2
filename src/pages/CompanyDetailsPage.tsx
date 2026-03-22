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
} from '@mui/material'
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
                      isHero={true}
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
      />
    </Box>
  )
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: Member
  isHero: boolean
  delay: number
  onClick: () => unknown
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

      {(() => {
        // Warriors: assigned option only. Heroes: base equipment + assigned/purchased.
        const assignedEquip = member.equipment ?? []
        const displayWargear = isHero
          ? Array.from(
              new Set([
                ...(BASE_UNITS_RAW.find((u) => u.id === member.baseUnitId)
                  ?.baseEquipment ?? []),
                ...assignedEquip,
              ])
            )
          : assignedEquip
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
                {match.scenarioLabel ?? match.scenarioId.replace(/_/g, ' ')}
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
  const [section, setSection] = useState<'reinforcements' | 'wargear'>(
    'reinforcements'
  )
  const [rollResult, setRollResult] = useState<ReinforcementResult | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState(0)
  const [confirmReinf, setConfirmReinf] = useState<ReinforcementResult | null>(
    null
  )
  const [msg, setMsg] = useState<string | null>(null)

  // Wargear purchase state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

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

  const handleRoll = () => {
    if (!canAffordRoll || atMax) return
    setIsRolling(true)
    const baseRoll = Math.floor(Math.random() * 6) + 1
    const finalRoll = Math.max(1, Math.min(6, baseRoll + adjustAmount))
    const result = rollOnTable(companyDef.reinforcementTable, finalRoll)

    // If special, roll on special table
    if (result.type === 'special' && companyDef.specialTable) {
      const specialRoll = Math.floor(Math.random() * 6) + 1
      const specialResult = rollOnTable(
        companyDef.specialTable as import('../models').ReinforcementEntry[],
        specialRoll
      )
      setRollResult({ ...specialResult, fromSpecial: true })
    } else {
      setRollResult(result)
    }
    setIsRolling(false)
  }

  const countOfUnit = (baseUnitId: string) =>
    company.members.filter((m) => m.baseUnitId === baseUnitId).length

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

  const confirmRecruitment = async (
    finalResult: ReinforcementResult,
    chosenEquipment?: string[]
  ) => {
    if (!finalResult || finalResult.type === 'none') return

    const { v4: uuidv4 } = await import('uuid')

    const newMembers: import('../models').Member[] = []

    const makeWarrior = (
      baseUnitId: string,
      equipment: string[]
    ): import('../models').Member => ({
      id: uuidv4(),
      name: getUnitLabel(baseUnitId),
      baseUnitId,
      role: 'warrior' as import('../models').MemberRole,
      equipment,
      experience: 0,
      lifetimeExperience: 0,
      injuries: [],
      specialRules: [],
      statIncreases: {},
      statDecreases: {},
    })

    if (finalResult.type === 'unit') {
      newMembers.push(
        makeWarrior(finalResult.baseUnitId!, finalResult.equipment ?? [])
      )
    } else if (finalResult.type === 'choice') {
      newMembers.push(
        makeWarrior(finalResult.baseUnitId!, chosenEquipment ?? [])
      )
    } else if (finalResult.type === 'pair') {
      for (const uid of finalResult.units ?? []) {
        newMembers.push(makeWarrior(uid, []))
      }
    }

    const updated: Company = {
      ...company,
      influence: company.influence - cost,
      members: [...company.members, ...newMembers],
    }
    await saveCompany(updated)
    setRollResult(null)
    setAdjustAmount(0)
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

  const handleBuyWargear = async (
    memberId: string,
    wargearId: string,
    influenceCost: number
  ) => {
    if (company.influence < influenceCost) return
    const updated: Company = {
      ...company,
      influence: company.influence - influenceCost,
      members: company.members.map((m) =>
        m.id === memberId ? { ...m, equipment: [...m.equipment, wargearId] } : m
      ),
    }
    await saveCompany(updated)
    setMsg(`Purchased ${getWargearLabel(wargearId)}!`)
    setTimeout(() => setMsg(null), 2500)
  }

  const selectedMember = company.members.find((m) => m.id === selectedMemberId)

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 3, maxWidth: 600, mx: 'auto' }}>
      {/* Section toggle */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        {(['reinforcements', 'wargear'] as const).map((s) => (
          <Box
            key={s}
            onClick={() => setSection(s)}
            sx={{
              flex: 1,
              py: 1.25,
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
                fontSize: '0.62rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: section === s ? 'primary.main' : 'text.secondary',
              }}
            >
              {s === 'reinforcements' ? 'Reinforcements' : 'Wargear'}
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

          {/* Roll adjuster */}
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{ opacity: 0.6, display: 'block', mb: 0.75 }}
            >
              Adjust roll with Influence (max +3, costs 1 IP per pip):
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                sx={{ minWidth: 32, p: 0.5 }}
                disabled={adjustAmount <= 0}
                onClick={() => setAdjustAmount((a) => Math.max(0, a - 1))}
              >
                −
              </Button>
              <Typography
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  minWidth: 32,
                  textAlign: 'center',
                  color: adjustAmount > 0 ? 'primary.main' : 'text.secondary',
                }}
              >
                {adjustAmount > 0 ? `+${adjustAmount}` : '0'}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                sx={{ minWidth: 32, p: 0.5 }}
                disabled={
                  adjustAmount >= 3 ||
                  company.influence < cost + adjustAmount + 1
                }
                onClick={() => setAdjustAmount((a) => Math.min(3, a + 1))}
              >
                +
              </Button>
              <Typography variant="caption" sx={{ opacity: 0.5, ml: 1 }}>
                Total cost: {cost + adjustAmount} IP
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={
              !canAffordRoll || atMax || company.influence < cost + adjustAmount
            }
            onClick={handleRoll}
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '0.65rem',
              mb: 2,
            }}
          >
            Roll for Reinforcement ({cost + adjustAmount} IP)
          </Button>

          {/* Roll result */}
          {rollResult && (
            <ReinforcementResultCard
              result={rollResult}
              company={company}
              companyDef={companyDef}
              countOfUnit={countOfUnit}
              isRareLimitReached={isRareLimitReached}
              onConfirm={confirmRecruitment}
              onDismiss={() => {
                setRollResult(null)
                setAdjustAmount(0)
              }}
            />
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
                            ? `${row.units?.map((u) => getUnitLabel(u.baseUnitId)).join(' & ')}`
                            : row.baseUnitId
                              ? `${getUnitLabel(row.baseUnitId)}${row.rare ? ` (Rare ${row.rare})` : ''}`
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
                Available Wargear — {selectedMember.name}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {purchasableWargear
                  .filter((w) => {
                    // Skip already equipped
                    if (selectedMember.equipment.includes(w.id)) return false
                    // Category rules: only one mount, one shield type, etc.
                    if (
                      w.category === 'mount' &&
                      selectedMember.equipment.some((e) => {
                        const found = (wargearData as any[]).find(
                          (x: any) => x.id === e
                        )
                        return found?.category === 'mount'
                      })
                    )
                      return false
                    return true
                  })
                  .map((w) => {
                    const cost = w.influenceCost!
                    const canAfford = company.influence >= cost
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
                          borderColor: 'divider',
                          borderRadius: 1,
                          background: 'rgba(0,0,0,0.15)',
                          opacity: canAfford ? 1 : 0.4,
                        }}
                      >
                        <Box>
                          <Typography variant="body2">{w.label}</Typography>
                          <Typography variant="caption" sx={{ opacity: 0.5 }}>
                            {w.category}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canAfford}
                          onClick={() =>
                            handleBuyWargear(selectedMember.id, w.id, cost)
                          }
                          sx={{ minWidth: 70, fontSize: '0.62rem' }}
                        >
                          {cost} IP
                        </Button>
                      </Box>
                    )
                  })}
                {purchasableWargear.filter(
                  (w) => !selectedMember.equipment.includes(w.id)
                ).length === 0 && (
                  <Typography
                    variant="body2"
                    sx={{ opacity: 0.5, textAlign: 'center', py: 2 }}
                  >
                    All available wargear already equipped.
                  </Typography>
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
          )}
        </Box>
      )}
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
