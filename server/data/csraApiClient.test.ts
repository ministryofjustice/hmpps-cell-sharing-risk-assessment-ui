import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import CsraApiClient from './csraApiClient'
import config from '../config'
import { RedisClient } from './redisClient'
import type {
  AgencyStatus,
  CsraAssessmentsInProgress,
  CsraCurrentRating,
  CsraHighRiskDueForReview,
  CsraPrisonPrisonerList,
  CsraPrisonRatingSummary,
  CsraReviewDetail,
  CsraReviewHistory,
} from './csraApiTypes'

describe('CsraApiClient', () => {
  let csraApiClient: CsraApiClient
  let mockAuthenticationClient: jest.Mocked<AuthenticationClient>
  const redisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as RedisClient

  beforeEach(() => {
    mockAuthenticationClient = {
      getToken: jest.fn().mockResolvedValue('test-system-token'),
    } as unknown as jest.Mocked<AuthenticationClient>

    csraApiClient = new CsraApiClient(redisClient, mockAuthenticationClient)
  })

  afterEach(() => {
    nock.cleanAll()
    jest.resetAllMocks()
  })

  describe('getCurrentCsraRating', () => {
    it('should GET the current rating using a system token stamped with the username', async () => {
      const currentRating: CsraCurrentRating = {
        prisonerNumber: 'A1234BC',
        status: 'COMPLETE',
        rating: 'STANDARD',
        provisional: false,
        riskTo: [],
        vulnerabilities: [],
        finalDate: '2026-07-01',
      }

      nock(config.apis.csraApi.url)
        .get('/csra-review/prisoner/A1234BC/current-rating')
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, currentRating)

      const response = await csraApiClient.getCurrentCsraRating('AUSER_GEN', { prisonerNumber: 'A1234BC' })

      expect(response).toEqual(currentRating)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })

    it('should return a NO_RATING result when the prisoner has no assessment', async () => {
      const noRating: CsraCurrentRating = {
        prisonerNumber: 'A1234BC',
        status: 'NO_RATING',
        rating: null,
        provisional: false,
        riskTo: [],
        vulnerabilities: [],
      }

      nock(config.apis.csraApi.url).get('/csra-review/prisoner/A1234BC/current-rating').reply(200, noRating)

      const response = await csraApiClient.getCurrentCsraRating('AUSER_GEN', { prisonerNumber: 'A1234BC' })

      expect(response.status).toBe('NO_RATING')
      expect(response.rating).toBeNull()
    })
  })

  describe('getAssessmentsInProgress', () => {
    it('should GET in-progress assessments using a system token stamped with the username', async () => {
      const assessmentsInProgress: CsraAssessmentsInProgress = {
        assessmentStarted: [
          {
            reviewId: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
            prisonerNumber: 'A9354JF',
            firstName: 'Simon',
            lastName: 'Kettleby',
            startedOn: '2026-07-06',
            startedBy: 'JBLOGGS',
          },
        ],
        provisionalRatingEntered: [
          {
            reviewId: '6a4fa388-3aae-4c9f-8fc7-fb85ac2ed27f',
            prisonerNumber: 'A5197BD',
            firstName: 'Daniel',
            lastName: 'Havers',
            assessedOn: '2026-07-06',
            assessedBy: 'MSTANLEY',
            rating: 'HIGH_SPECIFIC',
          },
        ],
      }

      nock(config.apis.csraApi.url)
        .get('/csra-review/prison/MDI/assessments-in-progress')
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, assessmentsInProgress)

      const response = await csraApiClient.getAssessmentsInProgress('AUSER_GEN', { prisonId: 'MDI' })

      expect(response).toEqual(assessmentsInProgress)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })
  })

  describe('getCsraHistory', () => {
    const history: CsraReviewHistory = {
      summary: {
        totalCsras: 2,
        highCount: 1,
        standardCount: 1,
        firstAssessmentDate: '2020-01-01',
        lastAssessmentDate: '2024-07-23',
        lastHighDate: '2024-07-23',
      },
      content: [
        {
          id: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
          type: 'REVIEW',
          rating: 'HIGH_SPECIFIC',
          recordedDate: '2024-07-23',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 2,
      totalPages: 1,
    }

    it('should GET the history with paging + filters as query params, using a system token', async () => {
      nock(config.apis.csraApi.url)
        .get('/csra-review/prisoner/A1234BC/history')
        .query({
          page: '0',
          size: '20',
          ratings: ['HIGH', 'STANDARD'],
          establishments: ['LEI', 'MDI'],
          fromDate: '2020-01-01',
          toDate: '2024-12-31',
        })
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, history)

      const response = await csraApiClient.getCsraHistory('AUSER_GEN', {
        prisonerNumber: 'A1234BC',
        page: '0',
        size: '20',
        ratings: ['HIGH', 'STANDARD'],
        establishments: ['LEI', 'MDI'],
        fromDate: '2020-01-01',
        toDate: '2024-12-31',
      })

      expect(response).toEqual(history)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })

    it('should omit undefined filter query params', async () => {
      // nock only matches the exact query below, so this fails if fromDate/toDate/ratings are sent.
      nock(config.apis.csraApi.url)
        .get('/csra-review/prisoner/A1234BC/history')
        .query({ page: '0', size: '20' })
        .reply(200, history)

      const response = await csraApiClient.getCsraHistory('AUSER_GEN', {
        prisonerNumber: 'A1234BC',
        page: '0',
        size: '20',
      })

      expect(response).toEqual(history)
    })
  })

  describe('getCsraReview', () => {
    const reviewId = 'de91dfa7-821f-4552-a427-bf2f32eafeb0'

    it('should GET a single review using a system token stamped with the username', async () => {
      const detail: CsraReviewDetail = {
        id: reviewId,
        prisonerNumber: 'A1234BC',
        prisonId: 'LEI',
        prisonName: 'Leeds (HMP)',
        assessmentDate: '2016-10-31',
        type: 'REVIEW',
        createdAt: '2016-10-31T09:15:00',
        createdBy: 'NQP56Y',
        legacy: {
          level: 'HI',
          approvedResult: 'HI',
          calculatedResult: 'STANDARD',
          assessmentCommittee: { code: 'RECP', name: 'Reception' },
          questions: [{ question: 'Select Risk Rating', answer: 'High', additionalAnswers: [] }],
        },
      }

      nock(config.apis.csraApi.url)
        .get(`/csra-review/${reviewId}`)
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, detail)

      const response = await csraApiClient.getCsraReview('AUSER_GEN', { id: reviewId })

      expect(response).toEqual(detail)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })

    it('should reject with a responseStatus of 404 when the review is unknown', async () => {
      // Not `status`: the rest client sanitises errors into a shape that names it responseStatus, and
      // the controller has to branch on that to turn an unknown id into a not-found page.
      nock(config.apis.csraApi.url).get(`/csra-review/${reviewId}`).reply(404)

      await expect(csraApiClient.getCsraReview('AUSER_GEN', { id: reviewId })).rejects.toMatchObject({
        responseStatus: 404,
      })
    })
  })

  describe('getRatingSummary', () => {
    it('should GET prison rating summary using a system token stamped with the username', async () => {
      const ratingSummary: CsraPrisonRatingSummary = {
        prisonId: 'MDI',
        total: 1015,
        noRating: 3,
        highRisk: 217,
        standardRisk: 795,
      }

      nock(config.apis.csraApi.url)
        .get('/csra-review/prison/MDI/rating-summary')
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, ratingSummary)

      const response = await csraApiClient.getRatingSummary('AUSER_GEN', { prisonId: 'MDI' })

      expect(response).toEqual(ratingSummary)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })
  })

  describe('getHighRiskDueForReview', () => {
    it('should GET the high-risk due-for-review list using a system token', async () => {
      const dueForReview: CsraHighRiskDueForReview = {
        content: [
          {
            prisonerNumber: 'A1234BC',
            firstName: 'Callum',
            lastName: 'Reid',
            reviewDueBy: '2026-06-29',
            ratingType: 'HIGH_GENERAL',
            rating: 'HIGH_GENERAL',
            provisional: false,
            lastRatingSource: 'REVIEW',
            lastRatingDate: '2025-06-24',
          },
        ],
        totalResults: 1,
        availableRatingTypes: ['HIGH_GENERAL'],
      }

      nock(config.apis.csraApi.url)
        .get('/csra-review/prison/MDI/high-risk-due-for-review')
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, dueForReview)

      const response = await csraApiClient.getHighRiskDueForReview('AUSER_GEN', { prisonId: 'MDI' })

      expect(response).toEqual(dueForReview)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })

    it('should pass filter query params when provided', async () => {
      nock(config.apis.csraApi.url)
        .get('/csra-review/prison/MDI/high-risk-due-for-review')
        .query({
          ratingTypes: ['HIGH', 'HIGH_SPECIFIC'],
          reviewDateFrom: '2026-01-01',
          sort: 'NAME',
          direction: 'DESC',
        })
        .reply(200, { content: [], totalResults: 0, availableRatingTypes: [] })

      const response = await csraApiClient.getHighRiskDueForReview('AUSER_GEN', {
        prisonId: 'MDI',
        ratingTypes: ['HIGH', 'HIGH_SPECIFIC'],
        reviewDateFrom: '2026-01-01',
        sort: 'NAME',
        direction: 'DESC',
      })

      expect(response.content).toEqual([])
    })
  })

  describe('getPrisonPrisoners', () => {
    const prisonerList: CsraPrisonPrisonerList = {
      content: [
        {
          prisonerNumber: 'A1234BC',
          firstName: 'Matthew',
          lastName: 'Doyle',
          rating: 'STANDARD',
          provisional: false,
          assessmentType: 'ASSESSMENT',
          assessedOn: '2026-03-05',
        },
      ],
      page: 0,
      size: 25,
      totalElements: 1,
      totalPages: 1,
    }

    it('should GET the prisoner list using a system token stamped with the username', async () => {
      nock(config.apis.csraApi.url)
        .get('/csra-review/prison/MDI/prisoners')
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, prisonerList)

      const response = await csraApiClient.getPrisonPrisoners('AUSER_GEN', { prisonId: 'MDI' })

      expect(response).toEqual(prisonerList)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })

    it('should pass all filter and sort query params when provided', async () => {
      nock(config.apis.csraApi.url)
        .get('/csra-review/prison/MDI/prisoners')
        .query({
          page: '0',
          size: '25',
          sort: 'RATING',
          direction: 'DESC',
          ratings: ['HIGH', 'HIGH_GENERAL'],
          assessmentTypes: ['ASSESSMENT', 'REVIEW'],
          fromDate: '2026-01-01',
          toDate: '2026-12-31',
        })
        .reply(200, prisonerList)

      const response = await csraApiClient.getPrisonPrisoners('AUSER_GEN', {
        prisonId: 'MDI',
        page: 0,
        size: 25,
        sort: 'RATING',
        direction: 'DESC',
        ratings: ['HIGH', 'HIGH_GENERAL'],
        assessmentTypes: ['ASSESSMENT', 'REVIEW'],
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      })

      expect(response).toEqual(prisonerList)
    })

    it('should omit undefined filter query params', async () => {
      // nock only matches the exact query below, so this fails if any extra params are sent
      nock(config.apis.csraApi.url)
        .get('/csra-review/prison/MDI/prisoners')
        .query({ page: '0', size: '25' })
        .reply(200, prisonerList)

      const response = await csraApiClient.getPrisonPrisoners('AUSER_GEN', {
        prisonId: 'MDI',
        page: 0,
        size: 25,
      })

      expect(response).toEqual(prisonerList)
    })
  })

  describe('rollout admin', () => {
    const agencies: AgencyStatus[] = [
      { agencyId: 'LEI', name: 'Leeds (HMP)', active: false },
      { agencyId: 'MDI', name: 'Moorland (HMP)', active: true },
    ]

    it('should GET all agencies using a system token stamped with the username', async () => {
      nock(config.apis.csraApi.url)
        .get('/active-agencies/all')
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, agencies)

      const response = await csraApiClient.getAllAgencies('AUSER_GEN', {})

      expect(response).toEqual(agencies)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })

    it('should PUT the new active state for an agency', async () => {
      const updated: AgencyStatus = { agencyId: 'MDI', name: 'Moorland (HMP)', active: true }

      nock(config.apis.csraApi.url)
        .put('/active-agencies/MDI', { active: true })
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, updated)

      const response = await csraApiClient.setAgencyActive('AUSER_GEN', { agencyId: 'MDI' }, { active: true })

      expect(response).toEqual(updated)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })

    it('should read the active agency ids from the public info endpoint without a token', async () => {
      nock(config.apis.csraApi.url)
        .get('/info')
        .reply(200, { build: { name: 'csra-api' }, activeAgencies: ['LEI', 'MDI'] })

      expect(await csraApiClient.getActiveAgencyIds()).toEqual(['LEI', 'MDI'])
      expect(mockAuthenticationClient.getToken).not.toHaveBeenCalled()
    })

    it('should default to no active agencies when info omits the key', async () => {
      nock(config.apis.csraApi.url)
        .get('/info')
        .reply(200, { build: { name: 'csra-api' } })

      expect(await csraApiClient.getActiveAgencyIds()).toEqual([])
    })
  })
})
