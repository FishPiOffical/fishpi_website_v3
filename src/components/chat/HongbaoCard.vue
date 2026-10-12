<script setup lang="ts">
import { computed } from 'vue'
import type { RedPacketContent } from '@/api/fishpi'

const props = withDefaults(
  defineProps<{
    packet: RedPacketContent
    /** 当前用户是否为发红包的人 */
    isSender?: boolean
    /** 当前用户 id（用于判断是否已参与猜拳） */
    userId?: string
  }>(),
  { isSender: false, userId: '' },
)

const emit = defineEmits<{
  open: [gesture?: number]
}>()

const empty = computed(
  () => Number(props.packet.count || 0) > 0 && Number(props.packet.count) === Number(props.packet.got || 0),
)

const alreadyJoined = computed(() => {
  if (!props.userId || !Array.isArray(props.packet.who)) return false
  return props.packet.who.some((w) => w?.userId === props.userId)
})

const typeLabel = computed(() => {
  switch (props.packet.type) {
    case 'average':
      return '普通红包'
    case 'specify':
      return '专属红包'
    case 'heartbeat':
      return '心跳红包 (慎抢)'
    case 'rockPaperScissors':
      return '石头剪刀布红包'
    case 'dice':
      return '摇骰子'
    default:
      return '拼手气红包'
  }
})

/** 与现网一致：他人未领完且本人未参与的猜拳红包，手势直接挂在卡片上 */
const showGestures = computed(
  () =>
    props.packet.type === 'rockPaperScissors' &&
    !props.isSender &&
    !empty.value &&
    !alreadyJoined.value,
)

const desc = computed(() => {
  if (!empty.value) return ''
  return props.packet.type === 'dice' ? '已开盘' : '已经被抢光啦'
})

function onCardClick() {
  if (showGestures.value) return
  emit('open')
}

function onGesture(g: number, e: Event) {
  e.stopPropagation()
  emit('open', g)
}

function onKeydown(e: KeyboardEvent) {
  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
  e.preventDefault()
  onCardClick()
}
</script>

<template>
  <div
    class="hongbao__item"
    :class="{ opened: empty, 'is-rps': showGestures }"
    role="button"
    tabindex="0"
    @click="onCardClick"
    @keydown="onKeydown"
  >
    <div v-if="showGestures" class="hongbao__finger_guessing">
      <button
        type="button"
        class="hongbao__finger_guessing_icon rock"
        title="石头"
        aria-label="石头"
        @click="onGesture(0, $event)"
      />
      <button
        type="button"
        class="hongbao__finger_guessing_icon scissors"
        title="剪刀"
        aria-label="剪刀"
        @click="onGesture(1, $event)"
      />
      <button
        type="button"
        class="hongbao__finger_guessing_icon paper"
        title="布"
        aria-label="布"
        @click="onGesture(2, $event)"
      />
    </div>

    <svg class="hongbao__icon" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="8" y="6" width="32" height="38" rx="4" fill="#e74c3c" />
      <rect x="8" y="18" width="32" height="4" fill="#c0392b" />
      <circle cx="24" cy="20" r="5" fill="#f1c40f" />
      <text x="24" y="23.5" text-anchor="middle" font-size="7" font-weight="700" fill="#c0392b">開</text>
    </svg>

    <div class="hongbao__body">
      <div class="hongbao__msg">
        {{ packet.msg || '摸鱼者，事竟成！' }}
      </div>
      <div class="hongbao__type">{{ typeLabel }}</div>
    </div>
    <div class="hongbao__footer">
      <span class="hongbao__desc">{{ desc || '摸鱼派红包' }}</span>
      <span v-if="packet.money != null" class="hongbao__money">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="#f0c040" stroke="#d4a017" stroke-width="1" />
          <text x="8" y="11.5" text-anchor="middle" font-size="9" font-weight="700" fill="#8a6d1b">¥</text>
        </svg>
        {{ packet.money }}<small>积分</small>
      </span>
    </div>
  </div>
</template>

<style scoped>
.hongbao__item {
  position: relative;
  display: inline-grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 238px;
  margin: 2px 0;
  padding: 14px 14px 10px;
  border: 1px solid color-mix(in srgb, #e59230 22%, var(--fp-border));
  border-radius: 12px;
  background: color-mix(in srgb, #e59230 8%, var(--fp-card));
  color: var(--fp-text);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.035);
  cursor: pointer;
  user-select: none;
  max-width: 100%;
  box-sizing: border-box;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.hongbao__item:hover {
  border-color: color-mix(in srgb, #e59230 55%, var(--fp-border));
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.07);
}
.hongbao__item:focus-visible {
  outline: 2px solid var(--fp-primary);
  outline-offset: 3px;
}
.hongbao__item.opened {
  background: var(--fp-hover);
  border-color: var(--fp-border);
  box-shadow: none;
  color: var(--fp-muted);
}
.hongbao__item.opened .hongbao__icon {
  opacity: .55;
  filter: saturate(.5);
}
.hongbao__item.is-rps {
  min-height: 116px;
  margin-right: 42px;
  max-width: calc(100% - 42px);
}
.hongbao__icon {
  flex-shrink: 0;
  width: 42px;
  height: 48px;
}
.hongbao__body {
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
}
.hongbao__msg {
  word-break: break-word;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
}
.hongbao__type {
  margin-top: 4px;
  font-size: 11px;
  color: var(--fp-muted);
}
.hongbao__footer {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  padding-top: 9px;
  border-top: 1px solid color-mix(in srgb, #e59230 12%, var(--fp-border));
}
.hongbao__money {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.hongbao__money small {
  margin-left: 1px;
  font-size: 10px;
  font-weight: 400;
  color: var(--fp-muted);
}
.hongbao__desc {
  font-size: 10px;
  color: var(--fp-muted);
}
.hongbao__finger_guessing {
  position: absolute;
  z-index: 2;
  inset: 0;
  pointer-events: none;
}
.hongbao__finger_guessing_icon {
  position: absolute;
  right: -40px;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  background-color: transparent;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  cursor: pointer;
  pointer-events: auto;
  transition: border-color 0.2s ease;
}
.hongbao__finger_guessing_icon:hover {
  border-color: #5c1151;
}
.hongbao__finger_guessing_icon.rock {
  top: 3px;
  background-image: url('/images/redpacket/gesture/rock.png');
}
.hongbao__finger_guessing_icon.scissors {
  top: 41px;
  background-image: url('/images/redpacket/gesture/scissors.png');
}
.hongbao__finger_guessing_icon.paper {
  top: 79px;
  background-image: url('/images/redpacket/gesture/paper.png');
}
.opened .hongbao__finger_guessing {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .hongbao__item, .hongbao__finger_guessing_icon { transition: none; }
}
</style>
