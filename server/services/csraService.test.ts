import CsraService from './csraService'
import { CsraApiClient } from '../data'
import type {
  CsraCurrentRating,
  CsraHighRiskDueForReview,
  CsraPrisonPrisonerList,
  CsraPrisonRatingSummary,
  CsraRecentArrivals,
  CsraReviewHistory,
} from '../data/csraApiTypes'

jest.mock('../data')

describe('CsraService', () => {
  let csraApiClient: jest.Mocked<CsraApiClient>
  let csraService: CsraService

  beforeEach(() => {
    csraApiClient = {
      getCurrentCsraRating: jest.fn(),
      getCsraHistory: jest.fn(),
      getRatingSummary: jest.fn(),
      getHighRiskDueForReview: jest.fn(),
      getPrisonPrisoners: jest.fn(),
      getRecentArrivals: jest.fn(),
    } as unknown as jest.Mocked<CsraApiClient>
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

  describe('getHistory', () => {
    it('delegates to the client, passing the username, prisoner number and query', async () => {
      const history = { summary: { totalCsras: 0 }, content: [] } as unknown as CsraReviewHistory
      ;(csraApiClient.getCsraHistory as unknown as jest.Mock).mockResolvedValue(history)

      const query = { page: '0', size: '20', ratings: ['HIGH'] }
      const result = await csraService.getHistory('AUSER_GEN', 'A1234BC', query)

      expect(result).toEqual(history)
      expect(csraApiClient.getCsraHistory).toHaveBeenCalledWith('AUSER_GEN', { prisonerNumber: 'A1234BC', ...query })
    })
  })

  describe('getRatingSummary', () => {
    it('delegates to the client, passing the username and prison id', async () => {
      const ratingSummary = {
        prisonId: 'MDI',
        total: 1015,
        noRating: 3,
        highRisk: 217,
        standardRisk: 795,
      } as unknown as CsraPrisonRatingSummary
      ;(csraApiClient.getRatingSummary as unknown as jest.Mock).mockResolvedValue(ratingSummary)

      const result = await csraService.getRatingSummary('AUSER_GEN', 'MDI')

      expect(result).toEqual(ratingSummary)
      expect(csraApiClient.getRatingSummary).toHaveBeenCalledWith('AUSER_GEN', { prisonId: 'MDI' })
    })
  })

  describe('getHighRiskDueForReview', () => {
    it('delegates to the client, passing the username, prison id and query', async () => {
      const dueForReview = {
        content: [{ prisonerNumber: 'A1234BC', reviewDueBy: '2026-06-29' }],
        totalResults: 1,
        availableRatingTypes: ['HIGH'],
      } as unknown as CsraHighRiskDueForReview
      ;(csraApiClient.getHighRiskDueForReview as unknown as jest.Mock).mockResolvedValue(dueForReview)

      const result = await csraService.getHighRiskDueForReview('AUSER_GEN', 'MDI', { ratingTypes: ['HIGH'] })

      expect(result).toEqual(dueForReview)
      expect(csraApiClient.getHighRiskDueForReview).toHaveBeenCalledWith('AUSER_GEN', {
        prisonId: 'MDI',
        ratingTypes: ['HIGH'],
      })
    })

    it('uses an empty query when none is passed', async () => {
      ;(csraApiClient.getHighRiskDueForReview as unknown as jest.Mock).mockResolvedValue({
        content: [],
        totalResults: 0,
        availableRatingTypes: [],
      })

      await csraService.getHighRiskDueForReview('AUSER_GEN', 'MDI')

      expect(csraApiClient.getHighRiskDueForReview).toHaveBeenCalledWith('AUSER_GEN', { prisonId: 'MDI' })
    })
  })

  describe('getPrisonPrisoners', () => {
    const prisonerList: CsraPrisonPrisonerList = {
      content: [{ prisonerNumber: 'A1234BC', provisional: false }],
      page: 0,
      size: 25,
      totalElements: 1,
      totalPages: 1,
    }

    it('delegates to the client, passing the username, prison id and query', async () => {
      ;(csraApiClient.getPrisonPrisoners as unknown as jest.Mock).mockResolvedValue(prisonerList)

      const query = { page: 0, size: 25, ratings: ['HIGH'], sort: 'RATING', direction: 'DESC' }
      const result = await csraService.getPrisonPrisoners('AUSER_GEN', 'MDI', query)

      expect(result).toEqual(prisonerList)
      expect(csraApiClient.getPrisonPrisoners).toHaveBeenCalledWith('AUSER_GEN', { prisonId: 'MDI', ...query })
    })

    it('uses an empty query when none is passed', async () => {
      ;(csraApiClient.getPrisonPrisoners as unknown as jest.Mock).mockResolvedValue(prisonerList)

      await csraService.getPrisonPrisoners('AUSER_GEN', 'MDI')

      expect(csraApiClient.getPrisonPrisoners).toHaveBeenCalledWith('AUSER_GEN', { prisonId: 'MDI' })
    })
  })

  describe('getRecentArrivals', () => {
    const recentArrivals: CsraRecentArrivals = {
      days: [
        {
          date: '2026-08-06',
          arrivals: [
            {
              prisonerNumber: 'A5197BD',
              firstName: 'DANIEL',
              lastName: 'HAVERS',
              arrivalType: 'NEW_ADMISSION',
              arrivedAt: '2026-08-06T14:03:00',
            },
          ],
        },
        { date: '2026-08-05', arrivals: [] },
      ],
      totalResults: 1,
      arrivalTypeCounts: { NEW_ADMISSION: 1, TRANSFER_IN: 0, COURT_RETURN: 0, TEMPORARY_ABSENCE_RETURN: 0 },
      fromDate: '2026-08-04',
      toDate: '2026-08-06',
    }

    it('delegates to the client, passing the username, prison id and query', async () => {
      ;(csraApiClient.getRecentArrivals as unknown as jest.Mock).mockResolvedValue(recentArrivals)

      const result = await csraService.getRecentArrivals('AUSER_GEN', 'LEI', {
        days: 3,
        arrivalTypes: ['NEW_ADMISSION'],
      })

      expect(result).toEqual(recentArrivals)
      expect(csraApiClient.getRecentArrivals).toHaveBeenCalledWith('AUSER_GEN', {
        prisonId: 'LEI',
        days: 3,
        arrivalTypes: ['NEW_ADMISSION'],
      })
    })

    it('uses an empty query when none is passed', async () => {
      ;(csraApiClient.getRecentArrivals as unknown as jest.Mock).mockResolvedValue(recentArrivals)

      await csraService.getRecentArrivals('AUSER_GEN', 'LEI')

      expect(csraApiClient.getRecentArrivals).toHaveBeenCalledWith('AUSER_GEN', { prisonId: 'LEI' })
    })
  })
})
