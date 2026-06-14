/**
 * @file Expand shortened stats block into HTML layout
 * No params, just searches for `{ ... }` blocks
 * @example ```markdown
 *    `{ AC: 14; HD: ½ (2hp); DMG: d4-1 (кинжал) или d6-1 (меч); MV: 60’ (20’); ML: 6; A: C }`
 * ```
 */

const statsTranslations = new Map([
  ['Atk', 'Атака'],
  ['AC', 'AC'],
  ['HD', 'HD'],
  ['DMG', 'Урон'],
  ['MV', 'Передвижение'],
  ['ML', 'Мораль'],
  ['A', 'Мировоззрение'],
  ['XP', 'Опыт'],
  ['S', 'Спасброски'],
])

const resolveValueFor = (statName, value) => {
  if (statName === 'A') {
    switch (value) {
      case 'C':
        return 'Х'
      case 'L':
        return 'З'
      case 'N':
        return 'Н'

      default:
        throw new Error(`Unknown alignment: ${value}`)
    }
  }

  if (value === '-') {
    return 'Нет'
  }

  return value
}

/**
 * @param {string} markdown
 * @returns {string}
 */
const renderStatsBlock = (markdown) => {
  const chunks = markdown.replace(/^{|}$/g, '').split(';')
  let htmlFormatted = ''

  chunks.forEach((chunk) => {
    const [key, value] = chunk
      .split(/:(.+)/)
      .filter(Boolean)
      .map((i) => i.trim())
    const statName = statsTranslations.get(key)

    if (!statName) {
      throw new Error(`Unknown stat name: "${key}"`)
    }
    if (!value) {
      throw new Error(`Falsy stat value: "${value}"`)
    }

    htmlFormatted += [
      `<span class="stat-record">`,
      `<span class="stat-name">${statName}</span>:&nbsp;`,
      `<span class="stat-value">${resolveValueFor(key, value)}</span>`,
      `</span>${' '}`,
    ].join(``)
  })

  return htmlFormatted || markdown
}

/**
 * @type {CommandHandlerFn}
 * @param {string} markdown
 * @returns {string}
 */
export const convertStatsInserts = (markdown) => {
  const commandPattern = /`{(.+?)}`/gms
  if (!commandPattern.test(markdown)) {
    return markdown
  }

  return markdown.replace(commandPattern, (match, content) => {
    return !content
      ? match
      : [
          `<div class="no-page-break">`,
          `<div class="stats-insert">`,
          renderStatsBlock(content.trim()),
          `</div>`,
          `</div>`,
        ].join('\n')
  })
}
