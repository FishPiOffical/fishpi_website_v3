// 父组件专项编译真实置顶工具与标签，避免把共享展示替换为空组件。
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'

const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const helperSource = await fs.readFile(new URL('../../src/utils/articlePin.ts', import.meta.url), 'utf8')
export const articlePinFixtureURL = url(compile(helperSource))
const source = await fs.readFile(new URL('../../src/components/articles/ArticlePinBadge.vue', import.meta.url), 'utf8')
const script = compileScript(parse(source).descriptor, { id: 'article-pin-fixture', inlineTemplate: true }).content
const dependencies = new Map([
  ['vue', import.meta.resolve('vue')],
  ['@/utils/articlePin', articlePinFixtureURL],
])
export const articlePinBadgeFixtureURL = url(compile(script).replace(/from\s+(['"])([^'"]+)\1/g,
  (whole, quote, name) => dependencies.has(name) ? `from '${dependencies.get(name)}'` : whole))
export const articlePinFixtureImports = [
  ['@/utils/articlePin', articlePinFixtureURL],
  ['@/components/articles/ArticlePinBadge.vue', articlePinBadgeFixtureURL],
  ['./ArticlePinBadge.vue', articlePinBadgeFixtureURL],
]
