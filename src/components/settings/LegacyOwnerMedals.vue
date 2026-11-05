<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useLegacyMedalsStore } from '@/stores/legacyMedals'
import { getAuthContextVersion } from '@/api/http'
import type { LegacyOwnerMedal } from '@/api/legacy/owner-medals'
const auth = useAuthStore(), store = useLegacyMedalsStore(), page = ref(1), imageErrors = ref(new Set<string>())
const pages = computed(() => Math.max(1, Math.ceil((store.items?.length || 0) / 20))), visible = computed(() => store.items?.slice((page.value - 1) * 20, page.value * 20) || [])
let mounted = false
const blocked = computed(() => store.loading || store.busy || !!store.pending)
function expires(value: number) { return value <= 0 ? '永久' : new Date(value).toLocaleDateString('zh-CN') }
function display(row: LegacyOwnerMedal) { if (!blocked.value) void store.execute({ recordId: row.recordId, definitionId: row.definitionId, kind: 'display', displayed: !row.displayed }) }
function move(row: LegacyOwnerMedal, direction: 'up' | 'down') { if (!blocked.value) void store.execute({ recordId: row.recordId, definitionId: row.definitionId, kind: 'move', direction }) }
watch([() => getAuthContextVersion(), () => auth.apiKey, () => auth.account?.oId], () => { page.value = 1; imageErrors.value = new Set(); if (mounted) void store.load() }, { flush: 'sync' })
watch(pages, count => { if (page.value > count) page.value = count })
onMounted(() => { mounted = true; void store.load() })
onScopeDispose(() => { mounted = false })
</script>
<template>
  <section class="owner-medals">
    <h2>你的勋章</h2><p class="hint">当前有效勋章快照，包含隐藏条目。移动由服务端按全部持有记录处理，当前列表不一定是完整排序范围。</p>
    <p v-if="store.loading" role="status">正在读取勋章；旧快照暂不可操作…</p><p v-if="store.readError" role="alert" class="error">{{ store.completed ? '操作请求已确认，但当前列表读取失败；请只重读，不要再次移动。' : '' }}{{ store.readError }}</p>
    <template v-if="store.items">
      <p>当前快照 {{ store.items.length }} 条</p><p v-if="!store.items.length" class="hint">当前没有有效勋章。</p><p v-if="store.ambiguous.size" class="hint">存在同一种勋章的重复条目，旧接口无法逐条定位，相关操作暂不可用。</p>
      <ul class="medals"><li v-for="(medal,index) in visible" :key="`${medal.recordId}:${store.ambiguous.has(medal.recordId) ? index : 'unique'}`"><div class="info"><img v-if="medal.imageURL && !imageErrors.has(medal.recordId)" :src="medal.imageURL" :alt="medal.name" class="legacy-medal-image" crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" @error="imageErrors.add(medal.recordId)" /><span v-if="imageErrors.has(medal.recordId)" class="hint">勋章图片无法显示</span><strong>{{ medal.name }}</strong><span v-if="medal.type">{{ medal.type }}</span><span>{{ medal.description }}</span><span class="hint">{{ medal.displayed ? '展示中' : '已隐藏' }} · 到期：{{ expires(medal.expiresAt) }}</span></div><div v-if="!store.ambiguous.has(medal.recordId)" class="actions"><button type="button" :aria-label="`上移${medal.name}`" :aria-disabled="blocked" @click="move(medal,'up')">上移</button><button type="button" :aria-label="`下移${medal.name}`" :aria-disabled="blocked" @click="move(medal,'down')">下移</button><button type="button" :aria-label="`${medal.displayed ? '隐藏' : '展示'}${medal.name}`" :aria-disabled="blocked" @click="display(medal)">{{ medal.displayed ? '隐藏' : '展示' }}</button></div></li></ul>
      <nav v-if="pages > 1" aria-label="本人勋章快照分页"><button type="button" :disabled="page <= 1" @click="page--">上一页勋章</button><span>当前快照第 {{ page }} / {{ pages }} 页</span><button type="button" :disabled="page >= pages" @click="page++">下一页勋章</button></nav>
    </template>
    <p v-if="store.error" role="alert" class="error">{{ store.error }}</p><p v-if="store.pending" role="status">操作结果未确认，请先核对当前展示状态与顺序；离页保留本次锁定，刷新或退出会清除本机状态。</p><p v-if="store.completed" role="status">操作请求已确认，当前展示状态与顺序以重新读取为准。</p>
    <button type="button" :disabled="store.loading || store.busy" @click="store.load">重新读取勋章</button>
  </section>
</template>
<style scoped lang="scss" src="./owner-medals.scss"></style>
