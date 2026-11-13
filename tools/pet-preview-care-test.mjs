import assert from 'node:assert/strict'
import test from 'node:test'
import { createPetPreviewCare } from './pet-preview-care.mjs'

// 此专项只运行隔离预览的纯内存状态，不启动服务、不请求接口，也不触碰持续测试数据。
const HOUR = 3_600_000
const NOW = Date.UTC(2026, 10, 12, 10)
const zeroEffects = () => ({ hunger: 0, water: 0, mood: 0, energy: 0, experience: 0, friendship: 0 })
const catalog = {
  version: 3,
  growthRules: { experiencePerLevel: 100, maxLevel: 30, careExperience: 10, careFriendship: 2 },
  rules: {
    dailyCoins: 20, dailyFood: 2, restDurationMs: 4 * HOUR, restEnergyPerHour: 20,
    growthDailyLimit: 10, careCooldownMs: HOUR / 2, waterGain: 40, petMood: 10, playMood: 20, playEnergy: 10,
  },
  items: [
    { id: 'food', name: '口粮', category: 'food', effects: { hunger: 35, water: 0, mood: 0, energy: 0 } },
    { id: 'fruit', name: '鲜果', category: 'food', effects: { hunger: 20, water: 0, mood: 8, energy: 0 } },
    { id: 'spring-water', name: '清泉饮', category: 'drink', effects: { hunger: 0, water: 35, mood: 0, energy: 5 } },
    { id: 'reed', name: '芦苇', category: 'material', effects: { hunger: 0, water: 0, mood: 0, energy: 0 } },
  ],
  stories: [{
    id: 'care-companion', name: '陪伴的日常',
    steps: [{ id: 'feed' }, { id: 'water' }, { id: 'play' }],
    rewards: { items: [{ itemId: 'food', quantity: 2 }] },
  }],
}

function fixture({ at = NOW, pet = {}, state: overrides = {} } = {}) {
  const date = at === NOW ? '2026-11-12' : new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at)
  const state = {
    serverNow: at, today: date, catalogVersion: 3,
    wallet: { coins: 100 },
    inventory: [{ itemId: 'food', quantity: 6 }, { itemId: 'fruit', quantity: 2 }, { itemId: 'spring-water', quantity: 2 }],
    collections: [],
    stories: [{ id: 'care-companion', completedSteps: 0, status: 'active', completedAt: null, claimedAt: null }],
    dailySupply: { claimed: false, coins: 20, food: 2 },
    income: { date, earned: 0, limit: 60, remaining: 60 },
    pet: {
      id: 'pet-preview-test', speciesId: 'hexiaotun', name: '荷小豚', adoptedAt: at,
      hunger: 40, water: 30, mood: 40, energy: 60, experience: 0, level: 1, friendship: 0,
      activity: null, skills: [], jobs: [], cooldowns: { pet: 0, play: 0 }, growthToday: { used: 0, limit: 10 }, ...pet,
    },
    ...overrides,
  }
  const logs = []
  const care = createPetPreviewCare({
    getState: () => state,
    catalog: structuredClone(catalog),
    fail(message, code) { throw Object.assign(new Error(message), { code }) },
    journal(action, name, changes) { logs.push(structuredClone({ action, name, ...changes })) },
  })
  care.settle(at)
  return {
    care, logs,
    get state() { return state },
    act(action, itemId, time = at) {
      return care.act({ petId: state.pet?.id, action, ...(itemId === undefined ? {} : { itemId }) }, time)
    },
    quantity(itemId) { return state.inventory.find(item => item.itemId === itemId)?.quantity ?? 0 },
  }
}

function rejectsWithoutEffects(f, action, itemId, code, at = f.state.serverNow) {
  const before = structuredClone(f.state)
  const logs = structuredClone(f.logs)
  assert.throws(() => f.act(action, itemId, at), error => error.code === code)
  assert.deepEqual(f.state, before, '失败操作不能消费库存、增长经验或改变旅程')
  assert.deepEqual(f.logs, logs, '失败操作不能产生成功日志')
}

