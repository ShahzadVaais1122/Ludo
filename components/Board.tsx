import React from 'react';
import { GameState, PlayerColor, Piece, Theme, DiceSkin } from '../types';
import { getPieceCoordinates } from '../utils/gameLogic';
import PieceComponent from './Piece';
import Dice from './Dice';
import { Star, ArrowRight, ArrowDown, ArrowLeft, ArrowUp } from 'lucide-react';

interface BoardProps {
  gameState: GameState;
  onPieceClick: (pieceId: number) => void;
  theme: Theme;
  diceValue: number;
  isDiceRolling: boolean;
  onDiceRoll: () => void;
  isDiceDisabled: boolean;
  diceSkin?: DiceSkin;
}

const Board: React.FC<BoardProps> = ({
  gameState, onPieceClick, theme,
  diceValue, isDiceRolling, onDiceRoll, isDiceDisabled, diceSkin
}) => {
  
  const cells = [];
  
  const getCellStyle = (x: number, y: number): React.CSSProperties => {
    const baseStyle = {
      backgroundColor: theme.boardBaseColor,
      borderColor: theme.borderColor,
      borderWidth: '1px',
      borderStyle: 'solid'
    };

    // BASES (Transparent to show overlay)
    if (x < 6 && y < 6) return { ...baseStyle, backgroundColor: 'transparent', borderColor: 'transparent' }; 
    if (x > 8 && y < 6) return { ...baseStyle, backgroundColor: 'transparent', borderColor: 'transparent' };
    if (x < 6 && y > 8) return { ...baseStyle, backgroundColor: 'transparent', borderColor: 'transparent' };
    if (x > 8 && y > 8) return { ...baseStyle, backgroundColor: 'transparent', borderColor: 'transparent' };

    // CENTER (Home)
    if (x >= 6 && x <= 8 && y >= 6 && y <= 8) return { ...baseStyle, backgroundColor: 'transparent', border: 'none' };

    // HOME PATHS (Colored Columns/Rows)
    if (y === 7 && x > 0 && x < 6) return { ...baseStyle, backgroundColor: theme.palette[PlayerColor.RED] }; // Red Home Path
    if (x === 7 && y > 0 && y < 6) return { ...baseStyle, backgroundColor: theme.palette[PlayerColor.GREEN] }; // Green Home Path
    if (y === 7 && x > 8 && x < 14) return { ...baseStyle, backgroundColor: theme.palette[PlayerColor.YELLOW] }; // Yellow Home Path
    if (x === 7 && y > 8 && y < 14) return { ...baseStyle, backgroundColor: theme.palette[PlayerColor.BLUE] }; // Blue Home Path

    // START SQUARES
    if (x === 1 && y === 6) return { ...baseStyle, backgroundColor: theme.palette[PlayerColor.RED] }; 
    if (x === 8 && y === 1) return { ...baseStyle, backgroundColor: theme.palette[PlayerColor.GREEN] }; 
    if (x === 13 && y === 8) return { ...baseStyle, backgroundColor: theme.palette[PlayerColor.YELLOW] }; 
    if (x === 6 && y === 13) return { ...baseStyle, backgroundColor: theme.palette[PlayerColor.BLUE] }; 

    // DEFAULT PATH
    return baseStyle;
  };

  const renderCellContent = (x: number, y: number) => {
     // Icons style
     const arrowStyle = "text-white w-[80%] h-[80%] stroke-[3px]";
     const starStyle = "w-[80%] h-[80%] fill-current";

     // Start Arrows
     if (x === 1 && y === 6) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><ArrowRight className={arrowStyle} /></div>;
     if (x === 8 && y === 1) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><ArrowDown className={arrowStyle} /></div>;
     if (x === 13 && y === 8) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><ArrowLeft className={arrowStyle} /></div>;
     if (x === 6 && y === 13) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><ArrowUp className={arrowStyle} /></div>;

     // Safe Spots (Stars on Base Color Squares)
     // Locations: (2,8), (6,2), (12,6), (8,12)
     if (x === 2 && y === 8) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><Star className={starStyle} style={{color: theme.safeSpotColor}} /></div>; 
     if (x === 6 && y === 2) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><Star className={starStyle} style={{color: theme.safeSpotColor}} /></div>; 
     if (x === 12 && y === 6) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><Star className={starStyle} style={{color: theme.safeSpotColor}} /></div>; 
     if (x === 8 && y === 12) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><Star className={starStyle} style={{color: theme.safeSpotColor}} /></div>; 
     
     return null;
  }

  // Render Grid
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const isBase = (x < 6 && y < 6) || (x > 8 && y < 6) || (x < 6 && y > 8) || (x > 8 && y > 8);
      
      cells.push(
        <div 
          key={`${x}-${y}`} 
          className="relative flex items-center justify-center min-w-0 min-h-0"
          style={{ gridColumnStart: x + 1, gridRowStart: y + 1, ...getCellStyle(x, y) }}
        >
          {!isBase && renderCellContent(x, y)}
        </div>
      );
    }
  }

  // Render Pieces
  const piecesToRender: React.ReactNode[] = [];
  const positionsMap = new Map<string, { pieces: {p: Piece, color: PlayerColor}[], x: number, y: number }>();

  gameState.players.forEach(player => {
    player.pieces.forEach(piece => {
      let coords: {x: number, y: number};
      if (piece.position === -1) {
        // Base visual positions (Inside the circles)
        let basePathX = 0, basePathY = 0;
        if (player.color === PlayerColor.RED) { basePathX = 0; basePathY = 0; }
        else if (player.color === PlayerColor.GREEN) { basePathX = 9; basePathY = 0; }
        else if (player.color === PlayerColor.YELLOW) { basePathX = 9; basePathY = 9; }
        else if (player.color === PlayerColor.BLUE) { basePathX = 0; basePathY = 9; }

        // Exact coords for the 4 circles inside the base:
        const offsets = [
            { dx: 1.5, dy: 1.5 }, // TL
            { dx: 4.5, dy: 1.5 }, // TR
            { dx: 1.5, dy: 4.5 }, // BL
            { dx: 4.5, dy: 4.5 }  // BR
        ];
        
        coords = { 
            x: basePathX + offsets[piece.id].dx, 
            y: basePathY + offsets[piece.id].dy 
        }; 
      } else {
        coords = getPieceCoordinates(piece, player.color);
      }

      const key = `${coords.x}-${coords.y}`;
      if (!positionsMap.has(key)) {
        positionsMap.set(key, { pieces: [], x: coords.x, y: coords.y });
      }
      positionsMap.get(key)!.pieces.push({ p: piece, color: player.color });
    });
  });

  positionsMap.forEach(({ pieces, x, y }) => {
    const stackSize = pieces.length;
    pieces.forEach((item, index) => {
       const isClickable = gameState.validMoves.includes(item.p.id) && 
                           gameState.players[gameState.currentTurnIndex].color === item.color;
       
       // Stacking logic
       const offset = stackSize > 1 ? (index * 4) - ((stackSize - 1) * 2) : 0; // Center the stack

       piecesToRender.push(
          <div 
              key={`piece-${item.color}-${item.p.id}`}
              className="absolute transition-all duration-200 ease-out flex items-center justify-center pointer-events-none"
              style={{
                left: `calc(${(x) * 100 / 15}% + ${offset}px)`, 
                top: `calc(${(y) * 100 / 15}% - ${offset}px)`,
                width: `calc(100% / 15)`,
                height: `calc(100% / 15)`,
                zIndex: isClickable ? 100 : 50 + index
              }}
          >
              <div className="w-[70%] h-[70%] pointer-events-auto">
                  <PieceComponent 
                      color={item.color} 
                      onClick={() => onPieceClick(item.p.id)}
                      isClickable={isClickable}
                      isStacked={stackSize}
                      theme={theme}
                  />
              </div>
          </div>
       );
    });
  });

  // Base Overlay Renderer
  const renderBase = (color: PlayerColor, x: number, y: number) => {
      const baseColor = theme.palette[color];
      return (
      <div className="absolute flex items-center justify-center border-[2px]"
           style={{
               left: `calc(${x * 100 / 15}%)`,
               top: `calc(${y * 100 / 15}%)`,
               width: `calc(600% / 15)`,
               height: `calc(600% / 15)`,
               backgroundColor: baseColor,
               borderColor: theme.borderColor
           }}
      >
          {/* Inner White Box */}
          <div className="w-[75%] h-[75%] border-[2px] relative shadow-sm" style={{ backgroundColor: theme.boardBaseColor, borderColor: theme.borderColor }}>
              
              {/* Large Center Star */}
              <div className="absolute inset-0 flex items-center justify-center z-0">
                  <Star className="w-[60%] h-[60%] rotate-12 drop-shadow-sm" fill="currentColor" strokeWidth={0} style={{ color: baseColor }} />
              </div>

              {/* 4 Corner Circles */}
              {[
                  { top: '8%', left: '8%' },
                  { top: '8%', right: '8%' },
                  { bottom: '8%', left: '8%' },
                  { bottom: '8%', right: '8%' }
              ].map((pos, i) => (
                  <div key={i} className="absolute w-[28%] h-[28%] rounded-full border-[2px] flex items-center justify-center"
                       style={{ ...pos, borderColor: theme.borderColor, backgroundColor: theme.boardBaseColor }}>
                      <div className="w-full h-full rounded-full border-[2px] border-white flex items-center justify-center shadow-inner"
                           style={{ backgroundColor: baseColor }}>
                         <Star className="text-white w-[60%] h-[60%]" fill="white" />
                      </div>
                  </div>
              ))}
          </div>
      </div>
    );
  };

  return (
    // Max height constraint added for mobile responsiveness
    <div className="w-full max-w-[600px] aspect-square relative p-1 sm:p-3 md:p-6 rounded-sm shadow-2xl mx-auto max-h-[50vh] sm:max-h-[85vh] select-none transition-colors duration-500"
         style={{ backgroundColor: '#5c4033' }}> {/* Wood/Table border remains constant or could be theme property */}
      
      {/* The Board Area */}
      <div className="w-full h-full relative border-[2px]" style={{ backgroundColor: theme.boardBaseColor, borderColor: theme.borderColor }}>
        
        {/* Grid */}
        <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))] w-full h-full">
            {cells}
        </div>

        {/* Bases Overlays */}
        {renderBase(PlayerColor.RED, 0, 0)}
        {renderBase(PlayerColor.GREEN, 9, 0)}
        {renderBase(PlayerColor.BLUE, 0, 9)}
        {renderBase(PlayerColor.YELLOW, 9, 9)}

        {/* Center Home Overlay */}
        <div className="absolute left-[40%] top-[40%] w-[20%] h-[20%] z-0 border-[2px]" style={{ borderColor: theme.borderColor }}>
            {/* Top (Green) */}
            <div className="absolute top-0 left-0 w-full h-full border-b-2" 
                 style={{ backgroundColor: theme.palette[PlayerColor.GREEN], borderColor: theme.borderColor, clipPath: 'polygon(0 0, 100% 0, 50% 50%)' }}></div>
            {/* Right (Yellow) */}
            <div className="absolute top-0 left-0 w-full h-full border-l-2" 
                 style={{ backgroundColor: theme.palette[PlayerColor.YELLOW], borderColor: theme.borderColor, clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)' }}></div>
            {/* Bottom (Blue) */}
            <div className="absolute top-0 left-0 w-full h-full border-t-2" 
                 style={{ backgroundColor: theme.palette[PlayerColor.BLUE], borderColor: theme.borderColor, clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)' }}></div>
            {/* Left (Red) */}
            <div className="absolute top-0 left-0 w-full h-full border-r-2" 
                 style={{ backgroundColor: theme.palette[PlayerColor.RED], borderColor: theme.borderColor, clipPath: 'polygon(0 0, 0 100%, 50% 50%)' }}></div>

            {/* DICE OVERLAY */}
            <div className="absolute inset-0 flex items-center justify-center z-50">
               <div className="scale-75 sm:scale-100">
                  <Dice
                      value={diceValue}
                      rolling={isDiceRolling}
                      onRoll={onDiceRoll}
                      disabled={isDiceDisabled}
                      skinData={diceSkin}
                  />
               </div>
            </div>
        </div>

        {/* Pieces Layer */}
        <div className="absolute inset-0 pointer-events-none w-full h-full z-10">
            {piecesToRender}
        </div>

      </div>
    </div>
  );
};

export default Board;