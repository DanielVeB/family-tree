export interface PartialDateParts {
  day: string
  month: string
  year: string
}

export type DateValidationError = 'errorInvalid' | 'errorYear' | 'errorFuture'

export function parsePartialDate(value: string | undefined): PartialDateParts {
  if (!value) return { day: '', month: '', year: '' }
  const [year = '', month = '', day = ''] = value.split('-')
  return { day, month, year }
}

export function buildPartialDate(parts: PartialDateParts): string | undefined {
  const { day, month, year } = parts
  if (!day && !month && !year) return undefined
  if (month && !year) return undefined
  if (day && !month) return undefined
  if (!year) return undefined
  const normalizedYear = year.padStart(4, '0')
  return month
    ? `${normalizedYear}-${month.padStart(2, '0')}${day ? `-${day.padStart(2, '0')}` : ''}`
    : normalizedYear
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

export function validatePartialDate(
  parts: PartialDateParts,
  today: Date,
): DateValidationError | undefined {
  const { day, month, year } = parts
  if (!day && !month && !year) return undefined
  if ((day || month) && !year) return 'errorYear'
  if (day && !month) return 'errorInvalid'
  if (
    (day && !/^\d{1,2}$/u.test(day)) ||
    (month && !/^\d{1,2}$/u.test(month)) ||
    (year && !/^\d{4}$/u.test(year))
  ) {
    return 'errorInvalid'
  }
  const yearNumber = Number(year)
  const monthNumber = month ? Number(month) : 1
  const dayNumber = day ? Number(day) : 1
  if (
    yearNumber < 1000 ||
    (month && (monthNumber < 1 || monthNumber > 12)) ||
    (day &&
      (dayNumber < 1 ||
        dayNumber >
          [
            31,
            isLeapYear(yearNumber) ? 29 : 28,
            31,
            30,
            31,
            30,
            31,
            31,
            30,
            31,
            30,
            31,
          ][monthNumber - 1]!))
  ) {
    return 'errorInvalid'
  }
  const todayParts = [
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  ]
  const earliest = [yearNumber, monthNumber, dayNumber]
  for (let index = 0; index < earliest.length; index += 1) {
    if (earliest[index]! < todayParts[index]!) return undefined
    if (earliest[index]! > todayParts[index]!) return 'errorFuture'
  }
  return undefined
}

export function validateDateOrder(
  birth: PartialDateParts,
  death: PartialDateParts,
): boolean {
  const birthParts = [birth.year, birth.month, birth.day]
  const deathParts = [death.year, death.month, death.day]
  const precision = Math.min(
    birthParts.filter(Boolean).length,
    deathParts.filter(Boolean).length,
  )
  for (let index = 0; index < precision; index += 1) {
    const birthValue = Number(birthParts[index])
    const deathValue = Number(deathParts[index])
    if (deathValue < birthValue) return false
    if (deathValue > birthValue) return true
  }
  return true
}

export function isValidPartialDate(value: string): boolean {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/u.exec(value)
  if (!match) return false
  const [, year = '', month = '', day = ''] = match
  return (
    validatePartialDate({ year, month, day }, new Date(9999, 11, 31)) ===
    undefined
  )
}

export function formatDateYears(
  birthDate: string | undefined,
  deathDate: string | undefined,
  bornLabel: (year: string) => string,
  diedLabel: (year: string) => string,
  rangeLabel: (from: string, to: string) => string,
): string {
  const birth = birthDate && isValidPartialDate(birthDate) ? birthDate : ''
  const death = deathDate && isValidPartialDate(deathDate) ? deathDate : ''
  const birthYear = birth.split('-')[0] ?? ''
  const deathYear = death.split('-')[0] ?? ''
  if (birthYear && deathYear) return rangeLabel(birthYear, deathYear)
  if (birthYear) return bornLabel(birthYear)
  if (deathYear) return diedLabel(deathYear)
  return ''
}
