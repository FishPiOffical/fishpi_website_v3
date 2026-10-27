<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ApiError } from '@/api/http'
import type { EmojiGroup, EmojiItem } from '@/api/fishpi'
import { addV3EmojiURL, createV3EmojiGroup, deleteV3EmojiGroup, fetchV3EmojiGroups, fetchV3GroupEmojis,
  fetchV3FrequentAliases, fetchV3EmotionOptions, saveV3FrequentEmotions, removeV3GroupEmoji, emojiOperationKey, updateV3EmojiGroup, updateV3EmojiItem, shareV3EmojiGroup, importV3EmojiGroup, migrateV3LegacyEmojis } from '@/api/v3-emojis'
import { useAuthStore } from '@/stores/auth'
import FpLoading from '@/components/FpLoading.vue'

const { accessToken } = storeToRefs(useAuthStore())
const groups = ref<EmojiGroup[]>([]), items = ref<EmojiItem[]>([]), groupId = ref('')
const loading = ref(false), busy = ref(false), error = ref(''), frequencyLoading = ref(false), catalogLoaded = ref(false)
const newGroup = ref(''), newUrl = ref(''), newName = ref(''), frequency = ref('')
const catalog = ref<string[][]>([])
const editGroupName = ref(''), editGroupSort = ref(0), editItemId = ref(''), editItemName = ref(''), editItemSort = ref(0)
const importCode = ref(''), sharedCode = ref(''), transferNotice = ref('')
const groupPage = ref(0), groupPages = ref(0), groupTotal = ref(0), itemPage = ref(0), itemPages = ref(0), itemTotal = ref(0)
const selectedGroup = computed(() => groups.value.find(g => g.oId === groupId.value))
watch(selectedGroup, group => { editGroupName.value = group?.name || ''; editGroupSort.value = group?.sort ?? 0; editItemId.value = ''; sharedCode.value = '' })
let epoch = 0, sequence = 0, frequencySequence = 0, mounted = false
const intentions = new Map<string, { fingerprint: string; key: string }>()
function mergeGroups(values: EmojiGroup[]) {
  return Array.from(new Map(values.map(g => [g.oId, g])).values()).sort((a,b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.oId < b.oId ? -1 : a.oId > b.oId ? 1 : 0))
}
async function read<T>(fetcher: () => Promise<T>, apply: (value: T) => void, failed?: (error: unknown) => void) {
  const token = accessToken.value, currentEpoch = epoch, request = ++sequence
  if (!token) return false
  loading.value = true; error.value = ''
  const current = () => mounted && currentEpoch === epoch && request === sequence && token === accessToken.value
  try { const result = await fetcher(); if (current()) { apply(result); return true } }
  catch (failure) { if (current()) { items.value = []; error.value = failure instanceof Error ? failure.message : '表情加载失败'; failed?.(failure) } }
  finally { if (current()) loading.value = false }
  return false
}
function loadItems(more = false) {
  const id = groupId.value
  if (!id) { items.value = []; itemTotal.value = itemPage.value = itemPages.value = 0; return Promise.resolve() }
  if (!more) { items.value = []; itemPage.value = itemPages.value = 0 }
  return read(() => fetchV3GroupEmojis(id, more ? itemPage.value + 1 : 1), page => {
    items.value = more ? [...items.value, ...page.list] : page.list
    itemPage.value = page.p; itemPages.value = page.pageCount; itemTotal.value = page.total
  }, failure => {
    if (failure instanceof ApiError && failure.status === 404) { groups.value = groups.value.filter(g => g.oId !== id); groupId.value = ''; itemTotal.value = 0 }
  })
}
async function loadGroups(preferred?: EmojiGroup) {
  const keep = preferred ?? selectedGroup.value, token = accessToken.value, currentEpoch = epoch
  const applied = await read(() => fetchV3EmojiGroups(), page => {
    groups.value = mergeGroups(keep && !page.list.some(g => g.oId === keep.oId) ? [...page.list, keep] : page.list)
    groupPage.value = page.p; groupPages.value = page.pageCount; groupTotal.value = page.total
    groupId.value = keep && groups.value.some(g => g.oId === keep.oId) ? keep.oId : groups.value[0]?.oId || ''
  })
  if (applied && token === accessToken.value && currentEpoch === epoch) await loadItems()
}
async function loadTransferredGroup(id: string) {
  const token = accessToken.value, currentEpoch = epoch
  const applied = await read(async () => {
    const first = await fetchV3EmojiGroups()
    let found = first.list.find(group => group.oId === id)
    // Imports append after the current maximum sort; inspect the last page first.
    if (first.pageCount > 100) throw new ApiError('分组过多，请刷新后选择目标分组', 503)
    const pages = first.pageCount > 1 ? [first.pageCount, ...Array.from({ length: Math.max(0, first.pageCount - 2) }, (_, i) => i + 2)] : []
    for (const p of pages) {
      if (found) break
      if (!mounted || token !== accessToken.value || currentEpoch !== epoch) return { first, found: undefined }
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
  if (applied && token === accessToken.value && currentEpoch === epoch) await loadItems()
}
function moreGroups() {
  return read(() => fetchV3EmojiGroups(groupPage.value + 1), page => {
    groups.value = mergeGroups([...groups.value, ...page.list]); groupPage.value = page.p; groupPages.value = page.pageCount; groupTotal.value = page.total
  })
}
function selectGroup(id: string) { groupId.value = id; void loadItems() }
async function loadFrequency() {
  const token = accessToken.value, currentEpoch = epoch, request = ++frequencySequence
  if (!token) return
  frequencyLoading.value = true
  const current = () => mounted && token === accessToken.value && currentEpoch === epoch && request === frequencySequence
  try {
    const [aliases, options] = await Promise.all([fetchV3FrequentAliases(), fetchV3EmotionOptions()])
    if (current()) { frequency.value = aliases.join(','); catalog.value = options.groups; catalogLoaded.value = true }
  } catch (failure) { if (current()) { catalogLoaded.value = false; error.value = failure instanceof Error ? failure.message : '常用表情加载失败' } }
  finally { if (current()) frequencyLoading.value = false }
}
function reset() {
  epoch++; sequence++; frequencySequence++; intentions.clear(); groups.value = []; items.value = []; groupId.value = ''
  newGroup.value = newUrl.value = newName.value = frequency.value = error.value = ''; catalog.value = []; catalogLoaded.value = false
  groupPage.value = groupPages.value = groupTotal.value = itemPage.value = itemPages.value = itemTotal.value = 0
  editGroupName.value = editItemId.value = editItemName.value = importCode.value = sharedCode.value = transferNotice.value = ''
  editGroupSort.value = editItemSort.value = 0
  loading.value = frequencyLoading.value = busy.value = false
}
onMounted(() => { mounted = true; if (accessToken.value) { void loadGroups(); void loadFrequency() } })
watch(accessToken, token => { reset(); if (mounted && token) { void loadGroups(); void loadFrequency() } }, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
async function mutate<T>(operation: string, payload: unknown, action: (key: string) => Promise<T>, done: (result: T) => Promise<unknown> | void) {
  const token = accessToken.value, currentEpoch = epoch
  if (!token || busy.value) return
  busy.value = true; error.value = ''
  try {
    const fingerprint = JSON.stringify(payload)
    let intent = intentions.get(operation)
    if (!intent || intent.fingerprint !== fingerprint) { intent = { fingerprint, key: emojiOperationKey() }; intentions.set(operation, intent) }
    const result = await action(intent.key)
    if (mounted && token === accessToken.value && currentEpoch === epoch) { intentions.delete(operation); await done(result) }
  } catch (failure) { if (mounted && token === accessToken.value && currentEpoch === epoch) error.value = failure instanceof Error ? failure.message : '表情操作失败' }
  finally { if (currentEpoch === epoch && token === accessToken.value) busy.value = false }
}
function onCreate() {
  const name = newGroup.value.trim(), sort = groupTotal.value
  if (!name) return
  return mutate('create-group', { name, sort }, key => createV3EmojiGroup(name, sort, key), async group => { newGroup.value = ''; await loadGroups(group) })
}
function onDeleteGroup() {
  const id = groupId.value
  if (!id || selectedGroup.value?.type !== 0) return
  return mutate('delete-group', { id }, key => deleteV3EmojiGroup(id, key), async () => { groupId.value = ''; await loadGroups() })
}
function onAddUrl() {
  const id = groupId.value, url = newUrl.value.trim(), name = newName.value.trim(), sort = 0
  if (!url) return
  return mutate('add-url', { id, url, name, sort }, key => addV3EmojiURL(id, url, sort, name, key), async result => {
    newUrl.value = newName.value = ''; groupId.value = result.groupId; await loadGroups()
  })
}
function onRemove(item: EmojiItem) {
  const group = groupId.value, id = item.oId
  if (!group || !id) return
  return mutate('remove-item', { group, id }, key => removeV3GroupEmoji(group, id, key), () => loadItems())
}
function validSort(value: number): boolean {
  if (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) return true
  error.value = '排序值须为32位整数'; return false
}
function onUpdateGroup() {
  const id = groupId.value, name = editGroupName.value.trim(), sort = editGroupSort.value
  if (!id || selectedGroup.value?.type !== 0 || !name || !validSort(sort)) return
  return mutate('update-group', { id, name, sort }, key => updateV3EmojiGroup(id, name, sort, key), group => loadGroups(group))
}
function editItem(item: EmojiItem) { editItemId.value = item.oId || ''; editItemName.value = item.name; editItemSort.value = item.sort ?? 0 }
function onUpdateItem() {
  const group = groupId.value, id = editItemId.value, name = editItemName.value.trim(), sort = editItemSort.value
  if (!group || !id || !validSort(sort)) return
  return mutate('update-item', { group, id, name, sort }, key => updateV3EmojiItem(group, id, name, sort, key), async () => { editItemId.value = ''; await loadItems() })
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
    await loadTransferredGroup(result.groupId)
  })
}
function onMigrate() {
  return mutate('migrate-legacy', {}, key => migrateV3LegacyEmojis(key), async result => {
    transferNotice.value = `已处理 ${result.processedCount} 张历史图片，新增 ${result.addedCount} 张`
    await loadTransferredGroup(result.groupId)
  })
}
function saveFrequency(resetDefaults = false) {
  const emotions = resetDefaults || !frequency.value.trim() ? [] : frequency.value.split(',').map(alias => alias.trim())
  const allowed = new Set(catalog.value.flat())
  if (new Set(emotions).size !== emotions.length || emotions.some(alias => !alias || !allowed.has(alias))) { error.value = '常用表情不能重复或留空项，请使用目录中的名称'; return }
  return mutate('save-frequency', { emotions }, key => saveV3FrequentEmotions(emotions, key), aliases => { frequency.value = aliases.join(',') })
}
</script>

<template>
  <section class="emoji-packs">
    <h3>常用表情</h3>
    <p class="hint">按逗号分隔名称保存顺序；留空可恢复默认。</p>
    <form class="row" @submit.prevent="saveFrequency()">
      <label>常用表情名称<input v-model="frequency" :disabled="busy || frequencyLoading" placeholder="smile,heart,+1" /></label>
      <button type="submit" :disabled="busy || !catalogLoaded">保存常用表情</button>
      <button type="button" :disabled="busy || !catalogLoaded" @click="saveFrequency(true)">恢复默认</button>
    </form>
    <details v-if="catalogLoaded"><summary>查看可用表情名称</summary><p v-for="(aliases, index) in catalog" :key="index" class="hint">{{ aliases.join('、') }}</p></details>
    <h3>图片分组</h3>
    <p class="hint">“全部”分组不可删除；从“全部”移除图片，会同步移出本人其他分组。</p>
    <p v-if="error" class="err" role="alert">{{ error }}</p>
    <button type="button" class="ghost" :disabled="loading || busy" @click="loadGroups(); loadFrequency()">刷新表情</button>
    <FpLoading v-if="loading || frequencyLoading" small />
    <div v-if="groups.length" class="tabs">
      <button v-for="g in groups" :key="g.oId" type="button" :class="{ on: groupId === g.oId }" :disabled="busy" @click="selectGroup(g.oId)">{{ g.name || '分组' }}</button>
    </div>
    <p v-else-if="!loading && !error" class="hint">还没有图片分组，添加第一张图片会建立“全部”。</p>
    <button v-if="groupPage < groupPages" type="button" class="ghost" :disabled="busy || loading" @click="moreGroups">更多分组</button>
    <form v-if="selectedGroup?.type === 0" class="row" @submit.prevent="onUpdateGroup">
      <input v-model="editGroupName" :disabled="busy" maxlength="64" aria-label="分组名称" />
      <input v-model.number="editGroupSort" :disabled="busy" type="number" step="1" min="-2147483648" max="2147483647" aria-label="分组排序" />
      <button type="submit" :disabled="busy || loading || !editGroupName.trim()">保存分组</button>
      <button type="button" :disabled="busy || loading || itemTotal === 0" @click="onShare">生成分享码</button>
    </form>
    <p v-if="sharedCode" class="hint">分享码：<code>{{ sharedCode }}</code>。持码登录者可导入，删除来源组不会撤销此快照。</p>
    <p v-if="groupId && !loading && !error" class="hint">已加载 {{ items.length }} / {{ itemTotal }} 张图片</p>
    <div class="grid">
      <figure v-for="item in items" :key="item.oId || item.name + (item.url || '')">
        <img v-if="item.url" :src="item.url" :alt="item.name" />
        <figcaption>{{ item.name }}</figcaption>
        <button v-if="item.oId" type="button" class="ghost" :disabled="busy" @click="editItem(item)">编辑</button>
        <button v-if="item.oId" type="button" class="ghost" :disabled="busy" @click="onRemove(item)">移除</button>
      </figure>
    </div>
    <form v-if="editItemId" class="row" @submit.prevent="onUpdateItem">
      <input v-model="editItemName" :disabled="busy" maxlength="64" aria-label="成员名称" placeholder="名称（可空）" />
      <input v-model.number="editItemSort" :disabled="busy" type="number" step="1" min="-2147483648" max="2147483647" aria-label="成员排序" />
      <button type="submit" :disabled="busy || loading">保存图片信息</button>
      <button type="button" :disabled="busy" @click="editItemId = ''">取消编辑</button>
    </form>
    <button v-if="itemPage < itemPages" type="button" class="ghost" :disabled="busy || loading" @click="loadItems(true)">更多图片</button>
    <form class="row" @submit.prevent="onAddUrl">
      <input v-model="newUrl" :disabled="busy" maxlength="512" aria-label="表情图片URL" placeholder="HTTPS图片 URL" />
      <input v-model="newName" :disabled="busy" maxlength="64" aria-label="表情图片名称" placeholder="名称（可选）" />
      <button type="submit" :disabled="busy || loading || !newUrl.trim()">{{ groupId ? '添加到分组' : '添加到全部' }}</button>
    </form>
    <form class="row" @submit.prevent="onCreate">
      <input v-model="newGroup" :disabled="busy" maxlength="64" aria-label="新分组名称" placeholder="新分组名称" />
      <button type="submit" :disabled="busy || loading || !newGroup.trim()">新建分组</button>
      <button type="button" class="ghost" :disabled="busy || loading || selectedGroup?.type !== 0" @click="onDeleteGroup">删除当前分组</button>
    </form>
    <h3>导入与迁移</h3>
    <form class="row" @submit.prevent="onImport">
      <input v-model="importCode" :disabled="busy" maxlength="16" aria-label="表情分享码" placeholder="输入分享码" />
      <button type="submit" :disabled="busy || loading || !importCode.trim()">导入新分组</button>
    </form>
    <p class="hint">每次成功导入建立独立新组。旧云表情只迁移本人的图片，遇到不符合规则的项目整批失败。</p>
    <button type="button" :disabled="busy || loading" @click="onMigrate">迁移本人旧云表情</button>
    <p v-if="transferNotice" role="status" class="hint">{{ transferNotice }}</p>
  </section>
</template>

<style scoped lang="scss">
h3 {
  margin: 0 0 8px;
  font-size: 18px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}
.tabs button,
.ghost,
.row button,
.emoji-packs > button {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
}
.tabs button.on {
  background: var(--fp-primary);
  color: #fff;
  border-color: transparent;
}
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0;
}
figure {
  margin: 0;
  width: 72px;
  text-align: center;
  font-size: 11px;
  color: var(--fp-muted);
}
img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.row input {
  flex: 1;
  min-width: 140px;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 6px 8px;
}
.row button[type='submit'] {
  background: var(--fp-primary);
  color: #fff;
  border-color: transparent;
}
</style>
