import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import CsraApiClient from './csraApiClient'
import config from '../config'
import { RedisClient } from './redisClient'
import type { CsraCurrentRating } from './csraApiTypes'

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
})
