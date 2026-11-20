<script setup lang="ts">
import { useEmojiPreferencesStore } from '@/stores/emojiPreferences'
import { useScrollPagination } from '@/composables/useScrollPagination'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ApiError, getAuthContextVersion } from '@/api/http'
import type { EmojiGroup, EmojiItem } from '@/api/fishpi'
import { addV3EmojiURL, createV3EmojiGroup, deleteV3EmojiGroup, fetchV3EmojiGroups, fetchV3GroupEmojis,
  fetchV3FrequentAliases, fetchV3EmotionOptions, saveV3FrequentEmotions, removeV3GroupEmoji, emojiOperationKey, updateV3EmojiGroup, updateV3EmojiItem, shareV3EmojiGroup, importV3EmojiGroup, migrateV3LegacyEmojis } from '@/api/v3-emojis'
import { uploadV3Files } from '@/api/v3-uploads'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'
import FpDialog from '@/components/FpDialog.vue'
import { imageThumbnail } from '@/utils/avatar'

const { accessToken, account } = storeToRefs(useAuthStore())
const emojiPreferences = useEmojiPreferencesStore()
const groups = ref<EmojiGroup[]>([]), items = ref<EmojiItem[]>([]), groupId = ref('')
const loading = ref(false), mutating = ref(false), error = ref(''), frequencyLoading = ref(false), catalogLoaded = ref(false)
const frequencyError = ref('')
const newGroup = ref(''), newUrl = ref(''), newName = ref(''), frequency = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const imageFile = ref<File | null>(null), imageGroup = ref(''), imageName = ref(''), uploadedUrl = ref('')
const uploading = ref(false)
const busy = computed(() => uploading.value || mutating.value)
let uploadController: AbortController | null = null
const catalog = ref<string[][]>([])
const editGroupName = ref(''), editGroupSort = ref(0), editItemId = ref(''), editItemName = ref(''), editItemSort = ref(0)
const importCode = ref(''), sharedCode = ref(''), transferNotice = ref('')
const groupPage = ref(0), groupPages = ref(0), groupTotal = ref(0), itemPage = ref(0), itemPages = ref(0), itemTotal = ref(0)
const selectedGroup = computed(() => groups.value.find(g => g.oId === groupId.value))
const panelTitles = { add: '添加图片', create: '新建分组', group: '管理分组', item: '编辑表情', transfer: '导入表情', frequent: '常用表情' } as const
const panel = ref<keyof typeof panelTitles | null>(null)
const source = ref<'file' | 'url'>('file')
const aliasQuery = ref(''), aliasLimit = ref(24)
watch(aliasQuery, () => { aliasLimit.value = 24 })
const frequentAliases = computed(() => frequency.value.split(',').map(name => name.trim()).filter(Boolean))
const availableAliases = computed(() => Array.from(new Set(catalog.value.flat())))
const matchingAliases = computed(() => {
  const search = aliasQuery.value.trim().toLowerCase()
  return search ? availableAliases.value.filter(name => name.toLowerCase().includes(search)) : availableAliases.value
})
const editedItem = computed(() => items.value.find(item => item.oId === editItemId.value))
const panelBody = ref<HTMLElement | null>(null), libraryTitle = ref<HTMLElement | null>(null)
let panelTrigger: HTMLElement | null = null

