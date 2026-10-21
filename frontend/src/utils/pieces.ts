import Blue_Archbishop from '../assets/game_asset/Blue_Archbishop.svg'
import Blue_Berolina from '../assets/game_asset/Blue_Berolina.svg'
import Blue_Chariot from '../assets/game_asset/Blue_Chariot.svg'
import Blue_Chariot_1hp from '../assets/game_asset/Blue_Chariot_1hp.svg'
import Blue_Chariot_2hp from '../assets/game_asset/Blue_Chariot_2hp.svg'
import Blue_Chariot_3hp from '../assets/game_asset/Blue_Chariot_3hp.svg'
import Blue_Chariot_4hp from '../assets/game_asset/Blue_Chariot_4hp.svg'
import Blue_Chariot_5hp from '../assets/game_asset/Blue_Chariot_5hp.svg'
import Blue_Dabbaba from '../assets/game_asset/Blue_Dabbaba.svg'
import Blue_Duck from '../assets/game_asset/Blue_Duck.svg'
import Blue_Sergeant from '../assets/game_asset/Blue_Sergeant.svg'
import Blue_Soldier from '../assets/game_asset/Blue_Soldier.svg'
import Red_Archbishop from '../assets/game_asset/Red_Archbishop.svg'
import Red_Berolina from '../assets/game_asset/Red_Berolina.svg'
import Red_Chariot from '../assets/game_asset/Red_Chariot.svg'
import Red_Chariot_1hp from '../assets/game_asset/Red_Chariot_1hp.svg'
import Red_Chariot_2hp from '../assets/game_asset/Red_Chariot_2hp.svg'
import Red_Chariot_3hp from '../assets/game_asset/Red_Chariot_3hp.svg'
import Red_Chariot_4hp from '../assets/game_asset/Red_Chariot_4hp.svg'
import Red_Chariot_5hp from '../assets/game_asset/Red_Chariot_5hp.svg'
import Red_Dabbaba from '../assets/game_asset/Red_Dabbaba.svg'
import Red_Duck from '../assets/game_asset/Red_Duck.svg'
import Red_Sergeant from '../assets/game_asset/Red_Sergeant.svg'
import Red_Soldier from '../assets/game_asset/Red_Soldier.svg'

export const pieces = {
  player1: {
    Archbishop: Blue_Archbishop,
    Berolina: Blue_Berolina,
    Chariot: Blue_Chariot,
    Chariot_1hp: Blue_Chariot_1hp,
    Chariot_2hp: Blue_Chariot_2hp,
    Chariot_3hp: Blue_Chariot_3hp,
    Chariot_4hp: Blue_Chariot_4hp,
    Chariot_5hp: Blue_Chariot_5hp,
    Dabbaba: Blue_Dabbaba,
    Duck: Blue_Duck,
    Sergeant: Blue_Sergeant,
    Soldier: Blue_Soldier,
  },
  player2: {
    Archbishop: Red_Archbishop,
    Berolina: Red_Berolina,
    Chariot: Red_Chariot,
    Chariot_1hp: Red_Chariot_1hp,
    Chariot_2hp: Red_Chariot_2hp,
    Chariot_3hp: Red_Chariot_3hp,
    Chariot_4hp: Red_Chariot_4hp,
    Chariot_5hp: Red_Chariot_5hp,
    Dabbaba: Red_Dabbaba,
    Duck: Red_Duck,
    Sergeant: Red_Sergeant,
    Soldier: Red_Soldier,
  },
} as const

export type Player = keyof typeof pieces
export type PieceName = keyof (typeof pieces)['player1']

export const pieceImages: Record<string, string> = {
  Blue_Archbishop,
  Blue_Berolina,
  Blue_Chariot,
  Blue_Chariot_1hp,
  Blue_Chariot_2hp,
  Blue_Chariot_3hp,
  Blue_Chariot_4hp,
  Blue_Chariot_5hp,
  Blue_Dabbaba,
  Blue_Duck,
  Blue_Sergeant,
  Blue_Soldier,
  Red_Archbishop,
  Red_Berolina,
  Red_Chariot,
  Red_Chariot_1hp,
  Red_Chariot_2hp,
  Red_Chariot_3hp,
  Red_Chariot_4hp,
  Red_Chariot_5hp,
  Red_Dabbaba,
  Red_Duck,
  Red_Sergeant,
  Red_Soldier,
}
