<script setup lang="ts">
import ChatAppearanceRecovery from '@/components/chat/ChatAppearanceRecovery.vue'
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useV3ChatAppearanceStore } from '@/stores/v3ChatAppearance'
import { storeToRefs } from 'pinia'
import { packsOf, type PackKind } from '@/packs'
import { useAppearanceStore } from '@/stores/appearance'

defineProps<{ compact?: boolean }>()

const appearance = useAppearanceStore()
const chatAppearance = useV3ChatAppearanceStore()
const auth = useAuthStore()
onMounted(() => chatAppearance.ensure())
const blocked = computed(() => !auth.accessToken || !chatAppearance.current || chatAppearance.loading || chatAppearance.busy || !!chatAppearance.pending)
function choose(kind:PackKind,id:string){ if(kind==='theme')appearance.apply(kind,id);else if(!blocked.value)void chatAppearance.choose(kind,id) }
const { state, notice } = storeToRefs(appearance)

const groups: { kind: PackKind; title: string }[] = [
  { kind: 'theme', title: '主题' },
  { kind: 'bubble', title: '对话框' },
  { kind: 'frame', title: '头像框' },
]

function selected(kind: PackKind) {
  if (kind === 'theme') return state.value.theme
  if (kind === 'bubble') return chatAppearance.current?.bubbleId
  return chatAppearance.current?.frameId
}
</script>

<template>
  <div class="picker" :class="{ compact }">
    <ChatAppearanceRecovery />
    <section v-for="group in groups" :key="group.kind">
      <h4>{{ group.title }}</h4>
      <div class="grid">
        <button
          v-for="pack in packsOf(group.kind)"
          :key="pack.id"
          type="button"
          :class="{ on: selected(group.kind) === pack.id }"
          :aria-pressed="selected(group.kind) === pack.id"
          :title="pack.name"
          :aria-disabled="group.kind !== 'theme' && blocked"
          @click="choose(group.kind, pack.id)"
        >
          <i :style="{ background: pack.preview }" />
          <span>{{ pack.name }}</span>
          <em v-if="pack.vip">VIP</em>
          <em v-else-if="group.kind !== 'theme' && pack.id !== 'classic' && pack.id !== 'none'" class="free">免费</em>
        </button>
      </div>
    </section>
    <p class="hint">气泡与头像框只影响之后发送的消息，历史消息保留发送时外观。</p>
    <p v-if="!auth.accessToken" class="hint">登录后设置个人聊天外观。</p>
    <p v-else-if="chatAppearance.loading" class="hint" role="status">正在读取个人外观…</p>
    <p v-if="chatAppearance.error" class="notice" role="alert">{{ chatAppearance.error }} <button type="button" :disabled="chatAppearance.loading" @click="chatAppearance.load">重新读取外观</button></p>
    <p v-if="chatAppearance.writeError" class="notice" role="alert">{{ chatAppearance.writeError }}</p>
    <button v-if="chatAppearance.pending" type="button" :disabled="chatAppearance.busy" @click="chatAppearance.retry">{{ chatAppearance.busy ? '保存中…' : '恢复原外观保存' }}</button>
    <div v-if="chatAppearance.current" class="appearance-preview"><div class="fp-msg is-room" data-appearance-snapshot="v1" :data-bubble="chatAppearance.current.bubbleId" :data-frame="chatAppearance.current.frameId"><span class="fp-avatar-frame"><img class="fp-avatar" src="/logo.png" alt="" /></span><div class="fp-bubble">新消息预览</div></div></div>
    <p v-if="notice" class="notice">{{ notice }}</p>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h4 {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--fp-muted);
  font-weight: 600;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
}
.compact .grid {
  grid-template-columns: repeat(2, 1fr);
}
button {
  position: relative;
  border: 1px solid var(--fp-border);
  background: var(--fp-bg);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  text-align: left;
}
button.on {
  border-color: var(--fp-primary);
  box-shadow: 0 0 0 1px var(--fp-primary);
}
i {
  display: block;
  height: 36px;
  border-radius: 6px;
  margin-bottom: 4px;
}
span {
  font-size: 12px;
}
em {
  position: absolute;
  top: 8px;
  right: 8px;
  font-style: normal;
  font-size: 10px;
  background: #c9a227;
  color: #1e1f22;
  border-radius: 4px;
  padding: 0 4px;
}
.free { background: var(--fp-primary-soft); color: var(--fp-primary); }
.hint { margin:0; color:var(--fp-muted); font-size:11px; line-height:1.6; }
button[aria-disabled='true'] { opacity:.5; cursor:default; }
.appearance-preview { padding:10px 5px; }.appearance-preview .fp-msg { display:flex; gap:10px; align-items:center; }.appearance-preview .fp-avatar { display:block; width:28px; height:28px; border-radius:var(--fp-avatar-radius); }.appearance-preview .fp-avatar-frame { flex:none; }.appearance-preview .fp-bubble { position:relative; font-size:11px; padding:8px 12px; background:var(--fp-hover); border-radius:8px; }
.notice {
  margin: 0;
  font-size: 12px;
  color: #e6c07b;
}
</style>
