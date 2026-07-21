import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import CsraApiClient from './csraApiClient'
import config from '../config'
import { RedisClient } from './redisClient'
import type { CsraCurrentRating, CsraPrisonRatingSummary, CsraReviewHistory } from './csraApiTypes'

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
})
