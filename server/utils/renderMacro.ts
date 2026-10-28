import nunjucks from 'nunjucks'

// TODO: remove this and replace uses of it with FeComponentsService.getComponent
export default function renderMacro(macroPath: string, macroName: string, params: object) {
  const macroParams = JSON.stringify(params, null, 2)
  const macroString = `
      {%- from "${macroPath}.njk" import ${macroName} -%}
      {{- ${macroName}(${macroParams}) -}}
    `

  return nunjucks.renderString(macroString, undefined)
}
