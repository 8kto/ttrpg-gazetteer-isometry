/** @import { IDocumentConfig, IModuleBuilderConfig, ITocOverrides } from 'oktozine/types' */

/** @type {ITocOverrides} */
const mainTocConf = {
  dropLabels: ['Зловещая Изометрия: газетир', 'Содержание'],
  dropItemsFromLabels: ['Благодарности и техническая информация'],
  alwaysInclude: [],
}

/** @type {ITocOverrides} */
const tocOverrides = {
  dropLabels: ['Содержание'],
  documents: {
    main: mainTocConf,
    osr: mainTocConf,
  },
}

/** @type {Partial<IDocumentConfig>} */
const mainModuleConf = {
  id: 'main',
  documentTitle: 'Зловещая Изометрия: газетир',
  documentFileName: 'Зловещая Изометрия: газетир ({{version}}).pdf',
  header: 'Зловещая Изометрия: газетир',
  coverHtmlFile: '0000-cover.md',
  backCoverHtmlFile: '9999-back-cover.md',
  include: [],
  skipped: [],
  tocConfig: {
    headersSelector: 'h1:not([data-skip-toc]), h2:not([data-skip-toc]), h3, h4, h5',
    rootClassName: 'toc--main',
    renderMaxLevel: 2,
  },
  tocOverrides: tocOverrides,
  bookmarksConfig: {
    config: 'build/$toc-main.json',
    skipFirstPages: 3,
    skipLastPages: 1,
  },
  buildPartSize: 8,
  buildProcessesNum: 1,
  skipHeaderAndFooter: [-1, 1],
  skipFooter: [],
  macros: [],
}

/** @type {IModuleBuilderConfig} */
const config = {
  version: '2',
  releaseDocumentIds: ['main'],
  template: 'two-columns.html',
  footer: '2026, undefined Okto',
  header: 'Зловещая Изометрия: газетир',
  cssPath: 'build/output.css',
  webServerPort: 3001,
  keepWebServer: true,
  invalidateBuildOnPattern: /\$refs-/,
  skipped: ['$refs-blocks.md', '$refs-stats.md', '$refs-items.md', '$notes.md', 'server.html'],
  referenceFiles: ['src/markdown/$refs-stats.md', 'src/markdown/$refs-items.md', 'src/markdown/$refs-blocks.md'],
  draftWatermarkHtml: '<strong>Черновая версия, не для распространения</strong>',
  chapterRefPattern: 'A-FPQS',
  tocConfig: {
    rootId: 'toc-main',
  },
  skipHeaderAndFooter: [1, -1],
  documents: [/** @type {IDocumentConfig} */ (mainModuleConf)],
}

export default config