test('四种日常互动更新状态、成长、库存和操作回执', () => {
  const f = fixture()
  const receipt = f.act('feed', 'food')
  assert.deepEqual(receipt, { operation: 'feed', petId: 'pet-preview-test', committedAt: NOW })
  assert.equal(f.state.pet.hunger, 75)
  assert.equal(f.quantity('food'), 5)
  assert.deepEqual(f.logs.at(-1).effects, { ...zeroEffects(), hunger: 35, experience: 10, friendship: 2 })
  assert.deepEqual(f.logs.at(-1).itemChanges, [{ itemId: 'food', quantity: -1 }])

  f.act('water')
  assert.equal(f.state.pet.water, 70)
  assert.deepEqual(f.logs.at(-1).effects, { ...zeroEffects(), water: 40, experience: 10, friendship: 2 })
  assert.deepEqual(f.logs.at(-1).itemChanges, [])
  f.act('pet')
  assert.equal(f.state.pet.mood, 50)
  assert.equal(f.state.pet.cooldowns.pet, NOW + HOUR / 2)
  f.act('play')
  assert.equal(f.state.pet.mood, 70)
  assert.equal(f.state.pet.energy, 50)
  assert.equal(f.state.pet.cooldowns.play, NOW + HOUR / 2)
  assert.equal(f.state.pet.experience, 40)
  assert.equal(f.state.pet.friendship, 8)
  assert.deepEqual(f.state.pet.growthToday, { used: 4, limit: 10 })
  assert.deepEqual(f.logs.at(-1).effects, { ...zeroEffects(), mood: 20, energy: -10, experience: 10, friendship: 2 })
  assert.equal(f.logs.length, 4)
  assert.equal(f.state.wallet.coins, 100, '日常互动不扣宠物币')
})

test('清泉饮只应用道具效果，不再叠加免费饮水', () => {
  const f = fixture()
  f.act('water', 'spring-water')
  assert.equal(f.state.pet.water, 65)
  assert.equal(f.state.pet.energy, 65)
  assert.equal(f.quantity('spring-water'), 1)
  assert.deepEqual(f.logs[0].effects, { ...zeroEffects(), water: 35, energy: 5, experience: 10, friendship: 2 })
  assert.deepEqual(f.logs[0].itemChanges, [{ itemId: 'spring-water', quantity: -1 }])
})

test('道具与状态上限按真实净变化记录', () => {
  const f = fixture({ pet: { hunger: 90, water: 95, mood: 98, energy: 99, friendship: 99 } })
  f.act('feed', 'fruit')
  assert.equal(f.state.pet.hunger, 100)
  assert.equal(f.state.pet.mood, 100)
  assert.equal(f.state.pet.friendship, 100)
  assert.deepEqual(f.logs[0].effects, { ...zeroEffects(), hunger: 10, mood: 2, experience: 10, friendship: 1 })
  f.act('water', 'spring-water')
  assert.equal(f.state.pet.water, 100)
  assert.equal(f.state.pet.energy, 100)
  assert.deepEqual(f.logs[1].effects, { ...zeroEffects(), water: 5, energy: 1, experience: 10 })
})

test('口粮与免费饮水已满时拒绝，组合道具仍可补充未满的另一项', () => {
  const f = fixture({ pet: { hunger: 100, water: 100, mood: 90, energy: 90 } })
  rejectsWithoutEffects(f, 'feed', 'food', 'already_full')
  rejectsWithoutEffects(f, 'water', undefined, 'already_full')
  f.act('feed', 'fruit')
  assert.equal(f.state.pet.hunger, 100)
  assert.equal(f.state.pet.mood, 98)
  f.act('water', 'spring-water')
  assert.equal(f.state.pet.water, 100)
  assert.equal(f.state.pet.energy, 95)

  const full = fixture({ pet: { hunger: 100, water: 100, mood: 100, energy: 100 } })
  rejectsWithoutEffects(full, 'feed', 'fruit', 'already_full')
  rejectsWithoutEffects(full, 'water', 'spring-water', 'already_full')
})

test('库存不足时不消费、不成长、不推进旅程或记日志', () => {
  const f = fixture({ state: { inventory: [{ itemId: 'food', quantity: 0 }, { itemId: 'fruit', quantity: 0 }, { itemId: 'spring-water', quantity: 0 }] } })
  rejectsWithoutEffects(f, 'feed', 'food', 'not_enough_food')
  rejectsWithoutEffects(f, 'feed', 'fruit', 'not_enough_items')
  rejectsWithoutEffects(f, 'water', 'spring-water', 'not_enough_items')
})

