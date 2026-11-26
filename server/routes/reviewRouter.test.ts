import request from 'supertest'
import { appWithAllRoutes, flashProvider, user } from './testutils/appSetup'
import { Role } from '../utils/roles'
import { CsraReview, CsraReviewAnswers } from '../data/csraApiTypes'
import { reasonQuestion, reviewSteps } from '../lib/transactionFlow/reviewConfig'
import RadioQuestion from '../lib/transactionFlow/questionTypes/radio'
import YesNoWithDetailQuestion from '../lib/transactionFlow/questionTypes/yesNoWithDetail'
import TextAreaQuestion from '../lib/transactionFlow/questionTypes/textArea'
import Step from '../lib/transactionFlow/step'

const prisoner = {
  prisonerNumber: 'A1234BC',
  firstName: 'JOHN',
  lastName: 'SMITH',
  prisonId: 'LEI',
  prisonName: 'Leeds (HMP)',
  dateOfBirth: '1972-02-03',
}

const review: CsraReview = {
  reviewId: 'review-123',
  prisonerNumber: prisoner.prisonerNumber,
  prisonId: 'LEI',
  status: 'IN_PROGRESS',
  interimResult: null,
  finalResult: null,
  stages: [
    {
      stage: 'FINAL',
      version: 3,
      answers: {
        reviewReason: 'NEW_OR_ADDITIONAL_INFORMATION',
        evidenceSources: [{ source: 'PNC' }],
        offenceMurderManslaughter: true,
        offenceMurderManslaughterDetail: 'Existing detail',
      },
    },
  ],
}

