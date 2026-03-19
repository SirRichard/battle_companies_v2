import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { motion, AnimatePresence } from 'framer-motion'
import PageHeader from '../components/common/PageHeader'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useAppContext } from '../context/AppContext'
import type { CompanyDefinition } from '../models'
import { getCompanyLabel } from '../utils/labels'
import { calcCompanyRating } from '../utils/rating'
import companiesData from '../data/companies.json'
import baseUnitsData from '../data/baseUnits.json'
import wargearData from '../data/wargear.json'

const COMPANIES_DEF = companiesData as CompanyDefinition[]
const BASE_UNITS_RAW = baseUnitsData as Array<{
  id: string
  baseEquipment: string[]
}>
const WARGEAR_RAW = wargearData as Array<{ id: string; category: string }>

function companyHasMissingStats(
  companyTypeId: string,
  getStatsForUnit: (id: string) => unknown
): boolean {
  const def = COMPANIES_DEF.find((c) => c.id === companyTypeId)
  if (!def) return false
  const ids = new Set<string>()
  for (const entry of def.startingRoster) ids.add(entry.baseUnitId)
  for (const adv of def.advancements) {
    ids.add(adv.fromBaseUnitId)
    ids.add(adv.toBaseUnitId)
  }
  for (const row of def.reinforcementTable) {
    if (row.baseUnitId) ids.add(row.baseUnitId)
  }
  for (const uid of Array.from(ids)) {
    const unit = BASE_UNITS_RAW.find((u) => u.id === uid)
    if (unit) {
      for (const eq of unit.baseEquipment) {
        if (WARGEAR_RAW.some((w) => w.id === eq && w.category === 'mount'))
          ids.add(eq)
      }
    }
  }
  return Array.from(ids).some((id) => !getStatsForUnit(id))
}

const MotionCard = motion(Card)

const ALIGNMENT_LABEL: Record<string, string> = {
  good: 'Free Peoples',
  evil: 'Shadow',
}

export default function LoadCompanyPage() {
  const { companies, deleteCompany, setActiveCompany, getStatsForUnit } =
    useAppContext()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [missingStatsId, setMissingStatsId] = useState<string | null>(null)

  const handleSelect = (id: string) => {
    const company = companies.find((c) => c.id === id)
    if (!company) return
    if (companyHasMissingStats(company.companyTypeId, getStatsForUnit)) {
      setMissingStatsId(id)
      return
    }
    setActiveCompany(company)
    navigate(`/companies/${id}`)
  }

  const handleMissingStatsContinue = () => {
    const company = companies.find((c) => c.id === missingStatsId)
    if (company) {
      setActiveCompany(company)
      navigate(`/companies/${missingStatsId}`)
    }
    setMissingStatsId(null)
  }

  const handleDeleteConfirm = async () => {
    if (confirmDelete) {
      await deleteCompany(confirmDelete)
      setConfirmDelete(null)
    }
  }

  const companyToDelete = companies.find((c) => c.id === confirmDelete)

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="Load Company" backTo="/" />

      <Box
        sx={{
          flex: 1,
          px: { xs: 2, sm: 3 },
          py: 3,
          maxWidth: 600,
          width: '100%',
          mx: 'auto',
        }}
      >
        {companies.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              mt: 10,
              gap: 2,
              opacity: 0.5,
            }}
          >
            <Typography variant="h4" sx={{ textAlign: 'center' }}>
              No Companies Yet
            </Typography>
            <Typography
              variant="body2"
              sx={{ textAlign: 'center', fontStyle: 'italic' }}
            >
              Your warband awaits. Create a new company to begin.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <AnimatePresence>
              {companies.map((company, i) => (
                <MotionCard
                  key={company.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  sx={{ position: 'relative', overflow: 'visible' }}
                >
                  <CardActionArea onClick={() => handleSelect(company.id)}>
                    <CardContent sx={{ pr: 6 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Typography variant="h5" sx={{ flex: 1, minWidth: 0 }}>
                          {company.name}
                        </Typography>
                        <Chip
                          label={
                            ALIGNMENT_LABEL[company.alignment] ??
                            company.alignment
                          }
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            fontStyle: 'italic',
                            borderColor:
                              company.alignment === 'good'
                                ? 'success.main'
                                : 'secondary.main',
                            color:
                              company.alignment === 'good'
                                ? 'success.light'
                                : 'secondary.light',
                            border: '1px solid',
                            background: 'transparent',
                          }}
                        />
                      </Box>

                      <Typography
                        variant="caption"
                        sx={{ fontStyle: 'italic', display: 'block', mb: 1.5 }}
                      >
                        {getCompanyLabel(company.companyTypeId)}
                      </Typography>

                      {/* Stats row */}
                      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        <Box>
                          <Typography variant="caption" sx={{ opacity: 0.6 }}>
                            Rating
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, color: 'primary.main' }}
                          >
                            {calcCompanyRating(
                              company.members,
                              getStatsForUnit
                            )}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ opacity: 0.6 }}>
                            Record
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {company.wins}W / {company.draws}D /{' '}
                            {company.losses}L
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ opacity: 0.6 }}>
                            Influence
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {company.influence} IP
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ opacity: 0.6 }}>
                            Members
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {company.members.length}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ opacity: 0.6 }}>
                            Last Played
                          </Typography>
                          <Typography variant="body2">
                            {new Date(
                              company.lastPlayedAt
                            ).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </CardActionArea>

                  {/* Delete button */}
                  <Tooltip title="Delete Company">
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDelete(company.id)
                      }}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        color: 'text.disabled',
                        minWidth: 44,
                        minHeight: 44,
                        '&:hover': { color: 'error.main' },
                      }}
                      aria-label="Delete company"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </MotionCard>
              ))}
            </AnimatePresence>
          </Box>
        )}
      </Box>

      {/* Missing stats warning */}
      <ConfirmDialog
        open={!!missingStatsId}
        title="Stats Required"
        message="Some base unit stats for this company are missing — you'll need to enter them before the company can be viewed. This happens if stats were cleared after the company was created."
        confirmLabel="Enter Stats"
        cancelLabel="Cancel"
        onConfirm={handleMissingStatsContinue}
        onCancel={() => setMissingStatsId(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Disband Company?"
        message={`Are you sure you want to permanently disband "${companyToDelete?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Disband"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
        dangerous
      />
    </Box>
  )
}
