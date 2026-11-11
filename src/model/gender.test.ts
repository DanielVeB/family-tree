import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import genderNames from '../config/gender-names.json'
import { guessGender } from './gender'

describe('guessGender', () => {
  it.each([
    ['Anna', 'female'],
    ['ANNA', 'female'],
    ['Ola', 'female'],
    ['Łucja', 'female'],
    ['Beata', 'female'],
    ['Nel', 'female'],
    ['Karmen', 'female'],
    ['Beatrycze', 'female'],
    ['Anna Maria', 'female'],
    ['Anna-Maria', 'female'],
    ['Kuba', 'male'],
    ['kuba', 'male'],
    ['Kosma', 'male'],
    ['Barnaba', 'male'],
    ['Bonawentura', 'male'],
    ['Dyzma', 'male'],
    ['Zawisza', 'male'],
    ['Jarema', 'male'],
    ['Boruta', 'male'],
    ['Noah', 'male'],
    ['Jan', 'male'],
    ['Luca', 'male'],
    ['Mikołaj', 'male'],
    ['Jean-Luc', 'male'],
    ['', undefined],
    ['  ', undefined],
  ] as const)('guesses %s as %s', (firstName, expected) => {
    expect(guessGender(firstName)).toBe(expected)
  })

  it('accepts a well-formed exception list with no duplicates or overlap', () => {
    const schema = z
      .object({
        maleNamesEndingInA: z.array(z.string().trim().min(1)),
        femaleNamesNotEndingInA: z.array(z.string().trim().min(1)),
      })
      .strict()
    const config = schema.parse(genderNames)
    const normalize = (value: string) =>
      value.normalize('NFC').trim().toLocaleLowerCase('pl')
    const maleNames = config.maleNamesEndingInA.map(normalize)
    const femaleNames = config.femaleNamesNotEndingInA.map(normalize)
    expect(new Set(maleNames).size).toBe(maleNames.length)
    expect(new Set(femaleNames).size).toBe(femaleNames.length)
    expect(maleNames.filter((name) => femaleNames.includes(name))).toEqual([])
    expect(
      config.maleNamesEndingInA.every((name) => name.trim() === name),
    ).toBe(true)
    expect(
      config.femaleNamesNotEndingInA.every((name) => name.trim() === name),
    ).toBe(true)
    expect(genderNames.maleNamesEndingInA).toContain('Noah')
  })
})
