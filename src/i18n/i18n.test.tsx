import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import i18n, { detectInitialLanguage } from './index'
import en from './locales/en.json'
import pl from './locales/pl.json'

describe('translations', () => {
  it('has matching base keys, complete locale plurals, and non-empty values', () => {
    const normalizeKeys = (keys: string[]) =>
      [
        ...new Set(
          keys.map((key) => key.replace(/_(one|few|many|other)$/, '')),
        ),
      ].sort()
    expect(normalizeKeys(Object.keys(en))).toEqual(
      normalizeKeys(Object.keys(pl)),
    )
    expect(Object.values(en).every((value) => value.trim().length > 0)).toBe(
      true,
    )
    expect(Object.values(pl).every((value) => value.trim().length > 0)).toBe(
      true,
    )
    expect(
      Object.keys(en)
        .filter((key) => key.startsWith('importSuccess_'))
        .sort(),
    ).toEqual(['importSuccess_one', 'importSuccess_other'])
    expect(
      Object.keys(pl)
        .filter((key) => key.startsWith('importSuccess_'))
        .sort(),
    ).toEqual([
      'importSuccess_few',
      'importSuccess_many',
      'importSuccess_one',
      'importSuccess_other',
    ])
    expect(
      Object.keys(en)
        .filter((key) => key.startsWith('deleteRelations_'))
        .sort(),
    ).toEqual(['deleteRelations_one', 'deleteRelations_other'])
    expect(
      Object.keys(pl)
        .filter((key) => key.startsWith('deleteRelations_'))
        .sort(),
    ).toEqual([
      'deleteRelations_few',
      'deleteRelations_many',
      'deleteRelations_one',
      'deleteRelations_other',
    ])
  })

  it('uses the correct English and Polish import success plurals', async () => {
    await i18n.changeLanguage('en')
    expect(
      [1, 2, 5].map((count) => i18n.t('importSuccess', { count })),
    ).toEqual(['Loaded 1 person', 'Loaded 2 people', 'Loaded 5 people'])
    await i18n.changeLanguage('pl')
    expect(
      [1, 2, 5, 22].map((count) => i18n.t('importSuccess', { count })),
    ).toEqual([
      'Wczytano 1 osobę',
      'Wczytano 2 osoby',
      'Wczytano 5 osób',
      'Wczytano 22 osoby',
    ])
    await i18n.changeLanguage('en')
  })

  it('uses the correct relationship count plurals in English and Polish', async () => {
    await i18n.changeLanguage('en')
    expect(
      [0, 1, 2, 5, 12, 22].map((count) => i18n.t('deleteRelations', { count })),
    ).toEqual([
      '0 relationships will be removed along with this person.',
      '1 relationship will be removed along with this person.',
      '2 relationships will be removed along with this person.',
      '5 relationships will be removed along with this person.',
      '12 relationships will be removed along with this person.',
      '22 relationships will be removed along with this person.',
    ])
    await i18n.changeLanguage('pl')
    expect(
      [0, 1, 2, 5, 12, 22].map((count) => i18n.t('deleteRelations', { count })),
    ).toEqual([
      'Wraz z tą osobą zostanie usuniętych 0 relacji.',
      'Wraz z tą osobą zostanie usunięta 1 relacja.',
      'Wraz z tą osobą zostaną usunięte 2 relacje.',
      'Wraz z tą osobą zostanie usuniętych 5 relacji.',
      'Wraz z tą osobą zostanie usuniętych 12 relacji.',
      'Wraz z tą osobą zostaną usunięte 22 relacje.',
    ])
    await i18n.changeLanguage('en')
  })
})

describe('initial language', () => {
  it('uses Polish for a Polish browser and English otherwise', () => {
    expect(detectInitialLanguage(null, 'pl-PL')).toBe('pl')
    expect(detectInitialLanguage(null, 'en-US')).toBe('en')
  })

  it('prefers a saved language over the browser language', () => {
    expect(detectInitialLanguage('pl', 'en-US')).toBe('pl')
    expect(detectInitialLanguage('en', 'pl-PL')).toBe('en')
  })
})

describe('language toggle', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    window.localStorage.setItem('family-tree-language', 'en')
    await i18n.changeLanguage('en')
  })

  it('switches language, persists the choice, and updates the document', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      screen.getByRole('heading', { name: en.welcomeTitle }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: pl.englishShort }))
    await user.click(screen.getByRole('button', { name: pl.polishShort }))

    expect(
      screen.getByRole('heading', { name: pl.welcomeTitle }),
    ).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('pl')
    expect(document.title).toBe(pl.documentTitle)
    expect(window.localStorage.getItem('family-tree-language')).toBe('pl')

    cleanup()
    await i18n.changeLanguage('en')
  })
})
