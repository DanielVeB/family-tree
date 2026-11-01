import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import i18n from './i18n'

afterEach(cleanup)

describe('start tree and add a relative', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await i18n.changeLanguage('en')
  })

  it('creates the first person and adds a child from the detail view', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('First name'), '  Anna  ')
    await user.type(within(dialog).getByLabelText('Last name'), ' Testowa ')
    await user.click(
      within(dialog).getByRole('button', { name: 'Create tree' }),
    )

    const firstPerson = await screen.findByRole('button', {
      name: 'Anna Testowa',
    })
    expect(firstPerson).toBeInTheDocument()
    await user.click(firstPerson)
    await user.click(screen.getByRole('button', { name: 'Add child' }))

    const firstName = screen.getByLabelText('First name')
    await user.type(firstName, 'Jan')
    await user.type(screen.getByLabelText('Last name'), 'Przykładowy')
    await user.click(screen.getByRole('button', { name: 'PL' }))
    expect(screen.getByLabelText('Imię')).toHaveValue('Jan')
    expect(
      screen.getByRole('heading', { name: 'Dodaj dziecko (Anna Testowa)' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(
      await screen.findByRole('button', { name: 'Jan Przykładowy' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Jan Przykładowy' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Anna Testowa').length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(
        screen
          .getAllByRole('button')
          .filter((button) =>
            ['Anna Testowa', 'Jan Przykładowy'].includes(
              button.getAttribute('aria-label') ?? '',
            ),
          ),
      ).toHaveLength(2)
    })
  })

  it('requires a first name before creating the first person', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.click(screen.getByRole('button', { name: 'Create tree' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'First name is required',
    )
    expect(screen.getByLabelText('First name')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

function within(element: HTMLElement) {
  return {
    getByLabelText: (name: string) => {
      const input = element.querySelector<HTMLInputElement>(
        `input[autocomplete="${name === 'First name' ? 'given-name' : 'family-name'}"]`,
      )
      if (!input) throw new Error(`Missing input: ${name}`)
      return input
    },
    getByRole: (role: 'button', options: { name: string }) => {
      const button = Array.from(element.querySelectorAll('button')).find(
        (candidate) => candidate.textContent?.trim() === options.name,
      )
      if (!button) throw new Error(`Missing ${role}: ${options.name}`)
      return button
    },
  }
}
