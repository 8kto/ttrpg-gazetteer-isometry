import { glueCrystalsAlike } from '../custom-macros.mjs'

describe('glueCrystalsAlike', () => {
  it.each([
    [`Телепорт-кристалл`, `<nobr>Телепорт-кристалл</nobr>`],
    [`Хроно-кристалл`, `<nobr>Хроно-кристалл</nobr>`],
    [`t-кристалл`, `<nobr>t-кристалл</nobr>`],
    [`t-кристаллы`, `<nobr>t-кристаллы</nobr>`],
    [`t-поле`, `<nobr>t-поле</nobr>`],
    [`t-полем`, `<nobr>t-полем</nobr>`],
  ])('wraps compound crystal/field term in nobr: %s', (input, expected) => {
    expect(glueCrystalsAlike(input)).toEqual(expected)
  })

  it.each([
    [`обычное слово`, `обычное слово`],
    [`x-кристалл`, `x-кристалл`],
  ])('does not wrap non-matching terms: %s', (input, expected) => {
    expect(glueCrystalsAlike(input)).toEqual(expected)
  })
})
