import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import PrisonApiAgencySwitchClient from './prisonApiAgencySwitchClient'
import config from '../config'
import { RedisClient } from './redisClient'

describe('PrisonApiAgencySwitchClient', () => {
  let client: PrisonApiAgencySwitchClient
  let mockAuthenticationClient: jest.Mocked<AuthenticationClient>
  const redisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as RedisClient

  const serviceCode = 'CSRA_AUTO_APPROVAL'
  const moorland = { agencyId: 'MDI', name: 'Moorland (HMP)' }

  beforeEach(() => {
    mockAuthenticationClient = {
      getToken: jest.fn().mockResolvedValue('test-system-token'),
    } as unknown as jest.Mocked<AuthenticationClient>

    client = new PrisonApiAgencySwitchClient(redisClient, mockAuthenticationClient)
  })

  afterEach(() => {
    nock.cleanAll()
    jest.resetAllMocks()
  })

  it('should GET the agencies switched on for a service using a system token stamped with the username', async () => {
    nock(config.apis.prisonApi.url)
      .get(`/api/agency-switches/${serviceCode}`)
      .matchHeader('authorization', 'Bearer test-system-token')
      .reply(200, [moorland])

    expect(await client.getAgencySwitches('AUSER_GEN', { serviceCode })).toEqual([moorland])
    expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
  })

  it('should surface a 404 when the service does not exist in NOMIS', async () => {
    nock(config.apis.prisonApi.url).get(`/api/agency-switches/${serviceCode}`).reply(404)

    await expect(client.getAgencySwitches('AUSER_GEN', { serviceCode })).rejects.toMatchObject({
      responseStatus: 404,
    })
  })

  it('should POST to switch a service on for an agency', async () => {
    nock(config.apis.prisonApi.url)
      .post(`/api/agency-switches/${serviceCode}/agency/MDI`)
      .matchHeader('authorization', 'Bearer test-system-token')
      .reply(201, moorland)

    expect(await client.addAgencySwitch('AUSER_GEN', { serviceCode, agencyId: 'MDI' })).toEqual(moorland)
  })

  it('should surface a 409 when the agency is already switched on', async () => {
    nock(config.apis.prisonApi.url).post(`/api/agency-switches/${serviceCode}/agency/MDI`).reply(409)

    await expect(client.addAgencySwitch('AUSER_GEN', { serviceCode, agencyId: 'MDI' })).rejects.toMatchObject({
      responseStatus: 409,
    })
  })

  it('should DELETE to switch a service off for an agency', async () => {
    const scope = nock(config.apis.prisonApi.url)
      .delete(`/api/agency-switches/${serviceCode}/agency/MDI`)
      .matchHeader('authorization', 'Bearer test-system-token')
      .reply(204)

    await client.removeAgencySwitch('AUSER_GEN', { serviceCode, agencyId: 'MDI' })

    expect(scope.isDone()).toBe(true)
  })
})
