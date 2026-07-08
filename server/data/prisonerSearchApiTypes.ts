/**
 * Subset of the hmpps-prisoner-search `Prisoner` model (GET /prisoner/{prisonerNumber}) needed to
 * render the prisoner identity banner. The API returns many more fields; add them here as pages need
 * them. See https://prisoner-search-dev.hmpps.service.justice.gov.uk/swagger-ui/index.html.
 */
export interface Prisoner {
  prisonerNumber: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  prisonId?: string
  prisonName?: string
  cellLocation?: string
  status?: string
  pncNumber?: string
  mostSeriousOffence?: string
}
