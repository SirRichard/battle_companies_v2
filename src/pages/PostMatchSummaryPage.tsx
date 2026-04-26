/**
 * PostMatchSummaryPage — Phase 4 post-match processing.
 *
 * Steps (accordion-style, each collapses as you advance):
 *   0. Injuries     — roll 2D6 per casualty, apply results
 *   1. Progression  — XP display, warrior rolls, hero advancement
 *   2. Influence    — show total gained
 *   3. Done         — Return to Company Details
 */

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  CircularProgress,
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { motion } from 'framer-motion'
import PageHeader from '../components/common/PageHeader'
import ConfirmDialog from '../components/common/ConfirmDialog'
import AnimatedDice, { DieFace } from '../components/common/AnimatedDice'
import { useAppContext } from '../context/AppContext'
import { getUnitLabel, getWargearLabel } from '../utils/labels'
import {
  resolveHeroInjury,
  resolveWarriorInjury,
  applyInjuryOutcome,
  healInjury,
  needsProgression,
  getWarriorAdvancements,
  applyWarriorPromotion,
  applyHeroInTheMaking,
  isOnTheirOwnPath,
  applyStatIncrease,
  applySpecialRule,
  subtractAdvancementXp,
  getPath,
  getPathEntry,
  rollD6,
  type InjuryOutcome,
  type PathDef,
  type PathProgEntry,
} from '../utils/advancement'
import type { Member, Company, CompanyDefinition } from '../models'
import type { PostMatchData } from '../models/postmatch'
import companiesData from '../data/companies.json'
import specialRulesData from '../data/specialRules.json'
import heroicActionsData from '../data/heroicActions.json'
import pathsData from '../data/paths.json'
import { v4 as uuidv4 } from 'uuid'

const MotionBox = motion(Box)
const COMPANIES = companiesData as CompanyDefinition[]
const SPECIAL_RULES = specialRulesData as Array<{
  id: string
  label: string
  description: string
  minor: boolean
}>
const HEROIC_ACTIONS = heroicActionsData as Array<{
  id: string
  label: string
  universal: boolean
}>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roll2d6Pair(): [number, number] {
  return [
    Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1,
  ]
}

function rollD6Single(): number {
  return Math.floor(Math.random() * 6) + 1
}

function roll2d6Single(): number {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1
}

function roll2d6WithDice(): { die1: number; die2: number; total: number } {
  const die1 = Math.floor(Math.random() * 6) + 1
  const die2 = Math.floor(Math.random() * 6) + 1
  return { die1, die2, total: die1 + die2 }
}

function outcomeLabel(outcome: InjuryOutcome, memberName: string): string {
  switch (outcome.type) {
    case 'dead':
      return `${memberName} has fallen — removed from the company.`
    case 'arm_wound':
      return outcome.count >= 2
        ? `${memberName} retires — second arm wound.`
        : `${memberName} suffers an arm wound.`
    case 'leg_wound':
      return outcome.count >= 2
        ? `${memberName} retires — second leg wound.`
        : `${memberName} suffers a leg wound (−1 Move).`
    case 'broken_honour':
      return outcome.retired
        ? `${memberName} retires — third broken honour.`
        : outcome.count >= 2
          ? `${memberName} suffers a second broken honour and gains Fearful.`
          : `${memberName} suffers broken honour.`
    case 'missing_next_game':
      return `${memberName} misses the next game.`
    case 'full_recovery':
      return outcome.healsInjury
        ? `${memberName} makes a full recovery! May heal one existing injury.`
        : `${memberName} makes a full recovery.`
    case 'protection_by_valar':
      return `${memberName} — Protection by the Valar! Full recovery and +1 Fate.`
    case 'wounds_of_a_hero':
      return `${memberName} — Wounds of a Hero! Full recovery and +${outcome.bonusInfluence} Influence.`
    case 'scratch_choice':
      return `${memberName} — T'is Just a Scratch!`
    case 'warrior_dead':
      return `${memberName} has fallen — removed from the company.`
    case 'warrior_injured':
      return `${memberName} is injured — misses next game.`
    case 'warrior_full_recovery':
      return `${memberName} makes a full recovery.`
    case 'warrior_lesson_learned':
      return `${memberName} — Lesson Learned! Full recovery and +${(outcome as any).bonusXp} XP.`
    default:
      return `${memberName} — result applied.`
  }
}

function outcomeColour(outcome: InjuryOutcome): string {
  if (outcome.type === 'dead' || outcome.type === 'warrior_dead')
    return '#c03a2b'
  if (
    outcome.type === 'full_recovery' ||
    outcome.type === 'warrior_full_recovery' ||
    outcome.type === 'protection_by_valar' ||
    outcome.type === 'wounds_of_a_hero' ||
    outcome.type === 'warrior_lesson_learned'
  )
    return '#2ecc71'
  if (
    outcome.type === 'missing_next_game' ||
    outcome.type === 'warrior_injured'
  )
    return '#f39c12'
  return '#c8a45a'
}

function describeHeroRoll(roll: number): string {
  if (roll === 2) return 'Dead'
  if (roll === 3) return 'Arm Wound'
  if (roll === 4) return 'Leg Wound'
  if (roll === 5) return 'Broken Honour'
  if (roll === 6) return "T'is Just a Scratch"
  if (roll <= 10) return 'Full Recovery'
  if (roll === 11) return 'Protection by the Valar'
  return 'Wounds of a Hero'
}

function describeWarriorRoll(roll: number): string {
  if (roll <= 3) return 'Dead'
  if (roll <= 5) return 'Injured'
  if (roll <= 11) return 'Full Recovery'
  return 'Lesson Learned'
}

// Explains what each injury outcome actually does
const OUTCOME_EXPLANATIONS: Record<string, string> = {
  dead: "The Hero's adventure ends here. Remove the Hero and all their wargear from the company roster permanently.",
  arm_wound:
    'The Hero cannot benefit from a shield in any way, use a two-handed weapon, pike, or fire a bow or crossbow of any sort. They may still carry a Company Standard and fight with a Hand Weapon. A second Arm Wound forces retirement.',
  leg_wound:
    'The Hero has their Move value permanently reduced by 1". A second Leg Wound forces retirement.',
  broken_honour:
    'The Hero may no longer provide a Stand Fast, nor may they affect members of the Battle Company with their Heroic Actions. A second result grants the Fearful special rule. A third result forces retirement.',
  missing_next_game:
    'The Hero must miss the next game. Alternatively, the Hero may reroll on this chart — the second result applies even if worse. If this result occurs after a reroll, the Hero must miss the next game.',
  full_recovery:
    'The Hero may play in the next game as normal. Additionally, the Hero may heal one Arm Wound, Leg Wound, or Broken Honour they previously obtained.',
  protection_by_valar:
    'The Hero is considered to have made a Full Recovery. Additionally, the Hero permanently gains +1 Fate point (up to their Path Maximum).',
  wounds_of_a_hero:
    "The Hero model's Battle Company immediately gains an extra D6 Influence Points. Additionally, the Hero is considered to have made a Full Recovery.",
  scratch_choice:
    "T'is Just a Scratch! The Hero must choose: miss the next game, or reroll on this chart (the second result applies even if worse). If the reroll also produces this result, the Hero must miss the next game.",
  warrior_dead:
    'Remove the Warrior and all their wargear from the company roster permanently.',
  warrior_injured:
    'The Warrior must miss the next game but suffers no further effects.',
  warrior_full_recovery:
    'The Warrior makes a full recovery and may fight in the next battle as normal.',
  warrior_lesson_learned:
    'The Warrior is considered to have made a Full Recovery. Additionally, the Warrior gains +D3 Experience.',
}

function getOutcomeExplanation(outcomeType: string): string {
  return OUTCOME_EXPLANATIONS[outcomeType] ?? 'Result applied.'
}

// ─── Progression result descriptors ──────────────────────────────────────────

function describeStatOption(options: string[]): string {
  return options
    .map((s) => {
      if (s === 'fight') return 'Fight Value (+1)'
      if (s === 'shoot') return 'Shoot Value (improve by 1)'
      if (s === 'strength') return 'Strength (+1)'
      if (s === 'defence') return 'Defence (+1)'
      if (s === 'move') return 'Move (+1")'
      if (s === 'courage') return 'Courage (improve by 1)'
      if (s === 'intelligence') return 'Intelligence (improve by 1)'
      if (s === 'attacks') return 'Attacks (+1)'
      if (s === 'wounds') return 'Wounds (+1)'
      if (s === 'might') return 'Might (+1)'
      if (s === 'will') return 'Will (+1)'
      if (s === 'fate') return 'Fate (+1)'
      return s
    })
    .join(' or ')
}

