/* eslint-disable no-param-reassign */
import path from 'path'
import nunjucks from 'nunjucks'
import express from 'express'
import fs from 'fs'
import { isFunction } from 'lodash-es'
import {
  arrivalTypeLabel,
  formatLocation,
  convertToTitleCase,
  csraLevelLabel,
  csraRatingLabel,
  csraRatingTagClass,
  csraStatusLabel,
  csraTypeLabel,
  daysOverdue,
  enumLabel,
  formatDate,
  formatDateTime,
  formatTime,
  formatMonthYear,
  initialiseName,
  formatDayMonth,
  formatDayMonthYear,
} from './utils'
import { userDisplayName } from './populateUserDisplayNames'
import config from '../config'
import logger from '../../logger'

export default function nunjucksSetup(app: express.Express): void {
  app.set('view engine', 'njk')
  const isProduction = process.env.NODE_ENV === 'production'
  const isTest = process.env.NODE_ENV === 'test'

  app.locals.asset_path = '/assets/'
  app.locals.applicationName = 'Cell Sharing Risk Assessment'
  app.locals.dpsUrl = config.serviceUrls.digitalPrison
  app.locals.environmentName = config.environmentName
  app.locals.environmentNameColour = config.environmentName === 'PRE-PRODUCTION' ? 'govuk-tag--green' : ''
  let assetManifest: Record<string, string> = {}

  try {
    const assetMetadataPath = path.resolve(__dirname, '../../assets/manifest.json')
    assetManifest = JSON.parse(fs.readFileSync(assetMetadataPath, 'utf8'))
  } catch (e) {
    if (process.env.NODE_ENV !== 'test') {
      logger.error(e, 'Could not read asset manifest file')
    }
  }

  const njkEnv = nunjucks.configure(
    [
      path.join(__dirname, '../../server/views'),
      'node_modules/govuk-frontend/dist/',
      'node_modules/govuk-frontend/dist/components/',
      'node_modules/@ministryofjustice/frontend/',
      'node_modules/@ministryofjustice/frontend/moj/components/',
      'node_modules/@ministryofjustice/hmpps-connect-dps-components/dist/assets/',
    ],
    {
      autoescape: true,
      express: app,
      watch: !isProduction && !isTest,
      noCache: !isProduction,
    },
  )

  function callAsMacro(name: string) {
    const macro = this.ctx[name]

    if (!isFunction(macro)) {
      // eslint-disable-next-line no-console
      console.log(`'${name}' macro does not exist`)
      return () => ''
    }

    return macro
  }

  njkEnv.addGlobal('callAsMacro', callAsMacro)

  njkEnv.addFilter('initialiseName', initialiseName)
  njkEnv.addFilter('assetMap', (url: string) => assetManifest[url] || url)
  njkEnv.addFilter('convertToTitleCase', convertToTitleCase)
  njkEnv.addFilter('formatDate', formatDate)
  njkEnv.addFilter('formatDateTime', formatDateTime)
  njkEnv.addFilter('formatTime', formatTime)
  njkEnv.addFilter('formatMonthYear', formatMonthYear)
  njkEnv.addFilter('formatDayMonth', formatDayMonth)
  njkEnv.addFilter('formatDayMonthYear', formatDayMonthYear)
  njkEnv.addFilter('formatLocation', formatLocation)
  njkEnv.addFilter('daysOverdue', daysOverdue)
  njkEnv.addFilter('csraRatingLabel', csraRatingLabel)
  njkEnv.addFilter('csraLevelLabel', csraLevelLabel)
  njkEnv.addFilter('csraRatingTagClass', csraRatingTagClass)
  njkEnv.addFilter('csraStatusLabel', csraStatusLabel)
  njkEnv.addFilter('csraTypeLabel', csraTypeLabel)
  njkEnv.addFilter('arrivalTypeLabel', arrivalTypeLabel)
  njkEnv.addFilter('enumLabel', enumLabel)
  njkEnv.addFilter('userDisplayName', userDisplayName)
}
