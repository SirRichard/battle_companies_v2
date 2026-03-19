/**
 * Label lookup utilities — resolve display names from IDs using static JSON data.
 * Falls back to a humanised form of the ID if no entry is found.
 */

import companiesData from '../data/companies.json'
import baseUnitsData from '../data/baseUnits.json'
import wargearData from '../data/wargear.json'

import type { CompanyDefinition } from '../models'

const COMPANIES = companiesData as CompanyDefinition[]
const BASE_UNITS = baseUnitsData as Array<{ id: string; label: string }>
const WARGEAR = wargearData as Array<{ id: string; label: string }>

function humanise(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

export function getCompanyLabel(companyTypeId: string): string {
  return (
    COMPANIES.find((c) => c.id === companyTypeId)?.label ??
    humanise(companyTypeId)
  )
}

export function getUnitLabel(baseUnitId: string): string {
  return (
    BASE_UNITS.find((u) => u.id === baseUnitId)?.label ?? humanise(baseUnitId)
  )
}

export function getWargearLabel(wargearId: string): string {
  return WARGEAR.find((w) => w.id === wargearId)?.label ?? humanise(wargearId)
}

/** Format a list of equipment IDs as a comma-separated label string. */
export function formatEquipment(equipmentIds: string[]): string {
  return equipmentIds.map(getWargearLabel).join(', ')
}
