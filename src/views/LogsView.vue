<script setup lang="ts">
import { formatDisplayTime } from '@/utils/time'

import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDiscoveryExtras } from '@/composables/useDiscoveryExtras'
import { usePageSeo } from '@/composables/usePageSeo'
const auth = useAuthStore(), { value, p, loading, error, read } = useDiscoveryExtras('logs')
const records = computed(() => value.value?.kind === 'logs' ? value.value : null)
usePageSeo(() => ({ title: '公开日志', path: '/logs', robots: 'noindex' }))
</script>
<template><section class="public-logs fp-page fp-ui fp-surface"><h1 class="fp-page-title">公开日志</h1><p>展示公开操作的记录时间与类别。</p><p v-if="!auth.isLoggedIn"><RouterLink :to="{ path: '/login', query: { redirect: '/logs' } }">登录后查看</RouterLink></p><template v-else><button class="fp-control" type="button" :disabled="loading" @click="read()">刷新公开日志</button><p class="fp-state" v-if="loading" role="status">正在读取公开日志…</p><div class="fp-state" v-else-if="error" role="alert"><p>{{ error }}</p><button class="fp-control" type="button" @click="read()">重试公开日志</button><button class="fp-control" v-if="p > 1" type="button" @click="read(1)">返回日志首页</button></div><template v-else-if="records"><p>共 {{ records.total }} 条</p><ol><li v-for="item in records.list" :key="item.id"><b>{{ item.category }}</b><time :datetime="item.time.replace(' ', 'T')">{{ formatDisplayTime(item.time) }}</time><small>记录 {{ item.id }}</small></li></ol><p class="fp-state" v-if="!records.list.length">本页没有公开日志。</p><nav><button class="fp-control" type="button" :disabled="p <= 1" @click="read(p - 1)">上一页日志</button><span>第 {{ p }} 页 / 共 {{ records.pageCount }} 页</span><button class="fp-control" type="button" :disabled="p >= records.pageCount" @click="read(p + 1)">下一页日志</button><button class="fp-control" v-if="p > records.pageCount" type="button" @click="read(1)">返回日志首页</button></nav></template><p v-else role="status">公开日志尚未读取。</p></template></section></template>
<style scoped lang="scss">
.public-logs {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-panel-radius);
  color: var(--fp-text);

  > button {
    display: none;
  }
}

h1 {
  font-size: 20px;
  margin: 0 0 6px;
}

p,
time,
small {
  color: var(--fp-muted);
}

ol {
  list-style: none;
  padding: 0;
  margin: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

li {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: var(--fp-surface-subtle);
  border: 1px solid var(--fp-divider);
  border-radius: 10px;
  overflow-wrap: anywhere;

  b {
    font-size: 13px;
    font-weight: 600;
    color: var(--fp-accent);
    background: color-mix(in srgb, var(--fp-accent) 12%, var(--fp-card));
    padding: 3px 10px;
    border-radius: 999px;
  }

  time {
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }

  small {
    margin-left: auto;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
}

nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  align-items: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--fp-divider);
}

button {
  padding: 6px 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  color: var(--fp-text);
  margin: 4px;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
  }
}

[role='alert'] p {
  color: var(--fp-danger);
}

a {
  color: var(--fp-link);
}

@media (max-width: 600px) {
  li {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;

    small {
      margin-left: 0;
    }
  }
}
</style>
