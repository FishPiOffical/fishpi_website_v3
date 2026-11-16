import { readFile } from 'node:fs/promises'
import { compileScript, parse } from '@vue/compiler-sfc'
import ts from 'typescript'

export async function listUiImports() {
  return Promise.all(['FpPagination', 'FpListState'].map(async name => {
    const file = new URL(`../../src/components/${name}.vue`, import.meta.url)
    const { descriptor } = parse(await readFile(file, 'utf8'))
    const { content } = compileScript(descriptor, { id: name, inlineTemplate: true })
    const { outputText } = ts.transpileModule(content, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    const js = outputText.replace(/from ['"]vue['"]/g, `from '${import.meta.resolve('vue')}'`)
    return [`@/components/${name}.vue`, `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`]
  }))
}
