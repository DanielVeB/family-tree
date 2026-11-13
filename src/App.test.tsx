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
    window.localStorage.setItem('family-tree-orientation', 'vertical')
    setViewportWidth(1024)
    await i18n.changeLanguage('en')
  })

  it('uses responsive orientation defaults when no saved preference exists', async () => {
    const user = userEvent.setup()
    window.localStorage.removeItem('family-tree-orientation')
    setViewportWidth(500)
    render(<App />)
    await startTree(user, 'Anna')
    expect(screen.getByRole('button', { name: 'Vertical view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Horizontal view' }),
    ).toHaveAttribute('aria-pressed', 'false')

    cleanup()
    window.localStorage.removeItem('family-tree-orientation')
    setViewportWidth(900)
    render(<App />)
    await startTree(user, 'Mia')
    expect(
      screen.getByRole('button', { name: 'Horizontal view' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches orientation without changing selection or export status, and persists it', async () => {
    const user = userEvent.setup()
    window.localStorage.removeItem('family-tree-orientation')
    setViewportWidth(500)
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    await user.type(screen.getByLabelText('First name'), 'Mia')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const mia = screen.getByRole('button', { name: 'Mia' })
    expect(mia).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Not exported yet')).toBeInTheDocument()
    const verticalBefore = getCardPosition('Anna')
    const verticalAfter = getCardPosition('Mia')
    expect(verticalAfter.top).toBeGreaterThan(verticalBefore.top)

    await user.click(screen.getByRole('button', { name: 'Horizontal view' }))
    expect(mia).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Not exported yet')).toBeInTheDocument()
    const horizontalBefore = getCardPosition('Anna')
    const horizontalAfter = getCardPosition('Mia')
    expect(horizontalAfter.left).toBeGreaterThan(horizontalBefore.left)
    expect(window.localStorage.getItem('family-tree-orientation')).toBe(
      'horizontal',
    )

    cleanup()
    render(<App />)
    await startTree(user, 'Ava')
    expect(
      screen.getByRole('button', { name: 'Horizontal view' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the read-only timeline without changing the selected person or export status', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))

    const anna = await screen.findByRole('button', { name: 'Anna' })
    await user.click(anna)
    expect(anna).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Not exported yet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Timeline' }))
    expect(
      screen.getByRole('dialog', { name: 'Family timeline' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('There are no dated events in this tree yet.'),
    ).toBeInTheDocument()

    await user.click(screen.getByText('Close'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anna' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Not exported yet')).toBeInTheDocument()
  })

  it('creates the first person and adds a child from its floating actions', async () => {
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

    const addedPerson = await screen.findByRole('button', {
      name: 'Jan Przykładowy',
    })
    expect(addedPerson).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Jan Przykładowy' }),
    ).toBeNull()
    const janCard = addedPerson.closest('.person-card')
    expect(janCard).toHaveAttribute('aria-label', 'Jan Przykładowy')
    expect(
      janCard?.querySelector('.person-card__control--edit'),
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

  it.each([
    ['sibling', 'left'],
    ['partner', 'right'],
  ] as const)(
    'adds a %s on the %s when chosen from its connection button',
    async (relation, side) => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
      await user.type(screen.getByLabelText('First name'), 'Anchor')
      await user.click(screen.getByRole('button', { name: 'Create tree' }))
      const anchor = await screen.findByRole('button', { name: 'Anchor' })
      await user.click(anchor)

      const actionLabel =
        relation === 'sibling'
          ? 'Add sibling on the left'
          : 'Add partner on the right'
      await user.click(screen.getByRole('button', { name: actionLabel }))
      await user.type(screen.getByLabelText('First name'), 'Relative')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      const relative = await screen.findByRole('button', { name: 'Relative' })
      const anchorLeft = Number.parseFloat(
        anchor.closest<HTMLElement>('.person-card')!.style.left,
      )
      const relativeLeft = Number.parseFloat(
        relative.closest<HTMLElement>('.person-card')!.style.left,
      )
      expect(side === 'left' ? relativeLeft : anchorLeft).toBeLessThan(
        side === 'left' ? anchorLeft : relativeLeft,
      )
    },
  )

  it('adds, edits, clears, and undoes a partner wedding date', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(await screen.findByRole('button', { name: 'Anna' }))
    await user.click(
      screen.getByRole('button', { name: 'Add partner on the right' }),
    )

    await user.type(screen.getByLabelText('First name'), 'Jan')
    await user.type(document.getElementById('wedding-date-day')!, '23')
    await user.type(document.getElementById('wedding-date-month')!, '6')
    await user.type(document.getElementById('wedding-date-year')!, '2001')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Jun 23, 2001')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(screen.getByRole('button', { name: 'Wedding dates' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Wedding date with Jan: Jun 23, 2001',
      }),
    )
    await user.clear(document.getElementById('wedding-date-day')!)
    await user.clear(document.getElementById('wedding-date-month')!)
    await user.clear(document.getElementById('wedding-date-year')!)
    await user.type(document.getElementById('wedding-date-year')!, '2002')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('2002')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('Jun 23, 2001')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Jan' }))
    await user.click(screen.getByRole('button', { name: 'Wedding dates' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Wedding date with Anna: Jun 23, 2001',
      }),
    )
    await user.clear(document.getElementById('wedding-date-day')!)
    await user.clear(document.getElementById('wedding-date-month')!)
    await user.clear(document.getElementById('wedding-date-year')!)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByText('Jun 23, 2001')).toBeNull()
    expect(document.querySelector('.marriage-date-label')).toBeNull()
  })

  it('saves suggested gender and a birth year, then exports both optional fields', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn((blob: Blob) => {
      expect(blob).toBeInstanceOf(Blob)
      return 'blob:person-details'
    })
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anchor')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(await screen.findByRole('button', { name: 'Anchor' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))

    await user.type(screen.getByLabelText('First name'), 'Kuba')
    expect(screen.getByRole('radio', { name: 'Male' })).toBeChecked()
    expect(
      screen.getByText('Chosen from the first name. You can change it.'),
    ).toBeInTheDocument()
    await user.type(document.getElementById('person-date-birth-year')!, '1948')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('b. 1948')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )
    await screen.findByRole('dialog', { name: 'Name your file' })
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    const exported = createObjectURL.mock.calls[0]![0] as Blob
    const tree = JSON.parse(await exported.text()) as {
      nodes: Array<{ data: Record<string, unknown> }>
    }
    const kuba = tree.nodes.find(({ data }) => data.firstName === 'Kuba')!.data
    expect(kuba).toMatchObject({
      gender: 'male',
      dateOfBirth: '1948',
    })
  })

  it('updates automatic gender while typing and preserves a manual choice', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anchor')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(await screen.findByRole('button', { name: 'Anchor' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))

    const firstName = screen.getByLabelText('First name')
    await user.type(firstName, 'Anna')
    expect(screen.getByRole('radio', { name: 'Female' })).toBeChecked()
    await user.clear(firstName)
    await user.type(firstName, 'Karmen')
    expect(screen.getByRole('radio', { name: 'Female' })).toBeChecked()
    expect(
      screen.getByText('Chosen from the first name. You can change it.'),
    ).toBeInTheDocument()
    await user.clear(firstName)
    await user.type(firstName, 'Jan')
    expect(screen.getByRole('radio', { name: 'Male' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'Female' }))
    await user.clear(firstName)
    await user.type(firstName, 'Ola')
    expect(screen.getByRole('radio', { name: 'Female' })).toBeChecked()
    expect(
      screen.queryByText('Chosen from the first name. You can change it.'),
    ).not.toBeInTheDocument()
  })

  it('suggests gender for an older person without changing data until save', async () => {
    const user = userEvent.setup()
    render(<App />)
    const oldTree = JSON.stringify({
      version: 1,
      nodes: [
        {
          id: 'marek',
          data: { firstName: 'Marek' },
          metaData: { layer: 0, order: 0 },
        },
      ],
      edges: [],
    })
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [makeFile(oldTree)] } })
    await user.click(await screen.findByRole('button', { name: 'Marek' }))
    await user.click(getPersonActionButton('Marek', 'edit'))
    expect(screen.getByRole('radio', { name: 'Male' })).toBeChecked()
    expect(
      screen.getByText('Chosen from the first name. You can change it.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Loaded from file')).toBeInTheDocument()

    await user.click(getPersonActionButton('Marek', 'edit'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(getPersonActionButton('Marek', 'edit'))
    expect(screen.getByRole('radio', { name: 'Male' })).toBeChecked()
    expect(
      screen.getByText('Chosen from the first name. You can change it.'),
    ).toBeInTheDocument()
  })

  it('imports and re-exports an older file without adding person fields', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn((blob: Blob) => {
      expect(blob).toBeInstanceOf(Blob)
      return 'blob:old-tree'
    })
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, {
      target: { files: [makeFile(validTreeFile, async () => validTreeFile)] },
    })
    await screen.findByRole('button', { name: 'Łucja Żółć' })
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )
    await screen.findByRole('dialog', { name: 'Name your file' })
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    const exported = createObjectURL.mock.calls[0]![0] as Blob
    const exportedTree = JSON.parse(await exported.text()) as {
      nodes: unknown[]
      edges: unknown[]
      metaData?: {
        saveHistory?: Array<{ target: string; savedAt: string }>
      }
    }
    const importedTree = JSON.parse(validTreeFile) as {
      nodes: unknown[]
      edges: unknown[]
    }
    expect(exportedTree.nodes).toEqual(importedTree.nodes)
    expect(exportedTree.edges).toEqual(importedTree.edges)
    expect(exportedTree.metaData?.saveHistory).toHaveLength(1)
    expect(exportedTree.metaData?.saveHistory?.[0]?.target).toBe('localExport')
  })

  it('keeps a manual gender and restores optional details with edit Undo', async () => {
    const user = userEvent.setup()
    render(<App />)
    const tree = JSON.stringify({
      version: 1,
      nodes: [
        {
          id: 'jan',
          data: {
            firstName: 'Jan',
            gender: 'female',
            dateOfBirth: '1948',
          },
          metaData: { layer: 0, order: 0 },
        },
      ],
      edges: [],
    })
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [makeFile(tree)] } })
    const jan = await screen.findByRole('button', { name: 'Jan' })
    await user.click(jan)
    await user.click(getPersonActionButton('Jan', 'edit'))
    expect(screen.getByRole('radio', { name: 'Female' })).toBeChecked()
    expect(
      screen.queryByText('Chosen from the first name. You can change it.'),
    ).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), 'Kuba')
    expect(screen.getByRole('radio', { name: 'Female' })).toBeChecked()
    await user.clear(document.getElementById('person-date-birth-year')!)
    await user.type(document.getElementById('person-date-birth-year')!, '1949')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByRole('button', { name: 'Kuba' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('Person edit undone')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jan' })).toBeInTheDocument()
    expect(screen.getByText('b. 1948')).toBeInTheDocument()

    await user.click(getPersonActionButton('Jan', 'edit'))
    expect(screen.getByLabelText('First name')).toHaveValue('Jan')
    expect(document.getElementById('person-date-birth-year')).toHaveValue(
      '1948',
    )
    expect(screen.getByRole('radio', { name: 'Female' })).toBeChecked()
  })

  it('blocks saving an impossible date and links the message to date inputs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anchor')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(await screen.findByRole('button', { name: 'Anchor' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    await user.type(screen.getByLabelText('First name'), 'Kuba')
    await user.type(document.getElementById('person-date-birth-day')!, '31')
    await user.type(document.getElementById('person-date-birth-month')!, '02')
    await user.type(document.getElementById('person-date-birth-year')!, '2020')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Enter a valid date.')).toBeInTheDocument()
    expect(document.getElementById('person-date-birth-day')).toHaveAttribute(
      'aria-describedby',
      'person-date-birth-error',
    )
    expect(
      screen.queryByRole('button', { name: 'Kuba' }),
    ).not.toBeInTheDocument()
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
      target: {
        files: [
          makeFile(validTreeFile, async () => validTreeFile, 'my-tree.json'),
        ],
      },
    })

    expect(
      await screen.findByRole('button', { name: 'Łucja Żółć' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Loaded from file')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loaded 2 people')
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )
    expect(await screen.findByLabelText('File name')).toHaveValue('my-tree')
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Export tree as a file' }),
      ).toHaveFocus(),
    )
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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus(),
    )

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
      screen.getByText('Zmiany nie zostały zapisane'),
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
    expect(screen.getByRole('button', { name: 'Maja' })).toBeInTheDocument()

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
    expect(screen.getByRole('button', { name: 'Anna' })).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: 'Anna' })).toBeInTheDocument()
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

  it('preselects smart connections and asks when there are multiple other parents', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))

    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    await user.type(screen.getByLabelText('First name'), 'Mia')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(
      screen.getByRole('button', { name: 'Add partner on the right' }),
    )
    const miaAsPartnerChild = screen.getByRole('checkbox', {
      name: 'Mia is also a child of the new partner',
    })
    expect(miaAsPartnerChild).toBeChecked()
    await user.type(screen.getByLabelText('First name'), 'Piotr')
    await user.click(screen.getByRole('button', { name: 'PL' }))
    expect(
      screen.getByRole('checkbox', {
        name: 'Mia jest też dzieckiem nowo dodanej osoby',
      }),
    ).toBeChecked()
    expect(screen.getByLabelText('Imię')).toHaveValue('Piotr')
    await user.click(screen.getByRole('button', { name: 'EN' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(screen.getByRole('button', { name: 'Mia' }))
    const disabledParentAction = screen.getByRole('button', {
      name: 'Mia already has two parents',
    })
    expect(disabledParentAction).toHaveAttribute('aria-disabled', 'true')
    expect(disabledParentAction).toHaveAttribute('tabindex', '0')

    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    expect(
      screen.getByRole('checkbox', {
        name: 'Also a sibling of Mia',
      }),
    ).toBeChecked()
    expect(
      screen.getByRole('group', {
        name: "Which of Anna's existing children should also be linked as siblings?",
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'PL' }))
    expect(
      screen.getByRole('group', {
        name: 'Które z istniejących dzieci osoby Anna połączyć także relacją rodzeństwa?',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'EN' }))
    const piotrAsParent = screen.getByRole('checkbox', {
      name: 'Also a child of Piotr',
    })
    expect(piotrAsParent).toBeChecked()
    await user.type(screen.getByLabelText('First name'), 'Olek')
    await user.click(piotrAsParent)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(
      screen.getByRole('button', { name: 'Add partner on the right' }),
    )
    expect(
      screen.getByRole('checkbox', {
        name: /Mia is also a child of the new partner/,
      }),
    ).toBeDisabled()
    const olekAsPartnerChild = screen.getByRole('checkbox', {
      name: 'Olek is also a child of the new partner',
    })
    expect(olekAsPartnerChild).toBeChecked()
    await user.type(screen.getByLabelText('First name'), 'Marek')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    const otherParentGroup = screen.getByRole('group', {
      name: 'Who is the other parent?',
    })
    const otherParentRadios = Array.from(
      otherParentGroup.querySelectorAll('input[type="radio"]'),
    )
    expect(otherParentRadios).toHaveLength(3)
    expect(
      otherParentRadios.every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true)
    await user.type(screen.getByLabelText('First name'), 'Zosia')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose the other parent, or "No other parent"',
    )
    expect(otherParentRadios[0]).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Zosia' })).toBeNull()
    await user.click(screen.getByRole('radio', { name: 'No other parent' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByRole('button', { name: 'Zosia' }),
    ).toBeInTheDocument()
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

    expect(
      await screen.findByRole('dialog', { name: 'Name your file' }),
    ).toBeInTheDocument()
    const nameInput = screen.getByLabelText('File name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Rodzina: Łukasz/Żółtowski?')
    await user.click(screen.getByRole('button', { name: 'Export' }))

    expect(click).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('application/json;charset=utf-8')
    expect(screen.getByText(/^Exported at/)).toBeInTheDocument()
    expect(
      screen.getByText('Exported as Rodzina Łukasz Żółtowski.json'),
    ).toBeInTheDocument()
    const downloadLink = click.mock.instances[0] as HTMLAnchorElement
    expect(downloadLink.download).toBe('Rodzina Łukasz Żółtowski.json')
    await user.click(screen.getByRole('button', { name: 'PL' }))
    expect(
      screen.getByText('Zapisano jako Rodzina Łukasz Żółtowski.json'),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Zapisano o/)).toBeInTheDocument()
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
    await user.click(exportButton)
    expect(click).toHaveBeenCalledTimes(2)
    expect(
      screen.getByText(
        'Your browser may add a number if a file with this name already exists.',
      ),
    ).toBeInTheDocument()
    const afterChange = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(afterChange)
    expect(afterChange.defaultPrevented).toBe(false)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('uses the native save picker and overwrites the selected file on repeat exports', async () => {
    const user = userEvent.setup()
    const write = vi.fn(async () => {})
    const close = vi.fn(async () => {})
    const handle = {
      name: 'picked-tree.json',
      createWritable: vi.fn(async () => ({ write, close })),
      queryPermission: vi.fn(async () => 'granted' as PermissionState),
      requestPermission: vi.fn(async () => 'granted' as PermissionState),
    }
    const picker = vi.fn(async () => handle)
    vi.stubGlobal('showSaveFilePicker', picker)
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )

    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(picker).toHaveBeenCalledWith({
      suggestedName: expect.stringMatching(
        /^family-tree-\d{4}-\d{2}-\d{2}\.json$/,
      ),
      types: [
        {
          description: 'Family tree file',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Exported as picked-tree.json',
    )

    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    await user.type(screen.getByLabelText('First name'), 'Mia')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )

    await waitFor(() => expect(close).toHaveBeenCalledTimes(2))
    expect(picker).toHaveBeenCalledOnce()
    expect(handle.queryPermission).toHaveBeenCalledWith({
      mode: 'readwrite',
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Updated picked-tree.json',
    )
  })

  it('validates the fallback filename and focuses/selects the suggestion', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )

    const input = (await screen.findByLabelText(
      'File name',
    )) as HTMLInputElement
    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a file name')

    await user.type(input, 'a'.repeat(101))
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Maximum 100 characters',
    )
  })

  it('does not change export state or show feedback when the native picker is cancelled', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => {
        throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
      }),
    )
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Export tree as a file' }),
      ).toBeEnabled()
    })
    expect(screen.getByText('Not exported yet')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    expect(logError).not.toHaveBeenCalled()
  })

  it('lets the fallback export menu replace the named target and keeps typed text on language switch', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:family-tree'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )
    const firstNameInput = await screen.findByLabelText('File name')
    await user.clear(firstNameInput)
    await user.type(firstNameInput, 'Rodzina Testowa')
    await user.keyboard('{Enter}')

    await user.click(
      screen.getByRole('button', { name: 'More export options' }),
    )
    expect(
      screen.getByText('Current file: Rodzina Testowa.json'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Export as…' }))
    const nextNameInput = await screen.findByLabelText('File name')
    expect(nextNameInput).toHaveValue('Rodzina Testowa')
    await user.clear(nextNameInput)
    await user.type(nextNameInput, 'Łukasz Żółtowski')
    await user.click(screen.getByRole('button', { name: 'PL' }))
    expect(screen.getByLabelText('Nazwa pliku')).toHaveValue('Łukasz Żółtowski')
    await user.keyboard('{Enter}')
    expect(
      screen.getByText('Zapisano jako Łukasz Żółtowski.json'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Zapisz drzewo do pliku' }),
      ).toHaveFocus(),
    )
  })

  it('clears the export target when a new tree is created after deleting the old one', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:family-tree'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )
    const firstNameInput = await screen.findByLabelText('File name')
    await user.clear(firstNameInput)
    await user.type(firstNameInput, 'old-tree')
    await user.keyboard('{Enter}')

    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(getPersonActionButton('Anna', 'delete'))
    await user.click(getDeleteConfirmButton())
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    const newFirstName = screen.getByLabelText('First name')
    await waitFor(() => expect(newFirstName).toHaveFocus())
    await user.type(newFirstName, 'Mia')
    expect(newFirstName).toHaveValue('Mia')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )

    const suggestedName = await screen.findByLabelText('File name')
    expect((suggestedName as HTMLInputElement).value).toMatch(
      /^family-tree-\d{4}-\d{2}-\d{2}$/,
    )
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

describe('edit and delete people', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    window.localStorage.setItem('family-tree-orientation', 'vertical')
    await i18n.changeLanguage('en')
  })

  it('edits names with validation, preserves focus, and saves inferred gender', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.type(screen.getByLabelText('Last name'), 'Testowa')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(screen.getByRole('button', { name: 'Anna Testowa' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    await user.type(screen.getByLabelText('First name'), 'Mia')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Anna Testowa' }))
    expect(screen.getByText('Not exported yet')).toBeInTheDocument()

    expect(getPersonActionButton('Anna Testowa', 'edit')).toHaveAttribute(
      'title',
      'Edit',
    )
    await user.click(getPersonActionButton('Anna Testowa', 'edit'))
    const firstName = screen.getByLabelText('First name')
    expect(firstName).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByLabelText('First name')).toBeNull()
    expect(screen.getByRole('button', { name: 'Anna Testowa' })).toBeVisible()
    expect(screen.getByText('Changes not exported')).toBeInTheDocument()

    await user.click(getPersonActionButton('Anna Testowa', 'edit'))
    await user.clear(screen.getByLabelText('First name'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'First name is required',
    )
    expect(screen.getByLabelText('First name')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await user.type(screen.getByLabelText('First name'), 'Łucja')
    await user.clear(screen.getByLabelText('Last name'))
    await user.type(screen.getByLabelText('Last name'), 'Żółć')
    await user.click(screen.getByRole('button', { name: 'PL' }))
    expect(screen.getByLabelText('Imię')).toHaveValue('Łucja')
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(
      await screen.findByRole('button', { name: 'Łucja Żółć' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Łucja Żółć' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Mia' }))
    expect(screen.getAllByText('Łucja Żółć')).toHaveLength(1)
    expect(
      screen.getByText('Zmiany nie zostały zapisane'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Zaktualizowano imię i nazwisko'),
    ).toBeInTheDocument()
  })

  it('confirms parent deletion, keeps child sibling links, and restores the tree with Undo', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:family-tree'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Anna')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    await user.type(screen.getByLabelText('First name'), 'Mia')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    expect(
      screen.getByRole('checkbox', { name: 'Also a sibling of Mia' }),
    ).toBeChecked()
    await user.type(screen.getByLabelText('First name'), 'Olek')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(screen.getByRole('button', { name: 'Anna' }))
    await user.click(
      screen.getByRole('button', { name: 'Export tree as a file' }),
    )
    await screen.findByRole('dialog', { name: 'Name your file' })
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(getPersonActionButton('Anna', 'delete'))
    expect(getPersonActionButton('Anna', 'delete')).toHaveAttribute(
      'title',
      'Delete',
    )
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Anna?' })
    expect(dialog).toHaveTextContent(
      '2 relationships will be removed along with this person.',
    )
    expect(dialog).not.toHaveTextContent('split into')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus(),
    )
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Anna' })).toBeInTheDocument()
    await waitFor(() =>
      expect(getPersonActionButton('Anna', 'delete')).toHaveFocus(),
    )

    await user.click(getPersonActionButton('Anna', 'delete'))
    await user.click(getDeleteConfirmButton())
    expect(screen.queryByRole('button', { name: 'Anna' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Mia' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Olek' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Deleted Anna')
    expect(screen.getByText('Changes not exported')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(
      await screen.findByRole('button', { name: 'Anna' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anna' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mia' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Olek' })).toBeInTheDocument()
    expect(screen.getByText(/^Exported at/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Restored Anna')

    await user.click(getPersonActionButton('Anna', 'delete'))
    await user.click(getDeleteConfirmButton())
    await user.click(screen.getByRole('button', { name: 'Mia' }))
    await user.click(screen.getByRole('button', { name: 'Add child' }))
    await user.type(screen.getByLabelText('First name'), 'Jan')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('shows the last-person consequence and returns to the empty state', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
    await user.type(screen.getByLabelText('First name'), 'Jan')
    await user.click(screen.getByRole('button', { name: 'Create tree' }))
    await user.click(screen.getByRole('button', { name: 'Jan' }))
    await user.click(getPersonActionButton('Jan', 'delete'))
    const onlyPersonDialog = screen.getByRole('alertdialog')
    expect(onlyPersonDialog).toHaveTextContent(
      'This is the only person in the tree. The tree will be empty afterwards.',
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(getPersonActionButton('Jan', 'delete'))
    await user.click(getDeleteConfirmButton())
    expect(
      await screen.findByRole('heading', {
        name: 'Your family story starts here',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Export tree as a file' }),
    ).toBeNull()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Start a new tree' }),
      ).toHaveFocus(),
    )
    const beforeUnload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(beforeUnload)
    expect(beforeUnload.defaultPrevented).toBe(false)
  })

  it('warns when deleting a person will split the tree into parts', async () => {
    const user = userEvent.setup()
    render(<App />)
    const splitTree = JSON.stringify({
      version: 1,
      nodes: ['anna', 'mia', 'piotr', 'olek'].map((id) => ({
        id,
        data: { firstName: id },
        metaData: {
          layer: ['anna', 'piotr'].includes(id) ? 0 : 1,
          order: ['anna', 'piotr'].includes(id)
            ? ['anna', 'piotr'].indexOf(id)
            : ['mia', 'olek'].indexOf(id),
        },
      })),
      edges: [
        { from: 'anna', to: 'mia', type: 'child' },
        { from: 'piotr', to: 'olek', type: 'child' },
        { from: 'mia', to: 'olek', type: 'marriage' },
      ],
    })
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [makeFile(splitTree)] } })
    await user.click(await screen.findByRole('button', { name: 'mia' }))
    await user.click(getPersonActionButton('mia', 'delete'))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete mia?' })
    expect(dialog).toHaveTextContent(
      '2 relationships will be removed along with this person.',
    )
    expect(dialog).toHaveTextContent(
      'The tree will split into 2 separate parts.',
    )
    await user.click(screen.getByRole('button', { name: 'PL' }))
    expect(dialog).toHaveTextContent(
      'Drzewo rozpadnie się na 2 oddzielne części.',
    )
    await user.click(screen.getByRole('button', { name: 'EN' }))
    await user.click(getDeleteConfirmButton())
    expect(screen.getByRole('button', { name: 'anna' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'piotr' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'olek' })).toBeInTheDocument()
  })

  it('moves a focused person with Alt+Arrow and restores the position with Undo', async () => {
    const user = userEvent.setup()
    render(<App />)
    const tree = JSON.stringify({
      version: 1,
      nodes: [
        {
          id: 'anna',
          data: { firstName: 'Anna' },
          metaData: { layer: 0, order: 0 },
        },
        {
          id: 'jan',
          data: { firstName: 'Jan' },
          metaData: { layer: 0, order: 1 },
        },
      ],
      edges: [{ from: 'anna', to: 'jan', type: 'sibling' }],
    })
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [makeFile(tree)] } })
    const anna = await screen.findByRole('button', { name: 'Anna' })
    const annaCard = anna.closest<HTMLElement>('.person-card')!
    const originalLeft = Number.parseFloat(annaCard.style.left)
    fireEvent.keyDown(anna, { key: 'ArrowRight', altKey: true })
    await screen.findByText('Moved Anna')
    expect(Number.parseFloat(annaCard.style.left)).toBeGreaterThan(originalLeft)
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('Move undone')).toBeInTheDocument()
    const restoredAnna = screen
      .getByRole('button', { name: 'Anna' })
      .closest<HTMLElement>('.person-card')!
    expect(Number.parseFloat(restoredAnna.style.left)).toBe(originalLeft)
    expect(screen.getByText('Loaded from file')).toBeInTheDocument()
  })

  it('moves one person instantly and supports Undo without a dialog', async () => {
    const user = userEvent.setup()
    render(<App />)
    const tree = JSON.stringify({
      version: 1,
      nodes: [
        {
          id: 'parent',
          data: { firstName: 'Parent' },
          metaData: { layer: 0, order: 0 },
        },
        {
          id: 'person',
          data: { firstName: 'Person' },
          metaData: { layer: 1, order: 0 },
        },
        {
          id: 'sibling',
          data: { firstName: 'Sibling' },
          metaData: { layer: 1, order: 1 },
        },
        {
          id: 'child',
          data: { firstName: 'Child' },
          metaData: { layer: 2, order: 0 },
        },
      ],
      edges: [
        { from: 'parent', to: 'person', type: 'child' },
        { from: 'parent', to: 'sibling', type: 'child' },
        { from: 'person', to: 'sibling', type: 'sibling' },
        { from: 'person', to: 'child', type: 'child' },
      ],
    })
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [makeFile(tree)] } })
    await user.click(await screen.findByRole('button', { name: 'Person' }))
    expect(
      screen.queryByRole('dialog', { name: 'Move Person?' }),
    ).not.toBeInTheDocument()
    await user.click(getPersonActionButton('Person', 'move'))
    expect(
      screen.getByRole('button', { name: 'Move right one place' }),
    ).toBeVisible()
    fireEvent.pointerDown(document.body)
    expect(
      screen.queryByRole('button', { name: 'Move right one place' }),
    ).not.toBeInTheDocument()
    await user.click(getPersonActionButton('Person', 'move'))
    await user.click(
      screen.getByRole('button', { name: 'Move right one place' }),
    )
    expect(await screen.findByText('Moved Person')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('Move undone')).toBeInTheDocument()
  })
})

