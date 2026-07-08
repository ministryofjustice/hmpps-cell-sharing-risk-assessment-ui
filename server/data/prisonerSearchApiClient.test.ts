import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import PrisonerSearchApiClient from './prisonerSearchApiClient'
import config from '../config'
import { RedisClient } from './redisClient'
import type { Prisoner } from './prisonerSearchApiTypes'

describe('PrisonerSearchApiClient', () => {
  let prisonerSearchApiClient: PrisonerSearchApiClient
  let mockAuthenticationClient: jest.Mocked<AuthenticationClient>
  const redisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as RedisClient

  beforeEach(() => {
    mockAuthenticationClient = {
      getToken: jest.fn().mockResolvedValue('test-system-token'),
    } as unknown as jest.Mocked<AuthenticationClient>

    prisonerSearchApiClient = new PrisonerSearchApiClient(redisClient, mockAuthenticationClient)
  })

  afterEach(() => {
    nock.cleanAll()
    jest.resetAllMocks()
  })

  describe('getPrisoner', () => {
    it('should GET the prisoner using a system token stamped with the username', async () => {
      const prisoner: Prisoner = {
        prisonerNumber: 'A1234BC',
        firstName: 'JOHN',
        lastName: 'SMITH',
        prisonId: 'MDI',
        prisonName: 'Moorland (HMP)',
        cellLocation: 'A-1-001',
      }

      nock(config.apis.prisonerSearchApi.url)
        .get('/prisoner/A1234BC')
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, prisoner)

      const response = await prisonerSearchApiClient.getPrisoner('AUSER_GEN', { prisonerNumber: 'A1234BC' })

      expect(response).toEqual(prisoner)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })
  })
})
