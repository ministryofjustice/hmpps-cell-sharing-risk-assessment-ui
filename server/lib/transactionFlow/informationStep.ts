import Step from './step'

export default class InformationStep extends Step {
  constructor(options: Pick<Step, 'title' | 'bodyHtml'>) {
    super({ ...options, questions: [] })
  }
}
