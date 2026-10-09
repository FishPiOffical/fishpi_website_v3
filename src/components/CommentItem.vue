<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { ArticleComment } from '@/api/fishpi'
import ReactionBar from '@/components/ReactionBar.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import ImageLightbox from '@/components/ImageLightbox.vue'
import MedalList from '@/components/medal/MedalList.vue'

const props = withDefaults(
  defineProps<{
    comment: ArticleComment
    /** 楼中楼回复：小头像、紧凑间距、相对时间 */
    reply?: boolean
    replyTo?: string
    loggedIn?: boolean
    own?: boolean
    canAccept?: boolean
    /** 只展示，不提供任何操作（如优质回帖） */
    readonly?: boolean
    editing?: boolean
    apiKey?: string | null
    /** 长篇文章评论不展示勋章（与现网一致） */
    hideMedals?: boolean
  }>(),
  {
    reply: false,
    replyTo: '',
    loggedIn: false,
    own: false,
    canAccept: false,
    readonly: false,
    editing: false,
    apiKey: '',
    hideMedals: false,
  },
)

const emit = defineEmits<{
  reply: []
  vote: []
  thank: []
  edit: []
  remove: []
  accept: []
  react: [value: string]
}>()

const zoomed = ref('')
const author = computed(() => props.comment.commentAuthorName || '匿名')
const fullTime = computed(() => props.comment.commentCreateTimeStr || props.comment.timeAgo || '')
const shownTime = computed(() => (props.reply ? props.comment.timeAgo || fullTime.value : fullTime.value))
const goodCnt = computed(() => Number(props.comment.commentGoodCnt || 0))
const thankCnt = computed(() => Number(props.comment.commentThankCnt || 0))
const voted = computed(() => props.comment.commentVote === 0)
const interactive = computed(() => props.loggedIn && !props.readonly)
const hasReactions = computed(() => (props.comment.reactionSummary || []).some((r) => r.count > 0))
/** 没有任何计数/状态时，操作栏在桌面端悬浮到头部右侧，不额外占一行 */
const quiet = computed(
  () => !goodCnt.value && !thankCnt.value && !hasReactions.value && !voted.value && !props.comment.rewarded && !props.canAccept,
)

function onBodyClick(e: MouseEvent) {
  const img = (e.target as HTMLElement | null)?.closest('img')
  if (!img || img.classList.contains('emoji') || img.closest('a')) return
  zoomed.value = img.currentSrc || img.src
}
</script>

<template>
  <div class="cmt" :class="{ reply }">
    <div class="cmt-self">
      <RouterLink :to="`/member/${author}`" class="avatar-link" :title="author">
        <span
          class="avatar"
          :style="comment.commentAuthorThumbnailURL ? { backgroundImage: `url('${comment.commentAuthorThumbnailURL}')` } : undefined"
        />
      </RouterLink>
      <div class="cmt-main">
        <header class="cmt-head">
          <RouterLink :to="`/member/${author}`" class="name">{{ author }}</RouterLink>
          <MedalList v-if="!hideMedals" :items="comment.sysMetal" class="cmt-medals" />
          <span v-if="replyTo" class="reply-to">回复 @{{ replyTo }}</span>
          <time class="time" :title="fullTime">{{ shownTime }}</time>
        </header>

        <slot v-if="editing" name="editor" />
        <div v-else class="cmt-body" @click="onBodyClick" v-html="comment.commentContent || ''" />

        <footer v-if="interactive || goodCnt || thankCnt || hasReactions" class="cmt-ops" :class="{ quiet }">
          <ReactionBar
            :summary="comment.reactionSummary"
            :current="comment.currentUserReaction"
            :disabled="!interactive"
            add-label="🙂"
            @toggle="(v) => emit('react', v)"
          />
          <template v-if="interactive">
            <button type="button" class="op" :class="{ idle: !goodCnt && !voted, on: voted }" title="赞" @click="emit('vote')">
              👍<span v-if="goodCnt">{{ goodCnt }}</span>
            </button>
            <button
              type="button"
              class="op"
              :class="{ idle: !thankCnt && !comment.rewarded, on: comment.rewarded }"
              :disabled="comment.rewarded || own"
              :title="comment.rewarded ? '已感谢' : '感谢'"
              @click="emit('thank')"
            >
              ❤️<span v-if="thankCnt">{{ thankCnt }}</span>
            </button>
            <button type="button" class="op idle" @click="emit('reply')">回复</button>
            <button v-if="own" type="button" class="op idle" @click="emit('edit')">编辑</button>
            <button v-if="own" type="button" class="op idle danger" @click="emit('remove')">删除</button>
            <button v-if="canAccept" type="button" class="op accept" @click="emit('accept')">采纳</button>
            <span v-if="!own" class="op-report idle">
              <ReportDialog :api-key="apiKey || ''" :data-id="comment.oId" :data-type="1" />
            </span>
          </template>
          <template v-else>
            <span v-if="goodCnt" class="op static">👍{{ goodCnt }}</span>
            <span v-if="thankCnt" class="op static">❤️{{ thankCnt }}</span>
          </template>
        </footer>
      </div>
    </div>

    <div v-if="$slots.default" class="replies">
      <slot />
    </div>
    <ImageLightbox v-model="zoomed" />
  </div>
