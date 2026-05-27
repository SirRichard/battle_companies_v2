import type { AtoBonusType } from '../models/match'

/**
 * Determines the proceed button label on the ToolkitAssignmentPage
 * based on whether the wanderer ATO bonus is selected.
 *
 * @param atoBonuses - The array of selected ATO bonuses for the match
 * @returns "Next: Choose Wanderer →" if wanderer is included, "Begin Battle" otherwise
 */
export function getProceedButtonLabel(atoBonuses: AtoBonusType[]): string {
  return atoBonuses.includes('wanderer')
    ? 'Next: Choose Wanderer →'
    : 'Begin Battle'
}
