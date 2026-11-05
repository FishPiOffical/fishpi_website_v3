<script setup lang="ts">
import {getApiMode} from '@/api/mode'
defineProps<{capability:'preferences'|'app-login'|'invitations'|'identity'|'export';title:string}>()
const reasons={
 preferences:'旧接口缺少可完整读取的本人偏好设置，保存还需要经典页面验证。当前模式暂不提供此项设置。',
 'app-login':'旧版 APP 扫码登录依赖经典页面会话，当前模式暂不提供扫码授权。',
 invitations:'旧版邀请码购买和状态查询需要经典页面验证，当前模式暂不提供这些操作。',
 identity:'旧接口缺少可供本站使用的本人认证申请、审核记录和私有材料协议，当前模式暂不提供认证申请。',
 export:'旧版内容导出依赖经典页面会话，与私有导出任务协议不同，当前模式暂不提供创建或下载导出。',
}
</script>
<template>
 <section v-if="getApiMode()==='v1'" class="settings-capability" :aria-label="title">
  <h2>{{ title }}</h2><p role="status">{{ reasons[capability] }}</p>
 </section>
 <slot v-else />
</template>
<style scoped lang="scss">
.settings-capability {margin:16px 0;h2{font-size:18px;margin:0 0 8px}p{margin:0;color:var(--fp-muted);line-height:1.7}}
</style>
