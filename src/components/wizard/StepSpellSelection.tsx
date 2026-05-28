/**
 * StepSpellSelection
 *
 * Shown after a hero selects Path of Channeling during company creation.
 * Presents the list of available magical powers from the Battle Companies
 * rules and lets the player pick one as their starting spell.
 */

import { Box, Typography, Button, Chip } from '@mui/material'
import { getUnitLabel, getWargearLabel } from '../../utils/labels'

interface Props {
  heroName: string
  baseUnitId: string
  equipment: string[]
  selectedSpellId: string | null
  onSelect: (spellId: string) => void
}

// Magical powers available to Battle Companies channelers (from paths.json source rules)
export const CHANNELING_SPELLS: Array<{
  id: string
  label: string
  castingValue: string
}> = [
  { id: 'aura_of_command', label: 'Aura of Command', castingValue: '5+' },
  { id: 'aura_of_dismay', label: 'Aura of Dismay', castingValue: '4+' },
  { id: 'banishment', label: 'Banishment', castingValue: '5+' },
  { id: 'black_dart', label: 'Black Dart', castingValue: '6+' },
  { id: 'bladewrath', label: 'Bladewrath', castingValue: '5+' },
  {
    id: 'blessing_of_the_valar',
    label: 'Blessing of the Valar',
    castingValue: '4+',
  },
  { id: 'blinding_light', label: 'Blinding Light', castingValue: '5+' },
  { id: 'call_winds', label: 'Call Winds', castingValue: '5+' },
  { id: 'collapse_rocks', label: 'Collapse Rocks', castingValue: '6+' },
  { id: 'compel', label: 'Compel', castingValue: '5+' },
  { id: 'curse', label: 'Curse', castingValue: '5+' },
  { id: 'drain_courage', label: 'Drain Courage', castingValue: '5+' },
  { id: 'enchant_blades', label: 'Enchant Blades', castingValue: '5+' },
  { id: 'enrage_beast', label: 'Enrage Beast', castingValue: '5+' },
  { id: 'flameburst', label: 'Flameburst', castingValue: '6+' },
  { id: 'fog_of_disarray', label: 'Fog of Disarray', castingValue: '4+' },
  { id: 'foil_magic', label: 'Foil Magic', castingValue: '4+' },
  { id: 'fortify_spirit', label: 'Fortify Spirit', castingValue: '4+' },
  { id: 'fury', label: 'Fury', castingValue: '4+' },
  { id: 'instil_fear', label: 'Instil Fear', castingValue: '6+' },
  { id: 'natures_wrath', label: "Nature's Wrath", castingValue: '6+' },
  { id: 'panic_steed', label: 'Panic Steed', castingValue: '5+' },
  {
    id: 'protection_of_valar',
    label: 'Protection of the Valar',
    castingValue: '5+',
  },
  { id: 'renew', label: 'Renew', castingValue: '5+' },
  { id: 'sorcerous_blast', label: 'Sorcerous Blast', castingValue: '6+' },
  { id: 'strengthen_will', label: 'Strengthen Will', castingValue: '5+' },
  { id: 'terrifying_aura', label: 'Terrifying Aura', castingValue: '4+' },
  { id: 'transfix', label: 'Transfix', castingValue: '5+' },
  { id: 'tremor', label: 'Tremor', castingValue: '6+' },
  { id: 'wither', label: 'Wither', castingValue: '5+' },
  { id: 'writhing_vines', label: 'Writhing Vines', castingValue: '5+' },
]

export default function StepSpellSelection({
  heroName,
  baseUnitId,
  equipment,
  selectedSpellId,
  onSelect,
}: Props) {
  return (
    <Box>
      <Box
        sx={{
          mb: 2,
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" sx={{ opacity: 0.6, fontStyle: 'italic' }}>
          Starting spell for
        </Typography>
        <Typography
          sx={{
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: '1rem',
            color: 'primary.main',
          }}
        >
          {heroName}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 0.5,
            mt: 0.5,
          }}
        >
          <Typography variant="caption" sx={{ opacity: 0.65 }}>
            Path of Channeling
          </Typography>
          {baseUnitId && (
            <>
              <Typography variant="caption" sx={{ opacity: 0.35 }}>
                ·
              </Typography>
              <Typography
                variant="caption"
                sx={{ opacity: 0.8, fontStyle: 'italic' }}
              >
                {getUnitLabel(baseUnitId)}
              </Typography>
            </>
          )}
        </Box>
        {equipment.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
            {equipment.map((eq) => (
              <Chip
                key={eq}
                label={getWargearLabel(eq)}
                size="small"
                sx={{
                  fontSize: '0.62rem',
                  height: 20,
                  background: 'rgba(201,168,76,0.06)',
                  border: '1px solid rgba(201,168,76,0.2)',
                  color: 'text.secondary',
                }}
              />
            ))}
          </Box>
        )}
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 0.75, opacity: 0.5 }}
        >
          Choose one Magical Power as your starting spell
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.75 }}>
        {CHANNELING_SPELLS.map((spell) => {
          const isSelected = selectedSpellId === spell.id
          return (
            <Button
              key={spell.id}
              onClick={() => onSelect(spell.id)}
              sx={{
                justifyContent: 'space-between',
                textAlign: 'left',
                px: 2,
                py: 1,
                minHeight: 44,
                border: '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                borderRadius: 1,
                background: isSelected
                  ? 'rgba(201,168,76,0.08)'
                  : 'transparent',
                color: isSelected ? 'primary.main' : 'text.primary',
                fontFamily: '"IM Fell English", serif',
                fontSize: '0.875rem',
                fontWeight: isSelected ? 700 : 400,
                textTransform: 'none',
                letterSpacing: 0,
                transition: 'border-color 0.15s, background 0.15s',
                '&:hover': {
                  borderColor: 'primary.main',
                  background: 'rgba(201,168,76,0.05)',
                },
              }}
            >
              <span>{spell.label}</span>
              <Typography
                component="span"
                sx={{
                  fontFamily: '"Cinzel Decorative", serif',
                  fontSize: '0.7rem',
                  opacity: isSelected ? 0.9 : 0.4,
                  ml: 1,
                  flexShrink: 0,
                }}
              >
                {spell.castingValue}
              </Typography>
            </Button>
          )
        })}
      </Box>
    </Box>
  )
}
