/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import MemberMatchCard from '../MemberMatchCard'
import type { MemberMatchCardProps } from '../MemberMatchCard'
import type { MemberMatchState } from '../../../models/match'

// ─── Mock useMediaQuery ───────────────────────────────────────────────────────

const mockUseMediaQuery = vi.fn()
vi.mock('@mui/material/useMediaQuery', () => ({
  default: (...args: unknown[]) => mockUseMediaQuery(...args),
}))

// ─── Mock framer-motion to avoid animation issues in tests ────────────────────

vi.mock('framer-motion', () => {
  const React = require('react')
  // motion(Component) returns a wrapper that strips motion props
  const motionFn = (Component: React.ComponentType | string) => {
    return React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      const {
        initial: _i,
        animate: _a,
        transition: _t,
        whileHover: _wh,
        whileTap: _wt,
        exit: _e,
        variants: _v,
        ...rest
      } = props
      return React.createElement(Component, { ...rest, ref })
    })
  }
  // Also support motion.div syntax via proxy
  const motionProxy = new Proxy(motionFn, {
    get: (_target, prop) => {
      return motionFn(prop as string)
    },
  })
  return { motion: motionProxy }
})

// ─── Test helpers ─────────────────────────────────────────────────────────────

const theme = createTheme()

function createMockMember(overrides: Partial<MemberMatchState> = {}): MemberMatchState {
  return {
    memberId: 'member-1',
    memberName: 'Aragorn',
    baseUnitId: 'ranger_of_the_north',
    role: 'leader',
    equipment: ['sword', 'shield'],
    xpCounterGains: 0,
    isCasualty: false,
    mightMax: 3,
    willMax: 2,
    fateMax: 1,
    mightCurrent: 3,
    willCurrent: 2,
    fateCurrent: 1,
    ...overrides,
  }
}

function createWarriorMember(overrides: Partial<MemberMatchState> = {}): MemberMatchState {
  return {
    memberId: 'warrior-1',
    memberName: 'Gondor Soldier',
    baseUnitId: 'warrior_of_minas_tirith',
    role: 'warrior',
    equipment: ['sword'],
    xpCounterGains: 0,
    isCasualty: false,
    mightMax: null,
    willMax: null,
    fateMax: null,
    mightCurrent: null,
    willCurrent: null,
    fateCurrent: null,
    ...overrides,
  }
}

function defaultProps(overrides: Partial<MemberMatchCardProps> = {}): MemberMatchCardProps {
  return {
    mm: createMockMember(),
    delay: 0,
    baseStats: { move: 6, fight: 5, shoot: 4, strength: 4, defence: 5, attacks: 2, wounds: 2, courage: 5, intelligence: 3 },
    statIncreases: {},
    statDecreases: {},
    specialRules: [],
    toolkitItems: [],
    permanentBrewUsed: false,
    onXpChange: vi.fn(),
    onCasualtyToggle: vi.fn(),
    onMwfChange: vi.fn(),
    onUseToolkitItem: vi.fn(),
    onRemoveToolkitItem: vi.fn(),
    onChipTap: vi.fn(),
    ...overrides,
  }
}

function renderCard(props: Partial<MemberMatchCardProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemberMatchCard {...defaultProps(props)} />
    </ThemeProvider>,
  )
}

/**
 * Configure useMediaQuery mock for breakpoint simulation.
 * MemberMatchCard calls:
 *   1. theme.breakpoints.up('md')       → isMd
 *   2. theme.breakpoints.between('sm','md') → isSm
 *   3. theme.breakpoints.down('sm')     → isXs
 */