function toggleAlias(alias: string) {
  const selected = frequentAliases.value
  frequency.value = (selected.includes(alias) ? selected.filter(name => name !== alias) : [...selected, alias]).join(',')
}
function openPanel(kind: keyof typeof panelTitles, event?: Event) {
  panelTrigger = (event?.currentTarget as HTMLElement | null) ?? null
  transferNotice.value = ''
  if (kind === 'add' && !imageFile.value && !newUrl.value && !imageName.value && !newName.value) {
    imageGroup.value = selectedGroup.value?.type === 0 ? groupId.value : ''
  }
  panel.value = kind
  if (kind === 'frequent') { aliasQuery.value = ''; aliasLimit.value = 24 }
  if (kind === 'frequent' && !catalogLoaded.value && !frequencyLoading.value) void loadFrequency()
}
function closePanel() {
  if (!panel.value) return
  const trigger = panelTrigger
  panel.value = null
  panelTrigger = null
  void nextTick(() => { (trigger?.isConnected ? trigger : libraryTitle.value)?.focus({ preventScroll: true }) })
}
watch(panelBody, (body, _, onCleanup) => {
  const dialog = body?.closest<HTMLElement>('[role="dialog"]')
  if (!body || !dialog) return
  body.focus({ preventScroll: true })
  const keepFocus = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary'))
      .filter(control => {
        const collapsed = control.closest('details:not([open])')
        return (!collapsed || collapsed.querySelector(':scope > summary') === control) && control.getClientRects().length
      })
    const first = controls[0], last = controls.at(-1)
    if (!first || !last) { event.preventDefault(); return }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === body)) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus()
    }
  }
  dialog.addEventListener('keydown', keepFocus)
  onCleanup(() => dialog.removeEventListener('keydown', keepFocus))
}, { flush: 'post' })

