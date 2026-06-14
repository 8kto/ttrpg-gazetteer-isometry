import { convertRefInserts } from '#commands/cmd-ref-insert.mjs'

describe('convert stats inserts', () => {
  it('should convert cmd into shortened stats html', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Отшельник] /-->`)).toEqual(
      `
<div class="no-page-break">
<section class="ref-insert">
<header>Отшельник</header>
<main>

\`{ AC: 10; HD: 5 (40 HP); MV: 12}\`
</main>
</section>
</div>
    `.trim(),
    )
  })

  xit('should convert cmd into shortened html (1st sentence)', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Солнечный зайчик] /-->`)).toEqual(
      `
<div class="no-page-break">
<section class="ref-insert">
<header>Солнечный зайчик</header>
<main>Отсвет солнечного луча, преломленный стёклами купола, падает на лицо приключенца небольшим цветным пятном.</main>
</section>
</div>
    `.trim(),
    )
  })

  it('should convert cmd into full html', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Отшельник] detailed /-->`)).toEqual(
      `
<div class="no-page-break">
<section class="ref-insert">
<header>Отшельник</header>
<main>

Крайне живучий и выносливый, при получении урона бросает d6, на 4-5 полностью избегает повреждений.

Развил несколько личностей (3), если одна очарована или под Сном, тело под управление берёт следующая (1: Просветлённый мудрец, 2: Пьяный мастер, 3: Сварливая консьержка).

\`{ AC: 10; HD: 5 (40 HP); MV: 12}\`
</main>
</section>
</div>
    `.trim(),
    )
  })

  it('should ignore not found refs', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[XXX YYY] /-->`)).toEqual(`<!-- cmd[ref] header[XXX YYY] /-->`)
  })

  it('should convert cmd into full html and support tags', () => {
    expect(convertRefInserts(`<!-- cmd[ref] header[Наира, суккуб] detailed /-->`)).toEqual(
      `
<div class="no-page-break">
<section class="ref-insert">
<header>Наира, суккуб</header>
<main>

_В будуаре (CX)_, дополнительная атака (1:2 раунда, начиная с первого). Стены, состоящие из живой материи, резко
сокращаются и сходятся, сжимая на 3d6 урона всех, кто внутри. Спасбросок Дыхания, чтобы получить половину урона,
ближайшие к выходу персонажи могут сначала бросить спасбросок Паралича, чтобы успеть выскочить.
</main>
</section>
</div>
    `.trim(),
    )
  })
})
