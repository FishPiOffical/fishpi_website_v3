<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  fetchArticleDraft,
  fetchArticleDrafts,
  fetchArticleMd,
  postArticle,
  queryTags,
  removeArticleDraft,
  saveArticleDraft,
  updateArticle,
  type ArticleDraft,
  type ArticlePayload,
} from '@/api/fishpi'
import EmojiPicker from '@/components/EmojiPicker.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { useAuthStore } from '@/stores/auth'

const TYPES = [
  { value: 0, label: '帖子', tip: '分享对别人有帮助的经验与见解' },
  { value: 1, label: '机要', tip: '邀请好友在私密空间中进行交流' },
  { value: 2, label: '同城广播', tip: '发起你所在城市的招聘、Meetup 等，需消耗积分' },
  { value: 5, label: '问答', tip: '总有一个人知道这个问题的答案' },
]
const TYPE_LABELS: Record<number, string> = { 0: '帖子', 1: '机要', 2: '同城广播', 3: '思绪', 5: '问答', 6: '长文章' }
const STATEMENTS = [
  { value: 0, label: '无声明' },
  { value: 1, label: '包含 AI 辅助创作' },
  { value: 2, label: '包含剧透' },
  { value: 3, label: '虚构演绎，仅供娱乐' },
]

const auth = useAuthStore()
const { apiKey, isLoggedIn } = storeToRefs(auth)
const router = useRouter()
const route = useRoute()
const editId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const title = ref('')
const tags = ref('')
const content = ref('')
const type = ref(0)
const offer = ref(0)
const rewardOpen = ref(false)
const rewardContent = ref('')
const rewardPoint = ref<number | null>(null)
const anonymous = ref(false)
const commentable = ref(true)
const notifyFollowers = ref(false)
const showInList = ref(true)
const statement = ref(0)
const error = ref('')
const sending = ref(false)
const savingDraft = ref(false)
const drafts = ref<ArticleDraft[]>([])
const draftId = ref('')
const tagHints = ref<string[]>([])
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
let tagTimer = 0

const typeTip = computed(() => TYPES.find((t) => t.value === type.value)?.tip || '')
const allowAnonymous = computed(() => type.value !== 2 && type.value !== 5)

function draftKey(d: ArticleDraft) {
  return String(d.oId || d.articleDraftId || '')
}

async function loadDrafts() {
  if (!apiKey.value || editId.value) {
    drafts.value = []
    return
  }
  try {
    drafts.value = await fetchArticleDrafts(apiKey.value)
  } catch {
    drafts.value = []
  }
}

function applyDraft(d: ArticleDraft) {
  title.value = d.articleDraftTitle || d.articleTitle || ''
  tags.value = d.articleDraftTags || d.articleTags || ''
  content.value = d.articleDraftContent || d.articleContent || ''
  type.value = Number(d.articleDraftType ?? d.articleType ?? 0)
  offer.value = Number(d.articleDraftQnAOfferPoint || 0)
  rewardContent.value = d.articleDraftRewardContent || ''
  rewardPoint.value = d.articleDraftRewardPoint || null
  rewardOpen.value = Boolean(rewardContent.value)
  anonymous.value = d.articleDraftAnonymous === true
  commentable.value = d.articleDraftCommentable !== false
  notifyFollowers.value = d.articleDraftNotifyFollowers === true
  showInList.value = Number(d.articleDraftShowInList ?? 1) !== 0
  statement.value = Number(d.articleDraftStatement || 0)
  draftId.value = draftKey(d)
}

function applyPayload(p: ArticlePayload) {
  title.value = p.articleTitle
  tags.value = p.articleTags
  content.value = p.articleContent
  type.value = p.articleType
  offer.value = p.articleQnAOfferPoint || 0
  rewardContent.value = p.articleRewardContent || ''
  rewardPoint.value = p.articleRewardPoint || null
  rewardOpen.value = Boolean(rewardContent.value)
  anonymous.value = Boolean(p.articleAnonymous)
  commentable.value = p.articleCommentable !== false
  showInList.value = p.articleShowInList !== false
  statement.value = p.articleStatement || 0
}

async function loadDraft(id: string) {
  if (!apiKey.value) return
  try {
    applyDraft(await fetchArticleDraft(apiKey.value, id))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法加载草稿'
  }
}

async function loadEdit() {
  if (!apiKey.value || !editId.value) return
  error.value = ''
  draftId.value = ''
  try {
    applyPayload(await fetchArticleMd(apiKey.value, editId.value))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法加载原文'
  }
}