describe('review journey', () => {
  const csraService = {
    startCsraReview: jest.fn(),
    getReviewForEditing: jest.fn(),
    updateReviewAnswers: jest.fn(),
    getCurrentRating: jest.fn(),
  }
  const services = {
    auditService: { logPageView: jest.fn().mockResolvedValue(null) },
    csraService,
    prisonerSearchService: { getPrisoner: jest.fn().mockResolvedValue(prisoner) },
    manageUsersService: {
      getUserCaseloads: jest.fn().mockResolvedValue({
        username: user.username,
        active: true,
        accountType: 'GENERAL',
        activeCaseload: { id: 'LEI', name: 'Leeds (HMP)' },
        caseloads: [{ id: 'LEI', name: 'Leeds (HMP)' }],
      }),
    },
    activeAgenciesService: { isPrisonActive: jest.fn().mockResolvedValue(true) },
  }

  const app = () => {
    const result = appWithAllRoutes({
      services: services as never,
      userSupplier: () => ({ ...user, userRoles: [Role.CSRA__REVIEW_EDIT] }),
      activeCaseloadId: 'LEI',
    })
    result.locals.feComponents = { sharedData: { activeCaseLoad: { caseLoadId: 'LEI' } } }
    return result
  }
  const base = '/prisoner/A1234BC/review'

  beforeEach(() => {
    jest.clearAllMocks()
    csraService.startCsraReview.mockResolvedValue({ reviewId: 'review-123' })
    csraService.getReviewForEditing.mockResolvedValue(review)
    csraService.updateReviewAnswers.mockResolvedValue(review)
    csraService.getCurrentRating.mockResolvedValue({ finalRating: 'HIGH_SPECIFIC', provisional: false })
    flashProvider.mockReturnValue([])
  })

  it('only creates a review when valid evidence and the selected reason are submitted together', async () => {
    const agent = request.agent(app())
    const reasonPage = await agent.get(`${base}/reason`)
    expect(reasonPage.status).toBe(200)
    expect(reasonPage.text).toContain('What is the reason for the review?')
    expect(reasonPage.text).toMatch(/<h1[^>]*>\s*What is the reason for the review\?\s*<\/h1>/)
    expect(reasonPage.text.match(/<h1\b/g)).toHaveLength(1)
    expect(reasonPage.text).toMatch(/<p>\s*Choose the reason for reviewing the prisoner’s cell sharing risk\.\s*<\/p>/)
    const invalidReason = await agent.post(`${base}/reason`).type('form').send({ reviewReason: 'INVALID' })
    expect(invalidReason.text).toContain('Select the reason for review')
    expect(invalidReason.text).toMatch(/<h1[^>]*>\s*What is the reason for the review\?\s*<\/h1>/)
    expect(invalidReason.text).toContain('Choose the reason for reviewing the prisoner’s cell sharing risk.')
    expect(csraService.startCsraReview).not.toHaveBeenCalled()
    await agent
      .post(`${base}/reason`)
      .type('form')
      .send({ reviewReason: 'NEW_OR_ADDITIONAL_INFORMATION' })
      .expect(302)
      .expect('Location', `${base}/multidisciplinary-team-review`)
    expect(csraService.startCsraReview).not.toHaveBeenCalled()
    const evidencePage = await agent.get(`${base}/evidence`).expect(200)
    expect(evidencePage.text).toContain('Which evidence sources have you checked?')
    expect(evidencePage.text).toMatch(/<h1[^>]*>\s*Which evidence sources have you checked\?\s*<\/h1>/)
    expect(evidencePage.text.match(/<h1\b/g)).toHaveLength(1)
    expect(evidencePage.text).toMatch(/<legend[^>]*class="[^"]*govuk-visually-hidden[^"]*"[^>]*>/)
    expect(evidencePage.text).toMatch(/>\s*DPS\s*<\/label>/)
    const invalid = await agent.post(`${base}/evidence`).type('form').send({ evidenceSources: 'OTHER' }).expect(200)
    expect(invalid.text).toContain('Enter the other evidence source')
    expect(csraService.startCsraReview).not.toHaveBeenCalled()
    const result = await agent
      .post(`${base}/evidence`)
      .type('form')
      .send({ evidenceSources: ['PNC', 'OTHER'], otherEvidenceDetail: '  Staff record  ' })
      .expect(302)
    expect(result.headers.location).toBe(`${base}/review-123`)
    expect(csraService.startCsraReview).toHaveBeenCalledWith(user.username, 'A1234BC', 'LEI', {
      reviewReason: 'NEW_OR_ADDITIONAL_INFORMATION',
      evidenceSources: [{ source: 'PNC' }, { source: 'OTHER', details: 'Staff record' }],
    })
  })

  it('redirects to the reason if no reason was selected', async () => {
    await request(app()).get(`${base}/evidence`).expect(302).expect('Location', `${base}/reason`)
    expect(csraService.startCsraReview).not.toHaveBeenCalled()
  })

  it.each([['PNC', 'PNC'], ['INVALID']])(
    'rejects invalid or duplicate evidence sources %s',
    async (...evidenceSources) => {
      const agent = request.agent(app())
      await agent.post(`${base}/reason`).type('form').send({ reviewReason: 'NEW_OR_ADDITIONAL_INFORMATION' })
      const response = await agent.post(`${base}/evidence`).type('form').send({ evidenceSources }).expect(200)
      expect(response.text).toContain('Select valid evidence sources')
      expect(csraService.startCsraReview).not.toHaveBeenCalled()
    },
  )

  it('requires review edit permission', async () => {
    const instance = appWithAllRoutes({
      services: services as never,
      userSupplier: () => ({ ...user, userRoles: [] }),
      activeCaseloadId: 'LEI',
    })
    await request(instance).get(`${base}/reason`).expect(302).expect('Location', '/sign-out')
    expect(csraService.startCsraReview).not.toHaveBeenCalled()
  })

  it.each([
    ['STANDARD', false, 'FINAL', ['NEW_OR_ADDITIONAL_INFORMATION', 'RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING']],
    ['HIGH_GENERAL', false, 'FINAL', ['SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW', 'SHORT_TERM_HIGH_RISK_REVIEW']],
    [
      'HIGH_SPECIFIC',
      false,
      'FINAL',
      [
        'SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW',
        'SHORT_TERM_HIGH_RISK_REVIEW',
        'NEW_OR_ADDITIONAL_INFORMATION',
        'RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING',
      ],
    ],
    [
      'STANDARD',
      true,
      'PROVISIONAL',
      [
        'SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW',
        'SHORT_TERM_HIGH_RISK_REVIEW',
        'NEW_OR_ADDITIONAL_INFORMATION',
        'RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING',
      ],
    ],
    [
      'HIGH_GENERAL',
      true,
      'INTERIM',
      [
        'SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW',
        'SHORT_TERM_HIGH_RISK_REVIEW',
        'NEW_OR_ADDITIONAL_INFORMATION',
        'RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING',
      ],
    ],
  ])(
    'shows the allowed reasons in order for %s (inherited: %s, stage: %s)',
    async (rating, inherited, stage, reasons) => {
      csraService.getCurrentRating.mockResolvedValue({
        finalRating: stage === 'FINAL' ? rating : null,
        provisionalRating: stage === 'FINAL' ? null : rating,
        inheritedAfterTransfer: inherited,
        ratingStage: stage,
      })
      const response = await request(app()).get(`${base}/reason`).expect(200)
      const options = [...response.text.matchAll(/name="reviewReason" type="radio" value="([^"]+)"/g)].map(
        match => match[1],
      )
      expect(options).toEqual(reasons)
      expect(response.text).toContain('Continue')
      reasonQuestion.items.forEach(option => {
        if (reasons.includes(option.value)) expect(response.text).toContain(option.hint)
      })
    },
  )

  it.each([
    ['SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW', 'scheduled-review'],
    ['SHORT_TERM_HIGH_RISK_REVIEW', 'short-term-review'],
    ['NEW_OR_ADDITIONAL_INFORMATION', 'multidisciplinary-team-review'],
    ['RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING', 'multidisciplinary-team-review'],
  ])('stages %s without creating a review and navigates to %s', async (reason, next) => {
    const agent = request.agent(app())
    await agent
      .post(`${base}/reason`)
      .type('form')
      .send({ reviewReason: reason })
      .expect(302)
      .expect('Location', `${base}/${next}`)
    const page = await agent.get(`${base}/${next}`).expect(200)
    expect(page.text).toContain('The questions for this review are not yet available')
    expect(page.text).toContain(`href="${base}/reason"`)
    expect(page.text).toContain('href="/prisoner/A1234BC"')
    expect(csraService.startCsraReview).not.toHaveBeenCalled()
    expect(csraService.updateReviewAnswers).not.toHaveBeenCalled()
  })

  it('rejects a reason that is unavailable for the current rating', async () => {
    csraService.getCurrentRating.mockResolvedValue({ finalRating: 'STANDARD' })
    const agent = request.agent(app())
    const response = await agent
      .post(`${base}/reason`)
      .type('form')
      .send({ reviewReason: 'SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW' })
      .expect(200)
    expect(response.text).toContain('Select the reason for review')
    await agent.get(`${base}/evidence`).expect(302).expect('Location', `${base}/reason`)
    expect(csraService.startCsraReview).not.toHaveBeenCalled()
  })

  it('shows the specified error and overview links without saving when nothing is selected', async () => {
    const instance = app()
    const page = await request(instance).get(`${base}/reason`).expect(200)
    expect(page.text).toContain('href="/prisoner/A1234BC"')
    const response = await request(instance).post(`${base}/reason`).type('form').send({}).expect(200)
    expect(response.text).toContain('Select the reason for review')
    expect(csraService.startCsraReview).not.toHaveBeenCalled()
    expect(csraService.updateReviewAnswers).not.toHaveBeenCalled()
  })

  it('discards the staged reason when returning to the prisoner overview', async () => {
    csraService.getCurrentRating.mockResolvedValue({
      prisonerNumber: prisoner.prisonerNumber,
      status: 'COMPLETE',
      finalRating: 'HIGH_SPECIFIC',
      provisional: false,
      riskTo: [],
      vulnerabilities: [],
      stages: [],
    })
    const agent = request.agent(app())
    await agent.post(`${base}/reason`).type('form').send({ reviewReason: 'SHORT_TERM_HIGH_RISK_REVIEW' }).expect(302)
    const overview = await agent.get('/prisoner/A1234BC').expect(200)
    expect(overview.text).toContain('Start review')
    expect(overview.text).not.toContain('Continue review')
    const page = await agent.get(`${base}/reason`).expect(200)
    expect(page.text).not.toMatch(/value="SHORT_TERM_HIGH_RISK_REVIEW"[^>]*checked/)
    expect(csraService.startCsraReview).not.toHaveBeenCalled()
    expect(csraService.updateReviewAnswers).not.toHaveBeenCalled()
  })

  it('supports future review-specific steps without losing saved answers', async () => {
    const question = new RadioQuestion<CsraReviewAnswers>(
      'Review-specific question?',
      'offenceMurderManslaughterDetail',
      [
        { text: 'First', value: 'FIRST' },
        { text: 'Second', value: 'SECOND' },
      ],
    )
    reviewSteps.push({ path: 'question/0', persistence: 'update', step: new Step({ questions: [question] }) })
    try {
      const instance = app()
      const page = await request(instance).get(`${base}/review-123/question/0`).expect(200)
      expect(page.text).toContain('Review-specific question?')
      await request(instance).post(`${base}/review-123/question/0`).type('form').send({ version: '3' }).expect(200)
      const invalid = await request(instance)
        .post(`${base}/review-123/question/0`)
        .type('form')
        .send({ offenceMurderManslaughterDetail: 'INVALID', version: '3' })
        .expect(200)
      expect(invalid.text).toContain('Select a valid option')
      expect(csraService.updateReviewAnswers).not.toHaveBeenCalled()
      await request(instance)
        .post(`${base}/review-123/question/0`)
        .type('form')
        .send({ offenceMurderManslaughterDetail: 'FIRST', version: '3' })
        .expect(302)
        .expect('Location', `${base}/review-123`)
      expect(csraService.updateReviewAnswers).toHaveBeenCalledWith(user.username, 'A1234BC', 'review-123', 'LEI', 3, {
        ...review.stages[0].answers,
        offenceMurderManslaughterDetail: 'FIRST',
      })
    } finally {
      reviewSteps.pop()
    }
  })

  it('uses question headings instead of a page heading for multi-question steps', async () => {
    const radio = new RadioQuestion<CsraReviewAnswers>('First review question?', 'offenceMurderManslaughterDetail', [
      { text: 'First', value: 'FIRST' },
    ])
    const textarea = new TextAreaQuestion<CsraReviewAnswers>('Second review question?', 'offenceAssistingSuicideDetail')
    reviewSteps.push({
      path: 'multiple-questions',
      persistence: 'update',
      step: new Step({ title: 'Review step title', questions: [radio, textarea] }),
    })
    try {
      const instance = app()
      const page = await request(instance).get(`${base}/review-123/multiple-questions`).expect(200)
      expect(page.text).not.toMatch(/<h1\b/)
      expect(page.text).toMatch(/<h2[^>]*>\s*First review question\?\s*<\/h2>/)
      expect(page.text).toMatch(/<h2[^>]*>\s*Second review question\?\s*<\/h2>/)
      expect(page.text).not.toMatch(/<h[12][^>]*>\s*Review step title\s*<\/h[12]>/)
      expect(page.text).toMatch(/<legend[^>]*class="[^"]*govuk-visually-hidden[^"]*"[^>]*>/)
      expect(page.text).toMatch(
        /<label[^>]*class="[^"]*govuk-visually-hidden[^"]*"[^>]*for="offenceAssistingSuicideDetail"/,
      )
      const invalid = await request(instance)
        .post(`${base}/review-123/multiple-questions`)
        .type('form')
        .send({ version: '3' })
        .expect(200)
      expect(invalid.text).not.toMatch(/<h1\b/)
      expect(invalid.text).toMatch(/<h2[^>]*>\s*First review question\?\s*<\/h2>/)
      expect(invalid.text).toMatch(/<h2[^>]*>\s*Second review question\?\s*<\/h2>/)
    } finally {
      reviewSteps.pop()
    }
  })

  it('navigates and saves additional configured steps in order', async () => {
    const first = new RadioQuestion<CsraReviewAnswers>('First review question?', 'offenceMurderManslaughterDetail', [
      { text: 'First', value: 'FIRST' },
    ])
    const second = new RadioQuestion<CsraReviewAnswers>('Second review question?', 'offenceAssistingSuicideDetail', [
      { text: 'Second', value: 'SECOND' },
    ])
    reviewSteps.push(
      { path: 'additional/first', persistence: 'update', step: new Step({ questions: [first] }) },
      { path: 'additional/second', persistence: 'update', step: new Step({ questions: [second] }) },
    )
    try {
      const agent = request.agent(app())
      await agent
        .post(`${base}/reason`)
        .type('form')
        .send({ reviewReason: 'NEW_OR_ADDITIONAL_INFORMATION' })
        .expect(302)
      await agent
        .post(`${base}/evidence`)
        .type('form')
        .send({ evidenceSources: 'PNC' })
        .expect(302)
        .expect('Location', `${base}/review-123/additional/first`)
      const firstPage = await agent.get(`${base}/review-123/additional/first`).expect(200)
      expect(firstPage.text).toContain('First review question?')
      await agent
        .post(`${base}/review-123/additional/first`)
        .type('form')
        .send({ offenceMurderManslaughterDetail: 'FIRST', version: '3' })
        .expect(302)
        .expect('Location', `${base}/review-123/additional/second`)
      const secondPage = await agent.get(`${base}/review-123/additional/second`).expect(200)
      expect(secondPage.text).toContain('Second review question?')
      expect(secondPage.text).toContain(`href="${base}/review-123/additional/first"`)
      await agent
        .post(`${base}/review-123/additional/second`)
        .type('form')
        .send({ offenceAssistingSuicideDetail: 'SECOND', version: '3' })
        .expect(302)
        .expect('Location', `${base}/review-123`)
      expect(csraService.startCsraReview).toHaveBeenCalledTimes(1)
      expect(csraService.updateReviewAnswers).toHaveBeenCalledTimes(2)
    } finally {
      reviewSteps.splice(-2)
    }
  })

  it('uses shared yes/no questions and conditional validation for review steps', async () => {
    const question = new YesNoWithDetailQuestion<CsraReviewAnswers>(
      'Review-specific risk?',
      'offenceMurderManslaughter',
      'offenceMurderManslaughterDetail',
      { detailValidationMessages: { required: 'Enter the review detail' } },
    )
    reviewSteps.push({ path: 'question/0', persistence: 'update', step: new Step({ questions: [question] }) })
    try {
      const instance = app()
      const page = await request(instance).get(`${base}/review-123/question/0`).expect(200)
      expect(page.text).toMatch(/<h1[^>]*>\s*Review-specific risk\?\s*<\/h1>/)
      expect(page.text).toMatch(/<label class="govuk-label[^"]*" for="offenceMurderManslaughterDetail">/)
      const invalid = await request(instance)
        .post(`${base}/review-123/question/0`)
        .type('form')
        .send({ offenceMurderManslaughter: 'YES', version: '3' })
        .expect(200)
      expect(invalid.text).toContain('Enter the review detail')
      expect(csraService.updateReviewAnswers).not.toHaveBeenCalled()
      await request(instance)
        .post(`${base}/review-123/question/0`)
        .type('form')
        .send({ offenceMurderManslaughter: 'NO', version: '3' })
        .expect(302)
      expect(csraService.updateReviewAnswers).toHaveBeenCalledWith(user.username, 'A1234BC', 'review-123', 'LEI', 3, {
        ...review.stages[0].answers,
        offenceMurderManslaughter: false,
        offenceMurderManslaughterDetail: null,
      })
    } finally {
      reviewSteps.pop()
    }
  })

  it('uses a text-area question as the sole page heading', async () => {
    const textarea = new TextAreaQuestion<CsraReviewAnswers>('Describe the review', 'offenceAssistingSuicideDetail')
    reviewSteps.push({
      path: 'text-question',
      persistence: 'update',
      step: new Step({ questions: [textarea] }),
    })
    try {
      const page = await request(app()).get(`${base}/review-123/text-question`).expect(200)
      expect(page.text).toMatch(/<h1[^>]*>\s*Describe the review\s*<\/h1>/)
      expect(page.text.match(/<h1\b/g)).toHaveLength(1)
      expect(page.text).toMatch(
        /<label[^>]*class="[^"]*govuk-visually-hidden[^"]*"[^>]*for="offenceAssistingSuicideDetail"/,
      )
    } finally {
      reviewSteps.pop()
    }
  })

  it('clears answers to review steps made inapplicable by a changed reason', async () => {
    const question = new YesNoWithDetailQuestion<CsraReviewAnswers>(
      'Review-specific risk?',
      'offenceMurderManslaughter',
      'offenceMurderManslaughterDetail',
    )
    reviewSteps.push({
      path: 'question/0',
      persistence: 'update',
      step: new Step<CsraReviewAnswers>({ questions: [question] }).dependsOn(
        'reviewReason',
        'NEW_OR_ADDITIONAL_INFORMATION',
      ),
    })
    try {
      const agent = request.agent(app())
      await agent
        .post(`${base}/review-123/reason`)
        .type('form')
        .send({ reviewReason: 'SHORT_TERM_HIGH_RISK_REVIEW' })
        .expect(302)
      await agent
        .post(`${base}/review-123/evidence`)
        .type('form')
        .send({ evidenceSources: 'PNC', version: '3' })
        .expect(302)
      expect(csraService.updateReviewAnswers).toHaveBeenCalledWith(user.username, 'A1234BC', 'review-123', 'LEI', 3, {
        ...review.stages[0].answers,
        reviewReason: 'SHORT_TERM_HIGH_RISK_REVIEW',
        offenceMurderManslaughter: null,
        offenceMurderManslaughterDetail: null,
      })
    } finally {
      reviewSteps.pop()
    }
  })

  it('does not show assessment questions in the review', async () => {
    const overview = await request(app()).get(`${base}/review-123`).expect(200)
    expect(overview.text).toContain('The review has been saved')
    expect(overview.text).not.toContain('Is there evidence of murder')
    await request(app()).get(`${base}/review-123/question/0`).expect(404)
  })

  it('rejects stale updates and prevents editing a completed review', async () => {
    const instance = app()
    await request(instance)
      .post(`${base}/review-123/evidence`)
      .type('form')
      .send({ evidenceSources: 'PNC', version: '2' })
      .expect(409)
    csraService.getReviewForEditing.mockResolvedValue({ ...review, finalResult: 'STANDARD' })
    await request(instance).get(`${base}/review-123`).expect(409)
    expect(csraService.updateReviewAnswers).not.toHaveBeenCalled()
  })

  it('updates evidence without dropping saved answers', async () => {
    await request(app())
      .post(`${base}/review-123/evidence`)
      .type('form')
      .send({ evidenceSources: 'DPS', version: '3' })
      .expect(302)
    expect(csraService.updateReviewAnswers).toHaveBeenCalledWith(user.username, 'A1234BC', 'review-123', 'LEI', 3, {
      ...review.stages[0].answers,
      evidenceSources: [{ source: 'DPS' }],
    })
  })

  it('restores selected review evidence and its conditional detail', async () => {
    csraService.getReviewForEditing.mockResolvedValue({
      ...review,
      stages: [
        {
          ...review.stages[0],
          answers: { ...review.stages[0].answers, evidenceSources: [{ source: 'OTHER', details: 'Staff record' }] },
        },
      ],
    })
    const response = await request(app()).get(`${base}/review-123/evidence`).expect(200)
    expect(response.text).toMatch(/value="OTHER"[^>]*checked/)
    expect(response.text).toMatch(/name="otherEvidenceDetail"[^>]*value="Staff record"/)
  })

  it('stages the changed reason until evidence is saved', async () => {
    const agent = request.agent(app())
    const page = await agent.get(`${base}/review-123/reason`).expect(200)
    expect(page.text).toContain('New or additional information')
    await agent
      .post(`${base}/review-123/reason`)
      .type('form')
      .send({ reviewReason: 'SHORT_TERM_HIGH_RISK_REVIEW' })
      .expect(302)
      .expect('Location', `${base}/review-123/evidence`)
    expect(csraService.updateReviewAnswers).not.toHaveBeenCalled()
    await agent
      .post(`${base}/review-123/evidence`)
      .type('form')
      .send({ evidenceSources: 'PNC', version: '3' })
      .expect(302)
      .expect('Location', `${base}/review-123`)
    expect(csraService.updateReviewAnswers).toHaveBeenCalledWith(user.username, 'A1234BC', 'review-123', 'LEI', 3, {
      ...review.stages[0].answers,
      reviewReason: 'SHORT_TERM_HIGH_RISK_REVIEW',
    })
  })

  it('does not allow changing the reason after an interim rating', async () => {
    csraService.getReviewForEditing.mockResolvedValue({ ...review, interimResult: 'STANDARD' })
    await request(app()).get(`${base}/review-123/reason`).expect(409)
    expect(csraService.updateReviewAnswers).not.toHaveBeenCalled()
  })

  it('discards a staged reason when returning to the review without saving', async () => {
    const agent = request.agent(app())
    await agent
      .post(`${base}/review-123/reason`)
      .type('form')
      .send({ reviewReason: 'SHORT_TERM_HIGH_RISK_REVIEW' })
      .expect(302)
    await agent.get(`${base}/review-123`).expect(200)
    await agent
      .post(`${base}/review-123/evidence`)
      .type('form')
      .send({ evidenceSources: 'PNC', version: '3' })
      .expect(302)
    expect(csraService.updateReviewAnswers).toHaveBeenCalledWith(
      user.username,
      'A1234BC',
      'review-123',
      'LEI',
      3,
      review.stages[0].answers,
    )
  })

  it('resumes a previously created review without answers without creating a second review', async () => {
    csraService.getReviewForEditing.mockResolvedValue({ ...review, stages: [] })
    const agent = request.agent(app())
    await agent.get(`${base}/review-123`).expect(302).expect('Location', `${base}/review-123/reason`)
    await agent
      .post(`${base}/review-123/reason`)
      .type('form')
      .send({ reviewReason: 'SHORT_TERM_HIGH_RISK_REVIEW' })
      .expect(302)
      .expect('Location', `${base}/review-123/evidence`)
    await agent
      .post(`${base}/review-123/evidence`)
      .type('form')
      .send({ evidenceSources: 'PNC', version: '1' })
      .expect(302)
      .expect('Location', `${base}/review-123`)
    expect(csraService.startCsraReview).not.toHaveBeenCalled()
    expect(csraService.updateReviewAnswers).toHaveBeenCalledWith(user.username, 'A1234BC', 'review-123', 'LEI', 1, {
      reviewReason: 'SHORT_TERM_HIGH_RISK_REVIEW',
      evidenceSources: [{ source: 'PNC' }],
    })
  })

  it('refuses to open a review belonging to another prisoner', async () => {
    csraService.getReviewForEditing.mockResolvedValue({ ...review, prisonerNumber: 'B1234CD' })
    await request(app()).get(`${base}/review-123`).expect(404)
  })
})
