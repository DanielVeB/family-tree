import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ZodError } from 'zod'
import App from './App'
import i18n from './i18n'
import * as exportHelpers from './io/exportTree'
import validTreeFile from './io/fixtures/valid-tree.json?raw'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

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

  it('imports a tree, confirms replacement, and preserves the current tree on cancel', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!
    const picker = vi.spyOn(input, 'click')

    await user.click(
      screen.getByRole('button', { name: 'Import a tree from a file' }),
    )
    expect(picker).toHaveBeenCalledOnce()
    expect(input.accept).toBe('.json,application/json')
    fireEvent.change(input, {
      target: { files: [makeFile(validTreeFile)] },
    })

    expect(
      await screen.findByRole('button', { name: 'Łucja Żółć' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Loaded from file')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loaded 2 people')
    expect(input.value).toBe('')
    const afterImport = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(afterImport)
    expect(afterImport.defaultPrevented).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Łucja Żółć' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    await user.type(screen.getByLabelText('First name'), 'Maja')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByRole('button', { name: 'Maja' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Changes not exported')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Import a tree from a file' }),
    )
    fireEvent.change(input, {
      target: { files: [makeFile(validTreeFile)] },
    })
    const dialog = await screen.findByRole('dialog', {
      name: 'Replace your current tree?',
    })
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'PL' }))
    expect(
      screen.getByRole('heading', { name: 'Zastąpić obecne drzewo?' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Anuluj' }))
    expect(dialog).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Łucja Żółć' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Maja' })).toBeInTheDocument()
    expect(
      screen.getByText('Zmiany nie zostały wyeksportowane'),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Importuj drzewo z pliku' }),
      ).toHaveFocus()
    })

    await user.click(
      screen.getByRole('button', { name: 'Importuj drzewo z pliku' }),
    )
    fireEvent.change(input, {
      target: { files: [makeFile(validTreeFile)] },
    })
    expect(
      await screen.findByRole('dialog', {
        name: 'Zastąpić obecne drzewo?',
      }),
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Maja' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Maja' })).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Importuj drzewo z pliku' }),
    )
    fireEvent.change(input, {
      target: { files: [makeFile(validTreeFile)] },
    })
    await screen.findByRole('dialog', {
      name: 'Zastąpić obecne drzewo?',
    })
    await user.click(screen.getByRole('button', { name: 'Zastąp drzewo' }))
    expect(screen.queryByRole('button', { name: 'Maja' })).toBeNull()
    expect(screen.getByText('Wczytano z pliku')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Łucja Żółć' })).toBeNull()
  })

  it('shows one generic import error and leaves tree selection and status unchanged', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(screen.getByRole('button', { name: 'Anna' }))

    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, {
      target: { files: [makeFile('not json')] },
    })

    expect(await screen.findByRole('status')).toHaveTextContent(
      'This file could not be loaded. Please choose a family tree file exported from this app.',
    )
    expect(screen.getByRole('heading', { name: 'Anna' })).toBeInTheDocument()
    expect(screen.getByText('Not exported yet')).toBeInTheDocument()

    fireEvent.change(input, {
      target: {
        files: [
          makeFile('unreadable', () =>
            Promise.reject(new Error('read failure')),
          ),
        ],
      },
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'This file could not be loaded. Please choose a family tree file exported from this app.',
    )
    expect(screen.getByRole('heading', { name: 'Anna' })).toBeInTheDocument()
    expect(screen.getByText('Not exported yet')).toBeInTheDocument()
  })

  it('shows the empty state after importing a tree with no people', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, {
      target: {
        files: [makeFile('{"version":1,"nodes":[],"edges":[]}')],
      },
    })

    expect(
      await screen.findByRole('heading', {
        name: 'Your family story starts here',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loaded 0 people')
    expect(
      screen.queryByRole('button', { name: 'Export tree as a file' }),
    ).toBeNull()
    const picker = vi.spyOn(input, 'click')
    await user.click(
      screen.getByRole('button', { name: 'Import a tree from a file' }),
    )
    expect(picker).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    expect(screen.getByText('Changes not exported')).toBeInTheDocument()
    const afterChange = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(afterChange)
    expect(afterChange.defaultPrevented).toBe(true)
  })

  it('exports the tree, marks it clean, then marks changes dirty again', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn((blob: Blob) => {
      expect(blob).toBeInstanceOf(Blob)
      return 'blob:family-tree'
    })

    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))

    expect(screen.getByText('Not exported yet')).toBeInTheDocument()
    const beforeExport = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeExport)
    expect(beforeExport.defaultPrevented).toBe(true)
    const exportButton = screen.getByRole('button', {
      name: 'Export tree as a file',
    })
    await user.click(exportButton)

    expect(click).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('application/json;charset=utf-8')
    expect(screen.getByText(/^Exported at/)).toBeInTheDocument()
    expect(
      screen.getByText(/^Exported as family-tree-\d{4}-\d{2}-\d{2}\.json$/),
    ).toBeInTheDocument()
    const downloadLink = click.mock.instances[0] as HTMLAnchorElement
    expect(downloadLink.download).toMatch(
      /^family-tree-\d{4}-\d{2}-\d{2}\.json$/,
    )
    await user.click(screen.getByRole('button', { name: 'PL' }))
    expect(
      screen.getByText(
        /^Wyeksportowano jako family-tree-\d{4}-\d{2}-\d{2}\.json$/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Wyeksportowano o/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'EN' }))

    const afterExport = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(afterExport)
    expect(afterExport.defaultPrevented).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Anna' }))
    expect(screen.getByText(/^Exported at/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    await user.type(screen.getByLabelText('First name'), 'Jan')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Changes not exported')).toBeInTheDocument()
    const afterChange = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(afterChange)
    expect(afterChange.defaultPrevented).toBe(true)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('does not download or clear the dirty status when validation fails', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:family-tree')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
    vi.spyOn(exportHelpers, 'serializeTree').mockImplementation(() => {
      throw new ZodError([])
    })
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )

    expect(createObjectURL).not.toHaveBeenCalled()
    expect(logError).toHaveBeenCalledWith(
      'Tree validation failed before export.',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'The file could not be created.',
    )
    expect(screen.getByText('Not exported yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anna' })).toBeInTheDocument()
  })
})

function makeFile(
  text: string,
  readText: () => Promise<string> = async () => text,
) {
  const file = new File([text], 'family-tree.json', {
    type: 'application/json',
  })
  Object.defineProperty(file, 'text', { value: readText })
  return file
}

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
