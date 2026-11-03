import * as govukFrontend from 'govuk-frontend'
import * as mojFrontend from '@ministryofjustice/frontend'
import initPrisonersSortForm from './prisonersSort'
import initHistoryRevalidation from './historyRevalidation'

initHistoryRevalidation()
govukFrontend.initAll()
mojFrontend.initAll()
initPrisonersSortForm()