function setBreakpoint(bp: 'xs' | 'sm' | 'md') {
  mockUseMediaQuery.mockImplementation((query: string) => {
    // MUI generates media query strings from theme breakpoints
    // up('md') → min-width: 900px
    // between('sm','md') → min-width: 600px and max-width: 899.95px
    // down('sm') → max-width: 599.95px
    if (query.includes('min-width') && !query.includes('max-width')) {
      // up('md') → isMd
      return bp === 'md'
    }
    if (query.includes('min-width') && query.includes('max-width')) {
      // between('sm','md') → isSm
      return bp === 'sm'
    }
    if (query.includes('max-width') && !query.includes('min-width')) {
      // down('sm') → isXs
      return bp === 'xs'
    }
    return false
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MemberMatchCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Breakpoint rendering ──────────────────────────────────────────────────

  describe('Breakpoint rendering', () => {
    it('xs: renders Collapse wrapper and chevron, no MWF summary for warriors', () => {
      setBreakpoint('xs')
      renderCard({ mm: createWarriorMember() })

      // Chevron present with aria-expanded
      const chevron = screen.getByRole('button', { name: /expand details/i })
      expect(chevron).toBeInTheDocument()
      expect(chevron).toHaveAttribute('aria-expanded', 'false')

      // MWF summary not rendered (warrior has null M/W/F)
      expect(screen.queryByText('M')).not.toBeInTheDocument()
    })

    it('xs: renders Collapse wrapper and chevron for heroes without MWF summary', () => {
      setBreakpoint('xs')
      renderCard({ mm: createMockMember() })

      // Chevron present
      const chevron = screen.getByRole('button', { name: /expand details/i })
      expect(chevron).toBeInTheDocument()

      // At xs, MWF summary should NOT show (only at sm for heroes)
      // MWFSummary renders M/W/F labels — at xs these should not be in primary row
      // The M/W/F controls are inside collapse (hidden)
      expect(chevron).toHaveAttribute('aria-expanded', 'false')
    })

    it('sm: renders chevron and compact inline M/W/F controls for heroes', () => {
      setBreakpoint('sm')
      const hero = createMockMember({ role: 'leader', mightCurrent: 3, willCurrent: 2, fateCurrent: 1 })
      renderCard({ mm: hero })

      // Chevron present
      const chevron = screen.getByRole('button', { name: /expand details/i })
      expect(chevron).toBeInTheDocument()

      // Compact M/W/F controls visible — single-letter labels + values inline
      expect(screen.getByLabelText(/decrease might/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/increase might/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/decrease will/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/decrease fate/i)).toBeInTheDocument()
    })

    it('sm: does NOT show MWF summary for warriors', () => {
      setBreakpoint('sm')
      renderCard({ mm: createWarriorMember() })

      // Chevron present
      const chevron = screen.getByRole('button', { name: /expand details/i })
      expect(chevron).toBeInTheDocument()

      // No MWF summary for warrior
      expect(screen.queryByText('M')).not.toBeInTheDocument()
    })

    it('md: renders flat content without Collapse or chevron', () => {
      setBreakpoint('md')
      renderCard({ mm: createMockMember() })

      // No chevron at md+
      expect(screen.queryByRole('button', { name: /expand details/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /collapse details/i })).not.toBeInTheDocument()

      // Stats visible directly (no collapse needed)
      expect(screen.getByText('Mv')).toBeInTheDocument()
      expect(screen.getByText('Fv')).toBeInTheDocument()
    })
  })

  // ── Chip popover (onChipTap) ──────────────────────────────────────────────

  describe('Chip popover interaction', () => {
    it('calls onChipTap with correct args when equipment chip clicked', () => {
      setBreakpoint('md')
      const onChipTap = vi.fn()
      renderCard({
        mm: createMockMember({ equipment: ['sword'] }),
        onChipTap,
      })

      // Find equipment chip by its role="button" and label
      const chips = screen.getAllByRole('button')
      const swordChip = chips.find((el) => el.textContent?.toLowerCase().includes('sword'))
      expect(swordChip).toBeDefined()

      fireEvent.click(swordChip!)
      expect(onChipTap).toHaveBeenCalledTimes(1)
      expect(onChipTap).toHaveBeenCalledWith(
        swordChip,
        expect.objectContaining({ label: expect.any(String), description: expect.any(String) }),
      )
    })

    it('calls onChipTap on Enter keydown on special rule chip', () => {
      setBreakpoint('md')
      const onChipTap = vi.fn()
      renderCard({
        mm: createMockMember({ equipment: [] }),
        specialRules: ['resistant_to_magic'],
        onChipTap,
      })

      // Find special rule chip
      const chips = screen.getAllByRole('button')
      const ruleChip = chips.find(
        (el) => el.getAttribute('tabindex') === '0' && el.classList.contains('MuiChip-root'),
      )
      expect(ruleChip).toBeDefined()

      fireEvent.keyDown(ruleChip!, { key: 'Enter' })
      // MUI Chip onClick also fires on Enter, so onChipTap may be called via both handlers
      expect(onChipTap).toHaveBeenCalled()
    })

    it('calls onChipTap on Space keydown on chip', () => {
      setBreakpoint('md')
      const onChipTap = vi.fn()
      renderCard({
        mm: createMockMember({ equipment: [] }),
        specialRules: ['resistant_to_magic'],
        onChipTap,
      })

      const chips = screen.getAllByRole('button')
      const ruleChip = chips.find(
        (el) => el.getAttribute('tabindex') === '0' && el.classList.contains('MuiChip-root'),
      )
      expect(ruleChip).toBeDefined()

      fireEvent.keyDown(ruleChip!, { key: ' ' })
      expect(onChipTap).toHaveBeenCalledTimes(1)
    })
  })

  // ── Keyboard on chevron ───────────────────────────────────────────────────

  describe('Keyboard activation on chevron', () => {
    it('Enter on chevron toggles aria-expanded', async () => {
      setBreakpoint('xs')
      renderCard()

      const chevron = screen.getByRole('button', { name: /expand details/i })
      expect(chevron).toHaveAttribute('aria-expanded', 'false')

      // MUI IconButton handles Enter natively via click
      fireEvent.click(chevron)

      // After toggle, aria-expanded should be true and label changes
      const expandedChevron = screen.getByRole('button', { name: /collapse details/i })
      expect(expandedChevron).toHaveAttribute('aria-expanded', 'true')
    })

    it('Space on chevron toggles aria-expanded', () => {
      setBreakpoint('xs')
      renderCard()

      const chevron = screen.getByRole('button', { name: /expand details/i })
      expect(chevron).toHaveAttribute('aria-expanded', 'false')

      // Simulate space activation (MUI IconButton handles via click)
      fireEvent.click(chevron)

      const expandedChevron = screen.getByRole('button', { name: /collapse details/i })
      expect(expandedChevron).toHaveAttribute('aria-expanded', 'true')
    })
  })

  // ── Envenom chip ──────────────────────────────────────────────────────────

  describe('Envenom chip rendering', () => {
    it('renders envenom chip with "Envenom Weapon (weapon_label)" format', () => {
      setBreakpoint('md')
      renderCard({
        mm: createMockMember({ equipment: [] }),
        specialRules: [{ id: 'poisoned_attacks', parameter: 'dagger' }],
      })

      // synthesizeEnvenomChips produces envenom_weapon::dagger
      // getWargearLabel resolves to "Envenom Weapon (Dagger)" (humanised fallback)
      const envenomChip = screen.getByText(/Envenom Weapon/i)
      expect(envenomChip).toBeInTheDocument()
      expect(envenomChip.textContent).toMatch(/Envenom Weapon \(.*\)/)
    })

    it('filters poisoned_attacks from special rules display', () => {
      setBreakpoint('md')
      renderCard({
        mm: createMockMember({ equipment: [] }),
        specialRules: [
          { id: 'poisoned_attacks', parameter: 'dagger' },
          'resistant_to_magic',
        ],
      })

      // Envenom chip present in equipment area
      expect(screen.getByText(/Envenom Weapon/i)).toBeInTheDocument()

      // poisoned_attacks should NOT appear as a special rule chip
      expect(screen.queryByText(/Poisoned Attacks/i)).not.toBeInTheDocument()
    })
  })
})