</template>

<style scoped>
.cmt-self {
  position: relative;
  display: flex;
  gap: 12px;
}
.avatar-link {
  flex: none;
}
.avatar {
  display: block;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: var(--fp-border) center / cover;
}
.reply .cmt-self {
  gap: 8px;
}
.reply .avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
.cmt-main {
  flex: 1;
  min-width: 0;
}
.cmt-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-height: 20px;
  line-height: 20px;
}
.reply .cmt-head {
  min-height: 24px;
  line-height: 24px;
}
.name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fp-title);
  text-decoration: none;
}
.name:hover {
  color: var(--fp-accent);
}
.reply-to {
  font-size: 12px;
  color: var(--fp-accent);
}
.time {
  font-size: 12px;
  color: var(--fp-muted);
}

.cmt-body {
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fp-text);
  word-break: break-word;
}
.reply .cmt-body {
  margin-top: 2px;
}
.cmt-body :deep(p) {
  margin: 0;
}
.cmt-body :deep(p + p),
.cmt-body :deep(ul),
.cmt-body :deep(ol),
.cmt-body :deep(blockquote),
.cmt-body :deep(pre) {
  margin-top: 6px;
  margin-bottom: 0;
}
.cmt-body :deep(img) {
  max-width: min(320px, 100%);
  max-height: 240px;
  width: auto;
  height: auto;
  object-fit: contain;
  vertical-align: middle;
  border-radius: 4px;
  cursor: zoom-in;
}
.cmt-body :deep(img[alt='图片表情']) {
  max-height: 120px;
  border-radius: 0;
}
.cmt-body :deep(img.emoji) {
  width: 20px;
  height: 20px;
  margin: 0 1px;
  vertical-align: -4px;
  cursor: default;
}
.cmt-body :deep(a) {
  color: var(--fp-link);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.cmt-body :deep(blockquote) {
  padding: 2px 10px;
  border-left: 3px solid var(--fp-border);
  color: var(--fp-muted);
}
.cmt-body :deep(pre) {
  max-height: 320px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
  background: var(--fp-bg);
  font-size: 13px;
}

.cmt-ops {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 4px;
  margin-top: 6px;
  min-height: 22px;
}
.cmt-ops :deep(.rx) {
  display: inline-flex;
  margin: 0;
}
.cmt-ops :deep(.rx .chip),
.cmt-ops :deep(.rx .ghost) {
  padding: 0 7px;
  line-height: 20px;
}
.cmt-ops :deep(.rx .ghost) {
  border-color: transparent;
}
.op,
.op-report :deep(.ghost) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 7px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--fp-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}
.op:hover:not(:disabled),
.op-report :deep(.ghost:hover),
.cmt-ops :deep(.rx .ghost:hover) {
  background: var(--fp-hover);
  color: var(--fp-accent);
}
.op:disabled {
  cursor: default;
}
.op.on {
  color: var(--fp-accent);
}
.op.danger:hover {
  color: #cf222e;
}
.op.accept {
  color: var(--fp-green);
  font-weight: 500;
}
.op.static {
  cursor: default;
}
.op-report {
  margin-left: auto;
}

.replies {
  margin: 8px 0 0 48px;
  padding-left: 12px;
  border-left: 2px solid var(--fp-border);
}
.replies > :deep(.cmt) {
  padding: 6px 0;
}

@media (hover: hover) and (pointer: fine) {
  .op.idle,
  .op-report.idle,
  .cmt-ops :deep(.rx.empty:not(.open)) {
    opacity: 0;
  }
  .cmt-self:hover .op.idle,
  .cmt-self:hover .op-report.idle,
  .cmt-self:hover .cmt-ops :deep(.rx.empty),
  .cmt-self:focus-within .op.idle,
  .cmt-self:focus-within .op-report.idle,
  .cmt-self:focus-within .cmt-ops :deep(.rx.empty) {
    opacity: 1;
  }
  .cmt-ops.quiet {
    position: absolute;
    top: 0;
    right: 0;
    margin: 0;
    padding-left: 8px;
    background: var(--fp-card);
    pointer-events: none;
  }
  .cmt-self:hover .cmt-ops.quiet,
  .cmt-self:focus-within .cmt-ops.quiet {
    pointer-events: auto;
  }
  .cmt-ops.quiet .op-report {
    margin-left: 0;
  }
}
@media (max-width: 768px) {
  .replies {
    margin-left: 18px;
  }
}
</style>
