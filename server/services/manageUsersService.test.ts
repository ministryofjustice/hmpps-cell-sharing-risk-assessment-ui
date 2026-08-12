import ManageUsersService from './manageUsersService'
import { ManageUsersApiClient } from '../data'
import type { UserDetails } from '../data/manageUsersApiTypes'

jest.mock('../data')

describe('ManageUsersService', () => {
  let manageUsersApiClient: jest.Mocked<ManageUsersApiClient>
  let manageUsersService: ManageUsersService

  beforeEach(() => {
    manageUsersApiClient = {
      getUserCaseloads: jest.fn(),
      getUserDetails: jest.fn(),
    } as unknown as jest.Mocked<ManageUsersApiClient>

    manageUsersService = new ManageUsersService(manageUsersApiClient)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getUserDetails', () => {
    it('delegates to the client, passing acting username and target username', async () => {
      const userDetails: UserDetails = {
        username: 'JBLOGGS',
        name: 'Joe Bloggs',
        active: true,
        authSource: 'nomis',
        userId: '231232',
      }
      ;(manageUsersApiClient.getUserDetails as unknown as jest.Mock).mockResolvedValue(userDetails)

      const result = await manageUsersService.getUserDetails('AUSER_GEN', 'JBLOGGS')

      expect(result).toEqual(userDetails)
      expect(manageUsersApiClient.getUserDetails).toHaveBeenCalledWith('AUSER_GEN', { username: 'JBLOGGS' })
    })
  })
})
