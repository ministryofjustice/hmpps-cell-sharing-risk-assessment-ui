import csraWarrantsController, { csraWarrantFileController } from './csraWarrantsController'
import config from '../config'
import { Page } from '../services/auditService'

const ASSESSMENT_ID = 'assessment-123'
const BASE_PATH = `/prisoner/A1234BC/csra/${ASSESSMENT_ID}`

const makeWarrant = (overrides = {}) => ({
  documentId: 'doc-1',
  documentType: 'SENTENCING_WARRANT',
  courtName: 'Leeds Crown Court',
  hearingType: 'Sentence',
  ingestionAt: '2026-08-11T09:00:00',
  fileSize: 58634,
  ...overrides,
})

describe('csraWarrantsController', () => {
  const warrantsService = {
    getRecentWarrants: jest.fn(),
    getWarrantFile: jest.fn(),
  }
  const auditService = { logPageView: jest.fn().mockResolvedValue(null) }

  const request = (query: Record<string, string> = {}, params: Record<string, string> = {}) =>
    ({
      id: 'request-id-123',
      query,
      params: { prisonerNumber: 'A1234BC', assessmentId: ASSESSMENT_ID, ...params },
    }) as any

  const response = () =>
    ({
      locals: { user: { username: 'user1' }, prisoner: { prisonerNumber: 'A1234BC' } },
      render: jest.fn(),
      send: jest.fn(),
      set: jest.fn(),
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
    config.warrants.enabled = true
    warrantsService.getRecentWarrants.mockResolvedValue([makeWarrant()])
  })

  afterAll(() => {
    config.warrants.enabled = false
  })

  describe('the warrants page', () => {
    const controller = () => csraWarrantsController({ auditService, warrantsService } as never)

    it('renders the prisoner’s recent warrants', async () => {
      const res = response()

      await controller()(request(), res, jest.fn())

      expect(warrantsService.getRecentWarrants).toHaveBeenCalledWith('user1', 'A1234BC', 'recent')
      expect(res.render).toHaveBeenCalledWith(
        'pages/csraWarrants',
        expect.objectContaining({
          warrants: [makeWarrant()],
          sort: 'recent',
          windowDays: 30,
          basePath: BASE_PATH,
          // The design offers a back link rather than a breadcrumb trail.
          backLink: BASE_PATH,
          returnLinkText: 'Return to assessment',
        }),
      )
    })

    it('passes the earliest sort through', async () => {
      const res = response()

      await controller()(request({ sort: 'earliest' }), res, jest.fn())

      expect(warrantsService.getRecentWarrants).toHaveBeenCalledWith('user1', 'A1234BC', 'earliest')
      expect(res.render).toHaveBeenCalledWith('pages/csraWarrants', expect.objectContaining({ sort: 'earliest' }))
    })

    it('falls back to the default sort for an unrecognised value', async () => {
      await controller()(request({ sort: 'sideways' }), response(), jest.fn())

      expect(warrantsService.getRecentWarrants).toHaveBeenCalledWith('user1', 'A1234BC', 'recent')
    })

    it('renders with no warrants rather than erroring when there are none', async () => {
      warrantsService.getRecentWarrants.mockResolvedValue([])
      const res = response()

      await controller()(request(), res, jest.fn())

      expect(res.render).toHaveBeenCalledWith('pages/csraWarrants', expect.objectContaining({ warrants: [] }))
    })

    it('audits the page view', async () => {
      await controller()(request(), response(), jest.fn())

      expect(auditService.logPageView).toHaveBeenCalledWith(
        Page.PRISONER_CSRA_WARRANTS,
        expect.objectContaining({ who: 'user1', subjectId: 'A1234BC', subjectType: 'PRISONER_ID' }),
      )
    })

    it('404s when the feature flag is off', async () => {
      config.warrants.enabled = false

      await expect(controller()(request(), response(), jest.fn())).rejects.toMatchObject({ status: 404 })
      expect(warrantsService.getRecentWarrants).not.toHaveBeenCalled()
    })

    describe('reached without an assessment id', () => {
      // The standalone entry point: there are no in-progress assessments in production until
      // go-live, so the page has to be reachable from the prison number alone.
      const requestWithoutAssessment = () =>
        ({
          id: 'request-id-123',
          query: {},
          params: { prisonerNumber: 'A1234BC' },
        }) as any

      it('hangs every link off the prisoner rather than an assessment', async () => {
        const res = response()

        await controller()(requestWithoutAssessment(), res, jest.fn())

        expect(res.render).toHaveBeenCalledWith(
          'pages/csraWarrants',
          expect.objectContaining({
            basePath: '/prisoner/A1234BC',
            backLink: '/prisoner/A1234BC',
          }),
        )
      })

      it('offers a return to CSRA rather than to an assessment that does not exist', async () => {
        const res = response()

        await controller()(requestWithoutAssessment(), res, jest.fn())

        expect(res.render).toHaveBeenCalledWith(
          'pages/csraWarrants',
          expect.objectContaining({ returnLinkText: 'Return to CSRA' }),
        )
      })

      it('still looks the warrants up by prison number', async () => {
        await controller()(requestWithoutAssessment(), response(), jest.fn())

        expect(warrantsService.getRecentWarrants).toHaveBeenCalledWith('user1', 'A1234BC', 'recent')
      })

      it('still 404s when the feature flag is off', async () => {
        config.warrants.enabled = false

        await expect(controller()(requestWithoutAssessment(), response(), jest.fn())).rejects.toMatchObject({
          status: 404,
        })
      })
    })
  })

  describe('the PDF proxy', () => {
    const controller = () => csraWarrantFileController({ warrantsService } as never)

    it('sends the file inline so the browser renders it rather than downloading it', async () => {
      warrantsService.getWarrantFile.mockResolvedValue({
        body: Buffer.from('pdf bytes'),
        contentType: 'application/pdf',
      })
      const res = response()

      await controller()(request({}, { documentId: 'doc-1' }), res, jest.fn())

      expect(warrantsService.getWarrantFile).toHaveBeenCalledWith('user1', 'A1234BC', 'doc-1')
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/pdf')
      expect(res.set).toHaveBeenCalledWith('Content-Disposition', 'inline')
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
      expect(res.send).toHaveBeenCalledWith(Buffer.from('pdf bytes'))
    })

    it('404s for a document that is not one of the prisoner’s warrants', async () => {
      warrantsService.getWarrantFile.mockResolvedValue(null)

      await expect(
        controller()(request({}, { documentId: 'someone-elses-doc' }), response(), jest.fn()),
      ).rejects.toMatchObject({ status: 404 })
    })

    it('404s rather than leaking an upstream failure', async () => {
      warrantsService.getWarrantFile.mockRejectedValue(new Error('document-api down'))

      await expect(controller()(request({}, { documentId: 'doc-1' }), response(), jest.fn())).rejects.toMatchObject({
        status: 404,
      })
    })

    it('404s when the feature flag is off', async () => {
      config.warrants.enabled = false

      await expect(controller()(request({}, { documentId: 'doc-1' }), response(), jest.fn())).rejects.toMatchObject({
        status: 404,
      })
      expect(warrantsService.getWarrantFile).not.toHaveBeenCalled()
    })

    it('serves the file when reached without an assessment id', async () => {
      warrantsService.getWarrantFile.mockResolvedValue({
        body: Buffer.from('pdf bytes'),
        contentType: 'application/pdf',
      })
      const res = response()
      const req = { id: 'request-id-123', query: {}, params: { prisonerNumber: 'A1234BC', documentId: 'doc-1' } } as any

      await controller()(req, res, jest.fn())

      // The ownership check is on the prisoner, never the assessment, so nothing is lost here.
      expect(warrantsService.getWarrantFile).toHaveBeenCalledWith('user1', 'A1234BC', 'doc-1')
      expect(res.set).toHaveBeenCalledWith('Content-Disposition', 'inline')
    })
  })
})
