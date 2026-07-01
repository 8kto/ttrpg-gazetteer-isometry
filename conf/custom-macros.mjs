const HYPH = '(?:-|-|–|—)'
const CRYSTAL_PREFIXES = ['Телепорт', 'Хроно', 't', 'g', 'f']
const WORD_TAIL = '[\\p{L}\\p{N}_]*'
const LEFT_BOUNDARY = '(?<![\\p{L}\\p{N}_])'
const RIGHT_BOUNDARY = '(?![\\p{L}\\p{N}_])'

const combinedNobrTermsRegex = new RegExp(
  [
    `${LEFT_BOUNDARY}((?:${CRYSTAL_PREFIXES.join('|')})${HYPH}кристалл${WORD_TAIL})${RIGHT_BOUNDARY}`,
    `${LEFT_BOUNDARY}(t${HYPH}пол${WORD_TAIL})${RIGHT_BOUNDARY}`,
  ].join('|'),
  'gu',
)

/**
 * Wrap compound crystal/field terms (e.g. `Телепорт-кристалл`, `t-поле`)
 * in `<nobr>` to prevent mid-word line breaks.
 * @param {string} markdown - Source Markdown string.
 * @returns {string} Markdown with compound terms wrapped.
 */
export const glueCrystalsAlike = (markdown) => {
  return markdown.replace(combinedNobrTermsRegex, (m) => `<nobr>${m}</nobr>`)
}
