import { describe, expect, it } from 'vitest'
import {
  buildPartialDate,
  formatDateYears,
  formatPartialDate,
  isValidPartialDate,
  parsePartialDate,
  validateDateOrder,
  validatePartialDate,
} from './dates'

describe('partial dates', () => {
  it('parses and builds year, month, and day precision with padding', () => {
    expect(parsePartialDate('1948')).toEqual({
      day: '',
      month: '',
      year: '1948',
    })
    expect(parsePartialDate('1948-03')).toEqual({
      day: '',
      month: '03',
      year: '1948',
    })
    expect(buildPartialDate({ day: '7', month: '3', year: '1948' })).toBe(
      '1948-03-07',
    )
    expect(buildPartialDate({ day: '', month: '3', year: '1948' })).toBe(
      '1948-03',
    )
    expect(buildPartialDate({ day: '', month: '', year: '1948' })).toBe('1948')
    expect(buildPartialDate({ day: '', month: '', year: '' })).toBeUndefined()
  })

  it.each([
    ['1948', true],
    ['1000', true],
    ['1948-03', true],
    ['2000-02-29', true],
    ['1900-02-29', false],
    ['2021-02-30', false],
    ['1948-13', false],
    ['0999', false],
    ['07.03.1948', false],
  ])('validates stored value %s', (value, valid) => {
    expect(isValidPartialDate(value)).toBe(valid)
  })

  it('validates leap days, month ends, earliest year, and future partial dates', () => {
    const today = new Date(2024, 1, 29)
    expect(
      validatePartialDate({ year: '2020', month: '02', day: '29' }, today),
    ).toBeUndefined()
    expect(
      validatePartialDate({ year: '2021', month: '02', day: '29' }, today),
    ).toBe('errorInvalid')
    expect(
      validatePartialDate({ year: '2024', month: '04', day: '31' }, today),
    ).toBe('errorInvalid')
    expect(
      validatePartialDate({ year: '0999', month: '', day: '' }, today),
    ).toBe('errorInvalid')
    expect(validatePartialDate({ year: '', month: '5', day: '' }, today)).toBe(
      'errorYear',
    )
    expect(
      validatePartialDate({ year: '2025', month: '', day: '' }, today),
    ).toBe('errorFuture')
    expect(
      validatePartialDate({ year: '2024', month: '03', day: '' }, today),
    ).toBe('errorFuture')
    expect(
      validatePartialDate({ year: '2024', month: '', day: '' }, today),
    ).toBeUndefined()
  })

  it('compares birth and death only at their shared precision', () => {
    expect(
      validateDateOrder(
        { year: '1990', month: '05', day: '' },
        { year: '1990', month: '03', day: '10' },
      ),
    ).toBe(false)
    expect(
      validateDateOrder(
        { year: '1990', month: '', day: '' },
        { year: '1990', month: '03', day: '10' },
      ),
    ).toBe(true)
  })

  it('formats only known years and tolerates invalid input', () => {
    const born = (year: string) => `b. ${year}`
    const died = (year: string) => `d. ${year}`
    const range = (from: string, to: string) => `${from} – ${to}`
    expect(formatDateYears('1948-03', '2019', born, died, range)).toBe(
      '1948 – 2019',
    )
    expect(formatDateYears('1948', undefined, born, died, range)).toBe(
      'b. 1948',
    )
    expect(formatDateYears(undefined, '2019', born, died, range)).toBe(
      'd. 2019',
    )
    expect(formatDateYears('2021-02-30', undefined, born, died, range)).toBe('')
  })

  it('formats partial dates using the active locale', () => {
    expect(formatPartialDate('2001', 'en')).toBe('2001')
    expect(formatPartialDate('2001-06', 'en')).toBe('June 2001')
    expect(formatPartialDate('2001-06-23', 'en')).toBe('Jun 23, 2001')
    expect(formatPartialDate('2001-06-23', 'pl')).toContain('2001')
    expect(formatPartialDate('2001-02-30', 'en')).toBe('')
  })
})
