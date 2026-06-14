import { convertStatsInserts } from '#commands/cmd-stats-insert.mjs'

describe('convert stats inserts', () => {
  it('should convert cmd into html', () => {
    expect(
      convertStatsInserts(
        `\`{ AC: 14; HD: ½ (2hp); DMG: d4-1 (кинжал) или d6-1 (меч); MV: 60’ (20’); ML: 6; A: C }\``,
      ).trim(),
    ).toEqual(
      `
<div class="no-page-break">
<div class="stats-insert">
<span class="stat-record">
<span class="stat-name">AC</span>:
<span class="stat-value">14</span>
</span><span class="stat-record">
<span class="stat-name">HD</span>:
<span class="stat-value">½ (2hp)</span>
</span><span class="stat-record">
<span class="stat-name">Урон</span>:
<span class="stat-value">d4-1 (кинжал) или d6-1 (меч)</span>
</span><span class="stat-record">
<span class="stat-name">Передвижение</span>:
<span class="stat-value">60’ (20’)</span>
</span><span class="stat-record">
<span class="stat-name">Мораль</span>:
<span class="stat-value">6</span>
</span><span class="stat-record">
<span class="stat-name">Мировоззрение</span>:
<span class="stat-value">Х</span>
</span>
</div>
</div>
    `.trim(),
    )
  })
})
