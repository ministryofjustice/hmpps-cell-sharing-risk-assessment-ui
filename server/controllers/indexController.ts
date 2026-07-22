import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import logger from '../../logger'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default function indexController({ auditService, csraService }: Dependencies): RequestHandler {
  return async (req, res) => {
    await auditService.logPageView(Page.INDEX, { who: res.locals.user.username, correlationId: req.id })

    let stats: { noRating: string | number; highRisk: string | number; standardRisk: string | number } = {
      noRating: '-',
      highRisk: '-',
      standardRisk: '-',
    }

    try {
      stats = await csraService.getRatingSummary(
        res.locals.user.username,
        res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId,
      )
    } catch (error) {
      logger.error('Error fetching prisoner ratings for index page', error)
    }

    return res.render('pages/index', {
      title: 'Cell sharing risk assessment (CSRA)',
      cardsSections: [
        {
          subheading: 'Start and complete assessments',
          cards: [
            {
              heading: 'Recent arrivals',
              description: 'View recently arrived prisoners who may need an assessment.',
              href: '/recent-arrivals',
              clickable: true,
            },
            {
              heading: 'Assessments in progress',
              description: 'View prisoners who have an assessment in progress.',
              href: '/assessments-in-progress',
              clickable: true,
            },
          ],
        },
        {
          subheading: 'View upcoming and incomplete reviews',
          cards: [
            {
              heading: 'High risk prisoners due for review',
              description: 'View prisoners with a scheduled cell sharing risk review.',
              href: '/due-for-review',
              clickable: true,
            },
            {
              heading: 'Reviews in progress',
              description: 'Continue incomplete cell sharing risk reviews for prisoners.',
              href: '/reviews-in-progress',
              clickable: true,
            },
          ],
        },
      ],
      establishmentName: res.locals.feComponents?.sharedData?.activeCaseLoad?.description ?? 'Unknown establishment',
      stats: {
        noRating: String(stats.noRating),
        highRisk: String(stats.highRisk),
        standardRisk: String(stats.standardRisk),
      },
    })
  }
}
