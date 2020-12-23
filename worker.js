const mineflayer = require('mineflayer')
const pvp = require('mineflayer-pvp').plugin
const { pathfinder, Movements } = require('mineflayer-pathfinder')
const {
  GoalFollow
} = require('mineflayer-pathfinder').goals
const minecraftHawkEye = require('minecrafthawkeye')
const { workerData } = require('worker_threads')
const {
  pvp_weapon,
  nearestEntity,
  team,
  team_nearestEntity,
  skill_using,
  potion_using,
  team_nearest_player_number
} = require('./lib')

const bot = mineflayer.createBot({
  host: 'localhost', // optional
  port: 25580, // optional
  username: workerData,
  logErrors: false,
  version: '1.15.2'
})

let time = 0
let start = false
let team_data = []
let weapon = null
let affiliation_team = null
let defaultMove = null

bot.loadPlugin(pvp)
bot.loadPlugin(pathfinder)
bot.loadPlugin(minecraftHawkEye)

bot.on('kicked', (reason, loggedIn) => console.log({ reason, loggedIn }))
bot.on('error', (error) => console.log({ error }))

bot.once('spawn', () => {
  const mcData = require('minecraft-data')(bot.version)
  defaultMove = new Movements(bot, mcData)

  bot.pvp.movements.canDig = false
  bot.pvp.movements.maxDropDown = 64

  defaultMove.canDig = false
  defaultMove.maxDropDown = 64

  bot.pvp.attackRange = 2.5
  bot.pvp.followRange = 1
  bot._client.on('packet', (data, metadata) => {
    if (metadata.name === 'teams') {
      team_data = team(team_data, data)
      if (team_data[bot.entity.username]) {
        affiliation_team = team_data[bot.entity.username]
      }
    }
  })
})

bot.on('move', () => {
  bot.setControlState('sprint', true)
  const target = nearestEntity(bot, 'player', 2)
  if (target) {
    if (!bot.pathfinder.isMoving()) bot.lookAt(target.position.offset(0, target.height, 0))
    bot.setControlState('back', true)
    bot.setControlState('left', true)
  } else {
    bot.setControlState('back', false)
    bot.setControlState('left', false)
  }
})

bot.on('path_update', (results) => {
  if (results.status === 'timeout') {
    bot.pathfinder.setGoal(null)
    bot.pvp.stop()
    bot.hawkEye.stop()
  }
})

bot.on('attackedTarget', () => {
  bot.setControlState('sprint', true)
  bot.setControlState('forward', true)
  bot.setControlState('jump', true)
  bot.setControlState('jump', false)
})

bot.on('death', () => {
  bot.pathfinder.setGoal(null)
  bot.pvp.stop()
  bot.hawkEye.stop()
})

bot.on('physicTick', () => {
  let player_number
  const { target } = bot.pvp
  bot.pvp.followRange = 1
  if (start === false) return
  weapon = pvp_weapon(bot)
  const { weapon_name, job } = weapon
  // ---攻撃---
  if (!target) {
    const entity = team_nearestEntity(
      bot,
      team_data,
      affiliation_team,
      'object',
      256
    )
    if (entity && !bot.pathfinder.isMoving()) {
      bot.pvp.stop()
      bot.hawkEye.stop()
      bot.pathfinder.setMovements(defaultMove)
      bot.pathfinder.setGoal(new GoalFollow(entity, 3))
    }
  }
  switch (job) {
    case 'support': {
      const blockPosition = {
        position: bot.entity.position,
        isValid: true // Fake to is "alive"
      }
      if (weapon.no_balance_bullet === false) {
        if (time > 10) {
          blockPosition.position.y = blockPosition.position.y - 3
          bot.hawkEye.oneShot(blockPosition)
          time = 0
        } else {
          time++
          bot.hawkEye.stop()
        }
      } else {
        time = 0
        bot.hawkEye.stop()
      }
      const entity = team_nearestEntity(
        bot,
        team_data,
        affiliation_team,
        'player',
        6
      )
      if (entity && target !== entity) {
        bot.pvp.attack(entity)
      }
      break
    }
    case 'archer': {
      bot.pvp.followRange = 6
      const entity = team_nearestEntity(
        bot,
        team_data,
        affiliation_team,
        'player',
        30
      )
      if (!entity) return
      if (weapon_name === 'crossbow' && time < 115) {
        time = 119
      }
      if (time > 120) {
        bot.hawkEye.autoAttack(entity)
        time = 0
      }
      bot.pvp.attack(entity)
      time++
      break
    }
    default: {
      const entity = team_nearestEntity(
        bot,
        team_data,
        affiliation_team,
        'player',
        16
      )
      if (entity && target !== entity) {
        bot.pvp.attack(entity)
      }
    }
  }
  // ------
  // ---特殊行動&スキル使用---
  switch (job) {
    case 'assassin':
      player_number = team_nearest_player_number(
        bot,
        team_data,
        affiliation_team,
        21
      )
      if (player_number > 3) {
        skill_using(bot)
      }
      break
    case 'tank':
      player_number = team_nearest_player_number(
        bot,
        team_data,
        affiliation_team,
        12
      )
      if (player_number > 2 && bot.health < 5) {
        skill_using(bot)
      }
      if (bot.health < 3) {
        skill_using(bot)
      }
      if (player_number > 3) {
        bot.activateItem()
        if (bot.experience.level > 1) {
          bot.setControlState('sneak', true)
        }
        setTimeout(() => {
          bot.setControlState('sneak', false)
          bot.deactivateItem()
        }, 200)
      }
      break
    default:
      if (bot.health < 8) {
        skill_using(bot)
      }
      if (bot.health < 5) {
        potion_using(bot)
      }
  }
  // ---
  const monitoring_you = bot.nearestEntity(
    (entity) => {
      const dist = bot.entity.position.distanceTo(entity.position)
      if (entity.mobType !== 'Iron Golem') return false
      if (entity.metadata[2] === '{"text":"red"}') {
        if (affiliation_team === 'red') return false
      }
      if (entity.metadata[2] === '{"text":"blue"}') {
        if (affiliation_team === 'blue') return false
      }
      if (dist > 6) return false
      return true
    }
  )
  if (monitoring_you && !target) {
    bot.pvp.attack(monitoring_you)
    if (job === "archer") bot.hawkEye.oneShot(monitoring_you)
  }
  const item_entity = bot.nearestEntity(
    (entity) => {
      const dist = bot.entity.position.distanceTo(entity.position)
      if (entity.objectType !== 'Item') return false
      if (dist > 3) return false
      return true
    }
  )
  if (item_entity) {
    bot.pathfinder.setGoal(new GoalFollow(item_entity))
  }
  // ---
})

bot.on('chat', (username, message) => {
  if (message === '勝利しろ！') {
    start = false
    time = 0
    weapon = null
    affiliation_team = null
    bot.pathfinder.setGoal(null)
    bot.pvp.stop()
    bot.hawkEye.stop()
    setTimeout(() => { start = true }, 1000)
  }
})
