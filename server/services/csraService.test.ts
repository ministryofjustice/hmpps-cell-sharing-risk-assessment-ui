import CsraService from './csraService'
import { CsraApiClient } from '../data'
import type { CsraCurrentRating } from '../data/csraApiTypes'

jest.mock('../data')

describe('CsraService', () => {
  let csraApiClient: jest.Mocked<CsraApiClient>
  let csraService: CsraService

  beforeEach(() => {
    csraApiClient = { getCurrentCsraRating: jest.fn() } as unknown as jest.Mocked<CsraApiClient>
    csraService = new CsraService(csraApiClient)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getCurrentRating', () => {
    it('delegates to the client, passing the username and prisoner number', async () => {
      const currentRating = { prisonerNumber: 'A1234BC', status: 'COMPLETE' } as CsraCurrentRating
      ;(csraApiClient.getCurrentCsraRating as unknown as jest.Mock).mockResolvedValue(currentRating)

      const result = await csraService.getCurrentRating('AUSER_GEN', 'A1234BC')

      expect(result).toEqual(currentRating)
      expect(csraApiClient.getCurrentCsraRating).toHaveBeenCalledWith('AUSER_GEN', { prisonerNumber: 'A1234BC' })
    })
  })
})
