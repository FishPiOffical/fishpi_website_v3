import type { ClientDownload } from '@/api/v3-client-downloads'

// 上个线上版本使用的公开目录。目录接口暂不可用时保留上一版公开下载入口。
export const bundledClientDownloads: ClientDownload[] = [
  {
    id: "windows", name: "Windows 客户端", group: "desktop",
    icon: "https://fishpi.cn/images/clients/windows.png", status: "active", recommended: false,
    authors: [{"name":"imlinhanchao","userName":"imlinhanchao"}],
    links: [{"label":"Github Releases","href":"https://github.com/imlinhanchao/fishpi-desktop/releases"}],
  },
  {
    id: "macos", name: "macOS 客户端", group: "desktop",
    icon: "https://fishpi.cn/images/clients/macos.png", status: "active", recommended: false,
    authors: [{"name":"imlinhanchao","userName":"imlinhanchao"}],
    links: [{"label":"Github Releases","href":"https://github.com/imlinhanchao/fishpi-desktop/releases"}],
  },
  {
    id: "android-recommended", name: "Android 客户端", group: "mobile",
    icon: "https://fishpi.cn/images/clients/android.png", status: "active", recommended: true,
    authors: [{"name":"otis1026","userName":"otis1026"}],
    links: [{"label":"详细地址","href":"/article/1745833503658"}],
  },
  {
    id: "android-native", name: "Android 客户端（原生）", group: "mobile",
    icon: "https://fishpi.cn/images/clients/android.png", status: "active", recommended: false,
    authors: [{"name":"csfwff","userName":"csfwff"}],
    links: [{"label":"详细地址","href":"/article/1656144820684"}],
  },
  {
    id: "vscode", name: "VSCode 插件", group: "tools",
    icon: "https://fishpi.cn/images/clients/vscode.png", status: "active", recommended: false,
    authors: [{"name":"imlinhanchao","userName":"imlinhanchao"}],
    links: [{"label":"Visual Studio Marketplace","href":"https://marketplace.visualstudio.com/items?itemName=hancel.pwl-chat"}],
  },
  {
    id: "utools", name: "uTools 插件", group: "tools",
    icon: "https://fishpi.cn/images/clients/utools.png", status: "active", recommended: false,
    authors: [{"name":"otis1026","userName":"otis1026"}],
    links: [{"label":"立刻尝鲜","href":"/article/1748939764736"}],
  },
  {
    id: "chrome", name: "Chrome 插件", group: "tools",
    icon: "https://fishpi.cn/images/clients/chrome.png", status: "active", recommended: false,
    authors: [{"name":"Lemon","userName":"lemon"}],
    links: [
      { label: "Github Releases", href: "https://github.com/Lemon-cxh/pwl-chat-extension/releases" },
      { label: "Microsoft Edge Addons", href: "https://microsoftedge.microsoft.com/addons/detail/%E6%91%B8%E9%B1%BC%E6%B4%BE%E8%81%8A%E5%A4%A9%E5%AE%A4/oldbilakhdpiamjbkocdcdnlnakainfm" },
      { label: "Chrome 网上应用店", href: "https://chrome.google.com/webstore/detail/%E6%91%B8%E9%B1%BC%E6%B4%BE%E8%81%8A%E5%A4%A9%E5%AE%A4/fkaomdjjdbglkbcmfhhlioejkpacbbpe" },
    ],
  },
  {
    id: "idea", name: "IDEA 插件", group: "tools",
    icon: "https://fishpi.cn/images/clients/idea.jpg", status: "active", recommended: false,
    authors: [{"name":"Danbai","userName":"Danbai"}],
    links: [
      { label: "Github Releases", href: "https://github.com/danbai225/pwl-chat/releases" },
      { label: "IntelliJ IDEs Plugin | Marketplace", href: "https://plugins.jetbrains.com/plugin/18091-pwl-chat" },
    ],
  },
  {
    id: "python", name: "Python 客户端", group: "terminal",
    icon: "https://fishpi.cn/images/clients/python.png", status: "active", recommended: false,
    authors: [{"name":"Gakkiyomi","userName":"Gakkiyomi"}],
    links: [{"label":"Github","href":"https://github.com/gakkiyomi/pwl-chat-python"}],
  },
  {
    id: "golang-distributed", name: "Golang 分布式客户端", group: "terminal",
    icon: "https://fishpi.cn/images/clients/Golang.png", status: "active", recommended: false,
    authors: [{"name":"bulabula","userName":"bulabula"}],
    links: [{"label":"Github","href":"https://github.com/New-arkssac/fishpi-Goclient"}],
  },
  {
    id: "golang-terminal", name: "Golang 终端客户端", group: "terminal",
    icon: "https://fishpi.cn/images/clients/Golang.png", status: "active", recommended: false,
    authors: [{"name":"8888","userName":"8888"}],
    links: [{"label":"Github Releases","href":"https://github.com/fghwett/fishpi-golang/releases/"}],
  },
  {
    id: "coming-soon", name: "更多平台开发中…", group: "more",
    icon: "https://fishpi.cn/images/clients/code.png", status: "comingSoon", recommended: false,
    authors: [],
    links: [],
  },
  {
    id: "ios-retired", name: "iOS 客户端", group: "mobile",
    icon: "https://fishpi.cn/images/clients/ios.png", status: "retired", recommended: false,
    authors: [{"name":"Yui","userName":"Yui"},{"name":"iwpz","userName":"iwpz"}],
    links: [],
  },
  {
    id: "android-retired", name: "Android 客户端", group: "mobile",
    icon: "https://fishpi.cn/images/clients/android.png", status: "retired", recommended: false,
    authors: [{"name":"Yui","userName":"Yui"},{"name":"iwpz","userName":"iwpz"}],
    links: [],
  },
  {
    id: "android-flutter-retired", name: "Android 客户端（Flutter）", group: "mobile",
    icon: "https://fishpi.cn/images/clients/android.png", status: "retired", recommended: false,
    authors: [{"name":"iwpz","userName":"iwpz"}],
    links: [],
  },
]
