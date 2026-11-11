// Compiled Vue fixtures use data: modules. Resolve the shared pure display helper
// from that realm without replacing it with a mock or changing protocol shims.
import { registerHooks } from 'node:module'
const time = new URL('../src/utils/time.ts', import.meta.url).href
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/utils/publicSnapshots') return { url: new URL('../src/utils/publicSnapshots.ts', import.meta.url).href, shortCircuit: true }
  if (specifier === '@/utils/readingProgress') return { url: new URL('../src/utils/readingProgress.ts', import.meta.url).href, shortCircuit: true }
  if (specifier === '@/utils/chatAppearance') return { url: new URL('../src/utils/chatAppearance.ts', import.meta.url).href, shortCircuit: true }
  if (specifier === '@/composables/useScrollPagination') return { url: new URL('../src/composables/useScrollPagination.ts', import.meta.url).href, shortCircuit: true }
  if (specifier === '@/emoji/fish001') return { url: new URL('../src/emoji/fish001.ts', import.meta.url).href, shortCircuit: true }
  if (specifier === '@/stores/emojiPreferences') return { url: new URL('../src/stores/emojiPreferences.ts', import.meta.url).href, shortCircuit: true }
  if (specifier === '@/utils/chatSendShortcut') return { url: new URL('../src/utils/chatSendShortcut.ts', import.meta.url).href, shortCircuit: true }
  if (specifier === '@/utils/avatar') return { url: new URL('../src/utils/avatar.ts', import.meta.url).href, shortCircuit: true }
  if (specifier === '@/utils/time') return { url: time, shortCircuit: true }
  return next(specifier, context)
} })