watch(selectedGroup, group => { editGroupName.value = group?.name || ''; editGroupSort.value = group?.sort ?? 0; editItemId.value = ''; sharedCode.value = '' })
let epoch = 0, sequence = 0, frequencySequence = 0, mounted = false
function identity() { return JSON.stringify([getAuthContextVersion(), !!accessToken.value, account.value?.oId || '']) }
let boundary = identity()
const intentions = new Map<string, { fingerprint: string; key: string }>()
function mergeGroups(values: EmojiGroup[]) {
  return Array.from(new Map(values.map(g => [g.oId, g])).values()).sort((a,b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.oId < b.oId ? -1 : a.oId > b.oId ? 1 : 0))
}
async function read<T>(fetcher: () => Promise<T>, apply: (value: T) => void, failed?: (error: unknown) => void, preserveItems = false) {
  const owner = identity(), currentEpoch = epoch, request = ++sequence
  if (!accessToken.value) return false
  loading.value = true; error.value = ''
  const current = () => mounted && currentEpoch === epoch && request === sequence && owner === identity()
  try { const result = await fetcher(); if (current()) { apply(result); return true } }
  catch (failure) { if (current()) { if (!preserveItems) items.value = []; error.value = failure instanceof Error ? failure.message : '表情加载失败'; failed?.(failure) } }
  finally { if (current()) loading.value = false }
  return false
}
function loadItems(more = false) {
  if (more && (busy.value || loading.value || itemPage.value >= itemPages.value)) return Promise.resolve(false)
  const id = groupId.value
  if (!id) { items.value = []; itemTotal.value = itemPage.value = itemPages.value = 0; return Promise.resolve() }
  if (!more) { items.value = []; itemPage.value = itemPages.value = itemTotal.value = 0 }
  return read(() => fetchV3GroupEmojis(id, more ? itemPage.value + 1 : 1, 50, emojiPreferences.order), page => {
    items.value = more ? [...items.value, ...page.list] : page.list
    itemPage.value = page.p; itemPages.value = page.pageCount; itemTotal.value = page.total
  }, failure => {
    if (failure instanceof ApiError && failure.status === 404) { groups.value = groups.value.filter(g => g.oId !== id); groupId.value = ''; items.value = []; itemTotal.value = itemPage.value = itemPages.value = 0 }
  }, more)
}
async function loadGroups(preferred?: EmojiGroup) {
  const keep = preferred ?? selectedGroup.value, owner = identity(), currentEpoch = epoch
  const applied = await read(() => fetchV3EmojiGroups(), page => {
    groups.value = mergeGroups(keep && !page.list.some(g => g.oId === keep.oId) ? [...page.list, keep] : page.list)
    groupPage.value = page.p; groupPages.value = page.pageCount; groupTotal.value = page.total
    groupId.value = keep && groups.value.some(g => g.oId === keep.oId) ? keep.oId : groups.value[0]?.oId || ''
  })
  if (applied && owner === identity() && currentEpoch === epoch) await loadItems()
}
async function loadTransferredGroup(id: string) {
  const owner = identity(), currentEpoch = epoch
  const applied = await read(async () => {
    const first = await fetchV3EmojiGroups()
    let found = first.list.find(group => group.oId === id)
    // Imports append after the current maximum sort; inspect the last page first.
    if (first.pageCount > 100) throw new ApiError('分组过多，请刷新后选择目标分组', 503)
    const pages = first.pageCount > 1 ? [first.pageCount, ...Array.from({ length: Math.max(0, first.pageCount - 2) }, (_, i) => i + 2)] : []
    for (const p of pages) {
      if (found) break
      if (!mounted || owner !== identity() || currentEpoch !== epoch) return { first, found: undefined }
      const page = await fetchV3EmojiGroups(p)
      found = page.list.find(group => group.oId === id)
    }
    if (!found) throw new ApiError('操作已完成，但目标分组已不可用，请刷新列表', 404)
    return { first, found }
  }, ({ first, found }) => {
    if (!found) return
    groups.value = mergeGroups([...first.list, found]); groupId.value = found.oId
    groupPage.value = first.p; groupPages.value = first.pageCount; groupTotal.value = first.total
  })
  if (applied && owner === identity() && currentEpoch === epoch) await loadItems()
}
function moreGroups() {
  return read(() => fetchV3EmojiGroups(groupPage.value + 1), page => {
    groups.value = mergeGroups([...groups.value, ...page.list]); groupPage.value = page.p; groupPages.value = page.pageCount; groupTotal.value = page.total
  })
}
const itemsEnd = ref<HTMLElement | null>(null)
useScrollPagination(
  itemsEnd,
  () => !!groupId.value && !busy.value && !loading.value && !error.value && itemPage.value < itemPages.value,
  () => loadItems(true),
  () => identity() + ':' + groupId.value + ':' + emojiPreferences.order,
)
watch(() => emojiPreferences.order, () => { if (mounted && !busy.value && groupId.value) void loadItems() })
function selectGroup(id: string) {
  if (id === groupId.value) return
  transferNotice.value = ''
  groupId.value = id
  void loadItems()
}
async function loadFrequency() {
  const owner = identity(), currentEpoch = epoch, request = ++frequencySequence
  if (!accessToken.value) return
  frequencyLoading.value = true; frequencyError.value = ''
  const current = () => mounted && owner === identity() && currentEpoch === epoch && request === frequencySequence
  try {
    const [aliases, options] = await Promise.all([fetchV3FrequentAliases(), fetchV3EmotionOptions()])
    if (current()) { frequency.value = aliases.join(','); catalog.value = options.groups; catalogLoaded.value = true }
  } catch (failure) { if (current()) { catalogLoaded.value = false; frequencyError.value = failure instanceof Error ? failure.message : '常用表情加载失败' } }
  finally { if (current()) frequencyLoading.value = false }
}
function reset() {
  panel.value = null; panelTrigger = null; aliasQuery.value = ''; source.value = 'file'
  epoch++; sequence++; frequencySequence++; intentions.clear(); groups.value = []; items.value = []; groupId.value = ''
  newGroup.value = newUrl.value = newName.value = frequency.value = frequencyError.value = error.value = ''; catalog.value = []; catalogLoaded.value = false
  groupPage.value = groupPages.value = groupTotal.value = itemPage.value = itemPages.value = itemTotal.value = 0
  editGroupName.value = editItemId.value = editItemName.value = importCode.value = sharedCode.value = transferNotice.value = ''
  editGroupSort.value = editItemSort.value = 0
  uploadController?.abort()
  uploadController = null
  imageFile.value = null
  imageGroup.value = imageName.value = uploadedUrl.value = ''
  if (fileInput.value) fileInput.value.value = ''
  loading.value = frequencyLoading.value = mutating.value = uploading.value = false
}
onMounted(() => { mounted = true; if (accessToken.value) void loadGroups() })
watch([accessToken, () => account.value?.oId], () => {
  const current = identity()
  if (current === boundary) return
  boundary = current; reset()
  if (mounted && accessToken.value) void loadGroups()
}, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
async function mutate<T>(operation: string, payload: unknown, action: (key: string) => Promise<T>, done: (result: T) => Promise<unknown> | void) {
  const owner = identity(), currentEpoch = epoch
  if (!accessToken.value || busy.value) return
  mutating.value = true; error.value = ''
  try {
    const fingerprint = JSON.stringify(payload)
    let intent = intentions.get(operation)
    if (!intent || intent.fingerprint !== fingerprint) { intent = { fingerprint, key: emojiOperationKey() }; intentions.set(operation, intent) }
    const result = await action(intent.key)
    if (mounted && owner === identity() && currentEpoch === epoch) { intentions.delete(operation); await done(result) }
  } catch (failure) { if (mounted && owner === identity() && currentEpoch === epoch) error.value = failure instanceof Error ? failure.message : '表情操作失败' }
  finally { if (currentEpoch === epoch && owner === identity()) mutating.value = false }
}
function onCreate() {
  const name = newGroup.value.trim(), sort = groupTotal.value
  if (!name) return
  return mutate('create-group', { name, sort }, key => createV3EmojiGroup(name, sort, key), async group => { newGroup.value = ''; closePanel(); await loadGroups(group) })
}
function onDeleteGroup() {
  const id = groupId.value
  if (!id || selectedGroup.value?.type !== 0) return
  return mutate('delete-group', { id }, key => deleteV3EmojiGroup(id, key), async () => { groupId.value = ''; closePanel(); await loadGroups() })
}
function onAddUrl() {
  const id = imageGroup.value, url = newUrl.value.trim(), name = newName.value.trim(), sort = 0
  if (!url) return
  return mutate('add-url', { id, url, name, sort }, key => addV3EmojiURL(id, url, sort, name, key), async result => {
    newUrl.value = newName.value = ''
    closePanel()
    await showAddedImage(result.groupId)
  })
}
function selectImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  uploadedUrl.value = ''
  imageFile.value = null
  error.value = ''
  if (!file) return
  if (!/\.(?:png|jpe?g|gif|webp)$/i.test(file.name) ||
      (file.type && !/^image\/(?:png|jpeg|gif|webp)$/.test(file.type)) || !file.size) {
    input.value = ''
    error.value = '请选择有效的 PNG、JPEG、GIF 或 WebP 图片'
    return
  }
  imageFile.value = file
}

