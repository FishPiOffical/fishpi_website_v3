// 仅供隔离动画预览使用；与服务端照顾规则对齐，不连接业务接口或保存真实账号数据。
const hour = 60 * 60 * 1000
const meters = ['hunger', 'water', 'mood', 'energy']
const names = { feed: '喂食', water: '饮水', pet: '抚摸', play: '玩耍', rest: '休息', wake: '唤醒' }
const dateInShanghai = time => new Date(time + 8 * hour).toISOString().slice(0, 10)
const clamp = value => Math.max(0, Math.min(100, value))

export function createPetPreviewCare({ getState, catalog, fail, journal }) {
  let petId = null, lastAt = null, raw = {}, published = {}

  function publish(pet) {
    for (const meter of meters) {
      pet[meter] = Math.max(0, meter === 'energy' ? Math.floor(raw[meter] + 1e-9) : Math.ceil(raw[meter] - 1e-9))
      published[meter] = pet[meter]
    }
    pet.level = Math.min(catalog.growthRules.maxLevel, 1 + Math.floor(pet.experience / catalog.growthRules.experiencePerLevel))
  }

  function settle(now) {
    const state = getState(), pet = state.pet
    const today = dateInShanghai(now)
    // 日期只向前推进，防止测试时钟倒退重复领取补给和成长额度。
    if (today > state.today) {
      state.today = today
      state.dailySupply.claimed = false
      state.income = { ...state.income, date: today, earned: 0, remaining: state.income.limit }
      if (pet) pet.growthToday.used = 0
    }
    state.serverNow = now
    if (!pet) { petId = null; lastAt = null; return }
    if (pet.id !== petId) {
      petId = pet.id
      lastAt = now
      raw = Object.fromEntries(meters.map(meter => [meter, pet[meter]]))
      published = { ...raw }
    }
    // 其他演示操作可能更新状态，只吸收发生变化的字段，避免读快照时丢失小数。
    for (const meter of meters) if (pet[meter] !== published[meter]) raw[meter] = pet[meter]
    const elapsed = Math.max(0, now - lastAt) / hour
    raw.hunger = clamp(raw.hunger - elapsed * 2)
    raw.water = clamp(raw.water - elapsed * 3)
    raw.mood = clamp(raw.mood - elapsed)
    if (pet.activity?.kind === 'rest') {
      const rest = pet.activity
      const resting = Math.max(0, Math.min(now, rest.endsAt) - Math.max(lastAt, rest.startedAt)) / hour
      raw.energy = clamp(raw.energy + resting * catalog.rules.restEnergyPerHour)
      if (now >= rest.endsAt) pet.activity = null
    } else if (pet.activity && now >= pet.activity.endsAt) {
      pet.activity.status = 'claimable'
    }
    lastAt = Math.max(lastAt, now)
    publish(pet)
  }

  function act(body, now) {
    settle(now)
    const state = getState(), pet = state.pet, action = body.action
    if (!pet || body.petId !== pet.id) return fail('宠物已变化，请重新查看', 'pet_changed')
    if (!Object.hasOwn(names, action)) return fail('不支持的照顾方式', 'invalid_action')
    if (pet.activity?.kind === 'rest' && action !== 'wake') return fail('宠物正在休息，醒来后再照顾它吧', 'pet_resting')
    if (pet.activity && pet.activity.kind !== 'rest') return fail('请等待活动结束并领取成果', 'pet_busy')
    const item = body.itemId ? catalog.items.find(entry => entry.id === body.itemId) : null
    if (action === 'feed' && (!item || item.category !== 'food')) return fail('请选择食物', 'invalid_item')
    if (action === 'water' && body.itemId && (!item || item.category !== 'drink')) return fail('请选择饮品', 'invalid_item')
    if (!['feed', 'water'].includes(action) && body.itemId) return fail('此操作不使用道具', 'invalid_item')
    const inventory = item ? state.inventory.find(entry => entry.itemId === item.id) : null
    // 先检查所有前置条件，再一起结算消耗、成长和日志，失败不产生半次成功。
    if (item && (!inventory || inventory.quantity < 1)) return fail('背包里没有足够的道具', item.id === 'food' ? 'not_enough_food' : 'not_enough_items')
    if (item?.id === 'food' && raw.hunger > 99 + 1e-9) return fail('宠物已经吃饱了', 'already_full')
    if (item && !meters.some(meter => item.effects[meter] > 0 && raw[meter] < 100)) return fail('宠物暂时不需要补充', 'already_full')
    if (action === 'water' && !item && raw.water > 99 + 1e-9) return fail('宠物暂时不渴', 'already_full')
    if (['pet', 'play'].includes(action) && now < pet.cooldowns[action]) return fail('稍等一会儿再来陪它吧', 'care_cooldown')
    if (action === 'play' && raw.energy < 10) return fail('精力不足，先让宠物休息吧', 'not_enough_energy')

    const before = { ...raw, experience: pet.experience, friendship: pet.friendship }
    if (item) {
      inventory.quantity--
      for (const meter of meters) raw[meter] = clamp(raw[meter] + item.effects[meter])
    } else if (action === 'water') raw.water = clamp(raw.water + 40)
    if (action === 'pet') raw.mood = clamp(raw.mood + 10)
    if (action === 'play') { raw.mood = clamp(raw.mood + 20); raw.energy -= 10 }
    if (['pet', 'play'].includes(action)) pet.cooldowns[action] = now + hour / 2
    if (action === 'rest') pet.activity = { kind: 'rest', startedAt: now, endsAt: now + catalog.rules.restDurationMs }
    if (action === 'wake') pet.activity = null
    if (['feed', 'water', 'pet', 'play'].includes(action) && pet.growthToday.used < pet.growthToday.limit) {
      pet.growthToday.used++
      pet.experience += catalog.growthRules.careExperience
      pet.friendship = clamp(pet.friendship + catalog.growthRules.careFriendship)
    }
    const story = state.stories.find(entry => entry.id === 'care-companion')
    const definition = catalog.stories.find(entry => entry.id === 'care-companion')
    if (story?.status === 'active' && definition?.steps[story.completedSteps]?.id === action) {
      story.completedSteps++
      if (story.completedSteps === definition.steps.length) { story.status = 'claimable'; story.completedAt = now }
    }
    publish(pet)
    const effects = Object.fromEntries(meters.map(meter => [meter, raw[meter] - before[meter]]))
    effects.experience = pet.experience - before.experience
    effects.friendship = pet.friendship - before.friendship
    journal(action, names[action], { effects, itemChanges: item ? [{ itemId: item.id, quantity: -1 }] : [] })
    return { operation: action, petId: pet.id, committedAt: now }
  }

  return { settle, act }
}