test('精力不足与冷却中的操作没有额外效果，两种冷却互不替代', () => {
  const low = fixture({ pet: { energy: 9 } })
  rejectsWithoutEffects(low, 'play', undefined, 'not_enough_energy')
  const f = fixture()
  f.act('pet')
  rejectsWithoutEffects(f, 'pet', undefined, 'care_cooldown')
  f.act('play')
  rejectsWithoutEffects(f, 'play', undefined, 'care_cooldown')
  f.act('pet', undefined, NOW + HOUR / 2)
  assert.equal(f.state.pet.growthToday.used, 3, '冷却到点后允许下一次成功互动')
  assert.equal(f.logs.length, 3)
})

test('外出、课程、工作及待领取活动均阻止照顾', () => {
  for (const kind of ['outing', 'course', 'work']) {
    for (const status of ['running', 'claimable']) {
      const f = fixture({ pet: { activity: { id: 'preview-activity', kind, status, startedAt: NOW - HOUR, endsAt: status === 'running' ? NOW + HOUR : NOW - 1 } } })
      for (const [action, itemId] of [['feed', 'food'], ['water'], ['pet'], ['play'], ['rest'], ['wake']]) {
        rejectsWithoutEffects(f, action, itemId, 'pet_busy')
      }
    }
  }
})

test('每日仅前十次照顾成长，后续仍照顾但不再加经验与亲密度', () => {
  const f = fixture()
  for (let index = 0; index < 10; index++) f.act('pet', undefined, NOW + index * HOUR / 2)
  assert.equal(f.state.pet.experience, 100)
  assert.equal(f.state.pet.level, 2)
  assert.equal(f.state.pet.friendship, 20)
  assert.equal(f.state.pet.growthToday.used, 10)
  f.act('pet', undefined, NOW + 5 * HOUR)
  assert.equal(f.state.pet.experience, 100)
  assert.equal(f.state.pet.friendship, 20)
  assert.equal(f.state.pet.growthToday.used, 10)
  assert.equal(f.logs.at(-1).effects.experience, 0)
  assert.equal(f.logs.at(-1).effects.friendship, 0)
  assert.ok(f.logs.at(-1).effects.mood > 0, '到成长上限后仍正常增加心情')
})

test('经验累计可越过最高等级，但等级和亲密度不会超限', () => {
  const f = fixture({ pet: { experience: 2995, level: 30, friendship: 99 } })
  f.act('pet')
  assert.equal(f.state.pet.experience, 3005)
  assert.equal(f.state.pet.level, 30)
  assert.equal(f.state.pet.friendship, 100)
})

test('休息期间恢复精力，禁止其他照顾，唤醒不额外增加成长', () => {
  const f = fixture({ pet: { hunger: 90, water: 90, mood: 90, energy: 30 } })
  f.act('rest')
  assert.equal(f.state.pet.activity.kind, 'rest')
  assert.equal(f.state.pet.activity.startedAt, NOW)
  assert.equal(f.state.pet.activity.endsAt, NOW + 4 * HOUR)
  for (const [action, itemId] of [['feed', 'food'], ['water'], ['pet'], ['play'], ['rest']]) {
    rejectsWithoutEffects(f, action, itemId, 'pet_resting')
  }
  f.care.settle(NOW + HOUR / 2)
  assert.equal(f.state.pet.energy, 40)
  f.act('wake', undefined, NOW + HOUR / 2)
  assert.equal(f.state.pet.activity, null)
  assert.equal(f.state.pet.energy, 40)
  assert.equal(f.state.pet.experience, 0)
  assert.equal(f.state.pet.friendship, 0)
  assert.equal(f.state.pet.growthToday.used, 0)
  assert.deepEqual(f.logs.at(-1).effects, zeroEffects(), '唤醒日志不把休息恢复伪装成此次操作奖励')
  f.care.settle(NOW + HOUR)
  assert.equal(f.state.pet.energy, 40, '提前唤醒后不能继续按休息补精力')
})

test('四小时后自然醒，额外离线时间不再补充精力，醒来命令仍可确认', () => {
  const f = fixture({ pet: { hunger: 90, water: 90, mood: 90, energy: 5 } })
  f.act('rest')
  f.care.settle(NOW + 5 * HOUR)
  assert.equal(f.state.pet.activity, null)
  assert.equal(f.state.pet.energy, 85)
  assert.equal(f.state.pet.hunger, 80)
  assert.equal(f.state.pet.water, 75)
  assert.equal(f.state.pet.mood, 85)
  f.act('wake', undefined, NOW + 5 * HOUR)
  assert.equal(f.state.pet.activity, null)
  assert.equal(f.state.pet.energy, 85)
  assert.deepEqual(f.logs.at(-1).effects, zeroEffects())
})