async function addLocalImage() {
  const file = imageFile.value
  if (!file || busy.value || loading.value || !accessToken.value) return
  const owner = identity(), currentEpoch = epoch
  const id = imageGroup.value, name = imageName.value.trim()
  let url = uploadedUrl.value
  if (!url) {
    const controller = new AbortController()
    uploadController = controller
    uploading.value = true
    error.value = ''
    try {
      const [image] = await uploadV3Files([file], controller.signal)
      if (controller.signal.aborted || owner !== identity() || currentEpoch !== epoch) return
      if (!image?.url) throw new Error('图片上传失败，请重试')
      url = uploadedUrl.value = image.url
    } catch (failure) {
      if (!controller.signal.aborted && owner === identity() && currentEpoch === epoch) {
        error.value = failure instanceof Error ? failure.message : '图片上传失败'
      }
      return
    } finally {
      if (uploadController === controller) {
        uploadController = null
        uploading.value = false
      }
    }
  }
  if (owner !== identity() || currentEpoch !== epoch) return
  await mutate('add-local-image', { id, url, name }, key => addV3EmojiURL(id, url, 0, name, key), async result => {
    imageFile.value = null
    uploadedUrl.value = imageName.value = ''
    if (fileInput.value) fileInput.value.value = ''
    closePanel()
    await showAddedImage(result.groupId)
  })
}

