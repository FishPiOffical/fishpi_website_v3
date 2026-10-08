<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { reportContent } from '@/api/fishpi'

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

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(open, (v) => {
  if (v) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

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
  <Teleport to="body">
    <div v-if="open" class="report-mask" @click.self="close">
      <form class="report-box" @submit.prevent="submit">
        <header>
          <strong>举报</strong>
          <button type="button" class="x" title="关闭" @click="close">✕</button>
        </header>
        <div class="kinds">
          <label v-for="k in kinds" :key="k.value" :class="{ on: reportType === k.value }">
            <input v-model.number="reportType" type="radio" :value="k.value" />
            {{ k.label }}
          </label>
        </div>
        <textarea v-model="memo" rows="3" placeholder="请说明举报理由" required />
        <footer>
          <span class="tip">{{ msg }}</span>
          <button type="button" class="cancel" @click="close">取消</button>
          <button type="submit" class="ok" :disabled="sending || !memo.trim()">{{ sending ? '提交中…' : '提交' }}</button>
        </footer>
      </form>
    </div>
  </Teleport>
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
.report-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.45);
}
.report-box {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  background: var(--fp-card);
  color: var(--fp-text);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
header,
footer {
  display: flex;
  align-items: center;
  gap: 8px;
}
header strong {
  flex: 1;
  font-size: 15px;
}
.x {
  border: 0;
  background: transparent;
  color: var(--fp-muted);
  cursor: pointer;
  font-size: 14px;
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
}
.kinds label.on {
  border-color: var(--fp-primary);
  color: var(--fp-link);
}
.kinds input {
  display: none;
}
textarea {
  resize: vertical;
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
}
.tip {
  flex: 1;
  font-size: 12px;
  color: var(--fp-muted);
}
.cancel,
.ok {
  border-radius: 6px;
  padding: 5px 14px;
  font-size: 13px;
  cursor: pointer;
}
.cancel {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-text);
}
.ok {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
}
.ok:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
