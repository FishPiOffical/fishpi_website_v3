<script setup lang="ts">
import LegacyFrequentEmotions from './LegacyFrequentEmotions.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getAuthContextVersion } from '@/api/http'
import { legacyAllEmojiGroups, legacyAllGroupEmojis } from '@/api/legacy/editor-emojis'
import type { EmojiCommand } from '@/api/legacy/emoji-management'
import type { EmojiGroup, EmojiItem } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'
import { useLegacyEmojisStore } from '@/stores/legacyEmojis'
const auth = useAuthStore(), commands = useLegacyEmojisStore()
const groups = ref<EmojiGroup[]>([]), items = ref<EmojiItem[]>([]), selected = ref(''), page = ref(1)
const groupName = ref(''), groupSort = ref(0), newGroup = ref(''), url = ref(''), itemName = ref('')
const editing = ref(''), editName = ref(''), editSort = ref(0)
const importCode = ref('')
const share = computed(() => commands.receipt?.op === 'share' && commands.receipt.groupId === selected.value ? commands.receipt : null)
const loading = ref(false), error = ref(''), notice = ref(''), verified = ref(false)
const group = computed(() => groups.value.find(row => row.oId === selected.value))
const blocked = computed(() => loading.value || commands.busy || !!commands.pending)
const pages = computed(() => Math.ceil(items.value.length / 30))
const visible = computed(() => items.value.slice((page.value - 1) * 30, page.value * 30))
let mounted = false, sequence = 0, requestedGroup = ''
const identity = () => JSON.stringify([getAuthContextVersion(), auth.apiKey, auth.account?.oId])
function clear() { sequence++; requestedGroup = ''; groups.value = []; items.value = []; selected.value = ''; newGroup.value = url.value = itemName.value = importCode.value = ''; editing.value = ''; verified.value = false; loading.value = false; error.value = notice.value = '' }
watch(identity, () => { clear(); if (mounted) void reload() }, { flush: 'sync' })
watch(selected, () => { editing.value = ''; groupName.value = group.value?.name || ''; groupSort.value = group.value?.sort ?? 0 })
async function reload(target = requestedGroup || selected.value, requireTarget = commands.receipt?.op === 'import' && commands.receipt.groupId === target) {
  if (!mounted || !auth.apiKey || !auth.account?.oId) return
  const owner = identity(), run = ++sequence, valid = () => mounted && owner === identity() && run === sequence
  requestedGroup = target
  loading.value = true; error.value = ''; verified.value = false
  // Failed reads must not leave old private images or editable metadata on screen.
  groups.value = []; items.value = []; editing.value = ''
  try {
    const list = await legacyAllEmojiGroups()
    if (!valid()) return
    if (requireTarget && !list.some(row => row.oId === target)) throw new Error('操作已完成，但目标分组未能读取。请刷新核对，不要重复导入。')
    const id = list.some(row => row.oId === target) ? target : list[0]?.oId || ''
    const rows = id ? await legacyAllGroupEmojis(id) : []
    if (!valid()) return
    groups.value = list; selected.value = id; items.value = rows; page.value = 1
    groupName.value = group.value?.name || ''; groupSort.value = group.value?.sort ?? 0
    verified.value = !!commands.pending
  } catch (failure) { if (valid()) error.value = failure instanceof Error ? failure.message : '表情加载失败' }
  finally { if (valid()) loading.value = false }
}
function choose(event: Event) { void reload((event.target as HTMLSelectElement).value) }
async function submit(input: EmojiCommand, confirmText = '') {
  if (blocked.value || confirmText && !window.confirm(confirmText)) return
  const owner = identity()
  const migrationTarget = groups.value.find(row => row.type === 1)?.oId
  notice.value = ''; verified.value = false
  const success = await commands.submit(input)
  if (!mounted || owner !== identity()) return
  if (success) {
    notice.value = '操作已完成；如列表读取失败，请只刷新核对，不要重复提交。'
    const receipt = commands.receipt
    if (receipt?.op === 'import') {
      importCode.value = ''
      notice.value = `已导入分组「${receipt.groupName}」，本次处理 ${receipt.emojiCount} 个表情。请以下方当前列表核对。`
      await reload(receipt.groupId, true)
    } else if (input.op === 'migrate') {
      notice.value = '旧云表情迁移已完成。旧接口不提供迁移数量，请核对全部分组。'
      await reload(migrationTarget)
    } else if (input.op !== 'share') await reload()
  }
}
function release() {
  if (verified.value && window.confirm('确认已核对当前分组和表情？解除后不会重发原操作，请根据当前列表决定下一步。')) { commands.release(); verified.value = false }
}
function edit(item: EmojiItem) { editing.value = item.oId!; editName.value = item.name || ''; editSort.value = item.sort ?? 0 }
onMounted(() => { mounted = true; void reload() })
onBeforeUnmount(() => { mounted = false; sequence++ })
</script>
<template>
  <section class="legacy-emojis">
    <p class="hint">旧版表情包 · 列表为当前快照，图片地址不会重新上传。分组管理与常用表情分别读取，v3 模式保留原功能。</p>
    <LegacyFrequentEmotions />
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="commands.error" role="alert" class="error">{{ commands.error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <div class="row"><button type="button" :disabled="loading || commands.busy" @click="reload()">刷新核对</button><button v-if="commands.pending" type="button" :disabled="!verified || loading || commands.busy" @click="release">已核对，解除操作锁定</button><span v-if="loading" role="status">正在读取…</span></div>
    <fieldset :disabled="blocked">
      <legend>导入与迁移</legend>
      <form class="row" @submit.prevent="submit({ op: 'import', shareCode: importCode }, '从分享快照创建一个新分组，并加入全部分组？重复导入会创建另一个分组。')"><input v-model="importCode" aria-label="表情分享码" placeholder="输入分享码" maxlength="16" /><button>导入分享码</button></form>
      <div><button type="button" @click="submit({ op: 'migrate' }, '把历史云存档中的表情加入全部分组？迁移失败可能已处理部分图片，请先核对再决定下一步。')">迁移旧云表情</button></div>
    </fieldset>
    <fieldset :disabled="blocked">
      <legend>分组</legend>
      <form class="row" @submit.prevent="submit({ op: 'create', name: newGroup, sort: 0 })"><input v-model="newGroup" aria-label="新分组名称" placeholder="新分组名称" maxlength="20" /><button>新建分组</button></form>
      <p v-if="!loading && !error && !groups.length">暂无分组。</p>
      <template v-if="groups.length">
        <label>当前分组<select :value="selected" @change="choose"><option v-for="entry in groups" :key="entry.oId" :value="entry.oId">{{ entry.name }}</option></select></label>
        <form v-if="group && group.type !== 1" class="row" @submit.prevent="submit({ op: 'update-group', groupId: selected, name: groupName, sort: groupSort })"><input v-model="groupName" aria-label="分组名称" maxlength="20" /><input v-model.number="groupSort" aria-label="分组排序" type="number" /><button>保存分组</button><button type="button" @click="submit({ op: 'delete-group', groupId: selected }, '删除此分组？分组内的归类也将移除。')">删除分组</button></form>
        <p v-else class="hint">全部分组由系统维护；从这里移除表情，会同时从所有分组移除。</p>
        <button v-if="group?.type === 0" type="button" :disabled="!items.length" @click="submit({ op: 'share', groupId: selected }, '生成当前分组的分享快照？获得分享码的人可导入其中的图片和名称。')">生成分组分享码</button>
        <p v-if="share" role="status">分享码：<code>{{ share.shareCode }}</code> · 快照 {{ share.emojiCount }} 个表情（{{ share.groupName }}）</p>
      </template>
    </fieldset>
    <fieldset v-if="group" :disabled="blocked">
      <legend>表情 · {{ items.length }} 个</legend>
      <form class="row" @submit.prevent="submit({ op: 'add-url', groupId: selected, url, name: itemName, sort: 0 })"><input v-model="url" aria-label="表情图片地址" type="url" placeholder="HTTP(S) 图片地址" /><input v-model="itemName" aria-label="新表情名称" placeholder="名称（可选）" maxlength="20" /><button>添加表情</button></form>
      <p v-if="!items.length">此分组暂无表情。</p>
      <ul class="emoji-grid"><li v-for="item in visible" :key="item.oId"><img v-if="item.url" :src="item.url" :alt="item.name || '表情'" loading="lazy" /><span v-else>图片地址不可用</span><span>{{ item.name || '未命名' }}</span><div class="row"><button type="button" @click="edit(item)">编辑</button><button type="button" @click="submit({ op: 'remove-item', groupId: selected, emojiId: item.emojiId! }, group.type === 1 ? '从全部及所有分组移除此表情？' : '从此分组移除此表情？')">移除</button></div><form v-if="editing === item.oId" @submit.prevent="submit({ op: 'update-item', groupId: selected, itemId: editing, name: editName, sort: editSort })"><input v-model="editName" aria-label="表情名称" maxlength="20" /><input v-model.number="editSort" aria-label="表情排序" type="number" /><button>保存表情</button><button type="button" @click="editing = ''">取消</button></form></li></ul>
      <nav v-if="pages > 1" class="row" aria-label="表情快照分页"><button type="button" :disabled="page <= 1" @click="page--">上一页</button><span>{{ page }} / {{ pages }}</span><button type="button" :disabled="page >= pages" @click="page++">下一页</button></nav>
    </fieldset>
  </section>
</template>
<style scoped>
.legacy-emojis{display:grid;gap:14px}.hint{color:var(--text-muted);font-size:13px;line-height:1.7}.error{color:var(--danger,#c44)}.row{display:flex;align-items:center;flex-wrap:wrap;gap:8px}fieldset{min-width:0;border:1px solid var(--border-color,#ddd);border-radius:10px;padding:14px;display:grid;gap:12px}input,select,button{font:inherit;border:1px solid var(--border-color,#ddd);border-radius:6px;padding:7px 10px;background:var(--bg-color,#fff);color:inherit}input{min-width:0;max-width:100%;box-sizing:border-box}input[type=number]{width:95px}button{cursor:pointer}button:disabled{cursor:default;opacity:.5}.emoji-grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px;padding:0}.emoji-grid li{display:grid;justify-items:start;align-content:start;gap:8px;min-width:0}.emoji-grid img{width:72px;height:72px;object-fit:contain}.emoji-grid form{display:grid;gap:6px;max-width:100%}label{display:flex;align-items:center;gap:8px}
</style>
