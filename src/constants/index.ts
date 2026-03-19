import type { Faction } from '../models'

export const FACTIONS: Faction[] = [
  // Good
  { id: 'gondor', label: 'Gondor', alignment: 'good' },
  { id: 'rohan', label: 'Rohan', alignment: 'good' },
  { id: 'elven_realms', label: 'Elven Realms', alignment: 'good' },
  { id: 'dwarven_realms', label: 'Dwarven Realms', alignment: 'good' },
  { id: 'hobbits', label: 'The Shire & Allies', alignment: 'good' },
  // Evil
  { id: 'mordor', label: 'Mordor', alignment: 'evil' },
  { id: 'isengard', label: 'Isengard', alignment: 'evil' },
  { id: 'misty_mountains', label: 'Misty Mountains', alignment: 'evil' },
  { id: 'mirkwood', label: 'Mirkwood (Evil)', alignment: 'evil' },
  { id: 'the_far_east', label: 'The Far East', alignment: 'evil' },
]

/**
 * Per-stat validation ranges based on MESBG profiles.
 * min/max are hard limits — saving is blocked outside these.
 * warnBelow/warnAbove flag unusual-but-valid values to the user.
 */
export const STATS_ENTRY_FIELDS = [
  {
    key: 'move',
    label: 'Move',
    hint: 'e.g. 5 or 6',
    min: 1,
    max: 10,
    warnBelow: 3,
    warnAbove: 8,
  },
  {
    key: 'fight',
    label: 'Fight',
    hint: 'e.g. 3 or 4',
    min: 1,
    max: 9,
    warnBelow: 2,
    warnAbove: 7,
  },
  {
    key: 'shoot',
    label: 'Shoot',
    hint: '0 if no bow',
    min: 0,
    max: 9,
    warnBelow: null,
    warnAbove: 6,
  },
  {
    key: 'strength',
    label: 'Strength',
    hint: 'e.g. 3',
    min: 1,
    max: 9,
    warnBelow: 2,
    warnAbove: 6,
  },
  {
    key: 'defence',
    label: 'Defence',
    hint: 'e.g. 4 or 5',
    min: 1,
    max: 9,
    warnBelow: 2,
    warnAbove: 8,
  },
  {
    key: 'attacks',
    label: 'Attacks',
    hint: 'usually 1',
    min: 1,
    max: 3,
    warnBelow: null,
    warnAbove: 2,
  },
  {
    key: 'wounds',
    label: 'Wounds',
    hint: 'usually 1',
    min: 1,
    max: 3,
    warnBelow: null,
    warnAbove: 2,
  },
  {
    key: 'courage',
    label: 'Courage',
    hint: 'e.g. 3 or 4',
    min: 1,
    max: 7,
    warnBelow: 2,
    warnAbove: 6,
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    hint: 'e.g. 2',
    min: 1,
    max: 7,
    warnBelow: 1,
    warnAbove: 5,
  },
] as const

/**
 * Mount-specific stat fields — based on actual Rules Manual mount profiles:
 * Horse: MV10 FV2 SV6+ S3 D4 A0 W1 C7+ I7+
 * Armoured Horse: MV10 FV2 SV6+ S3 D5 A0 W1 C7+ I7+
 * Pony: MV8 FV1 SV6+ S3 D3 A0 W1 C8+ I7+
 * Warg / Fell Warg: MV10 FV3 SV6+ S4 D4 A1 W1 C8+ I8+
 *
 * Mounts DO have a Shoot value (always 6+, no bow) and CAN have 0 Attacks.
 * Warnings are calibrated to this real range rather than the infantry profile.
 */
export const MOUNT_STATS_ENTRY_FIELDS = [
  {
    key: 'move',
    label: 'Move',
    hint: 'e.g. 8 or 10',
    min: 1,
    max: 10,
    warnBelow: 8,
    warnAbove: 10,
  },
  {
    key: 'fight',
    label: 'Fight',
    hint: 'e.g. 1–3',
    min: 0,
    max: 9,
    warnBelow: 1,
    warnAbove: 3,
  },
  {
    key: 'shoot',
    label: 'Shoot',
    hint: 'usually 6',
    min: 0,
    max: 9,
    warnBelow: null,
    warnAbove: 6,
  },
  {
    key: 'strength',
    label: 'Strength',
    hint: 'e.g. 3 or 4',
    min: 1,
    max: 9,
    warnBelow: 3,
    warnAbove: 4,
  },
  {
    key: 'defence',
    label: 'Defence',
    hint: 'e.g. 3–5',
    min: 1,
    max: 9,
    warnBelow: 3,
    warnAbove: 5,
  },
  {
    key: 'attacks',
    label: 'Attacks',
    hint: '0 for horses',
    min: 0,
    max: 3,
    warnBelow: null,
    warnAbove: 1,
  },
  {
    key: 'wounds',
    label: 'Wounds',
    hint: 'usually 1',
    min: 1,
    max: 3,
    warnBelow: null,
    warnAbove: 1,
  },
  {
    key: 'courage',
    label: 'Courage',
    hint: 'e.g. 7 or 8',
    min: 1,
    max: 9,
    warnBelow: 7,
    warnAbove: 8,
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    hint: 'e.g. 7 or 8',
    min: 1,
    max: 9,
    warnBelow: 7,
    warnAbove: 8,
  },
] as const

/** Average profile thresholds — stat increases at or below these do NOT add to rating */
export const AVERAGE_PROFILE = {
  fight: 4,
  strength: 3,
  defence: 3,
  attacks: 1,
  wounds: 1,
}

/** Company Rating point values for hero stat increases (SRS §4.8.1) */
export const RATING_POINTS = {
  move: 5,
  fight: 5,
  strength: 5,
  defence: 5,
  attacks: 10,
  wounds: 10,
  might: 5,
  will: 5,
  fate: 5,
  specialRule: 5,
  minorRule: 5,
  minorRuleMax: 10,
}
