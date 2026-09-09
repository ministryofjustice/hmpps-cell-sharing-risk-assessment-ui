import type { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'

/** A minimal but genuinely valid one-page PDF, so the browser treats the response as a real file. */
const TINY_PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBl' +
  'L1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBS' +
  'L01lZGlhQm94WzAgMCA5OSA5OV0+PgplbmRvYmoKdHJhaWxlcgo8PC9Sb290IDEgMCBSPj4K'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPattern: '/document-api/health/ping',
      },
      response: {
        status: httpStatus,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { status: httpStatus === 200 ? 'UP' : 'DOWN' },
      },
    }),

  /** Batch metadata lookup (POST /documents), which is where the page gets its file sizes. */
  stubGetDocumentsMetadata: (documents: Array<{ documentUuid: string; fileSize: number }>): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'POST',
        urlPattern: '/document-api/documents',
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: documents.map(document => ({
          documentFilename: `${document.documentUuid}.pdf`,
          fileExtension: 'pdf',
          mimeType: 'application/pdf',
          ...document,
        })),
      },
    }),

  stubGetDocumentsMetadataError: (httpStatus = 500): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'POST',
        urlPattern: '/document-api/documents',
      },
      response: { status: httpStatus },
    }),

  stubGetDocumentFile: (documentUuid: string): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/document-api/documents/${documentUuid}/file`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
        base64Body: TINY_PDF_BASE64,
      },
    }),
}
