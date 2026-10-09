<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useNoticeStore } from '@/stores/notices'
import FpDialog from '@/components/FpDialog.vue'

const notices = useNoticeStore()
const { warnBroadcast } = storeToRefs(notices)
</script>

<template>
  <!-- 与现网一致：点遮罩不关闭，必须点按钮确认 -->
  <FpDialog
    :open="!!warnBroadcast"
    title="⚠ 摸鱼派社区紧急公告"
    tone="danger"
    :width="520"
    persistent
    @close="warnBroadcast = null"
  >
    <template v-if="warnBroadcast">
      <p class="text">{{ warnBroadcast.text }}</p>
      <p v-if="warnBroadcast.who" class="who">——紧急公告发布人：{{ warnBroadcast.who }}</p>
    </template>
    <template #footer>
      <button type="button" class="fp-btn fp-btn--primary" @click="warnBroadcast = null">我知道了</button>
    </template>
  </FpDialog>
</template>

<style scoped>
.text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.who {
  margin: 14px 0 0;
  text-align: right;
  font-size: 13px;
  color: var(--fp-muted);
}
</style>
