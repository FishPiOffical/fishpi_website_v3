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
  <button type="button" class="ghost" @click="show">举报</button>
  <FpDialog :open="open" title="举报" @close="close">
    <form id="report-form" class="report-form" @submit.prevent="submit">
      <div class="kinds">
        <label v-for="k in kinds" :key="k.value" :class="{ on: reportType === k.value }">
          <input v-model.number="reportType" type="radio" :value="k.value" />
          {{ k.label }}
        </label>
      </div>
      <textarea v-model="memo" class="fp-input" rows="3" placeholder="请说明举报理由" required />
    </form>
    <template #footer>
      <span class="tip">{{ msg }}</span>
      <button type="button" class="fp-btn" @click="close">取消</button>
      <button type="submit" form="report-form" class="fp-btn fp-btn--primary" :disabled="sending || !memo.trim()">
        {{ sending ? '提交中…' : '提交' }}
      </button>
    </template>
  </FpDialog>
</template>

<style scoped>
.ghost {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-muted);
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
}
.report-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.kinds label {
  padding: 3px 10px;
  border: 1px solid var(--fp-border);
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.kinds label:hover,
.kinds label.on {
  border-color: var(--fp-primary);
  color: var(--fp-primary);
}
.kinds input {
  display: none;
}
.tip {
  flex: 1;
  font-size: 12px;
  color: var(--fp-muted);
}
</style>
