import { useState } from 'react'
import {
  Box,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { motion } from 'framer-motion'
import { getUnitLabel, formatEquipment } from '../../utils/labels'
import type { CompanyDefinition } from '../../models'
import companiesData from '../../data/companies.json'

const ALL_COMPANIES = companiesData as CompanyDefinition[]

interface Props {
  factionId: string
  value: string | null
  onChange: (companyId: string | null) => void
}

export default function StepCompany({ factionId, value, onChange }: Props) {
  const companies = ALL_COMPANIES.filter((c) =>
    Array.isArray(c.factionId)
      ? c.factionId.includes(factionId)
      : c.factionId === factionId
  )
  const [detailsOpen, setDetailsOpen] = useState(value !== null)

  if (companies.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, opacity: 0.5 }}>
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
          No companies available for this faction in the current data subset.
        </Typography>
      </Box>
    )
  }

  // ─── Focused Layout (value !== null AND details open) ─────────────────────────
  if (value !== null && detailsOpen) {
    const selectedCompany = companies.find((c) => c.id === value)
    const unselectedCompanies = companies.filter((c) => c.id !== value)

    if (!selectedCompany) {
      return <CompanyList companies={companies} value={value} onChange={(id) => { onChange(id); if (id !== null) setDetailsOpen(true) }} factionId={factionId} />
    }

    return (
      <Box
        sx={{
          display: { xs: 'block', md: 'grid' },
          gridTemplateColumns: { md: '220px 1fr' },
          gap: { md: 2 },
        }}
      >
        {/* Sidebar — visible md+ only */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <List dense disablePadding>
            {unselectedCompanies.map((company) => (
              <ListItemButton
                key={company.id}
                onClick={() => { onChange(company.id); setDetailsOpen(true) }}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  py: 0.75,
                  px: 1.5,
                  '&:hover': {
                    background: 'rgba(200,164,90,0.08)',
                  },
                }}
              >
                <ListItemText
                  primary={company.label}
                  primaryTypographyProps={{
                    sx: {
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.82rem',
                      letterSpacing: '0.03em',
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        {/* Company Details */}
        <CompanyDetails company={selectedCompany} factionId={factionId} onCollapse={() => setDetailsOpen(false)} />
      </Box>
    )
  }

  // ─── Company List (value === null OR details closed) ──────────────────────────
  return <CompanyList companies={companies} value={value} onChange={(id) => { onChange(id); if (id !== null) setDetailsOpen(true) }} factionId={factionId} />
}

// ─── CompanyDetails sub-component ─────────────────────────────────────────────

function CompanyDetails({ company, factionId, onCollapse }: { company: CompanyDefinition; factionId: string; onCollapse: () => void }) {
  return (
    <Box sx={{ px: { xs: 0, md: 1 }, py: 1 }}>
      {/* Company name header with collapse button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography
          sx={{
            fontFamily: '"Cinzel", serif',
            fontSize: '1.1rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'primary.main',
          }}
        >
          {company.label}
        </Typography>
        <IconButton
          onClick={onCollapse}
          size="small"
          aria-label="Collapse company details"
          sx={{
            color: 'text.secondary',
            '&:hover': { color: 'primary.main' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Company stats */}
      <Typography variant="caption" sx={{ opacity: 0.6, mb: 2, display: 'block' }}>
        {company.startingRoster.reduce((s, e) => s + e.count, 0)} starting members · {company.maxCompanySize} max
        {company.gold > 0 ? ` · ${company.gold} starting gold` : ''}
      </Typography>

      {/* Flavour text */}
      {company.flavorTexts.map((text, fi) => (
        <Typography
          key={fi}
          variant="body2"
          sx={{
            fontStyle: 'italic',
            lineHeight: 1.7,
            opacity: 0.8,
            mb: fi < company.flavorTexts.length - 1 ? 1.5 : 0,
          }}
        >
          {text}
        </Typography>
      ))}

      {/* Special rules */}
      {company.companySpecialRules.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography
            sx={{
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
              color: 'primary.main',
              opacity: 0.8,
              mb: 1,
              textTransform: 'uppercase',
            }}
          >
            Company Special Rules
          </Typography>
          {company.companySpecialRules
            .filter((r) => r.title || r.label)
            .map((rule) => (
              <Box key={rule.id} sx={{ mb: 1.5 }}>
                <Typography
                  sx={{
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.82rem',
                    color: 'text.primary',
                    mb: 0.25,
                  }}
                >
                  {rule.title || rule.label}
                </Typography>
                {rule.description && (
                  <Typography
                    variant="body2"
                    sx={{ opacity: 0.7, lineHeight: 1.6 }}
                  >
                    {rule.description}
                  </Typography>
                )}
              </Box>
            ))}
        </Box>
      )}

      {/* Hero upgrades */}
      {(() => {
        const raw = company.heroUpgrade
        const upgrades = Array.isArray(raw) ? raw : raw ? [raw] : []
        if (upgrades.length === 0) return null
        return (
          <Box sx={{ mt: 2 }}>
            <Typography
              sx={{
                fontFamily: '"Cinzel", serif',
                fontSize: '0.75rem',
                letterSpacing: '0.08em',
                color: 'primary.main',
                opacity: 0.8,
                mb: 1,
                textTransform: 'uppercase',
              }}
            >
              Hero Upgrades
            </Typography>
            {upgrades.map((upgrade) => (
              <Box key={upgrade.id} sx={{ mb: 1.5 }}>
                <Typography
                  sx={{
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.82rem',
                    color: 'text.primary',
                    mb: 0.25,
                  }}
                >
                  {upgrade.label}
                  {upgrade.baseUnitIds && upgrade.baseUnitIds.length > 0 && (
                    <Box
                      component="span"
                      sx={{ opacity: 0.6, fontSize: '0.78rem' }}
                    >
                      {' '}
                      (
                      {upgrade.baseUnitIds
                        .map((id) => getUnitLabel(id))
                        .join(', ')}
                      )
                    </Box>
                  )}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ opacity: 0.7, lineHeight: 1.6 }}
                >
                  {upgrade.description}
                </Typography>
              </Box>
            ))}
          </Box>
        )
      })()}

      {/* Starting roster preview */}
      <Box sx={{ mt: 2 }}>
        <Typography
          sx={{
            fontFamily: '"Cinzel", serif',
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            color: 'primary.main',
            opacity: 0.8,
            mb: 1,
            textTransform: 'uppercase',
          }}
        >
          Starting Roster
        </Typography>
        {(() => {
          const visibleVariants =
            company.variants?.filter(
              (v) =>
                !v.isDefault &&
                (!v.visibleFromFactions ||
                  v.visibleFromFactions.includes(factionId))
            ) ?? []

          if (visibleVariants.length > 0) {
            return (
              <>
                {/* Standard Roster sub-heading */}
                <Typography
                  sx={{
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.72rem',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    opacity: 0.7,
                    mb: 0.5,
                    mt: 0.5,
                  }}
                >
                  Standard Roster
                </Typography>
                {company.startingRoster.map((entry, ei) => (
                  <Typography
                    key={ei}
                    variant="body2"
                    sx={{ opacity: 0.7, lineHeight: 1.8 }}
                  >
                    ×{entry.count} {getUnitLabel(entry.baseUnitId)}
                    {entry.equipment && entry.equipment.length > 0 && (
                      <Box component="span" sx={{ opacity: 0.6 }}>
                        {' '}
                        ({formatEquipment(entry.equipment)})
                      </Box>
                    )}
                  </Typography>
                ))}

                {/* Variant rosters */}
                {visibleVariants.map((variant) => (
                  <Box key={variant.id}>
                    <Typography
                      sx={{
                        fontFamily: '"Cinzel", serif',
                        fontSize: '0.72rem',
                        letterSpacing: '0.06em',
                        color: 'text.secondary',
                        opacity: 0.7,
                        mb: 0.5,
                        mt: 1,
                      }}
                    >
                      {variant.label}
                    </Typography>
                    {variant.startingRoster?.map((entry, ei) => (
                      <Typography
                        key={ei}
                        variant="body2"
                        sx={{ opacity: 0.7, lineHeight: 1.8 }}
                      >
                        ×{entry.count} {getUnitLabel(entry.baseUnitId)}
                        {entry.equipment && entry.equipment.length > 0 && (
                          <Box component="span" sx={{ opacity: 0.6 }}>
                            {' '}
                            ({formatEquipment(entry.equipment)})
                          </Box>
                        )}
                      </Typography>
                    ))}
                  </Box>
                ))}
              </>
            )
          }

          // No visible variants — render roster as before
          return company.startingRoster.map((entry, ei) => (
            <Typography
              key={ei}
              variant="body2"
              sx={{ opacity: 0.7, lineHeight: 1.8 }}
            >
              ×{entry.count} {getUnitLabel(entry.baseUnitId)}
              {entry.equipment && entry.equipment.length > 0 && (
                <Box component="span" sx={{ opacity: 0.6 }}>
                  {' '}
                  ({formatEquipment(entry.equipment)})
                </Box>
              )}
            </Typography>
          ))
        })()}
      </Box>
    </Box>
  )
}

// ─── CompanyList sub-component (original list view) ───────────────────────────

interface CompanyListProps {
  companies: CompanyDefinition[]
  value: string | null
  onChange: (companyId: string | null) => void
  factionId: string
}

function CompanyList({ companies, value, onChange, factionId }: CompanyListProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        variant="body2"
        sx={{ fontStyle: 'italic', opacity: 0.7, mb: 1 }}
      >
        Select the specific warband your company belongs to. Tap a company to
        read its background and special rules before choosing.
      </Typography>

      {companies.map((company, i) => {
        const isSelected = value === company.id
        const startingCount = company.startingRoster.reduce(
          (s, e) => s + e.count,
          0
        )

        return (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.25 }}
          >
            <Box
              onClick={() =>
                onChange(value === company.id ? null : company.id)
              }
              sx={{
                border: '1px solid',
                borderColor: isSelected
                  ? 'primary.main'
                  : 'rgba(200,164,90,0.18)',
                borderRadius: 1,
                background: isSelected
                  ? 'rgba(200,164,90,0.08)'
                  : 'transparent',
                overflow: 'hidden',
                transition: 'border-color 0.18s, background 0.18s',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: isSelected
                    ? 'primary.main'
                    : 'rgba(200,164,90,0.4)',
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 2.5,
                  py: 1.75,
                  gap: 2,
                }}
              >
                {/* Selection indicator */}
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: '2px solid',
                    borderColor: isSelected
                      ? 'primary.main'
                      : 'rgba(200,164,90,0.3)',
                    background: isSelected ? 'primary.main' : 'transparent',
                    transition: 'all 0.18s',
                  }}
                />

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.95rem',
                      fontWeight: isSelected ? 700 : 500,
                      letterSpacing: '0.04em',
                      color: isSelected ? 'primary.main' : 'text.primary',
                    }}
                  >
                    {company.label}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    {startingCount} starting members · {company.maxCompanySize}{' '}
                    max
                    {company.gold > 0 ? ` · ${company.gold} starting gold` : ''}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </motion.div>
        )
      })}
    </Box>
  )
}
