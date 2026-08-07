import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import logger from '../../logger'
import { toArray } from '../utils/queryUtils'
import { CsraArrivalType } from '../data/csraApiTypes'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default class RecentArrivalsController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler = async (req, res, next) => {
    const { auditService, csraService } = this.dependencies
    await auditService.logPageView(Page.RECENT_ARRIVALS, { who: res.locals.user.username, correlationId: req.id })

    try {
      const prisonId = res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId
      const arrivalTypes = toArray(req.query.arrivalType)
      const recentArrivals = await csraService.getRecentArrivals(res.locals.user.username, prisonId, {
        days: 3,
        arrivalTypes: arrivalTypes as CsraArrivalType[],
      })
      const { arrivalTypeCounts } = recentArrivals
      const arrivalTypeLabels = {
        NEW_ADMISSION: 'New admissions',
        TRANSFER_IN: 'Transfers in',
        COURT_RETURN: 'Court returns',
        TEMPORARY_ABSENCE_RETURN: 'Temporary absence returns',
      }
      const arrivalTypeOptions = Object.entries(arrivalTypeLabels).map(([value, label]) => ({
        value,
        text: `${label} (${arrivalTypeCounts[value] || 0})`,
        checked: arrivalTypes.includes(value as CsraArrivalType),
      }))

      return res.render('pages/recentArrivals', {
        title: 'People who have arrived in the last 3 days',
        recentArrivals,
        arrivalTypeOptions,
      })
    } catch (error) {
      logger.error('Error fetching prisoners for recent-arrivals page', error)
      return next(error)
    }
  }
}
