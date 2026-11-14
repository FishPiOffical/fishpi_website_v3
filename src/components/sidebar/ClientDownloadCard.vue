<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
<template>
  <div class="client-download">
    <img src="https://file.fishpi.cn/logo_app.png" width="36" height="36" alt="" />
    <div class="download-copy"><strong>随时随地摸鱼</strong><p>下载摸鱼派客户端，想摸就摸！</p></div>
    <RouterLink to="/download" class="download-action">下载 <span aria-hidden="true">↗</span></RouterLink>
  </div>
</template>
<style scoped>
.client-download { display:flex; align-items:center; flex-wrap:wrap; gap:10px; padding:12px; border:1px solid var(--fp-border); border-radius:10px; background:var(--fp-surface-subtle); }
.client-download img { flex:none; border-radius:8px; }
.download-copy { flex:1; min-width:120px; }
.download-copy strong { font-size:13px; color:var(--fp-title); }
.download-copy p { margin:3px 0 0; font-size:11px; line-height:1.5; color:var(--fp-muted); }
.download-action { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:34px; padding:0 12px; margin-left:auto; border-radius:8px; background:var(--fp-primary); color:#fff; text-decoration:none; font-size:12px; font-weight:600; }
.download-action:hover { color:#fff; text-decoration:none; filter:brightness(.95); }
.download-action:focus-visible { outline:2px solid var(--fp-primary); outline-offset:3px; }
</style>
