import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import config from '../config'
import type { WarrantSort } from '../services/warrantsService'
import logger from '../../logger'
import { buildPagination, parsePageNumber } from '../utils/utils'

type Dependencies = Pick<Services, 'auditService' | 'warrantsService'>

const WARRANTS_PAGE_SIZE = 20

const parseSort = (value: unknown): WarrantSort => (value === 'earliest' ? 'earliest' : 'recent')

/**
 * Both warrants routes return 404 when the feature flag is off.
 */
function assertEnabled() {
  if (!config.warrants.enabled) {
    throw NotFound('Warrants are not enabled')
  }
}

/**
 * "Warrants available in DPS": all of the prisoner's court warrants, each linking to its PDF.
 */
export default function csraWarrantsController({
  auditService,
  warrantsService,
}: Dependencies): RequestHandler<{ prisonerNumber: string; assessmentId?: string }> {
  return async (req, res) => {
    assertEnabled()

    const { assessmentId } = req.params
    const {
      prisoner,
      user: { username },
    } = res.locals

    const sort = parseSort(req.query.sort)
    const warrants = await warrantsService.getWarrants(username, prisoner.prisonerNumber, sort)
    // Standalone access has no assessment to return to, so use the prisoner's CSRA page.
    const basePath = assessmentId
      ? `/prisoner/${prisoner.prisonerNumber}/csra/${assessmentId}`
      : `/prisoner/${prisoner.prisonerNumber}`

    if (warrants.length === 0) {
      res.redirect(basePath)
      return
    }

    const totalPages = Math.ceil(warrants.length / WARRANTS_PAGE_SIZE)
    const requestedPage = parsePageNumber(req.query.page)
    const page = Math.min(requestedPage, Math.max(1, totalPages))
    if (page !== requestedPage) {
      logger.warn('Warrants page number is out of range; using page %s', page)
    }
    const pagination = buildPagination(page, totalPages, warrants.length, WARRANTS_PAGE_SIZE, `sort=${sort}`)

    await auditService.logPageView(Page.PRISONER_CSRA_WARRANTS, {
      who: username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    res.render('pages/csraWarrants', {
      prisoner,
      // The court API is unpaged, so slice only after all warrants have been filtered and sorted.
      warrants: warrants.slice((page - 1) * WARRANTS_PAGE_SIZE, page * WARRANTS_PAGE_SIZE),
      pagination: totalPages > 1 ? pagination : null,
      results: pagination.results,
      sort,
      basePath,
      backLink: basePath,
      returnLinkText: assessmentId ? 'Return to assessment' : 'Return to CSRA',
    })
  }
}

/**
 * Proxy a single warrant PDF through the app, so the browser never needs a backend token.
 *
 * The service only returns a file when the UUID is one of this prisoner's own warrants;
 * anything else is a 404. `inline` is set on our response as well as being asked of document-api,
 * since ours is the one the browser actually sees.
 */
export function csraWarrantFileController({ warrantsService }: Pick<Services, 'warrantsService'>): RequestHandler<{
  prisonerNumber: string
  assessmentId?: string
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
