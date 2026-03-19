import { Box, TextField, Typography } from '@mui/material'
import type { CompanyDefinition } from '../../models'

interface Props {
  companyDef: CompanyDefinition
  value: string
  onChange: (name: string) => void
}

const PLACEHOLDER_NAMES = [
  'The Grey Company',
  'Shadowbane',
  'Iron Shield',
  'The Wandering Few',
  'Oathkeepers',
  'Last Ember',
]

export default function StepCompanyName({
  companyDef,
  value,
  onChange,
}: Props) {
  const placeholder =
    PLACEHOLDER_NAMES[companyDef.id.length % PLACEHOLDER_NAMES.length]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.7 }}>
        Give your warband a name. It will carry this name through every victory
        and defeat of your campaign.
      </Typography>

      <TextField
        label="Company Name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
        fullWidth
        inputProps={{ maxLength: 60 }}
        helperText={`${value.length}/60 characters`}
        FormHelperTextProps={{
          sx: {
            fontFamily: '"Crimson Text", serif',
            fontStyle: 'italic',
            opacity: 0.5,
          },
        }}
      />

      {/* Preview badge */}
      {value.trim() && (
        <Box
          sx={{
            border: '1px solid rgba(200,164,90,0.25)',
            borderRadius: 1,
            px: 3,
            py: 2,
            background: 'rgba(200,164,90,0.04)',
            textAlign: 'center',
          }}
        >
          <Typography
            variant="caption"
            sx={{ opacity: 0.5, display: 'block', mb: 0.5 }}
          >
            {companyDef.label}
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Cinzel", serif',
              fontSize: '1.25rem',
              color: 'primary.main',
              letterSpacing: '0.08em',
            }}
          >
            {value.trim()}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
