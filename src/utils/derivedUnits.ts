import { MemberStats, StoredBaseUnitStats } from '../models/index'

/** Subset of baseUnits.json fields relevant to derived-unit logic. */
export interface BaseUnitDef {
  id: string
  label: string
  pointsCost?: number
  keywords?: string[]
  baseEquipment?: string[]
  derivedFrom?: string
  statOverrides?: Partial<MemberStats>
  riderCount?: number
  additionalRiders?: Array<{ equipment: string[] }>
  keywordOverride?: string[]
}

/**
 * A single entry in the stats work queue.
 * Extends the plain string ID used today with derived-unit metadata.
 */
export interface QueueEntry {
  unitId: string
  /** True when this entry was injected as a parent dependency. */
  isInjectedParent: boolean
  /**
   * When set, this entry should be auto-saved from the parent's stats
   * rather than shown to the user as a form.
   * Populated only when the parent's stats are already in the library
   * at queue-build time.
   */
  autoSaveFromParentId: string | null
  /**
   * Human-readable label for the derived unit this parent was injected for.
   * Only set when isInjectedParent === true.
   * Used to render the contextual "Required for X" message (Req 5.3).
   */
  injectedForLabel: string | null
}

/**
 * Computes the derived unit's stats by copying the parent's stats and
 * applying any statOverrides declared on the derived unit definition.
 *
 * Keys present in `unitDef.statOverrides` replace the corresponding parent
 * value; keys absent from `statOverrides` retain the parent value unchanged.
 * If `statOverrides` is undefined or empty, returns a shallow copy of
 * `parentStats` unchanged.
 *
 * @param parentStats   The parent unit's full stats record.
 * @param unitDef       The derived unit's definition (for statOverrides).
 */
export function applyStatOverrides(
  parentStats: Required<MemberStats>,
  unitDef: BaseUnitDef
): Required<MemberStats> {
  return {
    ...parentStats,
    ...(unitDef.statOverrides ?? {}),
  } as Required<MemberStats>
}

/**
 * Builds the full StoredBaseUnitStats record for a derived unit,
 * including any extra fields (riderCount, additionalRiders) from the
 * unit definition.
 *
 * For warg_marauder this preserves riderCount and additionalRiders
 * alongside the copied base stats (Req 4.2, 4.3).
 *
 * @param derivedUnitDef  The derived unit's definition.
 * @param parentStats     The parent unit's full stats record.
 */
export function buildDerivedUnitStats(
  derivedUnitDef: BaseUnitDef,
  parentStats: Required<MemberStats>
): StoredBaseUnitStats {
  const stats = applyStatOverrides(parentStats, derivedUnitDef)

  const record: StoredBaseUnitStats = {
    baseUnitId: derivedUnitDef.id,
    stats,
  }

  if (derivedUnitDef.riderCount !== undefined) {
    record.riderCount = derivedUnitDef.riderCount
  }

  if (derivedUnitDef.additionalRiders !== undefined) {
    record.additionalRiders = derivedUnitDef.additionalRiders
  }

  return record
}

/**
 * Builds a derived-unit-aware work queue from a raw list of unit IDs.
 *
 * Rules applied in order:
 * 1. Skip any unit already in the Stats_Library (idempotent — Req 6.1, 6.2).
 * 2. For each derived unit not yet in the library:
 *    a. If parent IS in library → mark entry with `autoSaveFromParentId` (Req 2.1).
 *    b. If parent NOT in library AND parent not already queued →
 *       inject parent entry immediately before the derived unit (Req 1.4).
 * 3. Non-derived units become plain entries.
 *
 * Edge cases:
 * - If a unit's `derivedFrom` references an ID not found in `baseUnits`, treat it as non-derived.
 * - If a parent is already queued (injected for a previous derived unit), don't inject it again.
 *
 * @param rawUnitIds   The unit IDs that need stats (from wizard or company).
 * @param getStats     Lookup function for the Stats_Library (from AppContext).
 * @param baseUnits    Full baseUnits.json array.
 */
export function buildDerivedAwareQueue(
  rawUnitIds: string[],
  getStats: (id: string) => StoredBaseUnitStats | undefined,
  baseUnits: BaseUnitDef[]
): QueueEntry[] {
  const result: QueueEntry[] = []
  // Track which unit IDs have already been added to the queue (to avoid duplicate parent injections)
  const queuedIds = new Set<string>()
  // Track which unit IDs appear in the raw input (parent may already be in the list)
  const rawIdSet = new Set(rawUnitIds)

  for (const unitId of rawUnitIds) {
    // Rule 1: Skip units already in the Stats_Library
    if (getStats(unitId)) {
      continue
    }

    const unitDef = baseUnits.find(u => u.id === unitId)

    // If the unit has a derivedFrom field and the parent exists in baseUnits
    if (unitDef?.derivedFrom) {
      const parentDef = baseUnits.find(u => u.id === unitDef.derivedFrom)

      if (parentDef) {
        // Rule 2a: Parent IS in library → mark as auto-save
        if (getStats(parentDef.id)) {
          result.push({
            unitId,
            isInjectedParent: false,
            autoSaveFromParentId: parentDef.id,
            injectedForLabel: null,
          })
          queuedIds.add(unitId)
        } else if (rawIdSet.has(parentDef.id) && !getStats(parentDef.id)) {
          // Rule 2c: Parent is already in the raw input list (will be entered this session)
          // → mark derived unit for auto-save from parent; parent will appear as its own plain entry
          result.push({
            unitId,
            isInjectedParent: false,
            autoSaveFromParentId: parentDef.id,
            injectedForLabel: null,
          })
          queuedIds.add(unitId)
        } else {
          // Rule 2b: Parent NOT in library AND not already queued → inject parent before derived unit
          if (!queuedIds.has(parentDef.id)) {
            result.push({
              unitId: parentDef.id,
              isInjectedParent: true,
              autoSaveFromParentId: null,
              injectedForLabel: unitDef.label,
            })
            queuedIds.add(parentDef.id)
          }
          // Add the derived unit itself (it will auto-save once parent is saved)
          result.push({
            unitId,
            isInjectedParent: false,
            autoSaveFromParentId: null,
            injectedForLabel: null,
          })
          queuedIds.add(unitId)
        }
      } else {
        // Fallback: derivedFrom references an ID not found in baseUnits → treat as non-derived
        result.push({
          unitId,
          isInjectedParent: false,
          autoSaveFromParentId: null,
          injectedForLabel: null,
        })
        queuedIds.add(unitId)
      }
    } else {
      // Rule 3: Non-derived unit → plain entry
      result.push({
        unitId,
        isInjectedParent: false,
        autoSaveFromParentId: null,
        injectedForLabel: null,
      })
      queuedIds.add(unitId)
    }
  }

  return result
}

// Re-export StoredBaseUnitStats so consumers of this module have access
// to the full type without needing a separate import.
export type { StoredBaseUnitStats }
