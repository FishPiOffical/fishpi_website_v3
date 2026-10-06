<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="card">
    <h1>注册</h1>
    <p>P0 先走现网注册流程，避免验证码链路漏接。</p>
    <a href="https://fishpi.cn/register" target="_blank" rel="noreferrer">前往 fishpi.cn 注册</a>
    <RouterLink to="/login">已有账号，去登录</RouterLink>
  </div>
</template>

<style scoped>
.card {
  max-width: 420px;
  margin: 40px auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 24px;
}
a {
  display: inline-block;
  margin-right: 12px;
  color: var(--fp-link);
}
</style>
