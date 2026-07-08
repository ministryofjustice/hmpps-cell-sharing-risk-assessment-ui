import PrisonerSearchService from './prisonerSearchService'
import { PrisonerSearchApiClient } from '../data'
import type { Prisoner } from '../data/prisonerSearchApiTypes'

jest.mock('../data')

describe('PrisonerSearchService', () => {
  let prisonerSearchApiClient: jest.Mocked<PrisonerSearchApiClient>
  let prisonerSearchService: PrisonerSearchService

  beforeEach(() => {
    prisonerSearchApiClient = { getPrisoner: jest.fn() } as unknown as jest.Mocked<PrisonerSearchApiClient>
    prisonerSearchService = new PrisonerSearchService(prisonerSearchApiClient)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getPrisoner', () => {
    it('delegates to the client, passing the username and prisoner number', async () => {
      const prisoner = { prisonerNumber: 'A1234BC', firstName: 'JOHN', lastName: 'SMITH' } as Prisoner
      ;(prisonerSearchApiClient.getPrisoner as unknown as jest.Mock).mockResolvedValue(prisoner)

      const result = await prisonerSearchService.getPrisoner('AUSER_GEN', 'A1234BC')

      expect(result).toEqual(prisoner)
      expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith('AUSER_GEN', { prisonerNumber: 'A1234BC' })
    })
  })
})
