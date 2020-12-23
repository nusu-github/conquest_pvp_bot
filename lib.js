const { randomBytes } = require('crypto')

const generateRandomString = (length) =>
  randomBytes(length).reduce((p, i) => p + (i % 32).toString(32), '')

const getRandom = (min, max) =>
  Math.floor(Math.random() * (max + 1 - min)) + min

const weapon_change = (bot, weapon_type) => {
  const weapon = bot.inventory
    .items()
    .find((item) => item.name.includes(weapon_type))
  if (weapon) {
    if (bot.entity.heldItem !== weapon) bot.equip(weapon, 'hand')
    return weapon_type
  } return null
}

const team = (team_data, packet_data) => {
  const { mode, players } = packet_data
  switch (mode) {
    // チーム参加
    case 3: {
      team_data[players[0]] = packet_data.team
      break
    }
    // チーム離脱
    case 4: {
      const index = team_data.indexOf(players[0])
      if (index > -1) team_data.splice(index, 1)
      break
    }
  }
  return team_data
}

const pvp_weapon = (bot) => {
  const weapon = new class {
    constructor() {
      this.weapon_name = null
      this.weapon_data = null
      this.job = null
      this.no_balance_bullet = false
    }
  }()
  const inventory = bot.inventory
    .items()
  const weapon_list = inventory.filter(({ name }) => {
    switch (name.replace(/^.*_/, '')) {
      case 'axe': return true
      case 'crossbow': return true
      case 'shield': return true
      case 'hoe': return true
      case 'bow': return true
      default: return false
    }
  })
  if (weapon_list[0]) {
    weapon.weapon_name = weapon_list[0].name
    weapon.weapon_data = weapon_list[0]
    if (bot.entity.heldItem !== weapon_list[0]) bot.equip(weapon_list[0], 'hand')
    if (weapon_list[0].nbt.value.display) {
      const weapon_description = JSON.parse(weapon_list[0].nbt.value.display.value.Lore.value.value[0]).text
      if (~weapon_description.indexOf('サポートの')) {
        weapon.job = 'support'
      }
    }
    if (weapon_list[0].name === 'crossbow') {
      const crossbow_list = weapon_list.filter(({ nbt }) => {
        if (nbt.value.ChargedProjectiles.value.value.length > 1) return true
        return false
      })
      if (crossbow_list[0]) {
        if (crossbow_list[0].nbt.value.ChargedProjectiles.value.value[0].id.value === 'minecraft:firework_rocket') {
          weapon.job = 'archer'
        }
        if (bot.entity.heldItem !== crossbow_list[0]) bot.equip(crossbow_list[0], 'hand')
      } else weapon.no_balance_bullet = true
    }
  }
  weapon.job = (() => {
    if (weapon.job !== null) return weapon.job
    switch (weapon.weapon_name) {
      case 'axe': return 'attacker'
      case 'shield': return 'tank'
      case 'hoe': return 'assassin'
      case 'bow': return 'archer'
      default: return null
    }
  })()
  return weapon
}

const skill_using = (bot) => {
  const resolve = weapon_change(bot, 'carrot_on_a_stick')
  if (!resolve) return resolve
  bot.activateItem()
  setTimeout(() => {
    bot.deactivateItem()
  }, 100)
  bot.emit('skill')
}

const potion_using = (bot) => {
  const resolve = weapon_change(bot, 'splash_potion')
  if (!resolve) return
  const target_vec3 = bot.entity.velocity
  target_vec3.y = 90
  bot.lookAt(target_vec3)
  bot.activateItem()
  setTimeout(() => {
    bot.deactivateItem()
  }, 100)
  bot.emit('potion')
}

const special_skill_using = (bot) => {
  bot.setControlState('sneak', true)
  setTimeout(() => {
    bot.setControlState('sneak', false)
  }, 10000)
}

const nearestEntity = (bot, type, range) => {
  if (!range) range = 6
  return bot.nearestEntity(
    (entity) => {
      const dist = bot.entity.position.distanceTo(entity.position)
      if (entity.type !== type) return false
      if (entity === bot.entity) return false
      if (dist > range) return false
      return true
    }
  )
}

const team_nearestEntity = (
  bot,
  team_data,
  target_team,
  type,
  range,
  on_team
) => {
  if (!range) range = 6
  return bot.nearestEntity(
    (entity) => {
      const dist = bot.entity.position.distanceTo(entity.position)
      if (entity.type !== type) return false
      if (entity === bot.entity) return false
      if (entity.username) {
        if (on_team === true) {
          if (team_data[entity.username] !== target_team) return false
        } else if (team_data[entity.username] === target_team) return false
        if (entity.effects['14']) return false
      } else {
        if (entity.metadata[2] === '{"text":"判定"}') return false
        if (entity.objectType === 'Item') return false
        if (on_team === true) {
          if (team_data[entity.uuid] !== target_team) return false
        } else if (team_data[entity.uuid] === target_team) return false
      }
      if (dist > range) return false
      return true
    }
  )
}

const team_nearest_player_number = (
  bot,
  team_data,
  target_team,
  range,
  on_team
) => {
  if (!range) range = 6
  let player_number = 0
  for (const id in bot.entities) {
    const entity = bot.entities[id]
    if (entity.type !== 'player') continue
    if (entity === bot.entity) continue
    if (on_team) {
      if (team_data[entity.username] !== target_team) continue
    } else if (team_data[entity.username] === target_team) continue
    if (entity.effects['14']) continue
    const dist = bot.entity.position.distanceTo(entity.position)
    if (dist < range) player_number++
  }
  return player_number
}

module.exports = {
  generateRandomString,
  getRandom,
  weapon_change,
  pvp_weapon,
  nearestEntity,
  team,
  team_nearestEntity,
  skill_using,
  potion_using,
  special_skill_using,
  team_nearest_player_number
}
