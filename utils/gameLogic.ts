import { GLOBAl_PATH, HOME_PATHS, PLAYER_START_INDICES, SAFE_ZONES } from '../constants';
import { GameState, Piece, Player, PlayerColor, Coordinate, Difficulty } from '../types';

export const getPieceCoordinates = (piece: Piece, color: PlayerColor): Coordinate => {
  if (piece.position === -1) {
    // Handling base positions dynamically in component
    return { x: 0, y: 0 }; 
  }

  if (piece.position === 99) {
    // Center of board
    return { x: 7, y: 7 };
  }

  const offset = PLAYER_START_INDICES[color];
  
  if (piece.position >= 0 && piece.position <= 50) {
    // Normal path
    const globalIndex = (offset + piece.position) % 52;
    return GLOBAl_PATH[globalIndex];
  }

  if (piece.position > 50) {
    // Home stretch (51, 52, 53, 54, 55 correspond to indices 0-4 in HOME_PATHS)
    const homeIndex = piece.position - 51; 
    if (homeIndex < 0 || homeIndex >= 5) return {x:7, y:7};
    return HOME_PATHS[color][homeIndex];
  }

  return { x: 0, y: 0 };
};

// Helper to get global index on the main board (0-51)
const getGlobalIndex = (localPos: number, color: PlayerColor): number => {
    return (PLAYER_START_INDICES[color] + localPos) % 52;
};

export const canMovePiece = (piece: Piece, diceValue: number, allPlayers: Player[]): boolean => {
  // Rule: Must roll 6 to leave base
  if (piece.position === -1) {
    return diceValue === 6;
  }
  
  if (piece.position === 99) return false;

  // Rule: Exact number to enter home triangle (Position 56)
  const targetPos = piece.position + diceValue;
  if (targetPos > 56) return false;

  const myColor = piece.color;

  // --- BLOCK LOGIC ---
  // A "Block" is formed by 2 or more pieces of the same color on a square.
  // Opponents cannot PASS or LAND on a block.
  
  for (let step = 1; step <= diceValue; step++) {
      const checkPos = piece.position + step;
      
      // Blocks only exist on the main track (0-50). Home stretch is safe from opponents.
      if (checkPos > 50) continue; 
      
      const checkGlobalIndex = getGlobalIndex(checkPos, myColor);
      
      // 1. Check for Opponent Blocks (Cannot pass or land)
      for (const p of allPlayers) {
          if (p.color === myColor) continue; // Skip self
          
          const opponentPiecesAtSpot = p.pieces.filter(ep => {
              if (ep.position === -1 || ep.position > 50 || ep.position === 99) return false;
              return getGlobalIndex(ep.position, p.color) === checkGlobalIndex;
          });
          
          if (opponentPiecesAtSpot.length >= 2) {
              // Found an opponent block
              return false;
          }
      }
  }

  // 2. Check for Self-Block Stacking Limit (Optional Rule, but standard implies specific block formation)
  // "Players cannot land on a square occupied by their own token... creates a block"
  // We assume max 2 pieces per square for a block. If 2 already exist, we cannot land to make 3?
  // Let's implement a cap of 2 to be safe and consistent with "Block = 2 tokens".
  if (targetPos <= 50) {
      const targetGlobalIndex = getGlobalIndex(targetPos, myColor);
      const myPiecesAtTarget = allPlayers
          .find(p => p.color === myColor)
          ?.pieces.filter(p => p.id !== piece.id && p.position <= 50 && p.position !== -1 && getGlobalIndex(p.position, myColor) === targetGlobalIndex);
      
      if (myPiecesAtTarget && myPiecesAtTarget.length >= 2) {
          return false; // Cannot stack more than 2
      }
  }

  return true;
};

