<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useV3IdentityStore } from '@/stores/v3Identity'
const store = useV3IdentityStore(), { revision, summary, pendingKey, receipt, selecting, busy, error, loading, loaded, readError, records, page, pageCount, total, detail, detailId, detailLoading, detailError } = storeToRefs(store)
const preview = ref(''), selectionError = ref(''), fileInput = ref<HTMLInputElement | null>(null)
const hasPending = computed(() => records.value.some(item => item.status === 'pending'))
const statuses = { pending: '待审核结论', approved: '审核通过', rejected: '审核驳回' }
function date(value: number) { return new Date(value).toLocaleString() }
function closePreview() { preview.value = ''; store.revokePreview() }
async function choose(event: Event) { const input = event.target as HTMLInputElement, files = input.files; selectionError.value = ''; if (!files?.length) return; closePreview(); if (files.length !== 1) { store.clearDraft(); selectionError.value = '每次只能选择一张图片'; input.value = ''; return } const file = files[0]!; input.value = ''; await store.select(file) }
function showPreview() { preview.value = store.preview() }
function submit() { closePreview(); void store.create() }
watch(revision, () => { closePreview(); selectionError.value = '' }, { flush: 'sync' })
watch(summary, value => { if (!value) closePreview() })
onMounted(() => { void store.load() })
onBeforeUnmount(() => { closePreview(); store.leave() })
</script>
<template>
  <section class="owner-identity" aria-label="本人企业认证申请">
    <p>首批仅企业入驻，提交一张JPEG或PNG营业执照图片，最多5MiB。所选原图直接提交私有审核。</p>
    <p>仅指定审核员可一次读取；首次成功读取即销毁服务端材料，断网也不能重读。申请状态和结论保留，本人不能重新取回材料。审核结论不自动发放勋章或改变账号权限。</p>
    <form @submit.prevent="submit"><fieldset :disabled="busy || selecting || !!pendingKey"><input ref="fileInput" type="file" aria-label="企业认证营业执照图片" accept="image/jpeg,image/png" hidden @change="choose" /><button type="button" @click="fileInput?.click()">选择营业执照图片</button><p v-if="selecting">正在检查本地图片…</p><template v-if="summary"><p>已选择本地材料：{{ summary.mediaType === 'image/png' ? 'PNG' : 'JPEG' }} · {{ summary.byteLength.toLocaleString() }} 字节</p><button type="button" @click="showPreview">预览本地材料</button><button type="button" @click="closePreview(); store.clearDraft()">清除本地材料</button></template><button type="submit" :disabled="!summary || hasPending">核对并提交认证申请</button></fieldset></form>
    <figure v-if="preview" class="material-preview"><img :src="preview" alt="仅当前页面可见的本地营业执照预览" /><button type="button" @click="closePreview">关闭本地预览</button></figure>
    <p v-if="selectionError" role="alert" class="error">{{ selectionError }}</p><p v-if="error" role="alert" class="error">{{ error }}</p>
    <template v-if="pendingKey"><p class="hint">提交结果尚未确认，所选图片暂存于当前页面会话中，请恢复原申请，不能替换图片。刷新或退出后，可重新登录查询已有申请。</p><button type="button" :disabled="busy" @click="submit">恢复原认证申请</button></template>
    <p v-if="receipt" role="status">已确认提交回执：申请 {{ receipt.id }}，提交时间 {{ date(receipt.createdAt) }}。以下状态以重新读取结果为准。</p>
    <h2>本人申请记录</h2><button type="button" :disabled="loading" @click="store.load(page)">重新读取申请列表</button><p v-if="loading">正在读取申请…</p><p v-else-if="readError" role="alert" class="error">{{ readError }}</p>
    <button v-if="readError && page > 1" type="button" @click="store.load(1)">返回申请首页</button>
    <template v-if="!loading && !readError && loaded"><p>共 {{ total }} 份申请</p><p v-if="!records.length">{{ total ? '本页没有记录，请返回已有页码' : '暂无认证申请' }}</p><ul v-else><li v-for="item in records" :key="item.id"><h3>申请 {{ item.id }} · {{ statuses[item.status] }}</h3><p>提交：{{ date(item.createdAt) }}</p><p>{{ item.materialReadAt ? `材料已读取并销毁：${date(item.materialReadAt)}` : '材料尚未读取' }}</p><p v-if="item.reviewedAt">结论时间：{{ date(item.reviewedAt) }}</p><p v-if="item.note">审核说明：{{ item.note }}</p><button type="button" :disabled="detailLoading" @click="store.read(item.id)">读取申请详情 {{ item.id }}</button></li></ul><nav v-if="total || page > 1" aria-label="认证申请分页"><button type="button" :disabled="page <= 1 || loading" @click="store.load(page - 1)">上一页申请</button><span>{{ page }} / {{ pageCount }}</span><button type="button" :disabled="page >= Math.min(pageCount, 42949672) || loading" @click="store.load(page + 1)">下一页申请</button></nav></template>
    <section v-if="detailId" class="application-detail" aria-label="本人认证申请详情"><h2>申请 {{ detailId }} 当前详情</h2><p v-if="detailLoading">正在读取详情…</p><p v-else-if="detailError" role="alert" class="error">{{ detailError }}</p><template v-else-if="detail"><p>{{ statuses[detail.status] }}</p><p>{{ detail.materialReadAt ? `材料已读取并销毁：${date(detail.materialReadAt)}` : '材料尚未读取' }}</p><p v-if="detail.reviewedAt">结论时间：{{ date(detail.reviewedAt) }}</p><p v-if="detail.note">审核说明：{{ detail.note }}</p></template><button type="button" :disabled="detailLoading" @click="store.read(detailId)">刷新当前申请详情</button></section>
  </section>
</template>
<style scoped lang="scss">
.owner-identity { margin: 16px 0; } fieldset { border: 0; margin: 0; padding: 0; } label { display: grid; gap: 6px; margin: 12px 0; } input { max-width: 100%; } button { padding: 8px 12px; margin: 6px 8px 6px 0; color: var(--fp-text); background: transparent; border: 1px solid var(--fp-border); border-radius: 8px; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } .hint { color: var(--fp-muted); font-size: 13px; } .error { color: #c34a36; } .material-preview { margin: 16px 0; } .material-preview img { display: block; max-width: 100%; max-height: 400px; object-fit: contain; } li { padding-top: 12px; margin: 16px 0; border-top: 1px solid var(--fp-border); overflow-wrap: anywhere; } .application-detail { margin-top: 20px; padding-top: 12px; border-top: 1px solid var(--fp-border); } h2 { font-size: 18px; } h3 { font-size: 16px; }
</style>
