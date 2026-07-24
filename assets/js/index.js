import * as govukFrontend from 'govuk-frontend'
import * as mojFrontend from '@ministryofjustice/frontend'
import initDueForReviewSortForm from './dueForReviewSort'

govukFrontend.initAll()
mojFrontend.initAll()
initDueForReviewSortForm()