export const checkForKill = (
  movedPiece: Piece, 
  currentState: GameState, 
  movingPlayerId: string
): { killed: boolean, logs: string[] } => {
  
  if (movedPiece.position > 50 || movedPiece.position === -1) return { killed: false, logs: [] };

  const movingPlayerColor = currentState.players.find(p => p.id === movingPlayerId)?.color;
  if (!movingPlayerColor) return { killed: false, logs: [] };

  const movedGlobalIndex = getGlobalIndex(movedPiece.position, movingPlayerColor);
  
  // Rule: Safe Zones cannot be captured
  if (SAFE_ZONES.includes(movedGlobalIndex)) return { killed: false, logs: [] };

  let killed = false;
  const logs: string[] = [];

  currentState.players.forEach(p => {
    if (p.id !== movingPlayerId && !p.hasWon) {
      p.pieces.forEach(enemyPiece => {
        if (enemyPiece.position > 50 || enemyPiece.position === -1 || enemyPiece.position === 99) return;
        
        const enemyGlobalIndex = getGlobalIndex(enemyPiece.position, p.color);
        
        if (enemyGlobalIndex === movedGlobalIndex) {
          // Rule: Send back to yard
          enemyPiece.position = -1; 
          killed = true;
          logs.push(`${movingPlayerColor} captured ${p.color}! Sent back to yard.`);
        }
      });
    }
  });

  return { killed, logs };
};

export const getBotMove = (diceValue: number, player: Player, allPlayers: Player[], difficulty: Difficulty): number | null => {
  // Filter pieces that satisfy all movement rules (including blocks)
  const movablePieces = player.pieces.filter(p => canMovePiece(p, diceValue, allPlayers));
  
  if (movablePieces.length === 0) return null;

  // EASY: Random Move
  if (difficulty === Difficulty.EASY) {
    const randomIdx = Math.floor(Math.random() * movablePieces.length);
    return movablePieces[randomIdx].id;
  }

  // MEDIUM & HARD Shared Logic:
  
  // 1. Check for Win (Reach 99/Home Triangle)
  const winningPiece = movablePieces.find(p => p.position + diceValue === 56);
  if (winningPiece) return winningPiece.id;

  // 2. Kill (Higher priority in HARD)
  if (difficulty === Difficulty.HARD) {
      for (const piece of movablePieces) {
          if (piece.position === -1) continue;
          
          const targetPos = piece.position + diceValue;
          if (targetPos > 50) continue; 

          const targetGlobalIndex = getGlobalIndex(targetPos, player.color);
          
          if (SAFE_ZONES.includes(targetGlobalIndex)) continue;

          // Check if enemies are here
          const canKill = allPlayers.some(p => {
              if (p.id === player.id || p.hasWon) return false;
              return p.pieces.some(ep => {
                  if (ep.position === -1 || ep.position > 50) return false;
                  const epGlobalIndex = getGlobalIndex(ep.position, p.color);
                  return epGlobalIndex === targetGlobalIndex;
              });
          });

          if (canKill) return piece.id;
      }
  }

  // 3. Leave Base (Rule: Must roll 6)
  const basePiece = movablePieces.find(p => p.position === -1);
  if (basePiece && diceValue === 6) return basePiece.id;

  // 4. Safe Spot (HARD only)
  if (difficulty === Difficulty.HARD) {
    const safePiece = movablePieces.find(p => {
        if (p.position === -1) return false;
        const targetPos = p.position + diceValue;
        if (targetPos > 50) return false;
        const targetGlobalIndex = getGlobalIndex(targetPos, player.color);
        return SAFE_ZONES.includes(targetGlobalIndex);
    });
    if (safePiece) return safePiece.id;
  }
  
  // 5. Form a Block (Self-defense)
  // If moving lands on another of my pieces, it creates a block.
  const blockMaker = movablePieces.find(p => {
      if (p.position === -1) return false;
      const targetPos = p.position + diceValue;
      if (targetPos > 50) return false;
      const targetGlobalIndex = getGlobalIndex(targetPos, player.color);
      return player.pieces.some(other => other.id !== p.id && getGlobalIndex(other.position, player.color) === targetGlobalIndex);
  });
  if (blockMaker) return blockMaker.id;

  // 6. Default/Medium Strategy: Move piece furthest ahead
  movablePieces.sort((a, b) => b.position - a.position);
  return movablePieces[0].id;
};