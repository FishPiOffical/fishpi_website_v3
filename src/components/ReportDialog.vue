<script setup lang="ts">
import { ref } from 'vue'
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
    msg.value = '已提交'
    open.value = false
    memo.value = ''
  } catch (e) {
    msg.value = e instanceof Error ? e.message : '举报失败'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <span class="report">
    <button type="button" class="ghost" @click="open = !open">举报</button>
    <form v-if="open" class="box" @submit.prevent="submit">
      <select v-model.number="reportType">
        <option v-for="k in kinds" :key="k.value" :value="k.value">{{ k.label }}</option>
      </select>
      <input v-model="memo" placeholder="说明" required />
      <button type="submit" :disabled="sending || !memo.trim()">提交</button>
      <button type="button" class="ghost" @click="open = false">取消</button>
      <span v-if="msg">{{ msg }}</span>
    </form>
  </span>
</template>

<style scoped>
.report {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.ghost {
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-muted);
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
}
.box {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.box input,
.box select {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 6px;
  padding: 4px 8px;
}
.box button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}
</style>
