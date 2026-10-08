<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  fetchAdminArticles,
  fetchAdminComments,
  fetchAdminReports,
  fetchAdminUsers,
} from '@/api/admin'
import type {
  AdminArticleRow,
  AdminCommentRow,
  AdminReportRow,
  AdminUserRow,
} from '@/api/admin.mock'

type Kind = 'users' | 'articles' | 'comments' | 'reports'

const route = useRoute()
const kind = computed<Kind>(() => {
  const p = route.path
  if (p.includes('/articles')) return 'articles'
  if (p.includes('/comments')) return 'comments'
  if (p.includes('/reports')) return 'reports'
  return 'users'
})

const titles: Record<Kind, string> = {
  users: '用户',
  articles: '帖子',
  comments: '评论',
  reports: '举报',
}

const loading = ref(true)
const users = ref<AdminUserRow[]>([])
const articles = ref<AdminArticleRow[]>([])
const comments = ref<AdminCommentRow[]>([])
const reports = ref<AdminReportRow[]>([])

async function load() {
  loading.value = true
  try {
    if (kind.value === 'users') users.value = await fetchAdminUsers()
    else if (kind.value === 'articles') articles.value = await fetchAdminArticles()
    else if (kind.value === 'comments') comments.value = await fetchAdminComments()
    else reports.value = await fetchAdminReports()
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
watch(kind, () => void load())
</script>

<template>
  <section class="panel">
    <h2>{{ titles[kind] }}</h2>
    <p class="hint">只读列表；写操作仍依赖现网 FTL /admin。JSON 见 docs/MISSING_APIS.md。</p>
    <p v-if="loading" class="hint">加载中…</p>
    <table v-else-if="kind === 'users'">
      <thead>
        <tr>
          <th>用户</th>
          <th>积分</th>
          <th>角色</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.oId">
          <td>{{ u.userNickname || u.userName }} <small>@{{ u.userName }}</small></td>
          <td>{{ u.userPoint ?? '—' }}</td>
          <td>{{ u.roleId || '—' }}</td>
          <td>{{ u.userStatus || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <table v-else-if="kind === 'articles'">
      <thead>
        <tr>
          <th>标题</th>
          <th>作者</th>
          <th>时间</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in articles" :key="a.oId">
          <td>{{ a.articleTitle }}</td>
          <td>{{ a.articleAuthorName }}</td>
          <td>{{ a.articleCreateTimeStr || '—' }}</td>
          <td>{{ a.articleStatus || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <table v-else-if="kind === 'comments'">
      <thead>
        <tr>
          <th>内容</th>
          <th>作者</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in comments" :key="c.oId">
          <td>{{ c.commentContent }}</td>
          <td>{{ c.commentAuthorName }}</td>
          <td>{{ c.commentCreateTimeStr || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <table v-else>
      <thead>
        <tr>
          <th>类型</th>
          <th>目标</th>
          <th>举报人</th>
          <th>备注</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in reports" :key="r.oId">
          <td>{{ r.reportDataType }}</td>
          <td>{{ r.reportDataId }}</td>
          <td>{{ r.reportUserName }}</td>
          <td>{{ r.reportMemo || '—' }}</td>
          <td>{{ r.reportHandleStatus || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.panel {
  background: var(--fp-card);
  border-radius: 8px;
  box-shadow: var(--fp-card-shadow);
  padding: 16px 18px;
  overflow-x: auto;
}
h2 {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--fp-title);
}
.hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--fp-muted);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  color: var(--fp-text);
}
th,
td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--fp-border);
  vertical-align: top;
}
th {
  color: var(--fp-muted);
  font-weight: 600;
}
small {
  color: var(--fp-muted);
}
</style>
