import nock from 'nock'
// import CsraApiClient from './csraApiClient'
// import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
// import { createClient } from 'redis'
// import LocationsApiClient from './locationsApiClient'
// import { redisClient } from './redisClient'

describe('CsraApiClient', () => {
  // let csraApiClient: CsraApiClient
  // let mockAuthenticationClient: jest.Mocked<AuthenticationClient>

  beforeEach(() => {
    // mockAuthenticationClient = {
    //   getToken: jest.fn().mockResolvedValue('test-system-token'),
    // } as unknown as jest.Mocked<AuthenticationClient>
    // csraApiClient = new LocationsApiClient(
    //   redisClient as unknown as ReturnType<typeof createClient>,
    //   mockAuthenticationClient,
    // )
  })

  afterEach(() => {
    nock.cleanAll()
    jest.resetAllMocks()
  })

  it.skip('should test something', () => {})
})