onMounted(async () => {
  const qType = Number(route.query.type)
  if (!editId.value && TYPES.some((t) => t.value === qType)) type.value = qType
  await loadEdit()
  await loadDrafts()
  const q = typeof route.query.draft === 'string' ? route.query.draft : ''
  if (q) await loadDraft(q)
})
watch(editId, () => {
  void loadEdit()
  void loadDrafts()
})

watch(tags, (value) => {
  window.clearTimeout(tagTimer)
  const last = value.split(/[,，]/).pop()?.trim() || ''
  if (!apiKey.value || last.length < 1) {
    tagHints.value = []
    return
  }
  tagTimer = window.setTimeout(async () => {
    try {
      tagHints.value = await queryTags(apiKey.value!, last)
    } catch {
      tagHints.value = []
    }
  }, 250)
})

function pickTag(name: string) {
  const parts = tags.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  parts.pop()
  if (!parts.includes(name)) parts.push(name)
  tags.value = parts.join(',')
  tagHints.value = []
}

function payload(): ArticlePayload {
  const reward = rewardOpen.value ? rewardContent.value : ''
  return {
    articleTitle: title.value,
    articleContent: content.value,
    articleTags: tags.value,
    articleType: type.value,
    articleQnAOfferPoint: type.value === 5 ? offer.value : 0,
    articleRewardContent: reward,
    articleRewardPoint: reward.trim() ? Number(rewardPoint.value || 0) : 0,
    articleAnonymous: allowAnonymous.value && anonymous.value,
    articleCommentable: commentable.value,
    articleNotifyFollowers: notifyFollowers.value,
    articleShowInList: showInList.value,
    articleStatement: statement.value,
  }
}

