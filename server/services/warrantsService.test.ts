import WarrantsService, { WARRANT_WINDOW_DAYS } from './warrantsService'
import type CourtDataApiClient from '../data/courtDataApiClient'
import type DocumentApiClient from '../data/documentApiClient'
import type { CourtHearing, CourtDocumentType } from '../data/courtDataApiTypes'

const DAY_IN_MS = 24 * 60 * 60 * 1000

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_IN_MS).toISOString()

const makeHearing = (
  documents: Array<{ documentType: CourtDocumentType; documentId: string; ingestionAt: string }>,
  overrides: Partial<CourtHearing> = {},
): CourtHearing => ({
  hearingId: 'hearing-1',
  courtName: 'Leeds Crown Court',
  courtId: 'court-1',
  courtCode: 'B10LS',
  hearingDate: daysAgo(5),
  caseReferences: ['REF1'],
  hearingType: 'Sentence',
  documents,
  ...overrides,
})

describe('WarrantsService', () => {
  const getCourtHearings = jest.fn()
  const getDocumentsMetadata = jest.fn()
  const getDocumentFile = jest.fn()

  const courtDataApiClient = { getCourtHearings } as unknown as CourtDataApiClient
  const documentApiClient = { getDocumentsMetadata, getDocumentFile } as unknown as DocumentApiClient

  let service: WarrantsService

  beforeEach(() => {
    jest.clearAllMocks()
    getDocumentsMetadata.mockResolvedValue([])
    service = new WarrantsService(courtDataApiClient, documentApiClient)
  })

  describe('getRecentWarrants', () => {
    it('keeps only warrant document types, dropping registers and generic documents', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([
          { documentType: 'SENTENCING_WARRANT', documentId: 'doc-1', ingestionAt: daysAgo(1) },
          { documentType: 'REMAND_WARRANT', documentId: 'doc-2', ingestionAt: daysAgo(2) },
          { documentType: 'PRISON_COURT_REGISTER', documentId: 'doc-3', ingestionAt: daysAgo(1) },
          { documentType: 'COMMON_PLATFORM_DOCUMENT', documentId: 'doc-4', ingestionAt: daysAgo(1) },
        ]),
      ])

      const warrants = await service.getRecentWarrants('user1', 'A1234BC')

      expect(warrants.map(warrant => warrant.documentId)).toEqual(['doc-1', 'doc-2'])
    })

    it('carries the court name and hearing type down from the parent hearing', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([{ documentType: 'REMAND_WARRANT', documentId: 'doc-1', ingestionAt: daysAgo(1) }], {
          courtName: 'Burnley Crown Court',
          hearingType: 'Remand',
        }),
      ])

      const [warrant] = await service.getRecentWarrants('user1', 'A1234BC')

      expect(warrant).toMatchObject({ courtName: 'Burnley Crown Court', hearingType: 'Remand' })
    })

    it('excludes warrants ingested outside the window but keeps ones on its edge', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([
          {
            documentType: 'SENTENCING_WARRANT',
            documentId: 'just-inside',
            ingestionAt: daysAgo(WARRANT_WINDOW_DAYS - 1),
          },
          {
            documentType: 'SENTENCING_WARRANT',
            documentId: 'just-outside',
            ingestionAt: daysAgo(WARRANT_WINDOW_DAYS + 1),
          },
        ]),
      ])

      const warrants = await service.getRecentWarrants('user1', 'A1234BC')

      expect(warrants.map(warrant => warrant.documentId)).toEqual(['just-inside'])
    })

    it('sorts newest first by default, and oldest first when asked for earliest', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([
          { documentType: 'SENTENCING_WARRANT', documentId: 'older', ingestionAt: daysAgo(10) },
          { documentType: 'REMAND_WARRANT', documentId: 'newer', ingestionAt: daysAgo(1) },
        ]),
      ])

      expect((await service.getRecentWarrants('user1', 'A1234BC')).map(w => w.documentId)).toEqual(['newer', 'older'])
      expect((await service.getRecentWarrants('user1', 'A1234BC', 'earliest')).map(w => w.documentId)).toEqual([
        'older',
        'newer',
      ])
    })

    it('flattens warrants across several hearings', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([{ documentType: 'SENTENCING_WARRANT', documentId: 'doc-1', ingestionAt: daysAgo(1) }], {
          hearingId: 'hearing-1',
        }),
        makeHearing([{ documentType: 'REMAND_WARRANT', documentId: 'doc-2', ingestionAt: daysAgo(2) }], {
          hearingId: 'hearing-2',
        }),
      ])

      expect(await service.getRecentWarrants('user1', 'A1234BC')).toHaveLength(2)
    })

    it('returns an empty list for a prisoner the court service could not match', async () => {
      getCourtHearings.mockResolvedValue([])

      expect(await service.getRecentWarrants('user1', 'A1234BC')).toEqual([])
      // No warrants means nothing to look up, so document-api is never called.
      expect(getDocumentsMetadata).not.toHaveBeenCalled()
    })

    it('joins file sizes on from document-api in a single batched call', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([
          { documentType: 'SENTENCING_WARRANT', documentId: 'doc-1', ingestionAt: daysAgo(1) },
          { documentType: 'REMAND_WARRANT', documentId: 'doc-2', ingestionAt: daysAgo(2) },
        ]),
      ])
      getDocumentsMetadata.mockResolvedValue([
        { documentUuid: 'doc-1', fileSize: 58634 },
        { documentUuid: 'doc-2', fileSize: 66765 },
      ])

      const warrants = await service.getRecentWarrants('user1', 'A1234BC')

      expect(getDocumentsMetadata).toHaveBeenCalledTimes(1)
      expect(getDocumentsMetadata).toHaveBeenCalledWith('user1', ['doc-1', 'doc-2'])
      expect(warrants.map(warrant => warrant.fileSize)).toEqual([58634, 66765])
    })

    it('still lists the warrants, without sizes, when document-api fails', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([{ documentType: 'SENTENCING_WARRANT', documentId: 'doc-1', ingestionAt: daysAgo(1) }]),
      ])
      getDocumentsMetadata.mockRejectedValue(new Error('document-api down'))

      const warrants = await service.getRecentWarrants('user1', 'A1234BC')

      expect(warrants).toHaveLength(1)
      expect(warrants[0].fileSize).toBeUndefined()
    })
  })

  describe('hasRecentWarrants', () => {
    it('is true when there is at least one warrant in the window', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([{ documentType: 'SENTENCING_WARRANT', documentId: 'doc-1', ingestionAt: daysAgo(1) }]),
      ])

      expect(await service.hasRecentWarrants('user1', 'A1234BC')).toBe(true)
    })

    it('does not call document-api, since it only needs to know whether any warrant exists', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([{ documentType: 'SENTENCING_WARRANT', documentId: 'doc-1', ingestionAt: daysAgo(1) }]),
      ])

      await service.hasRecentWarrants('user1', 'A1234BC')

      expect(getDocumentsMetadata).not.toHaveBeenCalled()
    })

    it('is false when the only documents are not warrants', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([{ documentType: 'PRISON_COURT_REGISTER', documentId: 'doc-1', ingestionAt: daysAgo(1) }]),
      ])

      expect(await service.hasRecentWarrants('user1', 'A1234BC')).toBe(false)
    })

    it('is false rather than throwing when the court API fails, so the task list still renders', async () => {
      getCourtHearings.mockRejectedValue(new Error('court API down'))

      expect(await service.hasRecentWarrants('user1', 'A1234BC')).toBe(false)
    })
  })

  describe('getWarrantFile', () => {
    beforeEach(() => {
      getCourtHearings.mockResolvedValue([
        makeHearing([{ documentType: 'SENTENCING_WARRANT', documentId: 'doc-1', ingestionAt: daysAgo(1) }]),
      ])
    })

    it('fetches the file when the document is one of the prisoner’s recent warrants', async () => {
      const file = { body: Buffer.from('pdf'), contentType: 'application/pdf' }
      getDocumentFile.mockResolvedValue(file)

      expect(await service.getWarrantFile('user1', 'A1234BC', 'doc-1')).toBe(file)
      expect(getDocumentFile).toHaveBeenCalledWith('user1', 'doc-1')
      // The ownership check needs the warrant list, not its file sizes.
      expect(getDocumentsMetadata).not.toHaveBeenCalled()
    })

    it('refuses a document that is not one of theirs, so the proxy cannot fetch arbitrary documents', async () => {
      expect(await service.getWarrantFile('user1', 'A1234BC', 'someone-elses-doc')).toBeNull()
      expect(getDocumentFile).not.toHaveBeenCalled()
    })

    it('refuses a non-warrant document belonging to the same prisoner', async () => {
      getCourtHearings.mockResolvedValue([
        makeHearing([{ documentType: 'PRISON_COURT_REGISTER', documentId: 'register-1', ingestionAt: daysAgo(1) }]),
      ])

      expect(await service.getWarrantFile('user1', 'A1234BC', 'register-1')).toBeNull()
      expect(getDocumentFile).not.toHaveBeenCalled()
    })
  })
})