// ─── Injury step types ────────────────────────────────────────────────────────

interface InjuryRecord {
  memberId: string
  memberName: string
  isHero: boolean
  roll: number | null
  die1?: number
  die2?: number
  outcome: InjuryOutcome | null
  healed?: 'arm_wound' | 'leg_wound' | 'broken_honour'
  // For scratch re-roll
  rerolled?: boolean
  rerollRoll?: number
  rerollDie1?: number
  rerollDie2?: number
  rerollOutcome?: InjuryOutcome
}

// ─── Progression step types ───────────────────────────────────────────────────

type WarriorProgResult =
  | 'no_change'
  | 'promoted'
  | 'ci_boost'
  | 'hero_in_making'

interface WarriorProgRecord {
  memberId: string
  memberName: string
  roll: number
  result: WarriorProgResult
  promotionOptions?: Array<{
    toBaseUnitId: string
    equipment?: string[]
    retainWargear?: boolean
  }>
  chosenPromotion?: number // index into promotionOptions
  newPathId?: string // set after hero path selection
  done: boolean
}

// Hero advancement result for one dice pair
interface HeroAdvRollResult {
  roll: number
  entry: PathProgEntry
  // For roll 4/6/8 with multiple stat options: user picks one
  chosenStatIndex?: number
  // For roll 7 / choice entries: user picks one option
  chosenOptionIndex?: number
  // For roll 10 minor rule or heroic action: user picks specific rule
  chosenMinorRule?: string
  chosenHeroicAction?: string
  // Was this already applied?
  applied: boolean
}

interface HeroAdvRecord {
  memberId: string
  memberName: string
  pathId: string
  pathLabel: string
  rollA: number
  rollB: number
  chosen: 'A' | 'B' | null // which of the two the user picks
  resultA: HeroAdvRollResult
  resultB: HeroAdvRollResult
  // Roll 5 means: take the other roll AS WELL
  bonusRoll?: HeroAdvRollResult // the non-roll-5 roll when roll 5 is chosen
  done: boolean
}

// ─── PostMatchSummaryPage ─────────────────────────────────────────────────────

const STEPS = ['Injuries', 'Progression', 'Influence'] as const
type Step = (typeof STEPS)[number]

