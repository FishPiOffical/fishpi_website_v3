let nextGroup = 0

function marker(element: Element | null, text: string) {
  return element?.tagName === 'P' && !element.childElementCount && element.textContent.trim() === text
}

function mountGroup(start: Element, end: Element, blocks: HTMLElement[], labels: string[]) {
  const group = document.createElement('div')
  group.className = 'fp-code-group'
  const list = document.createElement('div')
  list.className = 'fp-code-tabs'
  list.setAttribute('role', 'tablist')
  list.setAttribute('aria-label', '示例代码语言')
  group.append(list)
  const id = 'fp-code-group-' + ++nextGroup
  const tabs = blocks.map((block, index) => {
    const tab = document.createElement('button')
    const panel = document.createElement('div')
    tab.type = 'button'
    tab.id = id + '-tab-' + index
    tab.textContent = labels[index]
    tab.setAttribute('role', 'tab')
    panel.id = id + '-panel-' + index
    tab.setAttribute('aria-controls', panel.id)
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', tab.id)
    panel.append(block)
    group.append(panel)
    list.append(tab)
    return { tab, panel }
  })
  function select(index: number) {
    tabs.forEach(({ tab, panel }, position) => {
      const selected = position === index
      tab.tabIndex = selected ? 0 : -1
      tab.setAttribute('aria-selected', String(selected))
      panel.tabIndex = selected ? 0 : -1
      panel.setAttribute('aria-hidden', String(!selected))
      if (selected) panel.removeAttribute('hidden')
      else panel.setAttribute('hidden', 'until-found')
    })
  }
  tabs.forEach(({ tab, panel }, index) => {
    tab.onclick = () => select(index)
    panel.addEventListener('beforematch', () => select(index))
    tab.onkeydown = event => {
      let target: number
      switch (event.key) {
        case 'ArrowRight': target = (index + 1) % tabs.length; break
        case 'ArrowLeft': target = (index + tabs.length - 1) % tabs.length; break
        case 'Home': target = 0; break
        case 'End': target = tabs.length - 1; break
        default: return
      }
      event.preventDefault()
      select(target)
      tabs[target].tab.focus()
    }
  })
  select(0)
  start.replaceWith(group)
  end.remove()
}

export function groupArticleCode(root: HTMLElement, languages: Map<HTMLElement, string>) {
  for (const start of root.querySelectorAll(':scope > p')) {
    if (!marker(start, ':::code-group')) continue
    const blocks: HTMLElement[] = [], labels: string[] = []
    let node: ChildNode | null = start.nextSibling
    while (node) {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) { node = node.nextSibling; continue }
      if (!(node instanceof HTMLElement) || node.tagName !== 'PRE') break
      const code = node.querySelector<HTMLElement>(':scope > code:only-child')
      if (!code) break
      blocks.push(node)
      labels.push(languages.get(code) || '示例 ' + blocks.length)
      node = node.nextSibling
    }
    if (blocks.length >= 2 && node instanceof HTMLElement && marker(node, ':::')) mountGroup(start, node, blocks, labels)
  }
}