async function showAddedImage(targetId: string) {
  transferNotice.value = '图片已添加到表情包'
  const target = groups.value.find(group => group.oId === targetId)
  if (target) await loadGroups(target)
  else await loadTransferredGroup(targetId)
}

function onRemove(item: EmojiItem) {
  const group = groupId.value, id = item.oId
  if (!group || !id) return
  return mutate('remove-item', { group, id }, key => removeV3GroupEmoji(group, id, key), () => { closePanel(); return loadItems() })
}
function validSort(value: number): boolean {
  if (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) return true
  error.value = '排序值须为32位整数'; return false
}
function onUpdateGroup() {
  const id = groupId.value, name = editGroupName.value.trim(), sort = editGroupSort.value
  if (!id || selectedGroup.value?.type !== 0 || !name || !validSort(sort)) return
  return mutate('update-group', { id, name, sort }, key => updateV3EmojiGroup(id, name, sort, key), group => { closePanel(); return loadGroups(group) })
}
function editItem(item: EmojiItem, event?: Event) { openPanel('item', event); editItemId.value = item.oId || ''; editItemName.value = item.name; editItemSort.value = item.sort ?? 0 }
function onUpdateItem() {
  const group = groupId.value, id = editItemId.value, name = editItemName.value.trim(), sort = editItemSort.value
  if (!group || !id || !validSort(sort)) return
  return mutate('update-item', { group, id, name, sort }, key => updateV3EmojiItem(group, id, name, sort, key), async () => { editItemId.value = ''; closePanel(); await loadItems() })
}
function onShare() {
  const id = groupId.value
  if (!id || selectedGroup.value?.type !== 0) return
  return mutate('share-group', { id }, key => shareV3EmojiGroup(id, key), result => {
    sharedCode.value = result.shareCode; transferNotice.value = `已生成「${result.groupName}」快照，共 ${result.emojiCount} 张图片`
  })
}
function onImport() {
  const code = importCode.value.trim().toUpperCase()
  if (!/^[A-Z0-9]{8,16}$/.test(code)) { error.value = '分享码应为8至16位字母或数字'; return }
  return mutate('import-group', { code }, key => importV3EmojiGroup(code, key), async result => {
    importCode.value = ''; transferNotice.value = `已导入 ${result.emojiCount} 张图片到「${result.groupName}」`
    closePanel()
    await loadTransferredGroup(result.groupId)
  })
}
function onMigrate() {
  return mutate('migrate-legacy', {}, key => migrateV3LegacyEmojis(key), async result => {
    transferNotice.value = `已处理 ${result.processedCount} 张历史图片，新增 ${result.addedCount} 张`
    closePanel()
    await loadTransferredGroup(result.groupId)
  })
}
function saveFrequency(resetDefaults = false) {
  const emotions = resetDefaults || !frequency.value.trim() ? [] : frequency.value.split(',').map(alias => alias.trim())
  const allowed = new Set(catalog.value.flat())
  if (new Set(emotions).size !== emotions.length || emotions.some(alias => !alias || !allowed.has(alias))) { error.value = '常用表情不能重复或留空项，请使用目录中的名称'; return }
  return mutate('save-frequency', { emotions }, key => saveV3FrequentEmotions(emotions, key), aliases => { frequency.value = aliases.join(','); transferNotice.value = '常用表情已保存'; closePanel() })
}
</script>

