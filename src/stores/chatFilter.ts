import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type ChatBlockMatch = 'nickname' | 'uid' | 'keyword'
export type ChatBlockMode = 'block' | 'hide'
export type ChatLineFilterMode = ChatBlockMode | 'show'

export interface ChatBlockRule {
  id: string
  match: ChatBlockMatch
  value: string
  mode: ChatBlockMode
}

const STORAGE = 'fp.chatFilter'

interface ChatFilterPref {
  enabled: boolean
  rules: ChatBlockRule[]
}

function read(): ChatFilterPref {
  if (typeof localStorage === 'undefined') return { enabled: false, rules: [] }
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return { enabled: false, rules: [] }
    const parsed = JSON.parse(raw) as Partial<ChatFilterPref>
    const rules = Array.isArray(parsed.rules)
      ? parsed.rules.filter(
          (rule): rule is ChatBlockRule =>
            !!rule &&
            typeof rule.id === 'string' &&
            (rule.match === 'nickname' || rule.match === 'uid' || rule.match === 'keyword') &&
            typeof rule.value === 'string' &&
            (rule.mode === 'block' || rule.mode === 'hide'),
        )
      : []
    return { enabled: parsed.enabled === true, rules }
  } catch {
    return { enabled: false, rules: [] }
  }
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase()
}

export const useChatFilterStore = defineStore('chatFilter', () => {
  const pref = ref(read())
  const enabled = computed({
    get: () => pref.value.enabled,
    set: (value: boolean) => {
      pref.value = { ...pref.value, enabled: value }
      persist()
    },
  })
  const rules = computed(() => pref.value.rules)

  function persist() {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE, JSON.stringify(pref.value))
  }

  function addRule(match: ChatBlockMatch, value: string, mode: ChatBlockMode) {
    const cleanValue = value.trim()
    if (!cleanValue) return
    const key = normalize(cleanValue)
    const existing = pref.value.rules.findIndex((rule) => rule.match === match && normalize(rule.value) === key)
    const rules = [...pref.value.rules]
    if (existing >= 0) rules[existing] = { ...rules[existing], mode }
    else rules.push({ id: `${match}:${key}`, match, value: cleanValue, mode })
    pref.value = { ...pref.value, rules }
    persist()
  }

  function setMode(id: string, mode: ChatBlockMode) {
    const index = pref.value.rules.findIndex((item) => item.id === id)
    if (index < 0) return
    const rules = [...pref.value.rules]
    rules[index] = { ...rules[index], mode }
    pref.value = { ...pref.value, rules }
    persist()
  }

  function removeRule(id: string) {
    pref.value = { ...pref.value, rules: pref.value.rules.filter((rule) => rule.id !== id) }
    persist()
  }

  function modeFor(line: {
    userOId?: string
    userName?: string
    userNickname?: string
    html?: string
    redPacket?: { msg?: string }
    card?: Record<string, unknown>
  }): ChatLineFilterMode {
    if (!pref.value.enabled) return 'show'
    const messageText = [
      (line.html || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
          const point = code[0].toLowerCase() === 'x' ? Number.parseInt(code.slice(1), 16) : Number(code)
          return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' '
        })
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'"),
      line.redPacket?.msg || '',
      ...Object.values(line.card || {}).flatMap((value) =>
        typeof value === 'string'
          ? [value]
          : Array.isArray(value)
            ? value.filter((item): item is string => typeof item === 'string')
            : [],
      ),
    ]
      .filter(Boolean)
      .join(' ')
    const normalizedMessage = normalize(messageText)
    const matched = pref.value.rules.filter((rule) => {
      const value = normalize(rule.value)
      if (rule.match === 'uid') return normalize(line.userOId || '') === value
      if (rule.match === 'keyword') return normalizedMessage.includes(value)
      return normalize(line.userNickname || '') === value || normalize(line.userName || '') === value
    })
    if (matched.some((rule) => rule.mode === 'block')) return 'block'
    return matched.some((rule) => rule.mode === 'hide') ? 'hide' : 'show'
  }

  return { enabled, rules, addRule, setMode, removeRule, modeFor }
})
