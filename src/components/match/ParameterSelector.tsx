/**
 * ParameterSelector — inline sub-UI for collecting a parameter value
 * when a parameterised special rule is selected during advancement.
 *
 * Renders different UIs based on rule.parameter_type:
 * - friendly_hero → chip list of eligible heroes (single-select)
 * - weapon → chip list of eligible weapons (single-select)
 * - integer / target_integer → numeric input
 * - distance → numeric input with " suffix
 * - target_keyword → text input
 */

import { useState, useMemo } from 'react'
import { Box, Typography, Chip, TextField, Button } from '@mui/material'
import type { Member } from '../../models'
import {
  getEligibleHeroes,
  getEligibleWeapons,
  isValidParameter,
} from '../../utils/parameterizedRules'
import type { SpecialRuleEntry, WargearEntry } from '../../utils/parameterizedRules'
import wargearData from '../../data/wargear.json'

const WARGEAR = wargearData as WargearEntry[]

export interface ParameterSelectorProps {
  rule: SpecialRuleEntry
  receivingMember: Member
  companyMembers: Member[]
  baseWargear: string[]
  onParameterSelected: (value: string | number) => void
  onCancel: () => void
}

export default function ParameterSelector({
  rule,
  receivingMember,
  companyMembers,
  baseWargear,
  onParameterSelected,
  onCancel,
}: ParameterSelectorProps) {
  const [selectedValue, setSelectedValue] = useState<string | number | null>(null)
  const [inputValue, setInputValue] = useState('')

  const parameterType = rule.parameter_type ?? ''

  // Compute eligible lists for chip-based selectors
  const eligibleHeroes = useMemo(
    () =>
      parameterType === 'friendly_hero'
        ? getEligibleHeroes(companyMembers, receivingMember.id)
        : [],
    [parameterType, companyMembers, receivingMember.id]
  )

  const eligibleWeapons = useMemo(
    () =>
      parameterType === 'weapon'
        ? getEligibleWeapons(receivingMember, baseWargear, WARGEAR)
        : [],
    [parameterType, receivingMember, baseWargear]
  )

  // Determine current value for validation
  const currentValue = useMemo(() => {
    if (parameterType === 'friendly_hero' || parameterType === 'weapon') {
      return selectedValue
    }
    if (parameterType === 'integer' || parameterType === 'target_integer') {
      const parsed = Number(inputValue)
      return Number.isInteger(parsed) && parsed > 0 ? parsed : inputValue
    }
    if (parameterType === 'distance') {
      const cleaned = inputValue.replace(/["″]$/, '')
      const parsed = Number(cleaned)
      return !isNaN(parsed) && parsed > 0 ? parsed : inputValue
    }
    // target_keyword
    return inputValue
  }, [parameterType, selectedValue, inputValue])

  const isValid = isValidParameter(currentValue, parameterType)

  const handleConfirm = () => {
    if (!isValid || currentValue === null || currentValue === undefined) return
    onParameterSelected(currentValue)
  }

  // ─── Render: friendly_hero ────────────────────────────────────────────────
  if (parameterType === 'friendly_hero') {
    if (eligibleHeroes.length === 0) {
      return (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="body2" sx={{ opacity: 0.7, fontStyle: 'italic' }}>
            No valid targets available
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
          </Box>
        </Box>
      )
    }

    return (
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.6, mb: 1, display: 'block' }}>
          Select a friendly hero:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {eligibleHeroes.map((hero) => (
            <Chip
              key={hero.id}
              label={hero.name}
              size="small"
              variant={selectedValue === hero.id ? 'filled' : 'outlined'}
              color={selectedValue === hero.id ? 'primary' : 'default'}
              onClick={() => setSelectedValue(hero.id)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled={!isValid}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
          <Button size="small" variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      </Box>
    )
  }

  // ─── Render: weapon ───────────────────────────────────────────────────────
  if (parameterType === 'weapon') {
    if (eligibleWeapons.length === 0) {
      return (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="body2" sx={{ opacity: 0.7, fontStyle: 'italic' }}>
            No weapons available
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
          </Box>
        </Box>
      )
    }

    return (
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.6, mb: 1, display: 'block' }}>
          Select a weapon:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {eligibleWeapons.map((weapon) => (
            <Chip
              key={weapon.id}
              label={weapon.label}
              size="small"
              variant={selectedValue === weapon.id ? 'filled' : 'outlined'}
              color={selectedValue === weapon.id ? 'primary' : 'default'}
              onClick={() => setSelectedValue(weapon.id)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled={!isValid}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
          <Button size="small" variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      </Box>
    )
  }

  // ─── Render: integer / target_integer ─────────────────────────────────────
  if (parameterType === 'integer' || parameterType === 'target_integer') {
    return (
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.6, mb: 1, display: 'block' }}>
          Enter a value:
        </Typography>
        <TextField
          type="number"
          size="small"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          inputProps={{ min: 1, step: 1 }}
          sx={{ width: 120 }}
        />
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled={!isValid}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
          <Button size="small" variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      </Box>
    )
  }

  // ─── Render: distance ─────────────────────────────────────────────────────
  if (parameterType === 'distance') {
    return (
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.6, mb: 1, display: 'block' }}>
          Enter distance:
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TextField
            type="number"
            size="small"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            inputProps={{ min: 1, step: 1 }}
            sx={{ width: 100 }}
          />
          <Typography variant="body2">&quot;</Typography>
        </Box>
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled={!isValid}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
          <Button size="small" variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      </Box>
    )
  }

  // ─── Render: target_keyword ───────────────────────────────────────────────
  if (parameterType === 'target_keyword') {
    return (
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.6, mb: 1, display: 'block' }}>
          Enter keyword:
        </Typography>
        <TextField
          size="small"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="e.g. Orc, Elf"
          sx={{ width: 180 }}
        />
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled={!isValid}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
          <Button size="small" variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Box>
      </Box>
    )
  }

  // Fallback: unknown parameter_type
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="body2" sx={{ opacity: 0.7 }}>
        Unknown parameter type: {parameterType}
      </Typography>
      <Box sx={{ mt: 1.5 }}>
        <Button size="small" variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </Box>
  )
}