async function submit() {
  if (!apiKey.value) return
  error.value = ''
  if (!content.value.trim()) {
    error.value = '正文不能为空'
    return
  }
  if (type.value !== 5 && rewardOpen.value && rewardContent.value.trim()) {
    if (!Number.isInteger(Number(rewardPoint.value)) || Number(rewardPoint.value) < 1) {
      error.value = '打赏积分必须是正整数'
      return
    }
  }
  sending.value = true
  try {
    const id = editId.value
      ? await updateArticle(apiKey.value, editId.value, payload())
      : await postArticle(apiKey.value, payload())
    if (draftId.value) {
      try {
        await removeArticleDraft(apiKey.value, draftId.value)
      } catch {
        /* published anyway */
      }
    }
    await router.replace(id ? `/article/${id}` : '/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : editId.value ? '更新失败' : '发帖失败'
  } finally {
    sending.value = false
  }
}

async function saveDraft() {
  if (!apiKey.value) return
  error.value = ''
  savingDraft.value = true
  try {
    const saved = await saveArticleDraft(apiKey.value, {
      ...payload(),
      articleDraftId: draftId.value || undefined,
    })
    // 保存接口返回的草稿不含正文/打赏内容，回填会清空编辑器，只记下 ID。
    if (saved && !draftId.value) draftId.value = draftKey(saved)
    await loadDrafts()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存草稿失败'
  } finally {
    savingDraft.value = false
  }
}

async function dropDraft(id: string) {
  if (!apiKey.value) return
  try {
    await removeArticleDraft(apiKey.value, id)
    if (draftId.value === id) draftId.value = ''
    await loadDrafts()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除草稿失败'
  }
}

</script>

<template>
  <form class="card" @submit.prevent="submit">
    <h1>{{ editId ? '编辑帖子' : '发帖' }}</h1>
    <p v-if="!isLoggedIn" class="hint">请先登录。</p>
    <template v-else>
      <section v-if="!editId && drafts.length" class="drafts">
        <h2>草稿</h2>
        <button
          v-for="d in drafts"
          :key="draftKey(d)"
          type="button"
          class="ghost"
          @click="loadDraft(draftKey(d))"
        >
          {{ d.articleDraftTitle || '无标题' }}
          <span @click.stop="dropDraft(draftKey(d))">删除</span>
        </button>
      </section>
      <div v-if="!editId" class="type-row" role="radiogroup" aria-label="文章类型">
        <label v-for="t in TYPES" :key="t.value" class="type-opt" :class="{ current: type === t.value }">
          <input v-model.number="type" type="radio" name="articleType" :value="t.value" />
          {{ t.label }}
        </label>
      </div>
      <p class="type-tip">
        <b>{{ TYPE_LABELS[type] || '帖子' }}</b>
        <span v-if="typeTip">{{ typeTip }}</span>
        <span v-if="editId">（编辑时不可更改类型）</span>
      </p>

      <input v-model="title" class="title-input" required placeholder="标题" />
      <MarkdownEditor
        ref="editorRef"
        v-model="content"
        :api-key="apiKey"
        :height="500"
        outline
        :placeholder="type === 1 ? '机要内容仅被 @ 的用户可见' : '支持 Markdown，可直接粘贴或拖拽上传图片'"
      />
      <div class="tools">
        <EmojiPicker @insert="(md) => editorRef?.insert(md)" />
      </div>

      <label>
        标签（逗号分隔）
        <input v-model="tags" required placeholder="前端,摸鱼" />
      </label>
      <div v-if="tagHints.length" class="hints">
        <button v-for="t in tagHints" :key="t" type="button" class="ghost" @click="pickTag(t)">{{ t }}</button>
      </div>

      <label v-if="type === 5" class="inline-field">
        悬赏积分
        <input v-model.number="offer" type="number" min="0" placeholder="采纳答案时奖励给回答者" />
      </label>
      <section v-else class="reward">
        <button type="button" class="ghost reward-toggle" @click="rewardOpen = !rewardOpen">
          {{ rewardOpen ? '取消打赏' : '打赏' }}
        </button>
        <template v-if="rewardOpen">
          <p class="type-tip">打赏内容仅对打赏过的用户可见。</p>
          <MarkdownEditor v-model="rewardContent" :api-key="apiKey" :height="200" placeholder="打赏后可见的内容" />
          <label class="inline-field">
            打赏积分
            <input v-model.number="rewardPoint" type="number" min="1" placeholder="打赏积分" />
          </label>
        </template>
      </section>

      <section class="settings">
        <label class="inline-field">
          创作声明
          <select v-model.number="statement">
            <option v-for="s in STATEMENTS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </label>
        <label v-if="allowAnonymous" class="check">
          <input v-model="anonymous" type="checkbox" :disabled="Boolean(editId)" />匿名
        </label>
        <label class="check"><input v-model="showInList" type="checkbox" />在列表展示</label>
        <label class="check"><input v-model="commentable" type="checkbox" />允许回帖</label>
        <label class="check"><input v-model="notifyFollowers" type="checkbox" />通知关注者</label>
      </section>

      <p v-if="error" class="err">{{ error }}</p>
      <div class="tools">
        <button v-if="!editId" type="button" class="ghost" :disabled="savingDraft || !title.trim()" @click="saveDraft">
          {{ savingDraft ? '保存中…' : '存草稿' }}
        </button>
        <button type="submit" :disabled="sending">
          {{ sending ? (editId ? '保存中…' : '发布中…') : editId ? '保存' : '发布' }}
        </button>
      </div>
    </template>
  </form>
</template>

<style scoped>
.card {
  width: 100%;
  max-width: 960px;
  box-sizing: border-box;
  margin: 0 auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--fp-muted);
  font-size: 13px;
}
input,
select,
textarea {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px 10px;
}
button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
}
.ghost {
  background: transparent;
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
}
.tools {
  display: flex;
  gap: 8px;
  align-items: center;
}
.hint,
.err {
  font-size: 13px;
}
.err {
  color: #e07a5f;
}
.drafts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.drafts h2 {
  margin: 0;
  font-size: 13px;
  color: var(--fp-muted);
}
.drafts span {
  margin-left: 8px;
  color: var(--fp-muted);
}
.hints {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.type-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.type-opt {
  flex-direction: row;
  align-items: center;
  padding: 6px 14px;
  border: 1px solid var(--fp-border);
  border-radius: 999px;
  color: var(--fp-text);
  cursor: pointer;
}
.type-opt input {
  display: none;
}
.type-opt.current {
  border-color: var(--fp-primary);
  color: var(--fp-primary);
  font-weight: 600;
}
.type-tip {
  margin: 0;
  font-size: 13px;
  color: var(--fp-muted);
}
.type-tip b {
  margin-right: 8px;
  color: var(--fp-title);
}
.title-input {
  font-size: 16px;
  padding: 10px 12px;
}
.inline-field {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}
.inline-field input {
  width: 160px;
}
.reward {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.reward-toggle {
  align-self: flex-start;
  padding: 6px 14px;
}
.settings {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  padding: 12px 14px;
  border: 1px dashed var(--fp-border);
  border-radius: 8px;
}
.check {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  color: var(--fp-text);
  cursor: pointer;
}
</style>
