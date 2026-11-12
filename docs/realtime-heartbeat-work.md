# v3 实时心跳兼容

本次基于 main，生产代码仅修改 `src/api/v3-realtime.ts`。通知、私信、聊天室和文章订阅均调用同一个 `subscribeChanges`，未增加新的连接管理器、依赖或心跳定时器。

- 保留认证首帧票据、ready 后每 25 秒 ping、OPEN 检查和既有退避重连。每次重连重新 POST 申请票据，票据不进入 URL。
- pong 单独消费，不进入业务消息处理。业务推送和 chat.presence 不刷新心跳时间。
- 原心跳定时器同时检查距上次发送、上次 pong 的实际时间。达到 60 秒即废弃连接重新取票，不向已超时连接补发 ping。
- focus、visibilitychange、pageshow 检查连接是否因暂停而失效；online 废弃当前连接并走既有退避。不会另开轮询定时器。
- 清理时移除恢复检查，订阅销毁移除事件监听。旧连接回调通过原 sequence/transport/token 校验隔离；ready 回调中同步销毁也不会再创建心跳。
- 授权到期继续由服务端关闭，客户端不修改或延长 expiresAt，close 后按原路径申请新票据。重连 ready 保留原有未读数、聊天历史/话题、文章失效补读。
- 不改变聊天室进出场规则、业务格式、鉴权或旧 /user-channel。

## 验证

`node tools/v3-realtime-heartbeat-test.mjs` 对实际 TS 模块使用虚拟时钟，逐一覆盖四通道：125 秒心跳/pong、有业务推送、61 秒暂停且 readyState 仍为 OPEN、新票据、重连补读、旧回调/旧定时器、无 pong、online、授权关闭、退出及反复订阅清理。

原有通知、文章实时、聊天室 timeline 专项通过；`npx vue-tsc -b` 和 `npm run build` 通过。

私信面板专项 `v3-messages-test.mjs` 在原有文案断言处失败：期待“结果未确认”，HEAD 组件为“暂未确认私信操作是否成功，请重试”。该专项使用替代实时模块，未加载本次修改文件。本次未修改无关文案或断言。

浏览器使用本机 Chrome（headless）桌面 1440×900 和 iPhone 13 移动端模拟，加载实际编译后的实时模块，通过 Playwright WebSocket 协议夹具回复 ready/pong：

- 两端四通道均实际运行 130 秒，每连接记录 5 次 ping，相邻约 25 秒，期间每 5 秒业务推送不影响心跳。
- 桌面夹具不再接受 ping 后，实际 60 秒超时关闭，四通道重新取票且触发补读。
- 后续恢复测试脚本最初因 Playwright 没有 clock.jump 方法中断；改用 fastForward 后独立补测。桌面和移动端模拟均通过缩短服务端超时、online、65 秒时钟跳跃和退出后推进 120 秒不重连检查。
- 真实手机/Safari、操作系统睡眠、真实断网/网络切换、Rhythm 的真实授权到期及真实业务数据补读未验。授权关闭及业务补读入口由专项夹具验证，不能代替真实联调。

浏览器协议夹具不能替代真实 Rhythm、手机真机与操作系统休眠联调。