test('频繁读取保留小数衰减与休息恢复，不按显示整数反复截断', () => {
  const f = fixture({ pet: { hunger: 90, water: 90, mood: 90, energy: 40 } })
  f.act('rest')
  for (let minute = 1; minute <= 60; minute++) f.care.settle(NOW + minute * 60_000)
  assert.equal(f.state.pet.hunger, 88)
  assert.equal(f.state.pet.water, 87)
  assert.equal(f.state.pet.mood, 89)
  assert.equal(f.state.pet.energy, 60)
  assert.equal(f.logs.length, 1, '读取和自然衰减不制造互动日志')
})

test('互动日志只记录本次净变化，不混入操作之前的自然衰减', () => {
  const f = fixture()
  f.act('feed', 'food', NOW + HOUR)
  assert.equal(f.state.pet.hunger, 73)
  assert.equal(f.state.pet.water, 27)
  assert.equal(f.state.pet.mood, 39)
  assert.deepEqual(f.logs[0].effects, { ...zeroEffects(), hunger: 35, experience: 10, friendship: 2 })
})

test('长时间离线状态最低为零，休息恢复最高为一百', () => {
  const f = fixture({ pet: { hunger: 2, water: 3, mood: 1, energy: 90 } })
  f.act('rest')
  f.care.settle(NOW + 2 * HOUR)
  assert.equal(f.state.pet.hunger, 0)
  assert.equal(f.state.pet.water, 0)
  assert.equal(f.state.pet.mood, 0)
  assert.equal(f.state.pet.energy, 100)
})

test('上海日期跨日才重置日额度与补给，时钟回拨不能重复恢复额度', () => {
  const at = Date.UTC(2026, 10, 12, 15, 55)
  const nextDay = Date.UTC(2026, 10, 12, 16, 5)
  const f = fixture({ at, pet: { growthToday: { used: 10, limit: 10 } }, state: {
    dailySupply: { claimed: true, coins: 20, food: 2 },
    income: { date: '2026-11-12', earned: 60, limit: 60, remaining: 0 },
  } })
  f.care.settle(nextDay)
  assert.equal(f.state.today, '2026-11-13')
  assert.equal(f.state.pet.growthToday.used, 0)
  assert.equal(f.state.dailySupply.claimed, false)
  assert.deepEqual(f.state.income, { date: '2026-11-13', earned: 0, limit: 60, remaining: 60 })
  f.act('pet', undefined, nextDay)
  assert.equal(f.state.pet.growthToday.used, 1)
  f.state.dailySupply.claimed = true
  const stable = structuredClone(f.state)
  f.care.settle(at)
  // serverNow 仍可反映实际回拨时钟，业务日期、额度和原始状态不得随之回退。
  assert.deepEqual({ ...f.state, serverNow: stable.serverNow }, stable, '时钟倒退不能降低业务日期、补回状态或重开领取机会')
  f.care.settle(nextDay)
  assert.deepEqual(f.state, stable)
})

test('成长旅程仅按喂食、饮水、玩耍顺序推进，重复与越序不累计', () => {
  const f = fixture()
  f.act('water')
  assert.equal(f.state.stories[0].completedSteps, 0)
  f.act('feed', 'food')
  assert.equal(f.state.stories[0].completedSteps, 1)
  f.act('pet')
  assert.equal(f.state.stories[0].completedSteps, 1)
  f.act('feed', 'food')
  assert.equal(f.state.stories[0].completedSteps, 1)
  f.act('water')
  assert.equal(f.state.stories[0].completedSteps, 2)
  const foodBeforeReward = f.quantity('food')
  f.act('play')
  assert.deepEqual(f.state.stories[0], {
    id: 'care-companion', completedSteps: 3, status: 'claimable', completedAt: NOW, claimedAt: null,
  })
  assert.equal(f.quantity('food'), foodBeforeReward, '旅程完成只变为待领取，不自动发奖励')
  f.act('pet', undefined, NOW + HOUR / 2)
  assert.equal(f.state.stories[0].completedSteps, 3)
  assert.equal(f.state.stories[0].status, 'claimable')
})

test('已经领取的旅程保持完成，照顾不能重新开放奖励', () => {
  const f = fixture({ state: { stories: [{ id: 'care-companion', completedSteps: 3, status: 'claimed', completedAt: NOW - 1000, claimedAt: NOW - 500 }] } })
  const before = structuredClone(f.state.stories)
  f.act('feed', 'food')
  f.act('water')
  f.act('play')
  assert.deepEqual(f.state.stories, before)
})
