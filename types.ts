export enum PlayerColor {
  RED = 'RED',
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  BLUE = 'BLUE'
}

export enum GameStatus {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface Piece {
  id: number;
  color: PlayerColor;
  position: number; // -1 = Base, 0-51 = Main Path, 52-57 = Home Straight, 99 = Home/Win
  isSafe: boolean;
}

export interface DiceSkin {
  id: string;
  name: string;
  price: number;
  description: string;
  colorClass: string;
  dotClass: string;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  isBot: boolean;
  avatarUrl: string;
  pieces: Piece[];
  hasWon: boolean;
  rank: number; // 0 if not finished
  diceSkin: string; // ID of the equipped skin
}

export interface GameState {
  status: GameStatus;
  roomCode: string;
  players: Player[];
  currentTurnIndex: number;
  diceValue: number;
  isDiceRolling: boolean;
  canRoll: boolean;
  winners: PlayerColor[];
  logs: string[];
  waitingForMove: boolean; // If true, player must click a piece
  validMoves: number[]; // Piece IDs that can move
  consecutiveSixes: number; // Track consecutive sixes for the 3x rule
}

export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
}

export interface Coordinate {
  x: number; // Grid column 0-14
  y: number; // Grid row 0-14
}