function makeFile(
  text: string,
  readText: () => Promise<string> = async () => text,
  fileName = 'family-tree.json',
) {
  const file = new File([text], fileName, {
    type: 'application/json',
  })
  Object.defineProperty(file, 'text', { value: readText })
  return file
}

async function startTree(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Start a new tree' }))
  await user.type(screen.getByLabelText('First name'), name)
  await user.click(screen.getByRole('button', { name: 'Create tree' }))
  await screen.findByRole('button', { name })
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
}

function getCardPosition(name: string) {
  const card = screen
    .getByRole('button', { name })
    .closest<HTMLElement>('.person-card')
  if (!card) throw new Error(`Missing card for ${name}`)
  return {
    left: Number.parseFloat(card.style.left || '0'),
    top: Number.parseFloat(card.style.top || '0'),
  }
}

function getPersonActionButton(
  name: string,
  action: 'edit' | 'delete' | 'move',
) {
  const identity = screen.getByRole('button', { name })
  const button = identity
    .closest('.person-card')
    ?.querySelector<HTMLButtonElement>(`.person-card__control--${action}`)
  if (!button) throw new Error(`Missing ${action} action for ${name}`)
  return button
}

function getDeleteConfirmButton() {
  const dialog = screen.getByRole('alertdialog')
  const button = Array.from(dialog.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === 'Delete',
  )
  if (!button) throw new Error('Missing delete confirmation button')
  return button
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
