import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import config from '../config'
import { WARRANT_WINDOW_DAYS, type WarrantSort } from '../services/warrantsService'
import logger from '../../logger'

type Dependencies = Pick<Services, 'auditService' | 'warrantsService'>

const parseSort = (value: unknown): WarrantSort => (value === 'earliest' ? 'earliest' : 'recent')

/**
 * The warrants pages are a proof of concept (MAPA-349) behind a config flag, so both routes 404
 * outright when it is off rather than rendering something half-wired.
 */
function assertEnabled() {
  if (!config.warrants.enabled) {
    throw NotFound('Warrants are not enabled')
  }
}

/**
 * "Warrants from the last 30 days": the prisoner's recent court warrants, each linking to its PDF.
 */
export default function csraWarrantsController({
  auditService,
  warrantsService,
}: Dependencies): RequestHandler<{ prisonerNumber: string; assessmentId: string }> {
  return async (req, res) => {
    assertEnabled()

    const { assessmentId } = req.params
    const {
      prisoner,
      user: { username },
    } = res.locals

    const sort = parseSort(req.query.sort)
    const warrants = await warrantsService.getRecentWarrants(username, prisoner.prisonerNumber, sort)

    await auditService.logPageView(Page.PRISONER_CSRA_WARRANTS, {
      who: username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    const basePath = `/prisoner/${prisoner.prisonerNumber}/csra/${assessmentId}`

    res.render('pages/csraWarrants', {
      prisoner,
      warrants,
      sort,
      windowDays: WARRANT_WINDOW_DAYS,
      basePath,
      backLink: basePath,
    })
  }
}

/**
 * Proxy a single warrant PDF through the app, so the browser never needs a backend token.
 *
 * The service only returns a file when the UUID is one of this prisoner's own recent warrants;
 * anything else is a 404. `inline` is set on our response as well as being asked of document-api,
 * since ours is the one the browser actually sees.
 */
export function csraWarrantFileController({ warrantsService }: Pick<Services, 'warrantsService'>): RequestHandler<{
  prisonerNumber: string
  assessmentId: string
  documentId: string
}> {
  return async (req, res) => {
    assertEnabled()

    const { documentId } = req.params
    const {
      prisoner,
      user: { username },
    } = res.locals

    let file
    try {
      file = await warrantsService.getWarrantFile(username, prisoner.prisonerNumber, documentId)
    } catch (error) {
      logger.error(`Could not fetch warrant ${documentId} for ${prisoner.prisonerNumber}`, error)
      throw NotFound('Warrant could not be retrieved')
    }

    if (!file) {
      throw NotFound('Warrant not found')
    }

    res.set('Content-Type', file.contentType)
    res.set('Content-Disposition', 'inline')
    // These are sensitive documents: keep them out of shared caches.
    res.set('Cache-Control', 'private, no-store')
    return res.send(file.body)
  }
}
