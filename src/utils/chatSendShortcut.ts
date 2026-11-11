export type ChatSendShortcut = 'mod-enter' | 'enter'

export function usesMacSendModifier() {
  return typeof navigator !== 'undefined' && /^Mac/i.test(navigator.platform)
}

export function matchesChatSendShortcut(event: KeyboardEvent, shortcut: ChatSendShortcut) {
  if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229 || event.shiftKey || event.altKey) return false
  if (shortcut === 'enter') return !event.ctrlKey && !event.metaKey
  return usesMacSendModifier()
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
}