export default function PostMatchSummaryPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { companies, getStatsForUnit, saveCompany } = useAppContext()

  const postMatchData = (
    location.state as { postMatchData: PostMatchData } | null
  )?.postMatchData

  const company = companies.find((c) => c.id === companyId)
  const companyDef = COMPANIES.find((c) => c.id === company?.companyTypeId)

  // Working copy of the company we mutate through the steps
  const [workingCompany, setWorkingCompany] = useState<Company | null>(null)

  const [currentStep, setCurrentStep] = useState<Step>('Injuries')
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set())

  // ── Injury state ────────────────────────────────────────────────────────────
  const [injuryRecords, setInjuryRecords] = useState<InjuryRecord[]>([])
  const [injuryIndex, setInjuryIndex] = useState(0) // which casualty we're rolling for
  const [rollingFor, setRollingFor] = useState<string | null>(null) // memberId being rolled
  const [diceValue, setDiceValue] = useState<number | null>(null)
  const [diceIndividual, setDiceIndividual] = useState<[number, number] | null>(
    null
  )
  const pendingDiceRef = useRef<[number, number] | null>(null)
  const [injuriesReady, setInjuriesReady] = useState(false)

  // Scratch/heal dialogs
  const [scratchDialog, setScratchDialog] = useState<{
    memberId: string
    memberName: string
  } | null>(null)
  const [injuryExplain, setInjuryExplain] = useState<{
    label: string
    explanation: string
  } | null>(null)
  const [healDialog, setHealDialog] = useState<{
    memberId: string
    memberName: string
    options: Array<'arm_wound' | 'leg_wound' | 'broken_honour'>
  } | null>(null)

  // ── Progression state ───────────────────────────────────────────────────────
  const [warriorProgRecords, setWarriorProgRecords] = useState<
    WarriorProgRecord[]
  >([])
  const [heroAdvRecords, setHeroAdvRecords] = useState<HeroAdvRecord[]>([])
  const [progressionIndex, setProgressionIndex] = useState(0)
  const [progPhase, setProgPhase] = useState<'warriors' | 'heroes' | 'done'>(
    'warriors'
  )

  // Path selection for Hero in the Making
  const [pathSelectMember, setPathSelectMember] = useState<{
    memberId: string
    memberName: string
    baseUnitId: string
    equipment: string[]
  } | null>(null)

  // Bonus influence from Wounds of a Hero
  const [bonusInfluence, setBonusInfluence] = useState(0)

  // ── Confirm return ──────────────────────────────────────────────────────────
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)
  const [progressionInitPending, setProgressionInitPending] = useState(false)

  // Initialise working company once
  useEffect(() => {
    if (company && !workingCompany) {
      setWorkingCompany(JSON.parse(JSON.stringify(company)))
    }
  }, [company, workingCompany])

  // ── Guard — resolved below in JSX via early-return-safe conditional ────────
  const isLoading = !postMatchData || !company || !companyDef || !workingCompany

  const casualties = postMatchData!.casualties
  const hasCasualties = casualties.length > 0

  // ─── Step header ─────────────────────────────────────────────────────────────

  const SectionHeader = ({ step, label }: { step: Step; label: string }) => {
    const isActive = currentStep === step
    const isDone = completedSteps.has(step)
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: isDone && !isActive ? 0.5 : 1.5,
          opacity: isDone && !isActive ? 0.5 : 1,
        }}
      >
        {isDone ? (
          <CheckCircleOutlineIcon
            sx={{ color: 'primary.main', fontSize: 20 }}
          />
        ) : (
          <Box
            sx={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: '2px solid',
              borderColor: isActive ? 'primary.main' : 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.6rem',
                color: isActive ? 'primary.main' : 'text.secondary',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {STEPS.indexOf(step) + 1}
            </Typography>
          </Box>
        )}
        <Typography
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: isActive ? 'primary.main' : 'text.secondary',
          }}
        >
          {label}
        </Typography>
      </Box>
    )
  }

  // ─── INJURIES STEP ────────────────────────────────────────────────────────────

  const startNextInjuryRoll = useCallback(
    (idx: number) => {
      setDiceIndividual(null)
      pendingDiceRef.current = null
      const casualty = casualties[idx]
      if (!casualty) {
        setInjuriesReady(true)
        return
      }
      setRollingFor(casualty.memberId)
      setDiceValue(null)
      // Animate then settle — generate individual dice now and store in ref so
      // handleDiceSettled can read them synchronously without stale closure issues
      const die1 = Math.floor(Math.random() * 6) + 1
      const die2 = Math.floor(Math.random() * 6) + 1
      const roll = die1 + die2
      pendingDiceRef.current = [die1, die2]
      setTimeout(() => {
        setDiceValue(roll)
      }, 1400)
    },
    [casualties]
  )

  useEffect(() => {
    if (
      currentStep === 'Injuries' &&
      hasCasualties &&
      injuryRecords.length === 0 &&
      !rollingFor
    ) {
      startNextInjuryRoll(0)
    }
    if (currentStep === 'Injuries' && !hasCasualties) {
      setInjuriesReady(true)
    }
  }, [
    currentStep,
    hasCasualties,
    injuryRecords.length,
    rollingFor,
    startNextInjuryRoll,
  ])

  // Called when AnimatedDice settles — wrapped in useCallback to avoid stale closures
  const handleDiceSettled = useCallback(() => {
    if (diceValue === null || !workingCompany) return
    const casualty = casualties[injuryIndex]
    if (!casualty) return
    const member = workingCompany.members.find(
      (m) => m.id === casualty.memberId
    )
    if (!member) return

    const outcome = casualty.isHero
      ? resolveHeroInjury(diceValue, member)
      : resolveWarriorInjury(diceValue)

    const [pd1, pd2] = pendingDiceRef.current ?? [undefined, undefined]
    const newRecord: InjuryRecord = {
      memberId: casualty.memberId,
      memberName: casualty.memberName,
      isHero: casualty.isHero,
      roll: diceValue,
      die1: pd1,
      die2: pd2,
      outcome,
    }

    setInjuryRecords((prev) => [...prev, newRecord])

    if (outcome.type === 'scratch_choice') {
      setScratchDialog({
        memberId: casualty.memberId,
        memberName: casualty.memberName,
      })
    } else {
      applyInjuryAndAdvance(newRecord)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceValue, workingCompany, injuryIndex, casualties])

  useEffect(() => {
    if (diceValue !== null && rollingFor) {
      handleDiceSettled()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diceValue])

  const applyInjuryAndAdvance = (record: InjuryRecord) => {
    if (!workingCompany) return
    const outcomeToApply = record.rerolled
      ? record.rerollOutcome!
      : record.outcome!
    const member = workingCompany.members.find((m) => m.id === record.memberId)
    if (!member) return advanceInjuryIndex(record.memberId)

    if (outcomeToApply.type === 'wounds_of_a_hero') {
      setBonusInfluence((prev) => prev + outcomeToApply.bonusInfluence)
    }
    if (outcomeToApply.type === 'warrior_lesson_learned') {
      setWorkingCompany((prev) => {
        if (!prev) return prev
        const xpBonus = (outcomeToApply as any).bonusXp ?? 0
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === record.memberId
              ? {
                  ...m,
                  experience: m.experience + xpBonus,
                  lifetimeExperience: m.lifetimeExperience + xpBonus,
                }
              : m
          ),
        }
      })
    }

    const { member: updated, isDead } = applyInjuryOutcome(
      member,
      outcomeToApply
    )

    if (isDead) {
      setWorkingCompany((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          members: prev.members.filter((m) => m.id !== record.memberId),
        }
      })
      advanceInjuryIndex(record.memberId)
    } else {
      // Check if full_recovery with healable injuries
      const canHeal =
        outcomeToApply.type === 'full_recovery' ||
        outcomeToApply.type === 'protection_by_valar' ||
        outcomeToApply.type === 'wounds_of_a_hero'
      const healableTypes = updated.injuries
        .filter(
          (i) =>
            i.type === 'arm_wound' ||
            i.type === 'leg_wound' ||
            i.type === 'broken_honour'
        )
        .map((i) => i.type) as Array<
        'arm_wound' | 'leg_wound' | 'broken_honour'
      >

      if (canHeal && healableTypes.length > 0) {
        setWorkingCompany((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            members: prev.members.map((m) =>
              m.id === updated.id ? updated : m
            ),
          }
        })
        setHealDialog({
          memberId: updated.id,
          memberName: updated.name,
          options: healableTypes,
        })
      } else {
        setWorkingCompany((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            members: prev.members.map((m) =>
              m.id === updated.id ? updated : m
            ),
          }
        })
        advanceInjuryIndex(record.memberId)
      }
    }
  }

  const advanceInjuryIndex = (currentMemberId: string) => {
    const nextIdx = injuryIndex + 1
    setInjuryIndex(nextIdx)
    setRollingFor(null)
    setDiceValue(null)
    if (nextIdx >= casualties.length) {
      setInjuriesReady(true)
    } else {
      setTimeout(() => startNextInjuryRoll(nextIdx), 600)
    }
  }

  // Scratch: miss next game
  const handleScratchMiss = () => {
    setScratchDialog(null)
    const record = injuryRecords[injuryRecords.length - 1]
    const finalRecord = {
      ...record,
      outcome: { type: 'missing_next_game' } as InjuryOutcome,
    }
    setInjuryRecords((prev) => [...prev.slice(0, -1), finalRecord])
    applyInjuryAndAdvance(finalRecord)
  }

  // Scratch: reroll
  const handleScratchReroll = () => {
    if (!workingCompany) return
    setScratchDialog(null)
    const { die1: rd1, die2: rd2, total: newRoll } = roll2d6WithDice()
    const record = injuryRecords[injuryRecords.length - 1]
    const member = workingCompany.members.find((m) => m.id === record.memberId)
    if (!member) return
    const rerollOutcome = resolveHeroInjury(newRoll, member)
    // If another 6, auto-miss next game
    const finalOutcome =
      rerollOutcome.type === 'scratch_choice'
        ? { type: 'missing_next_game' as const }
        : rerollOutcome
    const finalRecord = {
      ...record,
      rerolled: true,
      rerollRoll: newRoll,
      rerollDie1: rd1,
      rerollDie2: rd2,
      rerollOutcome: finalOutcome,
    }
    setInjuryRecords((prev) => [...prev.slice(0, -1), finalRecord])
    applyInjuryAndAdvance(finalRecord)
  }

  // Heal choice
  const handleHealChoice = (
    injuryType: 'arm_wound' | 'leg_wound' | 'broken_honour'
  ) => {
    const { memberId } = healDialog!
    setHealDialog(null)
    setWorkingCompany((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        members: prev.members.map((m) =>
          m.id === memberId ? healInjury(m, injuryType) : m
        ),
      }
    })
    advanceInjuryIndex(memberId)
  }

  const completeInjuries = () => {
    // Apply bonus influence
    if (bonusInfluence > 0) {
      setWorkingCompany((prev) => {
        if (!prev) return prev
        return { ...prev, influence: prev.influence + bonusInfluence }
      })
    }
    setCompletedSteps((prev) => new Set([...prev, 'Injuries']))
    setCurrentStep('Progression')
    setProgressionInitPending(true)
  }

  // Run initProgressionStep after state has settled
  useEffect(() => {
    if (progressionInitPending && workingCompany) {
      setProgressionInitPending(false)
      initProgressionStep()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressionInitPending, workingCompany])

  // ─── PROGRESSION STEP ────────────────────────────────────────────────────────

  const initProgressionStep = () => {
    if (!workingCompany) return
    // Find warriors and heroes who need progression
    const members = workingCompany.members
    const warriors = members.filter(
      (m) => m.role === 'warrior' && needsProgression(m)
    )
    const heroes = members.filter(
      (m) => m.role !== 'warrior' && needsProgression(m) && m.pathId
    )

    // Build warrior progression records with pre-rolled dice
    const wpRecords: WarriorProgRecord[] = warriors.map((m) => {
      const roll = rollD6Single()
      let result: WarriorProgResult
      if (isOnTheirOwnPath(m.baseUnitId, m.equipment)) {
        result = roll >= 4 ? 'ci_boost' : 'no_change' // on their own path: 6 treated as 4-5
      } else if (roll >= 1 && roll <= 3) {
        result = 'no_change'
      } else if (roll >= 4 && roll <= 5) {
        result = 'promoted'
      } else {
        result = 'hero_in_making'
      }
      const promotionOptions =
        result === 'promoted' || result === 'hero_in_making'
          ? companyDef
            ? getWarriorAdvancements(m, companyDef)
            : []
          : []
      // If promoted but no options, fallback to CI boost
      if (result === 'promoted' && promotionOptions.length === 0) {
        result = 'ci_boost'
      }
      return {
        memberId: m.id,
        memberName: m.name,
        roll,
        result,
        promotionOptions,
        done: false,
      }
    })

    // Build hero advancement records with two pre-rolled pairs
    const haRecords: HeroAdvRecord[] = heroes.map((m) => {
      const path = getPath(m.pathId!)
      const [rollA, rollB] = roll2d6Pair()
      const entryA = getPathEntry(m.pathId!, rollA)!
      const entryB = getPathEntry(m.pathId!, rollB)!
      return {
        memberId: m.id,
        memberName: m.name,
        pathId: m.pathId!,
        pathLabel: path?.label ?? m.pathId!,
        rollA,
        rollB,
        chosen: null,
        resultA: { roll: rollA, entry: entryA, applied: false },
        resultB: { roll: rollB, entry: entryB, applied: false },
        done: false,
      }
    })

    setWarriorProgRecords(wpRecords)
    setHeroAdvRecords(haRecords)
    setProgressionIndex(0)
    setProgPhase(
      wpRecords.length > 0
        ? 'warriors'
        : haRecords.length > 0
          ? 'heroes'
          : 'done'
    )
  }

  // Apply warrior progression and move to next
  const applyWarriorProg = (
    record: WarriorProgRecord,
    chosenPromotionIdx?: number
  ) => {
    setWorkingCompany((prev) => {
      if (!prev || !companyDef) return prev
      const m = prev.members.find((mem) => mem.id === record.memberId)
      if (!m) return prev
      let updated = m

      if (record.result === 'ci_boost') {
        // C and I improve by going lower (target number decreases) — store as -1 delta
        updated = {
          ...m,
          statIncreases: {
            ...m.statIncreases,
            courage: (m.statIncreases.courage ?? 0) - 1,
            intelligence: (m.statIncreases.intelligence ?? 0) - 1,
          },
          experience: Math.max(0, m.experience - 5),
        }
      } else if (
        record.result === 'promoted' &&
        chosenPromotionIdx !== undefined
      ) {
        const promo = record.promotionOptions![chosenPromotionIdx]
        updated = applyWarriorPromotion(
          m,
          promo.toBaseUnitId,
          promo.equipment ?? [],
          promo.retainWargear ?? false,
          getStatsForUnit
        )
      } else if (record.result === 'hero_in_making') {
        updated = applyHeroInTheMaking(m)
      } else {
        // no_change: still subtract XP
        updated = { ...m, experience: Math.max(0, m.experience - 5) }
      }

      return {
        ...prev,
        members: prev.members.map((mem) => (mem.id === m.id ? updated : mem)),
      }
    })

    // For hero_in_making, don't mark done yet — path selection happens next
    // and applyHeroPath will call advanceProgression once the path is chosen
    if (record.result !== 'hero_in_making') {
      setWarriorProgRecords((prev) =>
        prev.map((r) =>
          r.memberId === record.memberId
            ? { ...r, done: true, chosenPromotion: chosenPromotionIdx }
            : r
        )
      )
      advanceProgression('warriors', record.memberId)
    }
  }

  // Apply hero in the making path selection
  const applyHeroPath = (memberId: string, pathId: string) => {
    setPathSelectMember(null)
    const path = getPath(pathId)
    const heroicAction = path?.heroicAction
    const actionLabel = heroicAction
      ? heroicAction.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      : null
    setWorkingCompany((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        members: prev.members.map((m) =>
          m.id === memberId
            ? {
                ...m,
                pathId,
                heroStats: m.heroStats ?? { might: 1, will: 1, fate: 1 },
                specialRules:
                  actionLabel && !m.specialRules.includes(actionLabel)
                    ? [...m.specialRules, actionLabel]
                    : m.specialRules,
              }
            : m
        ),
      }
    })
    // Mark done, store path, then advance
    setWarriorProgRecords((prev) =>
      prev.map((r) =>
        r.memberId === memberId ? { ...r, done: true, newPathId: pathId } : r
      )
    )
    advanceProgression('warriors', memberId)
  }

  const advanceProgression = (
    phase: 'warriors' | 'heroes',
    currentId: string
  ) => {
    if (phase === 'warriors') {
      const nextIdx =
        warriorProgRecords.findIndex((r) => r.memberId === currentId) + 1
      if (nextIdx < warriorProgRecords.length) {
        setProgressionIndex(nextIdx)
      } else if (heroAdvRecords.length > 0) {
        setProgPhase('heroes')
        setProgressionIndex(0)
      } else {
        setProgPhase('done')
      }
    } else {
      const nextIdx =
        heroAdvRecords.findIndex((r) => r.memberId === currentId) + 1
      if (nextIdx < heroAdvRecords.length) {
        setProgressionIndex(nextIdx)
      } else {
        setProgPhase('done')
      }
    }
  }

  // Apply hero advancement choice
  const applyHeroAdv = (
    record: HeroAdvRecord,
    chosen: 'A' | 'B',
    chosenStatIndex?: number,
    chosenOptionIndex?: number,
    chosenMinorRule?: string,
    chosenHeroicAction?: string
  ) => {
    const chosenResult = chosen === 'A' ? record.resultA : record.resultB
    const otherResult = chosen === 'A' ? record.resultB : record.resultA
    const isRoll5 = chosenResult.roll === 5
    const applyBoth = isRoll5

    const applyResult = (
      member: Member,
      res: HeroAdvRollResult,
      statIdx?: number,
      optIdx?: number,
      minorRule?: string,
      heroicAction?: string
    ): Member => {
      const entry = res.entry
      if (!entry) return member

      if (entry.type === 'stat') {
        const opts = entry.options as string[]
        const stat = opts.length === 1 ? opts[0] : opts[statIdx ?? 0]
        return applyStatIncrease(member, stat)
      }
      if (entry.type === 'special_rule') {
        const label = entry.label ?? entry.specialRuleId ?? ''
        return applySpecialRule(member, label)
      }
      if (entry.type === 'choice') {
        const opts = entry.options as PathProgEntry[]
        const chosen = opts[optIdx ?? 0]
        if (!chosen) return member
        if (chosen.type === 'stat') {
          const statOpts = chosen.options as string[]
          const stat = statOpts.length === 1 ? statOpts[0] : statOpts[0]
          return applyStatIncrease(member, stat)
        }
        if (chosen.type === 'special_rule') {
          const label = chosen.label ?? chosen.specialRuleId ?? ''
          return applySpecialRule(member, label)
        }
        if (chosen.type === 'minor_special_rule' && minorRule) {
          const ruleData = SPECIAL_RULES.find((r) => r.id === minorRule)
          return applySpecialRule(member, ruleData?.label ?? minorRule)
        }
        if (chosen.type === 'heroic_action' && heroicAction) {
          const haData = HEROIC_ACTIONS.find((h) => h.id === heroicAction)
          return applySpecialRule(member, haData?.label ?? heroicAction)
        }
      }
      if (entry.type === 'minor_special_rule' && minorRule) {
        const ruleData = SPECIAL_RULES.find((r) => r.id === minorRule)
        return applySpecialRule(member, ruleData?.label ?? minorRule)
      }
      return member
    }

    setWorkingCompany((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        members: prev.members.map((m) => {
          if (m.id !== record.memberId) return m
          let updated = applyResult(
            m,
            chosenResult,
            chosenStatIndex,
            chosenOptionIndex,
            chosenMinorRule,
            chosenHeroicAction
          )
          if (applyBoth) {
            updated = applyResult(updated, otherResult)
          }
          return subtractAdvancementXp(updated)
        }),
      }
    })

    setHeroAdvRecords((prev) =>
      prev.map((r) =>
        r.memberId === record.memberId ? { ...r, chosen, done: true } : r
      )
    )
    advanceProgression('heroes', record.memberId)
  }

  const completeProgression = () => {
    setCompletedSteps((prev) => new Set([...prev, 'Progression']))
    setCurrentStep('Influence')
  }

  // ─── INFLUENCE STEP ───────────────────────────────────────────────────────────

  const completeInfluence = async () => {
    if (!workingCompany) return

    // Save final state to DB including match history record
    const matchRecord = {
      id: uuidv4(),
      date: new Date().toISOString(),
      result: postMatchData!.result,
      opponentRating: postMatchData!.opponentRating,
      scenarioId: postMatchData!.scenarioId,
      scenarioLabel: postMatchData!.scenarioLabel,
      influenceGained: postMatchData!.influenceBase + bonusInfluence,
      casualties: postMatchData!.casualties.map((c) => ({
        memberId: c.memberId,
        memberName: c.memberName,
        injuryResult:
          injuryRecords.find((r) => r.memberId === c.memberId)?.outcome?.type ??
          'unknown',
      })),
      xpGained: postMatchData!.xpGained,
    }

    const finalCompany: Company = {
      ...workingCompany,
      matchHistory: [...workingCompany.matchHistory, matchRecord],
      lastPlayedAt: new Date().toISOString(),
    }

    await saveCompany(finalCompany)
    setCompletedSteps((prev) => new Set([...prev, 'Influence']))
    setShowReturnConfirm(true)
  }

  const isProgressionDone =
    progPhase === 'done' ||
    (warriorProgRecords.length === 0 && heroAdvRecords.length === 0)

  // ─── Render ───────────────────────────────────────────────────────────────────

  const currentWarrior =
    progPhase === 'warriors' ? warriorProgRecords[progressionIndex] : null
  const currentHero =
    progPhase === 'heroes' ? heroAdvRecords[progressionIndex] : null
  const currentCasualty = rollingFor
    ? casualties.find((c) => c.memberId === rollingFor)
    : null

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Post-Match Summary"
        subtitle={`${postMatchData.scenarioLabel} — ${postMatchData.result === 'win' ? 'Victory' : postMatchData.result === 'draw' ? 'Draw' : 'Defeat'}`}
      />

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: { xs: 2, sm: 3 },
          py: 3,
          pb: 14,
          maxWidth: 600,
          mx: 'auto',
          width: '100%',
        }}
      >
        {/* ── INJURIES ──────────────────────────────────────────────────── */}
        <StepCard>
          <SectionHeader step="Injuries" label="Injuries" />
          <Collapse in={currentStep === 'Injuries'}>
            <Box>
              {!hasCasualties && (
                <Typography variant="body2" sx={{ opacity: 0.6, mb: 2 }}>
                  No casualties this match.
                </Typography>
              )}

              {/* Completed injury records */}
              {injuryRecords.map((rec, i) => {
                const outcome = rec.rerolled ? rec.rerollOutcome! : rec.outcome!
                if (outcome.type === 'scratch_choice') return null
                return (
                  <MotionBox
                    key={rec.memberId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    sx={{
                      mb: 1,
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      borderLeftWidth: 3,
                      borderLeftColor: outcomeColour(outcome),
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 1,
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
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {rec.memberName}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              opacity: 0.5,
                              fontSize: '0.62rem',
                              px: 0.75,
                              py: 0.15,
                              border: '1px solid',
                              borderColor: rec.isHero
                                ? 'primary.dark'
                                : 'divider',
                              borderRadius: 0.5,
                              color: rec.isHero
                                ? 'primary.light'
                                : 'text.secondary',
                            }}
                          >
                            {rec.isHero ? 'Hero' : 'Warrior'}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                          {rec.isHero
                            ? describeHeroRoll(
                                rec.rerolled ? rec.rerollRoll! : rec.roll!
                              )
                            : describeWarriorRoll(rec.roll!)}
                        </Typography>
                      </Box>
                      {/* Dice display */}
                      {(() => {
                        const d1 = rec.rerolled ? rec.rerollDie1 : rec.die1
                        const d2 = rec.rerolled ? rec.rerollDie2 : rec.die2
                        const total = rec.rerolled ? rec.rerollRoll : rec.roll
                        return (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              flexShrink: 0,
                            }}
                          >
                            {d1 != null && d2 != null ? (
                              <>
                                <DieFace value={d1} size={24} />
                                <Typography
                                  sx={{
                                    fontSize: '0.65rem',
                                    opacity: 0.5,
                                    fontFamily: '"Cinzel Decorative", serif',
                                  }}
                                >
                                  +
                                </Typography>
                                <DieFace value={d2} size={24} />
                                <Typography
                                  sx={{
                                    fontSize: '0.65rem',
                                    opacity: 0.5,
                                    fontFamily: '"Cinzel Decorative", serif',
                                  }}
                                >
                                  =
                                </Typography>
                              </>
                            ) : null}
                            <Box
                              sx={{
                                minWidth: 28,
                                height: 24,
                                border: '1px solid',
                                borderColor: 'primary.dark',
                                borderRadius: 0.75,
                                background: 'rgba(0,0,0,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                px: 0.5,
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: '0.7rem',
                                  fontFamily: '"Cinzel Decorative", serif',
                                  fontWeight: 700,
                                  color: 'primary.main',
                                  lineHeight: 1,
                                }}
                              >
                                {total}
                              </Typography>
                            </Box>
                          </Box>
                        )
                      })()}
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0.5,
                        mt: 0.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ flex: 1, color: outcomeColour(outcome) }}
                      >
                        {outcomeLabel(outcome, rec.memberName)}
                      </Typography>
                      <Box
                        component="span"
                        onClick={() =>
                          setInjuryExplain({
                            label: rec.isHero
                              ? describeHeroRoll(
                                  rec.rerolled ? rec.rerollRoll! : rec.roll!
                                )
                              : describeWarriorRoll(rec.roll!),
                            explanation: getOutcomeExplanation(outcome.type),
                          })
                        }
                        sx={{
                          cursor: 'pointer',
                          flexShrink: 0,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: '1px solid',
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0.55,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: 'text.secondary',
                          '&:hover': {
                            opacity: 1,
                            borderColor: 'primary.dark',
                          },
                          userSelect: 'none',
                        }}
                      >
                        ?
                      </Box>
                    </Box>
                    {rec.healed && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          opacity: 0.6,
                          fontStyle: 'italic',
                        }}
                      >
                        Healed: {rec.healed.replace(/_/g, ' ')}
                      </Typography>
                    )}
                  </MotionBox>
                )
              })}

              {/* Active roll animation */}
              {currentCasualty && !injuriesReady && (
                <Box
                  sx={{
                    py: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    Rolling injury for…
                  </Typography>
                  <AnimatedDice
                    finalValue={diceValue}
                    label={currentCasualty.memberName}
                    onSettled={(d1, d2) => setDiceIndividual([d1, d2])}
                  />
                </Box>
              )}

              {injuriesReady && currentStep === 'Injuries' && (
                <Button
                  variant="contained"
                  fullWidth
                  onClick={completeInjuries}
                  sx={{
                    mt: 1.5,
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '0.65rem',
                  }}
                >
                  Continue to Progression
                </Button>
              )}
            </Box>
          </Collapse>

          {completedSteps.has('Injuries') && currentStep !== 'Injuries' && (
            <Typography variant="caption" sx={{ opacity: 0.5 }}>
              {injuryRecords.length === 0
                ? 'No casualties.'
                : `${injuryRecords.length} casualty result(s) resolved.`}
            </Typography>
          )}
        </StepCard>

        {/* ── PROGRESSION ────────────────────────────────────────────────── */}
        <StepCard>
          <SectionHeader step="Progression" label="Experience & Progression" />
          <Collapse in={currentStep === 'Progression'}>
            <Box>
              {/* XP summary */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.6,
                    display: 'block',
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontSize: '0.6rem',
                  }}
                >
                  XP Gained This Match
                </Typography>
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
                >
                  {postMatchData.xpGained.map((x) => {
                    const memberForXp = workingCompany.members.find(
                      (m) => m.id === x.memberId
                    )
                    const needsProg = memberForXp
                      ? needsProgression(memberForXp)
                      : false
                    return (
                      <Box
                        key={x.memberId}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          px: 1,
                          py: 0.5,
                          border: '1px solid',
                          borderColor: needsProg ? 'primary.dark' : 'divider',
                          borderRadius: 0.5,
                          background: needsProg
                            ? 'rgba(201,168,76,0.04)'
                            : 'transparent',
                        }}
                      >
                        <Typography variant="body2">{x.memberName}</Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                          }}
                        >
                          <Typography
                            sx={{
                              fontFamily: '"Cinzel Decorative", serif',
                              color: 'primary.main',
                              fontSize: '0.85rem',
                            }}
                          >
                            +{x.xp}
                          </Typography>
                          {needsProg && (
                            <Chip
                              label="ADVANCES"
                              size="small"
                              sx={{
                                fontSize: '0.55rem',
                                height: 16,
                                background: 'rgba(201,168,76,0.15)',
                                color: 'primary.main',
                                border: '1px solid',
                                borderColor: 'primary.dark',
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </Box>

              <Divider sx={{ opacity: 0.3, mb: 2 }} />

              {/* No progressions */}
              {warriorProgRecords.length === 0 &&
                heroAdvRecords.length === 0 && (
                  <Typography variant="body2" sx={{ opacity: 0.6, mb: 2 }}>
                    No members need to progress yet.
                  </Typography>
                )}

              {/* Active warrior progression */}
              {progPhase === 'warriors' &&
                currentWarrior &&
                !currentWarrior.done && (
                  <WarriorProgressionCard
                    record={currentWarrior}
                    companyDef={companyDef}
                    getStatsForUnit={getStatsForUnit}
                    onApply={(idx) => applyWarriorProg(currentWarrior, idx)}
                    onNeedPathSelect={() => {
                      // Apply hero_in_making transformation first (sets role + heroStats)
                      applyWarriorProg(currentWarrior)
                      const m = workingCompany?.members.find(
                        (x) => x.id === currentWarrior.memberId
                      )
                      setPathSelectMember({
                        memberId: currentWarrior.memberId,
                        memberName: currentWarrior.memberName,
                        baseUnitId: m?.baseUnitId ?? '',
                        equipment: m?.equipment ?? [],
                      })
                    }}
                  />
                )}

              {/* Completed warrior progressions */}
              {warriorProgRecords
                .filter((r) => r.done)
                .map((rec: WarriorProgRecord) => (
                  <CompletedWarriorCard key={rec.memberId} record={rec} />
                ))}

              {/* Active hero advancement */}
              {progPhase === 'heroes' && currentHero && !currentHero.done && (
                <HeroAdvancementCard
                  record={currentHero}
                  member={
                    workingCompany.members.find(
                      (m) => m.id === currentHero.memberId
                    )!
                  }
                  getStatsForUnit={getStatsForUnit}
                  onApply={(chosen, statIdx, optIdx, minorRule, heroicAction) =>
                    applyHeroAdv(
                      currentHero,
                      chosen,
                      statIdx,
                      optIdx,
                      minorRule,
                      heroicAction
                    )
                  }
                />
              )}

              {/* Completed hero advancements */}
              {heroAdvRecords
                .filter((r) => r.done)
                .map((rec: HeroAdvRecord) => (
                  <CompletedHeroCard key={rec.memberId} record={rec} />
                ))}

              {isProgressionDone && currentStep === 'Progression' && (
                <Button
                  variant="contained"
                  fullWidth
                  onClick={completeProgression}
                  sx={{
                    mt: 1.5,
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '0.65rem',
                  }}
                >
                  Continue to Influence
                </Button>
              )}
            </Box>
          </Collapse>

          {completedSteps.has('Progression') &&
            currentStep !== 'Progression' && (
              <Typography variant="caption" sx={{ opacity: 0.5 }}>
                Progression resolved.
              </Typography>
            )}
        </StepCard>

        {/* ── INFLUENCE ──────────────────────────────────────────────────── */}
        <StepCard>
          <SectionHeader step="Influence" label="Influence" />
          <Collapse in={currentStep === 'Influence'}>
            <Box>
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
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.6, display: 'block', mb: 0.5 }}
                >
                  Total Influence Gained
                </Typography>
                <Typography
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '2rem',
                    color: 'primary.main',
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  +{postMatchData.influenceBase + bonusInfluence}
                </Typography>
                {bonusInfluence > 0 && (
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.6, display: 'block', mt: 0.5 }}
                  >
                    Includes +{bonusInfluence} from Wounds of a Hero
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.5, display: 'block', mt: 0.25 }}
                >
                  New total: {workingCompany.influence}
                </Typography>
              </Box>

              <Button
                variant="contained"
                fullWidth
                onClick={completeInfluence}
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: '0.65rem',
                }}
              >
                Complete &amp; Return to Company
              </Button>
            </Box>
          </Collapse>

          {completedSteps.has('Influence') && (
            <Typography variant="caption" sx={{ opacity: 0.5 }}>
              +{postMatchData.influenceBase + bonusInfluence} influence awarded.
            </Typography>
          )}
        </StepCard>
      </Box>

      {/* ── T'is Just a Scratch dialog ────────────────────────────────────── */}
      <Dialog
        open={!!scratchDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(160deg, #1a1008 0%, #110a03 100%)',
            border: '1px solid rgba(200,164,90,0.25)',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>T'is Just a Scratch!</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>{scratchDialog?.memberName}</strong> narrowly escaped
            serious injury.
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Choose what happens next:
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button variant="outlined" onClick={handleScratchMiss} fullWidth>
            Miss Next Game
          </Button>
          <Button
            variant="contained"
            onClick={handleScratchReroll}
            fullWidth
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '0.65rem',
            }}
          >
            Roll Again
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Heal choice dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={!!healDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(160deg, #1a1008 0%, #110a03 100%)',
            border: '1px solid rgba(200,164,90,0.25)',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>Full Recovery</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            <strong>{healDialog?.memberName}</strong> may heal one existing
            injury. Choose which to remove:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {healDialog?.options.map((opt) => (
              <Button
                key={opt}
                variant="outlined"
                onClick={() => handleHealChoice(opt)}
                fullWidth
                sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
              >
                {opt
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </Button>
            ))}
          </Box>
        </DialogContent>
      </Dialog>

      {/* ── Path selection dialog ─────────────────────────────────────────── */}
      {pathSelectMember && (
        <PathSelectionDialog
          memberName={pathSelectMember.memberName}
          baseUnitId={pathSelectMember.baseUnitId}
          equipment={pathSelectMember.equipment}
          onSelect={(pathId) =>
            applyHeroPath(pathSelectMember.memberId, pathId)
          }
        />
      )}

      {/* ── Return confirm ─────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={showReturnConfirm}
        title="Return to Company"
        message="All post-match changes have been saved. Return to your company?"
        confirmLabel="Return"
        cancelLabel="Stay"
        onConfirm={() => navigate(`/companies/${companyId}`)}
        onCancel={() => setShowReturnConfirm(false)}
      />

      {/* Injury result explanation popup */}
      {injuryExplain && (
        <Dialog
          open
          onClose={() => setInjuryExplain(null)}
          PaperProps={{
            sx: {
              background: '#1a0f05',
              border: '1px solid',
              borderColor: 'primary.dark',
              borderRadius: 2,
              maxWidth: 420,
            },
          }}
        >
          <DialogTitle
            sx={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: '0.85rem',
              color: 'primary.main',
              pb: 1,
            }}
          >
            {injuryExplain.label}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ opacity: 0.85, lineHeight: 1.6 }}>
              {injuryExplain.explanation}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setInjuryExplain(null)}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        background: 'rgba(0,0,0,0.15)',
      }}
    >
      {children}
    </Box>
  )
}

