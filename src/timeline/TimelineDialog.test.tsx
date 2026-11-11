import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TimelineDialog from './TimelineDialog'
import type { FamilyTree } from '../model/tree'
import i18n from '../i18n'

const tree: FamilyTree = {
  version: 1,
  nodes: [
    {
      id: 'a',
      data: { firstName: 'Anna', dateOfBirth: '1987-01' },
      metaData: { layer: 0, order: 0 },
    },
    {
      id: 'b',
      data: { firstName: 'Jan', dateOfDeath: '2020' },
      metaData: { layer: 0, order: 1 },
    },
  ],
  edges: [],
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('TimelineDialog', () => {
  it('starts paused, navigates with buttons and arrow keys, and restores focus on close', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const onClose = vi.fn()
    const { unmount } = render(<TimelineDialog tree={tree} onClose={onClose} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Birth of Anna')).toBeInTheDocument()
    expect(screen.getByText('January 1987')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(document.activeElement).toHaveClass('timeline-dialog__event')

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(screen.getByText('Death of Jan')).toBeInTheDocument()
    expect(screen.getByText('2020')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    expect(screen.getByText('Birth of Anna')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Death of Jan')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('plays every five seconds, pauses at the end, and restarts from the first event', () => {
    vi.useFakeTimers()
    render(<TimelineDialog tree={tree} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByText('Death of Jan')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByText('2 of 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.getByText('Birth of Anna')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('clears the playback timer when the dialog closes', () => {
    vi.useFakeTimers()
    const { unmount } = render(<TimelineDialog tree={tree} onClose={vi.fn()} />)
    const timerCountBeforePlayback = vi.getTimerCount()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(vi.getTimerCount()).toBe(timerCountBeforePlayback + 1)

    unmount()
    expect(vi.getTimerCount()).toBe(timerCountBeforePlayback)
  })

  it('keeps keyboard focus inside the dialog', () => {
    render(<TimelineDialog tree={tree} onClose={vi.fn()} />)
    const nextButton = screen.getByRole('button', { name: 'Next' })
    const closeButton = screen.getByRole('button', { name: 'Close' })
    nextButton.focus()
    const dialog = screen.getByRole('dialog')
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )
    expect(document.activeElement).toBe(nextButton)
    expect(focusable[0]).toBe(closeButton)
    expect(focusable[focusable.length - 1]).toBe(nextButton)

    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
  })

  it('shows a usable empty state and translates event date precision', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <TimelineDialog
        tree={{ version: 1, nodes: [], edges: [] }}
        onClose={onClose}
      />,
    )
    expect(
      screen.getByText('There are no dated events in this tree yet.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalledOnce()

    await i18n.changeLanguage('pl')
    rerender(<TimelineDialog tree={tree} onClose={onClose} />)
    expect(screen.getByText('Narodziny: Anna')).toBeInTheDocument()
    expect(screen.getByText('styczeń 1987')).toBeInTheDocument()
  })
})
