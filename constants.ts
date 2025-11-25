import { PlayerColor, Coordinate, DiceSkin } from './types';

export const BOARD_SIZE = 15;

export const DICE_SKINS: DiceSkin[] = [
  {
    id: 'default',
    name: 'Classic White',
    price: 0,
    description: 'The standard reliable dice.',
    colorClass: 'bg-white border-gray-300',
    dotClass: 'bg-black'
  },
  {
    id: 'gold',
    name: 'Royal Gold',
    price: 500,
    description: 'Luxurious gold finish for winners.',
    colorClass: 'bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-600 border-yellow-700 text-white shadow-yellow-500/50',
    dotClass: 'bg-white shadow-sm'
  },
  {
    id: 'neon',
    name: 'Cyber Neon',
    price: 1000,
    description: 'Futuristic glow in the dark.',
    colorClass: 'bg-slate-900 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)] text-cyan-400',
    dotClass: 'bg-cyan-400 shadow-[0_0_5px_#22d3ee]'
  },
  {
    id: 'ruby',
    name: 'Ruby Red',
    price: 750,
    description: 'Passion and fire.',
    colorClass: 'bg-gradient-to-br from-red-500 to-red-900 border-red-900 shadow-red-500/50',
    dotClass: 'bg-yellow-200'
  }
];

// Standard Ludo Path (Clockwise)
// Red (TL) -> Green (TR) -> Yellow (BR) -> Blue (BL)
export const GLOBAl_PATH: Coordinate[] = [
  // RED SEGMENT (Moves Right then Up)
  { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
  { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 },
  { x: 7, y: 0 }, // Top Center
  // GREEN SEGMENT (Moves Down then Right) - Starts at (8,1)
  { x: 8, y: 0 }, { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
  { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
  { x: 14, y: 7 }, // Right Center
  // YELLOW SEGMENT (Moves Left then Down) - Starts at (13,8)
  { x: 14, y: 8 }, { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 },
  { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 8, y: 14 },
  { x: 7, y: 14 }, // Bottom Center
  // BLUE SEGMENT (Moves Up then Left) - Starts at (6,13)
  { x: 6, y: 14 }, { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 },
  { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 },
  { x: 0, y: 7 }, // Left Center
  // BACK TO RED START AREA
  { x: 0, y: 6 } // Index 51
];

// Start offsets in the Global Path
export const PLAYER_START_INDICES = {
  [PlayerColor.RED]: 0,
  [PlayerColor.GREEN]: 13,
  [PlayerColor.YELLOW]: 26,
  [PlayerColor.BLUE]: 39
};

// Home Run Paths
export const HOME_PATHS = {
  [PlayerColor.RED]:    [{x:1, y:7}, {x:2, y:7}, {x:3, y:7}, {x:4, y:7}, {x:5, y:7}],
  [PlayerColor.GREEN]:  [{x:7, y:1}, {x:7, y:2}, {x:7, y:3}, {x:7, y:4}, {x:7, y:5}],
  [PlayerColor.YELLOW]: [{x:13, y:7}, {x:12, y:7}, {x:11, y:7}, {x:10, y:7}, {x:9, y:7}],
  [PlayerColor.BLUE]:   [{x:7, y:13}, {x:7, y:12}, {x:7, y:11}, {x:7, y:10}, {x:7, y:9}]
};

export const BASE_POSITIONS = {
  [PlayerColor.RED]: { x: 2.5, y: 2.5 },
  [PlayerColor.GREEN]: { x: 11.5, y: 2.5 },
  [PlayerColor.YELLOW]: { x: 11.5, y: 11.5 },
  [PlayerColor.BLUE]: { x: 2.5, y: 11.5 }
};

// Safe Zones (Global Indices)
// Start squares + Star squares (8 steps from start)
// Red Start: 0. Safe: 8
// Green Start: 13. Safe: 21
// Yellow Start: 26. Safe: 34
// Blue Start: 39. Safe: 47
export const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

export const COLORS = {
  [PlayerColor.RED]: 'bg-[#ff0000]',
  [PlayerColor.GREEN]: 'bg-[#00aa00]',
  [PlayerColor.YELLOW]: 'bg-[#ffdd00]',
  [PlayerColor.BLUE]: 'bg-[#0000ff]',
  
  [PlayerColor.RED + '_LIGHT']: 'bg-red-200',
  [PlayerColor.GREEN + '_LIGHT']: 'bg-green-200',
  [PlayerColor.YELLOW + '_LIGHT']: 'bg-yellow-100',
  [PlayerColor.BLUE + '_LIGHT']: 'bg-blue-200',
  
  [PlayerColor.RED + '_BORDER']: 'border-black',
  [PlayerColor.GREEN + '_BORDER']: 'border-black',
  [PlayerColor.YELLOW + '_BORDER']: 'border-black',
  [PlayerColor.BLUE + '_BORDER']: 'border-black',
};