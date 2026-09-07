import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import PrisonApiSplashClient from './prisonApiSplashClient'
import config from '../config'
import { RedisClient } from './redisClient'
import type { SplashScreen } from './prisonApiTypes'

describe('PrisonApiSplashClient', () => {
  let client: PrisonApiSplashClient
  let mockAuthenticationClient: jest.Mocked<AuthenticationClient>
  const redisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as RedisClient

  const moduleName = 'OCDNOQUE'
  const screen: SplashScreen = {
    moduleName,
    conditions: [{ conditionType: 'CASELOAD', conditionValue: 'MDI', blockAccess: true }],
  }

  beforeEach(() => {
    mockAuthenticationClient = {
      getToken: jest.fn().mockResolvedValue('test-system-token'),
    } as unknown as jest.Mocked<AuthenticationClient>

    client = new PrisonApiSplashClient(redisClient, mockAuthenticationClient)
  })

  afterEach(() => {
    nock.cleanAll()
    jest.resetAllMocks()
  })

  it('should GET a splash screen using a system token stamped with the username', async () => {
    nock(config.apis.prisonApi.url)
      .get(`/api/splash-screen/${moduleName}`)
      .matchHeader('authorization', 'Bearer test-system-token')
      .reply(200, screen)

    expect(await client.getSplashScreen('AUSER_GEN', { moduleName })).toEqual(screen)
    expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith('AUSER_GEN')
  })

  it('should surface a 404 when the splash screen has not been set up', async () => {
    nock(config.apis.prisonApi.url).get(`/api/splash-screen/${moduleName}`).reply(404)

    await expect(client.getSplashScreen('AUSER_GEN', { moduleName })).rejects.toMatchObject({ responseStatus: 404 })
  })

  it('should POST a new caseload condition', async () => {
    nock(config.apis.prisonApi.url)
      .post(`/api/splash-screen/${moduleName}/condition`, {
        conditionType: 'CASELOAD',
        conditionValue: 'MDI',
        blockAccess: true,
      })
      .matchHeader('authorization', 'Bearer test-system-token')
      .reply(200, screen)

    const response = await client.addSplashCondition(
      'AUSER_GEN',
      { moduleName },
      { conditionType: 'CASELOAD', conditionValue: 'MDI', blockAccess: true },
    )

    expect(response).toEqual(screen)
  })

  it('should PUT an updated condition with the new blockAccess in the path', async () => {
    nock(config.apis.prisonApi.url)
      .put(`/api/splash-screen/${moduleName}/condition/CASELOAD/MDI/false`)
      .matchHeader('authorization', 'Bearer test-system-token')
      .reply(200, screen)

    const response = await client.updateSplashCondition('AUSER_GEN', {
      moduleName,
      conditionType: 'CASELOAD',
      conditionValue: 'MDI',
      blockAccess: 'false',
    })

    expect(response).toEqual(screen)
  })

  it('should DELETE a condition', async () => {
    nock(config.apis.prisonApi.url)
      .delete(`/api/splash-screen/${moduleName}/condition/CASELOAD/MDI`)
      .matchHeader('authorization', 'Bearer test-system-token')
      .reply(200, {})

    await expect(
      client.removeSplashCondition('AUSER_GEN', { moduleName, conditionType: 'CASELOAD', conditionValue: 'MDI' }),
    ).resolves.toBeDefined()
  })
})
