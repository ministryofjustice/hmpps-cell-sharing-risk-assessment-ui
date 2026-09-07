import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import { RedisClient } from './redisClient'
import ManageUsersApiClient from './manageUsersApiClient'
import type { UserDetails } from './manageUsersApiTypes'

describe('ManageUsersApiClient', () => {
  let manageUsersApiClient: ManageUsersApiClient
  let mockAuthenticationClient: jest.Mocked<AuthenticationClient>
  const redisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as RedisClient

  beforeEach(() => {
    mockAuthenticationClient = {
      getToken: jest.fn().mockResolvedValue('test-user-token'),
    } as unknown as jest.Mocked<AuthenticationClient>

    manageUsersApiClient = new ManageUsersApiClient(redisClient, mockAuthenticationClient)
  })

  afterEach(() => {
    nock.cleanAll()
    jest.resetAllMocks()
  })

  describe('getUserDetails', () => {
    it('should GET user details using a system token stamped with the acting username', async () => {
      const userDetails: UserDetails = {
        username: 'JBLOGGS',
        name: 'Joe Bloggs',
        active: true,
        authSource: 'nomis',
        userId: '231232',
      }

      nock(config.apis.manageUsersApi.url)
        .get('/users/JBLOGGS')
        .matchHeader('authorization', 'Bearer test-user-token')
        .reply(200, userDetails)

      const response = await manageUsersApiClient.getUserDetails('AUSER_GEN', { username: 'JBLOGGS' })

      expect(response).toEqual(userDetails)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
    })
  })
})
