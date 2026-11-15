# V3 全局验证码流程

Rhythm 的全局 IP 盾与旧站共用状态；V3 触发后返回 HTTP 403 `captcha_required`，旧页面继续跳转 `/test`。普通401代表认证问题，不能统一当验证码。该盾不同于账号短信、联系方式与宠物操作各自的验证。

`src/api/http.ts` 在首页队列任务内部等待共用的验证屏障；`RiskCaptchaGate` 经现有 `useGeetest4` 加载极验，提交 `POST /validateCaptcha` 后仅以服务端 `code=0` 为通过。供应商失败、取消或关闭不解封；关闭后的旧组件和旧证明回调不影响新一轮。

同标签页正在进行的多个挑战只共享一次验证；验证期间新业务等待，校验提交不入首页和凭据队列。成功版本防止迟到的旧403重复开窗，失败版本让取消前已排队的任务一起结束；用户新的显式操作可再验证。原请求最多重试一次，写操作仅在明确前置挑战后保留原请求体与幂等键恢复；未知提交结果不自动重发。身份变化、离页取消和AbortSignal继续约束原请求，普通令牌轮换沿原身份规则。

SSR 的 `ssrUpstreamGate` 保留上游验证码退避原因，每次渲染自行观察并写入 `upstreamCaptcha`。浏览器挂载后请求 `/api/v3/auth/captcha-options` 核实自己的来源，实际受限才打开验证；成功后 `fp:retry-public` 仅重读公开资源。SSR服务器IP与访客IP分开，不合成来源证明，浏览器通过不解封SSR服务器。合法共享缓存沿原策略；失败数据保留未知，不假装合法空列表。

实时订阅收到验证码拒绝时保留blocked，不当作文章删除；`fp:captcha-passed` 触发重新申请票据，仍须WebSocket认证及ready才算连接恢复。卸载清监听和定时器。

## 自动验证

- `node tools/v3-captcha-flow-test.mjs`：本机HTTP、实际请求队列与协调器、entry-client启动逻辑，人工交互及应用挂载边界由夹具控制。
- `node tools/v3-captcha-gate-test.mjs`：实际Vue组件、FpDialog及极验helper的生命周期；供应商和服务端结果由夹具控制。
- `node tools/v3-ssr-upstream-gate-test.mjs`：上游退避、原因隔离及探测恢复。
- `node tools/v3-realtime-heartbeat-test.mjs`：票据/连接/心跳及验证码解封后的重连，transport由夹具控制。
- `node tools/v3-http-body-test.mjs`、`node tools/v3-article-realtime-test.mjs`、`npm run build`：相邻回归、类型检查与双端构建。

以上不能证明真实供应商、真实Rhythm进程、可信代理来源或PC/移动端交互通过。按Rhythm的 `docs/api-v3-captcha-flow-work.md` 完成人工验收，缺少亲测结果拒绝合入。

## 协作与范围

修改前检查差异并pull；改完后等用户同意，再推工作分支并创建PR，不直接推目标分支、不自动合并。保留无关改动，Rhythm单独提交。当前仅打通原方案第2/4/5步，路由扩充、计数重设计、第三方完整矩阵、多标签页及多实例协调仍延期，以Rhythm工作单为准。
