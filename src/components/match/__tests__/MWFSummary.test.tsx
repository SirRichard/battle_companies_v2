/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MWFSummary from '../MWFSummary'

describe('MWFSummary', () => {
  it('renders nothing when all values are null', () => {
    const { container } = render(
      <MWFSummary might={null} will={null} fate={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders M/W/F values when all are provided', () => {
    render(<MWFSummary might={3} will={2} fate={1} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('W')).toBeInTheDocument()
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('renders only non-null values', () => {
    render(<MWFSummary might={2} will={null} fate={3} />)
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('F')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByText('W')).not.toBeInTheDocument()
  })

  it('renders when only one value is non-null', () => {
    render(<MWFSummary might={null} will={1} fate={null} />)
    expect(screen.getByText('W')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('M')).not.toBeInTheDocument()
    expect(screen.queryByText('F')).not.toBeInTheDocument()
  })

  it('shows depleted value (0) with error styling', () => {
    render(<MWFSummary might={0} will={2} fate={1} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