<template>
  <section class="emoji-packs" aria-label="我的表情包">
    <header class="library-head">
      <div class="library-title">
        <h2 ref="libraryTitle" tabindex="-1">我的表情包</h2>
        <span v-if="groupPage" class="group-count">{{ groupTotal }} 个分组</span>
      </div>
      <div class="library-tools">
        <button type="button" class="library-refresh" aria-label="刷新表情包" title="刷新表情包"
          :disabled="busy || loading" @click="loadGroups(); if (catalogLoaded) loadFrequency()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.6 8a7.2 7.2 0 0 1 12.2-2l2.1 3M4.1 15l2.1 3a7.2 7.2 0 0 0 12.2-2"/></svg>
        </button>
        <button type="button" class="library-add" data-tone="primary" aria-haspopup="dialog" :disabled="busy || loading" @click="openPanel('add', $event)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>添加图片
        </button>
      </div>
    </header>

    <div class="group-bar" role="group" aria-label="选择表情分组">
      <div class="group-options">
        <button v-for="group in groups" :key="group.oId" type="button" class="group-choice"
          :aria-pressed="group.oId === groupId" :disabled="busy" @click="selectGroup(group.oId)">
          {{ group.name || '未命名分组' }}
        </button>
        <button v-if="groupPage < groupPages" type="button" class="group-more" :disabled="busy || loading" @click="moreGroups">更多分组</button>
      </div>
      <button type="button" class="group-new" aria-haspopup="dialog" :disabled="busy || loading" @click="openPanel('create', $event)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V6a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Zm9 3v5m-2.5-2.5h5"/></svg>新建分组
      </button>
    </div>

    <p v-if="error && !panel" role="alert">{{ error }}</p>
    <div class="gallery-bar">
      <span class="gallery-count">
        <template v-if="itemPage">{{ itemTotal }} 张图片<span v-if="itemPage < itemPages"> · 已加载 {{ items.length }} 张</span></template>
      </span>
      <div class="gallery-tools">
        <button type="button" class="library-tool" aria-haspopup="dialog" :disabled="busy" @click="openPanel('frequent', $event)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14a4.5 4.5 0 0 0 8 0M8.5 9.5h.1m6.8 0h.1"/></svg>
          常用表情
        </button>
        <button type="button" class="library-tool" aria-haspopup="dialog" :disabled="busy || loading" @click="openPanel('transfer', $event)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m-4-4 4 4 4-4M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>
          导入与迁移
        </button>
        <button v-if="selectedGroup?.type === 0" type="button" class="library-link" :disabled="busy || loading"
          @click="openPanel('group', $event)">管理分组</button>
      </div>
    </div>
    <FpLoading v-if="loading && !items.length" small text="正在读取表情包…" />
    <div v-if="items.length" class="sticker-grid">
      <button v-for="item in items" :key="item.oId || item.name + (item.url || '')" class="sticker" type="button" aria-haspopup="dialog"
        :disabled="!item.oId || busy" :aria-label="`编辑表情：${item.name || '未命名表情'}`" @click="editItem(item, $event)">
        <span class="sticker-picture">
          <img v-if="item.url" :src="imageThumbnail(item.url, 68, 68)" alt="" width="68" height="68" loading="lazy" />
          <span v-else class="missing-image">无预览</span>
        </span>
        <span class="sticker-name" :title="item.name">{{ item.name || '未命名表情' }}</span>
      </button>
    </div>
    <div v-else-if="!loading && !error && (!selectedGroup || itemPage)" class="library-empty">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.4"/><path d="m4 17 4-4 3 3 4-6 5 6"/></svg>
      <span>{{ selectedGroup ? '这个分组还没有图片' : '还没有收藏的表情图片' }}</span>
      <button type="button" class="library-link" @click="openPanel('add', $event)">添加第一张图片</button>
    </div>
    <button v-if="itemPage < itemPages" ref="itemsEnd" type="button" class="more-pictures" :disabled="busy || loading"
      @click="loadItems(true)">{{ loading ? '正在读取…' : '更多图片' }}</button>

    <p v-if="transferNotice && !panel" role="status">{{ transferNotice }}</p>

    <FpDialog :open="!!panel" :title="panel ? panelTitles[panel] : ''" :width="452"
      :persistent="busy" :closable="!busy" @close="closePanel">
      <div v-if="panel" ref="panelBody" class="pack-panel" tabindex="-1">
        <form v-if="panel === 'add'" aria-label="添加图片" @submit.prevent="source === 'file' ? addLocalImage() : onAddUrl()">
          <div class="source-switch" role="group" aria-label="图片来源">
            <button type="button" :aria-pressed="source === 'file'" :disabled="busy" @click="source = 'file'">本地上传</button>
            <button type="button" :aria-pressed="source === 'url'" :disabled="busy" @click="source = 'url'">图片链接</button>
          </div>
          <label v-show="source === 'file'" class="image-picker">
            <span>{{ imageFile ? imageFile.name : '选择本地图片' }}</span>
            <small>JPG、PNG、GIF 或 WebP</small>
            <input ref="fileInput" name="image" type="file" accept=".png,.jpg,.jpeg,.gif,.webp" aria-label="选择本地图片"
              :disabled="busy" @change="selectImage" />
          </label>
          <label v-if="source === 'url'">图片地址<input v-model="newUrl" name="url" type="url" required maxlength="512" placeholder="https://" :disabled="busy" /></label>
          <div class="form-pair">
            <label>添加到分组<select v-model="imageGroup" name="group" :disabled="busy || loading">
              <option value="">全部</option>
              <option v-for="group in groups.filter(group => group.type === 0)" :key="group.oId" :value="group.oId">{{ group.name || '未命名分组' }}</option>
            </select></label>
            <label v-if="source === 'file'">图片名称<input v-model="imageName" name="name" :disabled="busy" maxlength="64" placeholder="选填" /></label>
            <label v-else>图片名称<input v-model="newName" name="name" :disabled="busy" maxlength="64" placeholder="选填" /></label>
          </div>
          <div class="form-actions"><button type="submit" :disabled="busy || loading || (source === 'file' ? !imageFile : !newUrl.trim())">
            {{ uploading ? '上传中…' : source === 'url' ? '添加图片' : uploadedUrl ? '重试添加' : '上传并添加' }}
          </button></div>
        </form>

        <form v-else-if="panel === 'create'" aria-label="新建分组" @submit.prevent="onCreate">
          <label>分组名称<input v-model="newGroup" name="name" required :disabled="busy" maxlength="64" /></label>
          <div class="form-actions"><button type="submit" :disabled="busy || loading || !newGroup.trim()">新建分组</button></div>
        </form>

        <template v-else-if="panel === 'group' && selectedGroup?.type === 0">
          <form aria-label="管理分组" @submit.prevent="onUpdateGroup">
            <div class="form-pair">
              <label>分组名称<input v-model="editGroupName" name="name" required :disabled="busy" maxlength="64" /></label>
              <label>排序<input v-model.number="editGroupSort" name="sort" :disabled="busy" type="number" step="1" min="-2147483648" max="2147483647" /></label>
            </div>
            <div class="form-actions">
              <button type="button" class="danger-action" :disabled="busy || loading" @click="onDeleteGroup">删除当前分组</button>
              <button type="submit" :disabled="busy || loading || !editGroupName.trim()">保存分组</button>
            </div>
          </form>
          <div class="snapshot">
            <div class="snapshot-row"><strong>分享分组快照</strong>
              <button type="button" :disabled="busy || loading || !itemPage || itemTotal === 0" @click="onShare">生成分享码</button>
            </div>
            <template v-if="sharedCode"><code>{{ sharedCode }}</code><p>持码登录者可导入。删除来源分组后，此分享码依然有效。</p></template>
          </div>
        </template>

        <form v-else-if="panel === 'item' && editedItem" aria-label="编辑表情" @submit.prevent="onUpdateItem">
          <div class="edit-preview" v-if="editedItem.url"><img :src="imageThumbnail(editedItem.url, 120, 120)" alt="" width="120" height="120" /></div>
          <div class="form-pair">
            <label>图片名称<input v-model="editItemName" name="name" :disabled="busy" maxlength="64" placeholder="选填" /></label>
            <label>排序<input v-model.number="editItemSort" name="sort" :disabled="busy" type="number" step="1" min="-2147483648" max="2147483647" /></label>
          </div>
          <p v-if="selectedGroup?.type === 1" class="form-note">从「全部」移除，会同步移出你的其他分组。</p>
          <div class="form-actions">
            <button type="button" class="danger-action" :disabled="busy || loading" @click="onRemove(editedItem)">移除表情</button>
            <button type="submit" :disabled="busy || loading">保存图片信息</button>
          </div>
        </form>

        <template v-else-if="panel === 'transfer'">
          <form aria-label="通过分享码导入" @submit.prevent="onImport">
            <label>表情分享码<input v-model="importCode" name="code" required :disabled="busy" maxlength="16" autocapitalize="characters"
              autocorrect="off" spellcheck="false" placeholder="8 至 16 位字母或数字" /></label>
            <div class="form-actions"><button type="submit" :disabled="busy || loading || !importCode.trim()">导入新分组</button></div>
          </form>
          <details class="migration"><summary>迁移旧版云表情</summary><p>将本人旧版云表情加入收藏。遇到无效图片时，整批迁移会停止。</p>
            <button type="button" :disabled="busy || loading" @click="onMigrate">迁移本人旧云表情</button>
          </details>
        </template>

        <template v-else-if="panel === 'frequent'">
          <FpLoading v-if="frequencyLoading" small text="正在读取常用表情…" />
          <form v-else-if="catalogLoaded" aria-label="设置常用表情" @submit.prevent="saveFrequency()">
            <div class="selected-aliases">
              <strong>已选表情</strong>
              <div class="alias-list">
                <button v-for="(alias, index) in frequentAliases" :key="index + ':' + alias" type="button" :aria-label="`移除 ${alias}`" :disabled="busy" @click="toggleAlias(alias)">
                  {{ alias }} <span aria-hidden="true">×</span>
                </button>
                <span v-if="!frequentAliases.length" class="form-note">保存空列表会恢复系统默认表情。</span>
              </div>
            </div>
            <label>可选表情<input v-model="aliasQuery" name="search" type="search" :disabled="busy" placeholder="搜索表情名称" /></label>
            <div class="alias-catalog">
              <button v-for="alias in matchingAliases.slice(0, aliasLimit)" :key="alias" type="button" :aria-pressed="frequentAliases.includes(alias)" :disabled="busy" @click="toggleAlias(alias)">{{ alias }}</button>
              <button v-if="matchingAliases.length > aliasLimit" type="button" :disabled="busy" @click="aliasLimit += 24">更多表情名称</button>
              <span v-if="!matchingAliases.length" class="form-note">没有匹配的表情</span>
            </div>
            <details><summary>编辑表情顺序</summary>
              <label>按顺序填写名称，用英文逗号分隔<input v-model="frequency" name="aliases" :disabled="busy" placeholder="smile,heart,+1" /></label>
            </details>
            <div class="form-actions"><button type="button" :disabled="busy" @click="saveFrequency(true)">恢复默认</button>
              <button type="submit" :disabled="busy">保存常用表情</button></div>
          </form>
          <template v-else><p v-if="frequencyError" role="alert">{{ frequencyError }}</p>
            <button type="button" @click="loadFrequency">重新读取常用表情</button>
          </template>
        </template>

        <p v-if="error" role="alert">{{ error }}</p>
        <p v-if="panel === 'group' && sharedCode && transferNotice" role="status">{{ transferNotice }}</p>
      </div>
    </FpDialog>
  </section>
</template>

<style scoped src="./emoji-packs.css"></style>
