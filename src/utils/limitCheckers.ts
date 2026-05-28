import type { CompanyDefinition, Member } from '../models'
import baseUnitsData from '../data/baseUnits.json'
import wargearData from '../data/wargear.json'

// ── Types ────────────────────────────────────────────────────────────────────

interface BaseUnitEntry {
  id: string
  baseWargear: string[]
  keywords: string[]
}

interface WargearEntry {
  id: string
  category: string
}

/**
 * Context object passed to limit checker functions.
 * Keeps functions pure and testable without importing data directly.
 */
export interface LimitCheckContext {
  members: Array<{ baseUnitId: string; equipment: string[] }>
  companyDef: CompanyDefinition
  baseUnitsMap: Record<string, { baseWargear: string[]; keywords: string[] }>
  wargearCategoryMap: Record<string, string>
}

// ── Internal data maps ───────────────────────────────────────────────────────

const BASE_UNITS = baseUnitsData as BaseUnitEntry[]
const WARGEAR = wargearData as WargearEntry[]

const BASE_UNITS_MAP: Record<string, { baseWargear: string[]; keywords: string[] }> =
  BASE_UNITS.reduce<Record<string, { baseWargear: string[]; keywords: string[] }>>(
    (acc, u) => {
      acc[u.id] = {
        baseWargear: u.baseWargear ?? [],
        keywords: u.keywords ?? [],
      }
      return acc
    },
    {}
  )

const WARGEAR_CATEGORY_MAP: Record<string, string> = WARGEAR.reduce<
  Record<string, string>
>((acc, w) => {
  acc[w.id] = w.category
  return acc
}, {})

// ── Helper: build default context from live data ─────────────────────────────

/**
 * Builds a LimitCheckContext from a company's members and definition,
 * using the module-level data maps.
 */
export function buildLimitCheckContext(
  members: Array<{ baseUnitId: string; equipment: string[] }>,
  companyDef: CompanyDefinition
): LimitCheckContext {
  return {
    members,
    companyDef,
    baseUnitsMap: BASE_UNITS_MAP,
    wargearCategoryMap: WARGEAR_CATEGORY_MAP,
  }
}

// ── Exemption readers ────────────────────────────────────────────────────────

/**
 * Returns bow limit exemptions (baseUnitIds) from company special rules.
 */
export function getBowExemptions(companyDef: CompanyDefinition): string[] {
  for (const rule of companyDef.companySpecialRules ?? []) {
    const ex = rule.limitExemptions?.bow
    if (ex) return ex
  }
  return []
}

/**
 * Returns cavalry limit exemptions (baseUnitIds) from company special rules.
 */
export function getCavalryExemptions(companyDef: CompanyDefinition): string[] {
  for (const rule of companyDef.companySpecialRules ?? []) {
    const ex = rule.limitExemptions?.cavalry
    if (ex) return ex
  }
  return []
}

/**
 * Returns throwing weapon exemptions (equipment IDs) from company special rules.
 * These are equipment IDs that should not count toward the throwing weapon limit.
 */
export function getThrowingExemptions(companyDef: CompanyDefinition): string[] {
  for (const rule of companyDef.companySpecialRules ?? []) {
    const ex = rule.throwingExemptions
    if (ex) return ex
  }
  return []
}

// ── Equipment checks ─────────────────────────────────────────────────────────

function hasBowEquipment(
  baseUnitId: string,
  equipment: string[],
  ctx: LimitCheckContext
): boolean {
  const baseEquip = ctx.baseUnitsMap[baseUnitId]?.baseWargear ?? []
  return [...baseEquip, ...equipment].some(
    (e) => ctx.wargearCategoryMap[e] === 'bow'
  )
}

function hasCavalryKeyword(
  baseUnitId: string,
  equipment: string[],
  ctx: LimitCheckContext
): boolean {
  const isMount = equipment.some((e) => ctx.wargearCategoryMap[e] === 'mount')
  const keywords = ctx.baseUnitsMap[baseUnitId]?.keywords ?? []
  return isMount || keywords.includes('cavalry')
}

/**
 * Returns all throwing-category equipment IDs on a member (base + extra).
 */
function getThrowingEquipment(
  baseUnitId: string,
  equipment: string[],
  ctx: LimitCheckContext
): string[] {
  const baseEquip = ctx.baseUnitsMap[baseUnitId]?.baseWargear ?? []
  return [...baseEquip, ...equipment].filter(
    (e) => ctx.wargearCategoryMap[e] === 'throwing'
  )
}

// ── Count functions (extracted from CompanyDetailsPage) ──────────────────────

/**
 * Counts members with bow equipment, excluding those whose baseUnitId
 * is in the bow exemptions list or who have a unitRosterOverride with
 * bowLimitCount (those are counted separately).
 */
export function countBowMembers(
  ctx: LimitCheckContext,
  extraMembers: Array<{ baseUnitId: string; equipment: string[] }> = []
): number {
  const exemptions = getBowExemptions(ctx.companyDef)
  const rosterOverrides = getUnitRosterOverrides(ctx.companyDef)

  const all = [...ctx.members, ...extraMembers]

  let count = 0
  for (const m of all) {
    // Members with roster overrides use bowLimitCount instead
    const override = rosterOverrides.find((o) => o.baseUnitId === m.baseUnitId)
    if (override) {
      count += override.bowLimitCount
      continue
    }

    if (exemptions.includes(m.baseUnitId)) continue
    if (hasBowEquipment(m.baseUnitId, m.equipment, ctx)) count++
  }

  return count
}

