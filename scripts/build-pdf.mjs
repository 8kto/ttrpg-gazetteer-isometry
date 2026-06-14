#!/bin/env node
import chalk from 'chalk'
import fs from 'fs-extra'
import toc from 'html-toc'
import path from 'path'
import puppeteer from 'puppeteer'
import { fileURLToPath } from 'url'

import globalConfig from '../global.conf.js'
import packageConfig from '../package.json' assert { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baseIncludesPath = `${__dirname}/../src`
const buildPdfFolderPath = path.join(__dirname, '../build/chunks-pdf')
const buildHtmlFolderPath = path.join(__dirname, '../build/chunks-html')

const COVER_HTML_FILE = '0000-cover.md.html'
const BACK_COVER_HTML_FILE = '9999-back-cover.md.html'
const SKIPPED_FILES = [COVER_HTML_FILE, BACK_COVER_HTML_FILE, 'server.html']

/**
 * @param {string} html
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
const createDocumentContentPdf = async (html, outputPath) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: null, // Otherwise it defaults to 800x600
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-fullscreen', '--lang=ru-RU,ru'],
  })

  const page = await browser.newPage()
  // Redirect logs from browser page to the console
  page.on('console', (msg) => {
    // eslint-disable-next-line no-console
    console.log('PAGE LOG:', msg.text())
  })
  page.on('requestfailed', (request) => {
    console.error(`Failed request URL: ${request.url()} Reason: ${request.failure().errorText}`)
  })

  try {
    await page.setViewport({ width: 1280, height: 720 })
    await page.setContent(html, { waitUntil: 'networkidle0' }) // Wait for no in-flight network requests
    await page.addStyleTag({ path: path.join(__dirname, '../build/output.css') })

    // Ensure all fonts are loaded
    await page.evaluateHandle('document.fonts.ready')

    // Load header and footer templates
    const [templateHeader, templateFooter] = await Promise.all([
      fs.readFile(`${baseIncludesPath}/html/fragments/header.html`, 'utf-8'),
      fs.readFile(`${baseIncludesPath}/html/fragments/footer.html`, 'utf-8'),
    ])

    // Generate PDF
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: templateHeader.replace('{{header}}', globalConfig.header),
      footerTemplate: templateFooter.replace('{{footer}}', globalConfig.footer),
    })
  } catch (err) {
    console.error(err)
  } finally {
    await browser.close()
  }
}

/**
 * @param {string} filename
 * @returns {boolean}
 */
const shouldSkipFile = (filename) => {
  return !filename.endsWith('.html') || SKIPPED_FILES.includes(filename)
}

/**
 * @param {string} fileName
 * @param {string} pageContent
 * @returns {string}
 */
const getPageTemplate = (fileName, pageContent) => {
  let fullHtmlContent = ''

  fullHtmlContent += `<div class="page--${fileName.replace('.md.html', '')}">`
  fullHtmlContent += pageContent
  fullHtmlContent += `</div>`
  fullHtmlContent += `<div class="page-delimiter"></div>`
  fullHtmlContent += `</div>`

  return fullHtmlContent
}

/**
 * @param {string} content
 * @returns {string}
 */
const getFullPageTemplate = (content) => {
  return `<div class="page-bg"></div><div class="full-content-container">${content}</div>`
}

const main = async () => {
  console.info(chalk.green('Building PDF...'))

  if (!fs.existsSync(buildPdfFolderPath)) {
    fs.mkdirSync(buildPdfFolderPath)
  }

  const version = packageConfig.version
  const outputFilename = globalConfig.documentFileName.replace('{{version}}', version)
  const outputFilenamePath = path.join(buildPdfFolderPath, '..', outputFilename)

  try {
    const coverHtmlPath = path.join(buildHtmlFolderPath, COVER_HTML_FILE)
    const backCoverHtmlPath = path.join(buildHtmlFolderPath, BACK_COVER_HTML_FILE)
    const [coverContent, backCoverContent] = await Promise.all([
      fs.readFile(coverHtmlPath, 'utf8'),
      fs.readFile(backCoverHtmlPath, 'utf8'),
    ])

    let fullHtmlContent = getPageTemplate(COVER_HTML_FILE, coverContent)

    const htmlFiles = await fs.readdir(buildHtmlFolderPath)
    htmlFiles.sort((a, b) => a.localeCompare(b))
    for (const file of htmlFiles) {
      if (shouldSkipFile(file)) {
        continue
      }
      const content = await fs.readFile(path.join(buildHtmlFolderPath, file), 'utf8')
      fullHtmlContent += getPageTemplate(file, content)
    }

    fullHtmlContent += getPageTemplate(BACK_COVER_HTML_FILE, backCoverContent)

    const shouldInsertToc = false
    if (shouldInsertToc) {
      fullHtmlContent = toc(fullHtmlContent, {
        id: '#doc-toc',
        selectors: 'h1, h2, h3',
        // slugger: function (text, ...rest) {
        //   console.log({ text, rest })
        //   return slugify(text, { trim: true, lowercase: true })
        // },
        parentLink: false,
        addID: false,
      })
      await fs.writeFile(path.join(buildHtmlFolderPath, 'doc-toc.html'), fullHtmlContent)
    }

    await createDocumentContentPdf(getFullPageTemplate(fullHtmlContent), outputFilenamePath)

    console.info(chalk.blueBright(`Generated PDF document for ${outputFilenamePath}`))
  } catch (error) {
    console.error(error.stack)
    console.error(chalk.red('Error during build:'), error)
  }
}

void main()
