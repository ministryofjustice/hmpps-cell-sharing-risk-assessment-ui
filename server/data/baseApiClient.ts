import { asSystem, asUser, RestClient } from '@ministryofjustice/hmpps-rest-client'
import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'
import { RedisClient } from './redisClient'

export default class BaseApiClient extends RestClient {
  constructor(
    name: string,
    protected readonly redisClient: RedisClient,
    _config: typeof config.apis.csraApi,
    authenticationClient: AuthenticationClient,
  ) {
    super(name, _config, logger, authenticationClient)
  }

  protected apiCall<
    ReturnType extends object | string,
    Parameters extends { [k: string]: string },
    Data extends Record<string, unknown> | string[] | string = undefined,
  >({
    path,
    queryParams,
    requestType,
    options,
  }: {
    path: string
    queryParams?: string[]
    requestType: 'get' | 'post' | 'put' | 'delete' | 'patch'
    options?: {
      cacheDuration?: number
      // When true, calls the API with a system (client-credentials) token stamped with the
      // acting username, rather than the signed-in user's own token. Backend read APIs such as
      // the CSRA API and prisoner-search grant their roles to the system client, so those calls
      // must be made `asSystem`. The func's first argument is then the username, not a token.
      asSystem?: boolean
    }
  }) {
    const func = async (
      tokenOrUsername: string,
      parameters: Parameters = {} as never,
      data: Data = undefined,
    ): Promise<ReturnType> => {
      const filledPath = path.replace(/:(\w+)/g, (_, name) => parameters[name])
      const query = queryParams?.length ? Object.fromEntries(queryParams.map(p => [p, parameters[p]])) : undefined

      const cacheDuration = options?.cacheDuration || 0
      if (cacheDuration && this.redisClient) {
        logger.debug(`Getting ${filledPath} from redis`)
        const cachedResult = await this.redisClient.get(filledPath)

        if (cachedResult) {
          logger.debug(`Found ${filledPath} in redis, value: ${cachedResult}`)

          if (typeof cachedResult === 'string') {
            return JSON.parse(cachedResult)
          }

          return cachedResult as ReturnType
        }
      }

      logger.debug(
        `${requestType.toUpperCase()} ${filledPath} with query ${JSON.stringify(query)} - params ${JSON.stringify(parameters)} - data ${JSON.stringify(data)}`,
      )
      const result = await this[requestType]<ReturnType>(
        {
          path: filledPath,
          query,
          data,
        },
        options?.asSystem ? asSystem(tokenOrUsername) : asUser(tokenOrUsername),
      )

      if (cacheDuration && this.redisClient) {
        logger.debug(`Setting ${filledPath} in redis for ${cacheDuration} seconds, value: ${JSON.stringify(result)}`)

        await this.redisClient.set(filledPath, JSON.stringify(result), { EX: cacheDuration })
      }

      return result
    }
    func.clearCache = async (parameters: Parameters = {} as never) => {
      const filledPath = path.replace(/:(\w+)/g, (_, name) => parameters[name])
      if (this.redisClient) {
        await this.redisClient.del(filledPath)
      }
    }
    return func as typeof func & { clearCache: typeof func.clearCache }
  }
}