// ─── WarriorProgressionCard ───────────────────────────────────────────────────

interface WPCardProps {
  record: WarriorProgRecord
  companyDef: CompanyDefinition
  getStatsForUnit: (
    id: string
  ) => import('../models').StoredBaseUnitStats | undefined
  onApply: (promotionIdx?: number) => void
  onNeedPathSelect: () => void
}

function WarriorProgressionCard({
  record,
  companyDef,
  getStatsForUnit,
  onApply,
  onNeedPathSelect,
}: WPCardProps) {
  const [chosen, setChosen] = useState<number | null>(null)

  const resultText: Record<WarriorProgResult, string> = {
    no_change: 'No Change — the warrior holds steady.',
    promoted: 'Promoted!',
    ci_boost: '+1 Courage & +1 Intelligence (no promotion available).',
    hero_in_making: 'Hero in the Making!',
  }

  return (
    <MotionBox
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      sx={{
        mb: 2,
        p: 1.5,
        border: '1px solid',
        borderColor: 'primary.dark',
        borderRadius: 1,
        background: 'rgba(201,168,76,0.03)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {record.memberName}
        </Typography>
        <Chip
          label={`D6: ${record.roll}`}
          size="small"
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '0.65rem',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        />
      </Box>
      <Typography variant="body2" sx={{ color: 'primary.light', mb: 1 }}>
        {resultText[record.result]}
      </Typography>

      {record.result === 'promoted' &&
        record.promotionOptions &&
        record.promotionOptions.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
              mb: 1.5,
            }}
          >
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              Choose promotion:
            </Typography>
            {record.promotionOptions.map((opt, i) => (
              <Box
                key={i}
                onClick={() => setChosen(i)}
                sx={{
                  p: 1.25,
                  border: '1px solid',
                  borderColor: chosen === i ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  background:
                    chosen === i ? 'rgba(201,168,76,0.08)' : 'rgba(0,0,0,0.15)',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: 'primary.dark' },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: chosen === i ? 'primary.main' : 'text.primary',
                  }}
                >
                  {getUnitLabel(opt.toBaseUnitId)}
                </Typography>
                {opt.equipment && opt.equipment.length > 0 && (
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    with {opt.equipment.join(', ')}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}

      {record.result === 'hero_in_making' && (
        <Typography
          variant="caption"
          sx={{ display: 'block', opacity: 0.65, mb: 1 }}
        >
          This warrior has earned their place among heroes. You'll choose a
          heroic path next.
        </Typography>
      )}

      <Button
        variant="contained"
        fullWidth
        size="small"
        disabled={record.result === 'promoted' && chosen === null}
        onClick={() => {
          if (record.result === 'hero_in_making') {
            onNeedPathSelect()
          } else {
            onApply(chosen ?? undefined)
          }
        }}
        sx={{ fontFamily: '"Cinzel Decorative", serif', fontSize: '0.62rem' }}
      >
        {record.result === 'hero_in_making' ? 'Choose Heroic Path' : 'Apply'}
      </Button>
    </MotionBox>
  )
}

function CompletedWarriorCard({
  record,
}: {
  key?: string
  record: WarriorProgRecord
}) {
  const labels: Record<WarriorProgResult, string> = {
    no_change: 'No change.',
    promoted: `Promoted to ${record.promotionOptions?.[record.chosenPromotion ?? 0] ? getUnitLabel(record.promotionOptions[record.chosenPromotion ?? 0].toBaseUnitId) : '?'}`,
    ci_boost: '+1 Courage & Intelligence',
    hero_in_making: `Hero in the Making${record.newPathId ? ` — ${record.newPathId.replace('path_of_', '').replace(/_/g, ' ')} path` : ''}`,
  }
  return (
    <Box
      sx={{
        mb: 1,
        px: 1.5,
        py: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        opacity: 0.7,
      }}
    >
      <Typography variant="caption">{record.memberName}</Typography>
      <Typography variant="caption" sx={{ color: 'primary.light' }}>
        {labels[record.result]}
      </Typography>
    </Box>
  )
}

// ─── HeroAdvancementCard ──────────────────────────────────────────────────────

interface HACardProps {
  record: HeroAdvRecord
  member: Member
  getStatsForUnit: (
    id: string
  ) => import('../models').StoredBaseUnitStats | undefined
  onApply: (
    chosen: 'A' | 'B',
    statIdx?: number,
    optIdx?: number,
    minorRule?: string,
    heroicAction?: string
  ) => void
}

function HeroAdvancementCard({
  record,
  member,
  getStatsForUnit,
  onApply,
}: HACardProps) {
  const [chosen, setChosen] = useState<'A' | 'B' | null>(null)
  const [statChoice, setStatChoice] = useState<number>(0)
  const [optionChoice, setOptionChoice] = useState<number>(0)
  const [minorRule, setMinorRule] = useState<string>('')
  const [heroicAction, setHeroicAction] = useState<string>('')

  const path = getPath(record.pathId)
  const chosenResult =
    chosen === 'A' ? record.resultA : chosen === 'B' ? record.resultB : null
  const otherResult =
    chosen === 'A' ? record.resultB : chosen === 'B' ? record.resultA : null
  const isRoll5 = chosenResult?.roll === 5

  const canConfirm =
    chosen !== null &&
    needsExtraChoice(
      chosenResult?.entry,
      statChoice,
      optionChoice,
      minorRule,
      heroicAction
    )

  return (
    <MotionBox
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      sx={{
        mb: 2,
        p: 1.5,
        border: '1px solid',
        borderColor: 'primary.dark',
        borderRadius: 1,
        background: 'rgba(201,168,76,0.03)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1.5,
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {record.memberName}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            {record.pathLabel}
          </Typography>
        </Box>
        <Chip
          label="Advancement"
          size="small"
          sx={{
            fontSize: '0.6rem',
            height: 18,
            color: 'primary.main',
            border: '1px solid',
            borderColor: 'primary.dark',
            background: 'transparent',
          }}
        />
      </Box>

      {isRoll5 && (
        <Box
          sx={{
            mb: 1,
            px: 1.5,
            py: 0.75,
            border: '1px solid',
            borderColor: 'rgba(201,168,76,0.3)',
            borderRadius: 1,
            background: 'rgba(201,168,76,0.04)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'primary.light' }}>
            You rolled a 5 — you gain +1 Courage or Intelligence AND your other
            result is also applied!
          </Typography>
        </Box>
      )}

      <Box
        sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.5 }}
      >
        {(['A', 'B'] as const).map((side) => {
          const res = side === 'A' ? record.resultA : record.resultB
          const isSelected = chosen === side
          return (
            <Box
              key={side}
              onClick={() => {
                setChosen(side)
                setStatChoice(0)
                setOptionChoice(0)
                setMinorRule('')
                setHeroicAction('')
              }}
              sx={{
                p: 1.25,
                border: '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                background: isSelected
                  ? 'rgba(201,168,76,0.08)'
                  : 'rgba(0,0,0,0.15)',
                transition: 'all 0.15s',
                '&:hover': { borderColor: 'primary.dark' },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 0.25,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: isSelected ? 'primary.main' : 'text.secondary',
                  }}
                >
                  Roll {res.roll}
                </Typography>
                <Chip
                  label={res.roll}
                  size="small"
                  sx={{
                    fontFamily: '"Cinzel Decorative", serif',
                    fontSize: '0.65rem',
                    height: 18,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid',
                    borderColor: isSelected ? 'primary.dark' : 'divider',
                  }}
                />
              </Box>
              <Typography
                variant="body2"
                sx={{ color: isSelected ? 'text.primary' : 'text.secondary' }}
              >
                {describePathEntry(res.entry, path)}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* Extra choice UI when a result is selected and needs sub-choice */}
      {chosenResult && chosen && (
        <ExtraChoiceUI
          entry={chosenResult.entry}
          path={path}
          statChoice={statChoice}
          onStatChoice={setStatChoice}
          optionChoice={optionChoice}
          onOptionChoice={setOptionChoice}
          minorRule={minorRule}
          onMinorRule={setMinorRule}
          heroicAction={heroicAction}
          onHeroicAction={setHeroicAction}
          member={member}
        />
      )}

      <Button
        variant="contained"
        fullWidth
        size="small"
        disabled={!canConfirm}
        onClick={() =>
          onApply(
            chosen!,
            statChoice,
            optionChoice,
            minorRule || undefined,
            heroicAction || undefined
          )
        }
        sx={{ fontFamily: '"Cinzel Decorative", serif', fontSize: '0.62rem' }}
      >
        Confirm Advancement
      </Button>
    </MotionBox>
  )
}

function needsExtraChoice(
  entry: PathProgEntry | undefined,
  statChoice: number,
  optChoice: number,
  minorRule: string,
  heroicAction: string
): boolean {
  if (!entry) return false
  if (entry.type === 'stat') {
    const opts = entry.options as string[]
    return opts.length <= 1 || statChoice >= 0
  }
  if (entry.type === 'special_rule') return true
  if (entry.type === 'choice') {
    const opts = entry.options as PathProgEntry[]
    const chosen = opts[optChoice]
    if (!chosen) return false
    if (chosen.type === 'minor_special_rule') return !!minorRule
    if (chosen.type === 'heroic_action') return !!heroicAction
    return true
  }
  return true
}

function describePathEntry(
  entry: PathProgEntry | undefined,
  path: PathDef | undefined
): string {
  if (!entry) return '—'
  if (entry.type === 'stat') {
    const opts = entry.options as string[]
    return `Improve ${describeStatOption(opts)}`
  }
  if (entry.type === 'special_rule') {
    return entry.label ?? entry.specialRuleId ?? 'Special Rule'
  }
  if (entry.type === 'choice') {
    const opts = entry.options as PathProgEntry[]
    return opts
      .map((o) => {
        if (o.type === 'special_rule')
          return o.label ?? o.specialRuleId ?? 'Special Rule'
        if (o.type === 'stat')
          return `Improve ${describeStatOption(o.options as string[])}`
        if (o.type === 'minor_special_rule')
          return 'Choice of Minor Special Rule'
        if (o.type === 'heroic_action') return 'Add Heroic Action'
        if (o.type === 'magical_power') return 'Choose Magical Power'
        if (o.type === 'improve_casting_value') return 'Improve Casting Value'
        return 'Choice'
      })
      .join(' OR ')
  }
  return '—'
}

// Sub-component for extra choices (stat selection, option selection, rule picker)
function ExtraChoiceUI({
  entry,
  path,
  statChoice,
  onStatChoice,
  optionChoice,
  onOptionChoice,
  minorRule,
  onMinorRule,
  heroicAction,
  onHeroicAction,
  member,
}: {
  entry: PathProgEntry
  path: PathDef | undefined
  statChoice: number
  onStatChoice: (i: number) => void
  optionChoice: number
  onOptionChoice: (i: number) => void
  minorRule: string
  onMinorRule: (s: string) => void
  heroicAction: string
  onHeroicAction: (s: string) => void
  member: Member
}) {
  // Stat with multiple options
  if (entry.type === 'stat') {
    const opts = entry.options as string[]
    if (opts.length > 1) {
      return (
        <Box sx={{ mb: 1.5 }}>
          <Typography
            variant="caption"
            sx={{ opacity: 0.6, display: 'block', mb: 0.75 }}
          >
            Choose which stat to improve:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {opts.map((stat, i) => (
              <Chip
                key={stat}
                label={describeStatOption([stat])}
                size="small"
                onClick={() => onStatChoice(i)}
                sx={{
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: statChoice === i ? 'primary.main' : 'divider',
                  background:
                    statChoice === i ? 'rgba(201,168,76,0.12)' : 'transparent',
                  color: statChoice === i ? 'primary.main' : 'text.secondary',
                  fontSize: '0.6rem',
                }}
              />
            ))}
          </Box>
        </Box>
      )
    }
    return null
  }

  // Choice entry
  if (entry.type === 'choice') {
    const opts = entry.options as PathProgEntry[]
    const chosenOpt = opts[optionChoice]
    return (
      <Box sx={{ mb: 1.5 }}>
        <Typography
          variant="caption"
          sx={{ opacity: 0.6, display: 'block', mb: 0.75 }}
        >
          Choose one:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {opts.map((opt, i) => (
            <Box
              key={i}
              onClick={() => onOptionChoice(i)}
              sx={{
                px: 1.25,
                py: 0.75,
                border: '1px solid',
                borderColor: optionChoice === i ? 'primary.main' : 'divider',
                borderRadius: 0.75,
                cursor: 'pointer',
                background:
                  optionChoice === i
                    ? 'rgba(201,168,76,0.08)'
                    : 'rgba(0,0,0,0.15)',
                transition: 'all 0.15s',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.75rem',
                  color: optionChoice === i ? 'primary.main' : 'text.secondary',
                }}
              >
                {opt.type === 'special_rule'
                  ? (opt.label ?? opt.specialRuleId)
                  : opt.type === 'stat'
                    ? `Improve ${describeStatOption(opt.options as string[])}`
                    : opt.type === 'minor_special_rule'
                      ? 'Choice of Minor Special Rule'
                      : opt.type === 'heroic_action'
                        ? 'Add Heroic Action'
                        : opt.type === 'magical_power'
                          ? 'Choose Magical Power'
                          : opt.type === 'improve_casting_value'
                            ? 'Improve Casting Value'
                            : 'Option'}
              </Typography>
              {opt.description && (
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.5, display: 'block', mt: 0.25 }}
                >
                  {opt.description}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Minor special rule picker */}
        {chosenOpt?.type === 'minor_special_rule' && (
          <Box sx={{ mt: 1 }}>
            <Typography
              variant="caption"
              sx={{ opacity: 0.6, display: 'block', mb: 0.5 }}
            >
              Choose a minor special rule:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {SPECIAL_RULES.filter(
                (r) => r.minor && !member.specialRules.includes(r.label)
              )
                .slice(0, 14)
                .map((r) => (
                  <Chip
                    key={r.id}
                    label={r.label}
                    size="small"
                    onClick={() => onMinorRule(r.id)}
                    sx={{
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor:
                        minorRule === r.id ? 'primary.main' : 'divider',
                      background:
                        minorRule === r.id
                          ? 'rgba(201,168,76,0.12)'
                          : 'transparent',
                      color:
                        minorRule === r.id ? 'primary.main' : 'text.secondary',
                      fontSize: '0.58rem',
                    }}
                  />
                ))}
            </Box>
          </Box>
        )}

        {/* Heroic action picker */}
        {chosenOpt?.type === 'heroic_action' && (
          <Box sx={{ mt: 1 }}>
            <Typography
              variant="caption"
              sx={{ opacity: 0.6, display: 'block', mb: 0.5 }}
            >
              Choose a heroic action to add:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {HEROIC_ACTIONS.filter(
                (h) => !h.universal && !member.specialRules.includes(h.label)
              ).map((h) => (
                <Chip
                  key={h.id}
                  label={h.label}
                  size="small"
                  onClick={() => onHeroicAction(h.id)}
                  sx={{
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor:
                      heroicAction === h.id ? 'primary.main' : 'divider',
                    background:
                      heroicAction === h.id
                        ? 'rgba(201,168,76,0.12)'
                        : 'transparent',
                    color:
                      heroicAction === h.id ? 'primary.main' : 'text.secondary',
                    fontSize: '0.58rem',
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    )
  }

  return null
}

function CompletedHeroCard({
  record,
}: {
  key?: string
  record: HeroAdvRecord
}) {
  const chosen = record.chosen === 'A' ? record.resultA : record.resultB
  return (
    <Box
      sx={{
        mb: 1,
        px: 1.5,
        py: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        opacity: 0.7,
      }}
    >
      <Typography variant="caption">{record.memberName}</Typography>
      <Typography variant="caption" sx={{ color: 'primary.light' }}>
        Roll {chosen?.roll} — applied
      </Typography>
    </Box>
  )
}

// ─── PathSelectionDialog ──────────────────────────────────────────────────────

const PATHS_DATA = pathsData as unknown as PathDef[]

interface PathSelectProps {
  memberName: string
  baseUnitId: string
  equipment: string[]
  onSelect: (pathId: string) => void
}

function PathSelectionDialog({
  memberName,
  baseUnitId,
  equipment,
  onSelect,
}: PathSelectProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [confirmPath, setConfirmPath] = useState<string | null>(null)

  return (
    <Dialog
      open
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(160deg, #1a1008 0%, #110a03 100%)',
          border: '1px solid rgba(200,164,90,0.25)',
          borderRadius: 2,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle>Choose a Heroic Path</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            border: '1px solid',
            borderColor: 'primary.dark',
            borderRadius: 1,
            background: 'rgba(201,168,76,0.04)',
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: 'primary.main', mb: 0.25 }}
          >
            {memberName}
          </Typography>
          <Typography
            variant="caption"
            sx={{ display: 'block', opacity: 0.75 }}
          >
            {getUnitLabel(baseUnitId)}
          </Typography>
          {equipment.length > 0 && (
            <Typography
              variant="caption"
              sx={{ display: 'block', opacity: 0.55 }}
            >
              {equipment.map((e) => getWargearLabel(e)).join(', ')}
            </Typography>
          )}
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.65 }}>
            A Hero in the Making — choose their path. This cannot be changed
            later.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {PATHS_DATA.map((p) => {
            const roll7 = p.progression.find((e) => e.roll === 7)
            const sigStat = (
              roll7?.options as PathProgEntry[] | undefined
            )?.find((o) => o.type === 'stat')?.options as string[] | undefined
            const roll2 = p.progression.find((e) => e.roll === 2)
            return (
              <Box
                key={p.id}
                onClick={() => setHovered(hovered === p.id ? null : p.id)}
                sx={{
                  p: 1.5,
                  border: '1px solid',
                  borderColor: hovered === p.id ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: 'pointer',
                  background:
                    hovered === p.id
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
                      fontWeight: 600,
                      color: hovered === p.id ? 'primary.main' : 'text.primary',
                    }}
                  >
                    {p.label}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {p.heroicAction && (
                      <Chip
                        label={p.heroicAction
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                        size="small"
                        sx={{
                          fontSize: '0.58rem',
                          height: 18,
                          border: '1px solid',
                          borderColor: 'primary.dark',
                          background: 'transparent',
                          color: 'primary.light',
                        }}
                      />
                    )}
                    {sigStat && (
                      <Chip
                        label={`Sig: ${sigStat[0]}`}
                        size="small"
                        sx={{
                          fontSize: '0.58rem',
                          height: 18,
                          border: '1px solid',
                          borderColor: 'divider',
                          background: 'transparent',
                          color: 'text.secondary',
                        }}
                      />
                    )}
                  </Box>
                </Box>
                {hovered === p.id && roll2 && (
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mt: 0.5, opacity: 0.65 }}
                  >
                    Signature ability: {roll2.label ?? '—'}
                  </Typography>
                )}
                {hovered === p.id && (
                  <Button
                    variant="contained"
                    size="small"
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmPath(p.id)
                    }}
                    sx={{
                      mt: 1,
                      fontFamily: '"Cinzel Decorative", serif',
                      fontSize: '0.6rem',
                    }}
                  >
                    Select This Path
                  </Button>
                )}
              </Box>
            )
          })}
        </Box>
      </DialogContent>

      <ConfirmDialog
        open={!!confirmPath}
        title="Confirm Path Selection"
        message={`Commit to the ${PATHS_DATA.find((p) => p.id === confirmPath)?.label ?? ''}? This cannot be changed.`}
        confirmLabel="Commit"
        cancelLabel="Go Back"
        onConfirm={() => {
          onSelect(confirmPath!)
          setConfirmPath(null)
        }}
        onCancel={() => setConfirmPath(null)}
      />
    </Dialog>
  )
}
