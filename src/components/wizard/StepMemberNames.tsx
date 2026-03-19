import { Box, TextField, Typography, Divider } from '@mui/material'
import type { CompanyDefinition } from '../../models'
import { generateTempMemberIds } from '../../services/company/companyFactory'
import { getUnitLabel, formatEquipment } from '../../utils/labels'

interface Props {
  companyDef: CompanyDefinition
  memberNames: Record<string, string>
  onChange: (tempId: string, name: string) => void
}

export default function StepMemberNames({
  companyDef,
  memberNames,
  onChange,
}: Props) {
  const tempIds = generateTempMemberIds(companyDef)

  // Build display info alongside each tempId
  let memberIndex = 0
  const memberInfo: Array<{
    tempId: string
    unitLabel: string
    equipment: string[]
    groupLabel: string
  }> = []
  let lastGroupLabel = ''

  for (const entry of companyDef.startingRoster) {
    const unitLabel = getUnitLabel(entry.baseUnitId)

    const equipLabel = entry.equipment?.length
      ? `(${formatEquipment(entry.equipment)})`
      : ''

    const groupLabel = equipLabel ? `${unitLabel} ${equipLabel}` : unitLabel

    for (let i = 0; i < entry.count; i++) {
      memberInfo.push({
        tempId: tempIds[memberIndex],
        unitLabel,
        equipment: entry.equipment ?? [],
        groupLabel: groupLabel !== lastGroupLabel ? groupLabel : '',
      })
      lastGroupLabel = groupLabel
      memberIndex++
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography
        variant="body2"
        sx={{ fontStyle: 'italic', opacity: 0.7, mb: 1.5 }}
      >
        Name each member of your starting warband. Default names will be used
        for any left blank. You can always rename members later.
      </Typography>

      {memberInfo.map((info, i) => (
        <Box key={info.tempId}>
          {/* Group label separator */}
          {info.groupLabel && i > 0 && (
            <Divider sx={{ my: 1.5, opacity: 0.3 }} />
          )}
          {info.groupLabel && (
            <Typography
              sx={{
                fontFamily: '"Cinzel", serif',
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
                color: 'primary.main',
                opacity: 0.7,
                textTransform: 'uppercase',
                mb: 1,
                mt: i > 0 ? 0 : 0,
              }}
            >
              {info.groupLabel}
            </Typography>
          )}

          <TextField
            fullWidth
            size="small"
            label={`Warrior #${i + 1}`}
            placeholder={`Warrior #${i + 1}`}
            value={memberNames[info.tempId] ?? ''}
            onChange={(e) => onChange(info.tempId, e.target.value)}
            inputProps={{ maxLength: 40 }}
            sx={{ mb: 1 }}
          />
        </Box>
      ))}

      <Typography
        variant="caption"
        sx={{ opacity: 0.45, fontStyle: 'italic', mt: 1 }}
      >
        Tip: Named members are easier to track during a campaign. Even simple
        names like "Beren" or "Thrak" help tell your warband's story.
      </Typography>
    </Box>
  )
}
