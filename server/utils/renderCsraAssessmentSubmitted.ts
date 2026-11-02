import { Response } from 'express'

export default function renderCsraAssessmentSubmitted(res: Response, prisonerNumber: string): void {
  res.status(403).render('pages/csraAssessmentSubmitted', {
    returnLink: `/prisoner/${prisonerNumber}`,
  })
}
