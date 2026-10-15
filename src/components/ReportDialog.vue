<script setup lang="ts">
import { ref } from 'vue'
import { reportContent } from '@/api/fishpi'
import FpDialog from '@/components/FpDialog.vue'

const props = defineProps<{
  apiKey?: string | null
  dataId: string
  dataType: number
}>()

const open = ref(false)
const reportType = ref(0)
const memo = ref('')
const msg = ref('')
const sending = ref(false)

const kinds = [
  { value: 0, label: '垃圾广告' },
  { value: 1, label: '色情' },
  { value: 2, label: '违规' },
  { value: 3, label: '侵权' },
  { value: 4, label: '人身攻击' },
  { value: 5, label: '冒充他人' },
  { value: 6, label: '广告账号' },
  { value: 7, label: '泄露隐私' },
  { value: 8, label: '其它' },
]

function show() {
  msg.value = ''
  open.value = true
}

function close() {
  open.value = false
  msg.value = ''
}

async function submit() {
  if (!props.apiKey || !memo.value.trim()) return
  sending.value = true
  msg.value = ''
  try {
    await reportContent(props.apiKey, {
      reportDataId: props.dataId,
      reportDataType: props.dataType,
      reportType: reportType.value,
      reportMemo: memo.value.trim(),
    })
    msg.value = '已提交，感谢反馈'
    memo.value = ''
    setTimeout(close, 1200)
  } catch (e) {
    msg.value = e instanceof Error ? e.message : '举报失败'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <button type="button" class="fp-btn fp-btn--ghost fp-btn--sm" @click="show">举报</button>
  <FpDialog :open="open" title="举报内容" @close="close">
    <form id="report-form" class="report-form" @submit.prevent="submit">
      <div class="kinds">
        <label v-for="k in kinds" :key="k.value" class="kind-option" :class="{ on: reportType === k.value }">
          <input v-model.number="reportType" type="radio" name="reportType" :value="k.value" />
          <span>{{ k.label }}</span>
        </label>
      </div>
      <textarea v-model="memo" class="fp-input" rows="3" placeholder="请说明具体举报理由…" required />
    </form>
    <template #footer>
      <span class="tip">{{ msg }}</span>
      <button type="button" class="fp-btn fp-btn--ghost" @click="close">取消</button>
      <button type="submit" form="report-form" class="fp-btn fp-btn--primary" :disabled="sending || !memo.trim()">
        {{ sending ? '提交中…' : '提交举报' }}
      </button>
    </template>
  </FpDialog>
</template>

<style scoped>
.report-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.kinds {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.kind-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-radius-md, 8px);
  background: var(--fp-bg);
  font-size: 12px;
  color: var(--fp-text);
  cursor: pointer;
  user-select: none;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
}
.kind-option:hover {
  border-color: var(--fp-border-strong, var(--fp-border));
  background: var(--fp-hover);
}
.kind-option.on {
  border-color: var(--fp-primary);
  background: var(--fp-primary-soft, rgba(105, 170, 105, 0.14));
  color: var(--fp-title);
  font-weight: 500;
}
.tip {
  flex: 1;
  font-size: 12px;
  color: var(--fp-muted);
}
</style>
