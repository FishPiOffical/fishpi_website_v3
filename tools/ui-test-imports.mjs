// Compiled Vue fixtures use data: modules. Resolve the shared pure display helper
// from that realm without replacing it with a mock or changing protocol shims.
import { registerHooks } from 'node:module'
const time = new URL('../src/utils/time.ts', import.meta.url).href
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/utils/readingProgress') return { url: new URL('../src/utils/readingProgress.ts', import.meta.url).href, shortCircuit: true }
  if (specifier === '@/utils/chatAppearance') return { url: new URL('../src/utils/chatAppearance.ts', import.meta.url).href, shortCircuit: true }
  if (specifier === '@/utils/time') return { url: time, shortCircuit: true }
  return next(specifier, context)
} })
