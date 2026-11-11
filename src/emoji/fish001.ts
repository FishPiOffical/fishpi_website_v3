const assets = [
  ['盼望下班', '/yui/files/2026/11/11/270772.png'],
  ['打会儿瞌睡', '/yui/files/2026/11/11/270775.png'],
  ['要吃午饭了', '/yui/files/2026/11/11/270776.png'],
  ['下班了', '/yui/files/2026/11/11/270777.png'],
  ['我好饿', '/yui/files/2026/11/11/270778.png'],
  ['偷偷摸鱼', '/yui/files/2026/11/11/270779.png'],
  ['老板来了', '/yui/files/2026/11/11/270780.png'],
  ['假装忙碌', '/yui/files/2026/11/11/270781.png'],
  ['收到', '/yui/files/2026/11/11/270782.png'],
  ['我尽量', '/yui/files/2026/11/11/270783.png'],
  ['让我缓缓', '/yui/files/2026/11/11/270784.png'],
  ['不想上班', '/yui/files/2026/11/11/270785.png'],
  ['怎么还没下班', '/yui/files/2026/11/11/270786.png'],
  ['周五啦', '/yui/files/2026/11/11/270787.png'],
  ['周一自闭', '/yui/files/2026/11/11/270788.png'],
  ['开会勿扰', '/yui/files/2026/11/11/270789.png'],
  ['咖啡续命', '/yui/files/2026/11/11/270790.png'],
  ['工资到账', '/yui/files/2026/11/11/270791.png'],
  ['这就去办', '/yui/files/2026/11/11/270792.png'],
  ['辛苦了', '/yui/files/2026/11/11/270793.png'],
] as const

export const fish001 = {
  id: 'builtin:fish001',
  name: '派小鱼',
  items: assets.map(([name, path]) => ({ name, url: `https://file.fishpi.cn${path}` })),
}
