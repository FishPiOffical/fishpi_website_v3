export type ChatSendShortcut = 'ctrl-enter' | 'enter'

export function matchesChatSendShortcut(event: KeyboardEvent, shortcut: ChatSendShortcut) {
  return event.key === 'Enter' && !event.isComposing && event.keyCode !== 229
    && !event.shiftKey && !event.altKey && !event.metaKey
    && event.ctrlKey === (shortcut === 'ctrl-enter')
}
