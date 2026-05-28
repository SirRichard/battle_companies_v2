import { describe, it, expect } from 'vitest'
import { isShieldExclusive } from '../shieldExclusivity'

describe('isShieldExclusive', () => {
  it('returns true when adding a shield-category wargear and member owns small_shield', () => {
    // "shield" has category "shield" in wargear.json
    expect(isShieldExclusive('shield', [], ['small_shield'])).toBe(true)
  })

  it('returns true when adding light_shield and member owns small_shield', () => {
    expect(isShieldExclusive('light_shield', [], ['small_shield'])).toBe(true)
  })

  it('returns true when adding small_shield and member has shield-category wargear equipped', () => {
    expect(isShieldExclusive('small_shield', ['shield'], [])).toBe(true)
  })

  it('returns true when adding small_shield and member has light_shield equipped', () => {
    expect(isShieldExclusive('small_shield', ['light_shield'], [])).toBe(true)
  })

  it('returns false when adding a non-shield item and member owns small_shield', () => {
    expect(isShieldExclusive('spear', [], ['small_shield'])).toBe(false)
  })

  it('returns false when adding small_shield and member has no shield-category wargear', () => {
    expect(isShieldExclusive('small_shield', ['spear', 'bow'], [])).toBe(false)
  })

  it('returns false when adding a shield but member does not own small_shield', () => {
    expect(isShieldExclusive('shield', ['spear'], ['rope'])).toBe(false)
  })

  it('returns false for unknown item ID (permissive fallback)', () => {
    expect(isShieldExclusive('unknown_item', [], ['small_shield'])).toBe(false)
  })

  it('returns false when both equipment arrays are empty', () => {
    expect(isShieldExclusive('shield', [], [])).toBe(false)
  })

  it('returns true for iron_shield when member owns small_shield', () => {
    expect(isShieldExclusive('iron_shield', [], ['small_shield'])).toBe(true)
  })

  it('returns true for small_shield when member has iron_shield equipped', () => {
    expect(isShieldExclusive('small_shield', ['iron_shield'], [])).toBe(true)
  })
})