/**
 * Counts members with cavalry keyword or mount equipment,
 * excluding those whose baseUnitId is in the cavalry exemptions list.
 */
export function countCavalryMembers(
  ctx: LimitCheckContext,
  extraMembers: Array<{ baseUnitId: string; equipment: string[] }> = []
): number {
  const exemptions = getCavalryExemptions(ctx.companyDef)
  const all = [...ctx.members, ...extraMembers]
  return all.filter(
    (m) =>
      !exemptions.includes(m.baseUnitId) &&
      hasCavalryKeyword(m.baseUnitId, m.equipment, ctx)
  ).length
}

/**
 * Counts members with throwing-category equipment, applying throwing exemptions.
 * Members whose only throwing equipment consists entirely of exempted items
 * are excluded from the count.
 */
export function countThrowingMembers(
  ctx: LimitCheckContext,
  extraMembers: Array<{ baseUnitId: string; equipment: string[] }> = []
): number {
  const exemptions = getThrowingExemptions(ctx.companyDef)
  const all = [...ctx.members, ...extraMembers]

  return all.filter((m) => {
    const throwingItems = getThrowingEquipment(m.baseUnitId, m.equipment, ctx)
    if (throwingItems.length === 0) return false
    // If all throwing items are in the exemptions list, exclude this member
    if (
      exemptions.length > 0 &&
      throwingItems.every((item) => exemptions.includes(item))
    ) {
      return false
    }
    return true
  }).length
}

// ── Keyword-based counting ───────────────────────────────────────────────────

/**
 * Counts members whose base unit has the specified keyword.
 */
export function countMembersByKeyword(
  ctx: LimitCheckContext,
  keyword: string
): number {
  return ctx.members.filter((m) => {
    const keywords = ctx.baseUnitsMap[m.baseUnitId]?.keywords ?? []
    return keywords.includes(keyword)
  }).length
}

// ── Ratio / percentage checks ────────────────────────────────────────────────

/**
 * Returns true (blocked) if adding newMembers would cause the Dwarf count
 * to exceed the Dale count. Uses keywords on base unit definitions.
 */
export function wouldExceedDwarfDaleRatio(
  ctx: LimitCheckContext,
  newMembers: Array<{ baseUnitId: string }>
): boolean {
  const allBaseUnitIds = [
    ...ctx.members.map((m) => m.baseUnitId),
    ...newMembers.map((m) => m.baseUnitId),
  ]

  let dwarfCount = 0
  let daleCount = 0

  for (const id of allBaseUnitIds) {
    const keywords = ctx.baseUnitsMap[id]?.keywords ?? []
    if (keywords.includes('dwarf')) dwarfCount++
    if (keywords.includes('dale')) daleCount++
  }

  return dwarfCount > daleCount
}

/**
 * Returns true (blocked) if adding newMembers would cause the Elf count
 * to exceed 33% (one-third) of total company size (including the new members).
 * Uses integer arithmetic to avoid floating-point precision issues.
 */
export function wouldExceedElfLimit(
  ctx: LimitCheckContext,
  newMembers: Array<{ baseUnitId: string }>
): boolean {
  const allBaseUnitIds = [
    ...ctx.members.map((m) => m.baseUnitId),
    ...newMembers.map((m) => m.baseUnitId),
  ]

  const totalSize = allBaseUnitIds.length
  if (totalSize === 0) return false

  let elfCount = 0
  for (const id of allBaseUnitIds) {
    const keywords = ctx.baseUnitsMap[id]?.keywords ?? []
    if (keywords.includes('elf')) elfCount++
  }

  // Blocked if elf proportion strictly exceeds one-third.
  // Integer math: elfCount/totalSize > 1/3  ⟺  elfCount * 3 > totalSize
  return elfCount * 3 > totalSize
}

// ── Roster slot overrides ────────────────────────────────────────────────────

interface UnitRosterOverride {
  baseUnitId: string
  rosterSlots: number
  bowLimitCount: number
}

/**
 * Reads unitRosterOverrides from company special rules.
 */
export function getUnitRosterOverrides(
  companyDef: CompanyDefinition
): UnitRosterOverride[] {
  for (const rule of companyDef.companySpecialRules ?? []) {
    if (rule.unitRosterOverrides) return rule.unitRosterOverrides
  }
  return []
}

/**
 * Calculates the effective roster slot total for a company, accounting for
 * unitRosterOverrides. Members with an override use the specified rosterSlots
 * value; all others count as 1.
 */
export function getEffectiveRosterSlots(
  members: Array<{ baseUnitId: string }>,
  companyDef: CompanyDefinition
): number {
  const overrides = getUnitRosterOverrides(companyDef)

  let total = 0
  for (const m of members) {
    const override = overrides.find((o) => o.baseUnitId === m.baseUnitId)
    total += override ? override.rosterSlots : 1
  }
  return total
}
