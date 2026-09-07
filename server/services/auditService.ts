import HmppsAuditClient, { AuditEvent } from '../data/hmppsAuditClient'

export enum Page {
  INDEX = 'INDEX',
  PRISONER_CSRA = 'PRISONER_CSRA',
  PRISONER_CSRA_HISTORY = 'PRISONER_CSRA_HISTORY',
  PRISONER_CSRA_REVIEW = 'PRISONER_CSRA_REVIEW',
  DUE_FOR_REVIEW = 'DUE_FOR_REVIEW',
  ALL_PRISONERS = 'ALL_PRISONERS',
  ADMIN_PRISONS = 'ADMIN_PRISONS',
  RECENT_ARRIVALS = 'RECENT_ARRIVALS',
  ASSESSMENTS_IN_PROGRESS = 'ASSESSMENTS_IN_PROGRESS',
  REVIEWS_IN_PROGRESS = 'REVIEWS_IN_PROGRESS',
}

/** Auditable admin actions (as opposed to page views), recorded via logAuditEvent. */
export enum AdminAction {
  SET_PRISON_ACTIVE = 'SET_PRISON_ACTIVE',
  SET_NOMIS_CSRA_SCREEN = 'SET_NOMIS_CSRA_SCREEN',
}

export interface PageViewEventDetails {
  who: string
  subjectId?: string
  subjectType?: string
  correlationId?: string
  details?: object
}

export default class AuditService {
  constructor(private readonly hmppsAuditClient: HmppsAuditClient) {}

  async logAuditEvent(event: AuditEvent) {
    await this.hmppsAuditClient.sendMessage(event)
  }

  async logPageView(page: Page, eventDetails: PageViewEventDetails) {
    const event: AuditEvent = {
      ...eventDetails,
      what: `PAGE_VIEW_${page}`,
    }
    await this.hmppsAuditClient.sendMessage(event)
  }
}
