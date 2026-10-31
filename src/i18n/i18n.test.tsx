import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import i18n, { detectInitialLanguage } from './index'
import en from './locales/en.json'
import pl from './locales/pl.json'

describe('translations', () => {
  it('has matching keys and non-empty values in English and Polish', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort())
    expect(Object.values(en).every((value) => value.trim().length > 0)).toBe(
      true,
    )
    expect(Object.values(pl).every((value) => value.trim().length > 0)).toBe(
      true,
    )
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
