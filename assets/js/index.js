import * as govukFrontend from 'govuk-frontend'
import * as mojFrontend from '@ministryofjustice/frontend'
import initPrisonersSortForm from './prisonersSort'

govukFrontend.initAll()
mojFrontend.initAll()
initPrisonersSortForm()
