# V3 全局验证码流程

Rhythm 的全局 IP 盾与旧站共用状态；V3 触发后返回 HTTP 403 `captcha_required`，旧页面继续跳转 `/test`。普通401代表认证问题，不能统一当验证码。该盾不同于账号短信、联系方式与宠物操作各自的验证。

`src/api/http.ts` 在首页队列任务内部等待共用的验证屏障；`RiskCaptchaGate` 经现有 `useGeetest4` 加载极验，提交 `POST /validateCaptcha` 后仅以服务端 `code=0` 为通过。供应商失败、取消或关闭不解封；关闭后的旧组件和旧证明回调不影响新一轮。

同标签页正在进行的多个挑战只共享一次验证；验证期间新业务等待，校验提交不入首页和凭据队列。成功版本防止迟到的旧403重复开窗，失败版本让取消前已排队的任务一起结束；用户新的显式操作可再验证。原请求最多重试一次，写操作仅在明确前置挑战后保留原请求体与幂等键恢复；未知提交结果不自动重发。身份变化、离页取消和AbortSignal继续约束原请求，普通令牌轮换沿原身份规则。

SSR 的 `ssrUpstreamGate` 保留上游验证码退避原因，每次渲染自行观察并写入 `upstreamCaptcha`。浏览器挂载后请求 `/api/v3/auth/captcha-options` 核实自己的来源，实际受限才打开验证；成功后 `fp:retry-public` 仅重读公开资源。SSR服务器IP与访客IP分开，不合成来源证明，浏览器通过不解封SSR服务器。合法共享缓存沿原策略；失败数据保留未知，不假装合法空列表。

实时订阅收到验证码拒绝时保留blocked，不当作文章删除；`fp:captcha-passed` 触发重新申请票据，仍须WebSocket认证及ready才算连接恢复。卸载清监听和定时器。

## 浏览器诊断日志

全局验证码流程以 `[FP captcha]` 输出单行 JSON，关联 `pageId`、`requestId`、`flowId`、`gateId`、组件代次和提交次数。记录请求排队及实际发送、HTTP 状态、可读的服务端请求标识、凭据携带方式、内存令牌是否存在、共享恢复、供应商组件事件、服务端确认、关闭原因和原请求重试结果。页面启动记录诊断版本、产物文件名、浏览器版本、时区偏移、页面来源、刷新类型、窗口尺寸及 Service Worker 控制状态。

采用字段白名单，路径中的动态值投影为 `:value`，查询参数、片段、请求体、响应正文、Cookie、Authorization 内容、验证码证明和错误原文均不进入日志。日志只保留在浏览器控制台与当前标签页 sessionStorage，最近 600 条跨刷新保留。存储不可用会输出事件，内存和控制台继续记录。没有网络上报。

复现时打开 F12 → Console，勾选 Preserve log，过滤 `FP captcha`。发生重复弹窗后运行 `copy(window.fpCaptchaDiagnostics.export())`，将复制内容连同大致发生时间发送给维护人员。也可直接复制筛选后的控制台日志。清理时运行 `window.fpCaptchaDiagnostics.clear()`。导出包含自动验证实际记录，服务端内部判定仍需通过时间与服务端 requestId 关联查询。

PC 和移动端分别验证成功、拒绝后重试、取消以及刷新后导出，核对同一轮 `flowId` 和原请求 `requestId` 连续，且导出中没有凭据或业务内容。自动专项使用受控供应商与本机 HTTP 边界验证事件关联。

## 自动验证

专项统一通过 `node --import ./tools/ui-test-imports.mjs tools/<脚本名>.mjs` 执行，加载实际共享诊断模块。下列命令中的脚本名与验证范围一一对应。

- `node tools/v3-captcha-diagnostics-test.mjs`：字段和路径脱敏、JSON 导出、跨刷新保留、容量与存储不可用边界。
- `node tools/v3-captcha-flow-test.mjs`：本机HTTP、实际请求队列与协调器、entry-client启动逻辑，人工交互及应用挂载边界由夹具控制。
- `node tools/v3-captcha-gate-test.mjs`：实际Vue组件、FpDialog及极验helper的生命周期；供应商和服务端结果由夹具控制。
- `node tools/v3-ssr-upstream-gate-test.mjs`：上游退避、原因隔离及探测恢复。
- `node tools/v3-realtime-heartbeat-test.mjs`：票据/连接/心跳及验证码解封后的重连，transport由夹具控制。
- `node tools/v3-http-body-test.mjs`、`node tools/v3-article-realtime-test.mjs`、`npm run build`：相邻回归、类型检查与双端构建。

以上不能证明真实供应商、真实Rhythm进程、可信代理来源或PC/移动端交互通过。按Rhythm的 `docs/api-v3-captcha-flow-work.md` 完成人工验收，缺少亲测结果拒绝合入。

## 协作与范围

修改前检查差异并pull；改完后等用户同意，再推工作分支并创建PR，不直接推目标分支、不自动合并。保留无关改动，Rhythm单独提交。当前仅打通原方案第2/4/5步，路由扩充、计数重设计、第三方完整矩阵、多标签页及多实例协调仍延期，以Rhythm工作单为准。


## 2026-11-15 PR #1 复核

复核发现凭据队列在入队前校验身份、出队时未再校验，导致旧刷新请求可能在退出后仍修改 Cookie。已在实际派发前重新检查身份、AbortSignal 和验证码取消代际，并增加实际 HTTP 排队刷新回归；离线身份专项同步验证旧排队请求被取消而非继续发送。

新增与相邻专项、完整构建通过。全量首次为 117 项、18 项失败，其中离线身份断言因改为发送前取消而需同步；修正后该专项通过。未修改 origin/main 的 115 项对比有 19 项失败，其余 17 个失败文件均在基线重现；基线另外两项失败为退役桥接和反馈代理（后者超时）。这不等于全量测试全绿。

浏览器亲测实际组件及请求协调器的本地夹具：桌面三并发只打开一次验证、成功后共四次业务请求/一次证明；取消后三请求全部拒绝且没有提交证明；390×844 移动尺寸首次证明失败后仍受限且可再次触发验证；二次成功恢复由组件自动化测试覆盖，浏览器未观察最终结果。没有请求生产业务或模拟通过真实极验。真实供应商、真实 Rhythm 限流来源与部署代理仍需独立联调，不能用夹具结果替代。


## 2026-11-15 验证码面板裁切修复

RiskCaptchaGate 原先用 float 模式，展开的挑战会受到 FpDialog 面板 overflow:hidden 和正文 overflow:auto 裁切。首次挂载和证明失败后的重新挂载统一改用官方 popup 模式，独立显示供应商挑战面板；不改共享弹窗样式、认证证明、关闭和请求恢复逻辑。官方配置说明：https://docs.geetest.com/gt4/apirefer/api/web/ 。

`node tools/v3-captcha-gate-test.mjs` 与 `npx vue-tsc -b` 通过。本地实际 RiskCaptchaGate/FpDialog 加载真实极验，桌面1280×720及手机390×844均显示完整拼图、滑块和底部操作；未拖动或提交验证码，不替代真实证明成功链路验收。临时检查入口已移除。
