/**
 * 现网缺失 JSON 接口的本地假数据。
 * 正式契约见 docs/MISSING_APIS.md；有接口后应删除此处回退。
 */

import type { HomeColumnCard, UserBag } from '@/api/fishpi'

export const mockUserBag: UserBag = {
  checkin1day: 1,
  checkin2days: 0,
  nameCard: 1,
  metalTicket: 0,
  patchCheckinCard: 1,
  patchStart: '2026-10-01',
  sysCheckinRemain: 0,
}

function chapter(articleId: string, no: string, title: string) {
  return {
    articleId,
    permalink: `/article/${articleId}`,
    chapterNo: no,
    title,
  }
}

export const mockHomeColumns: { recent: HomeColumnCard[]; hot: HomeColumnCard[] } = {
  recent: [
    {
      columnId: 'mock-col-snow',
      columnTitle: '雪满辽东（假数据）',
      columnArticleCount: 19,
      chapters: [
        chapter('mock-art-snow-19', '第 19 章', '第十九章 · 呈递'),
        chapter('mock-art-snow-18', '第 18 章', '第十八章 · 铁声'),
      ],
      latestChapter: chapter('mock-art-snow-19', '第 19 章', '第十九章 · 呈递'),
    },
    {
      columnId: 'mock-col-bowl',
      columnTitle: '《漆碗》（假数据）',
      columnArticleCount: 8,
      chapters: [
        chapter('mock-art-bowl-8', '第 8 章', '第八章 晋升'),
        chapter('mock-art-bowl-7', '第 7 章', '第七章 夜谈'),
      ],
      latestChapter: chapter('mock-art-bowl-8', '第 8 章', '第八章 晋升'),
    },
    {
      columnId: 'mock-col-power',
      columnTitle: '某种超能力（假数据）',
      columnArticleCount: 46,
      chapters: [
        chapter('mock-art-power-46', '第 46 章', '第四十六章 人类的妥协'),
        chapter('mock-art-power-45', '第 45 章', '第四十五章 协议'),
      ],
      latestChapter: chapter('mock-art-power-46', '第 46 章', '第四十六章 人类的妥协'),
    },
  ],
  hot: [
    {
      columnId: 'mock-col-wuan',
      columnTitle: '午安的情感故事（假数据）',
      columnArticleCount: 66,
      chapters: [
        chapter('mock-art-wuan-67', '第 67 章', '质问'),
        chapter('mock-art-wuan-66', '第 66 章', '新年的钟声'),
      ],
      latestChapter: chapter('mock-art-wuan-67', '第 67 章', '质问'),
    },
    {
      columnId: 'mock-col-setting',
      columnTitle: '《别管，这是设定》（假数据）',
      columnArticleCount: 36,
      chapters: [
        chapter('mock-art-set-36', '第 36 章', '设定补丁'),
        chapter('mock-art-set-35', '第 35 章', '旁白罢工'),
      ],
      latestChapter: chapter('mock-art-set-36', '第 36 章', '设定补丁'),
    },
    {
      columnId: 'mock-col-xiandi',
      columnTitle: '仙帝，修修代码不就有了？（假数据）',
      columnArticleCount: 35,
      chapters: [
        chapter('mock-art-xd-35', '第 35 章', '编译飞升'),
        chapter('mock-art-xd-34', '第 34 章', '依赖冲突'),
      ],
      latestChapter: chapter('mock-art-xd-35', '第 35 章', '编译飞升'),
    },
  ],
}

/** 重置密码页缺少 JSON；本地用假 userId 走通 UI（提交现网会失败）。 */
export function mockResetPwdMeta(code: string) {
  return {
    userId: 'mock-reset-user-id',
    code: code || '000000',
  }
}
