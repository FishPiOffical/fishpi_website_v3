<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fetchArticleMd, postArticle, updateArticle, uploadFiles } from '@/api/fishpi'
import EmojiPicker from '@/components/EmojiPicker.vue'
import { useAuthStore } from '@/stores/auth'

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
const error = ref('')
const sending = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function loadEdit() {
  if (!apiKey.value || !editId.value) return
  error.value = ''
  try {
    const md = await fetchArticleMd(apiKey.value, editId.value)
    title.value = md.articleTitle
    tags.value = md.articleTags
    content.value = md.articleContent
    type.value = md.articleType
    offer.value = md.articleQnAOfferPoint
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法加载原文'
  }
}

onMounted(() => void loadEdit())
watch(editId, () => void loadEdit())

async function submit() {
  if (!apiKey.value) return
  error.value = ''
  sending.value = true
  try {
    const payload = {
      articleTitle: title.value,
      articleContent: content.value,
      articleTags: tags.value,
      articleType: type.value,
      articleQnAOfferPoint: type.value === 5 ? offer.value : 0,
    }
    const id = editId.value
      ? await updateArticle(apiKey.value, editId.value, payload)
      : await postArticle(apiKey.value, payload)
    await router.replace(id ? `/article/${id}` : '/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : editId.value ? '更新失败' : '发帖失败'
  } finally {
    sending.value = false
  }
}

async function insertImage(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  if (!apiKey.value || !files.length) return
  uploading.value = true
  error.value = ''
  try {
    const urls = await uploadFiles(apiKey.value, files)
    const chunk = urls.map((u, i) => `![${files[i]?.name || 'image'}](${u})`).join('\n')
    content.value = content.value ? `${content.value}\n${chunk}` : chunk
  } catch (err) {
    error.value = err instanceof Error ? err.message : '上传失败'
  } finally {
    uploading.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}
</script>

<template>
  <form class="card" @submit.prevent="submit">
    <h1>{{ editId ? '编辑帖子' : '发帖' }}</h1>
    <p v-if="!isLoggedIn" class="hint">请先登录。</p>
    <template v-else>
      <label>标题<input v-model="title" required /></label>
      <label>标签（逗号分隔）<input v-model="tags" required placeholder="前端,摸鱼" /></label>
      <label>
        类型
        <select v-model.number="type">
          <option :value="0">普通帖</option>
          <option :value="5">问答</option>
          <option :value="6">长文/专栏</option>
        </select>
      </label>
      <label v-if="type === 5">悬赏积分<input v-model.number="offer" type="number" min="0" /></label>
      <label>正文（Markdown）<textarea v-model="content" rows="12" required /></label>
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="insertImage" />
      <div class="tools">
        <EmojiPicker @insert="(md) => (content += md)" />
        <button type="button" class="ghost" :disabled="uploading" @click="fileInput?.click()">
          {{ uploading ? '上传中…' : '插入图片' }}
        </button>
      </div>
      <p v-if="error" class="err">{{ error }}</p>
      <button type="submit" :disabled="sending">
        {{ sending ? (editId ? '保存中…' : '发布中…') : editId ? '保存' : '发布' }}
      </button>
    </template>
  </form>
</template>

<style scoped>
.card {
  max-width: 720px;
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
</style>
