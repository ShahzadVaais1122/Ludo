import React from 'react';
import { GameState, PlayerColor, Piece } from '../types';
import { getPieceCoordinates } from '../utils/gameLogic';
import PieceComponent from './Piece';
import { Star, ArrowRight, ArrowDown, ArrowLeft, ArrowUp } from 'lucide-react';

interface BoardProps {
  gameState: GameState;
  onPieceClick: (pieceId: number) => void;
}

const Board: React.FC<BoardProps> = ({ gameState, onPieceClick }) => {
  
  const cells = [];
  
  // Helper for Colors
  const COLORS = {
    RED: 'bg-[#ff0000]',
    GREEN: 'bg-[#00aa00]',
    YELLOW: 'bg-[#ffdd00]',
    BLUE: 'bg-[#0000ff]',
    WHITE: 'bg-white',
  };

  const getCellClass = (x: number, y: number) => {
    // BASES (Transparent to show overlay)
    if (x < 6 && y < 6) return 'bg-transparent border-transparent'; 
    if (x > 8 && y < 6) return 'bg-transparent border-transparent';
    if (x < 6 && y > 8) return 'bg-transparent border-transparent';
    if (x > 8 && y > 8) return 'bg-transparent border-transparent';

    // CENTER (Home)
    if (x >= 6 && x <= 8 && y >= 6 && y <= 8) return 'bg-transparent border-none';

    // HOME PATHS (Colored Columns/Rows)
    if (y === 7 && x > 0 && x < 6) return `${COLORS.RED} border-black`; // Red Home Path
    if (x === 7 && y > 0 && y < 6) return `${COLORS.GREEN} border-black`; // Green Home Path
    if (y === 7 && x > 8 && x < 14) return `${COLORS.YELLOW} border-black`; // Yellow Home Path
    if (x === 7 && y > 8 && y < 14) return `${COLORS.BLUE} border-black`; // Blue Home Path

    // START SQUARES
    if (x === 1 && y === 6) return `${COLORS.RED} border-black`; 
    if (x === 8 && y === 1) return `${COLORS.GREEN} border-black`; 
    if (x === 13 && y === 8) return `${COLORS.YELLOW} border-black`; 
    if (x === 6 && y === 13) return `${COLORS.BLUE} border-black`; 

    // DEFAULT PATH
    return 'bg-white border-black';
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

     // Safe Spots (Stars on White Squares)
     // Locations: (2,8), (6,2), (12,6), (8,12)
     if (x === 2 && y === 8) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><Star className={`${starStyle} text-[#ff0000]`} /></div>; // Red Star
     if (x === 6 && y === 2) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><Star className={`${starStyle} text-[#00aa00]`} /></div>; // Green Star
     if (x === 12 && y === 6) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><Star className={`${starStyle} text-[#00aa00]`} /></div>; // Green Star
     if (x === 8 && y === 12) return <div className="w-full h-full flex items-center justify-center overflow-hidden"><Star className={`${starStyle} text-[#0000ff]`} /></div>; // Blue Star
     
     // Home Arrows (At end of home path)
     // Red End
     if (x === 5 && y === 7) return null; // Just color
     // Green End
     if (x === 7 && y === 5) return null;

     return null;
  }

  // Render Grid
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const isBase = (x < 6 && y < 6) || (x > 8 && y < 6) || (x < 6 && y > 8) || (x > 8 && y > 8);
      
      cells.push(
        <div 
          key={`${x}-${y}`} 
          className={`relative flex items-center justify-center border-[1px] min-w-0 min-h-0 ${getCellClass(x, y)}`} 
          style={{ gridColumnStart: x + 1, gridRowStart: y + 1 }}
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
              className="absolute transition-all duration-300 ease-out flex items-center justify-center pointer-events-none"
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
                  />
              </div>
          </div>
       );
    });
  });

  // Base Overlay Renderer
  const renderBase = (color: PlayerColor, x: number, y: number, bgColor: string, starColor: string) => (
      <div className={`absolute ${bgColor} border-[2px] border-black flex items-center justify-center`}
           style={{
               left: `calc(${x * 100 / 15}%)`,
               top: `calc(${y * 100 / 15}%)`,
               width: `calc(600% / 15)`, // 6 units wide
               height: `calc(600% / 15)`, // 6 units high
           }}
      >
          {/* Inner White Box */}
          <div className="w-[75%] h-[75%] bg-white border-[2px] border-black relative shadow-sm">
              
              {/* Large Center Star */}
              <div className="absolute inset-0 flex items-center justify-center z-0">
                  <Star className={`${starColor} w-[60%] h-[60%] rotate-12 drop-shadow-sm`} fill="currentColor" strokeWidth={0} />
              </div>

              {/* 4 Corner Circles */}
              <div className="absolute top-[8%] left-[8%] w-[28%] h-[28%] rounded-full border-[2px] border-black bg-white flex items-center justify-center">
                  <div className={`w-full h-full rounded-full ${bgColor} border-[2px] border-white flex items-center justify-center shadow-inner`}>
                      <Star className="text-white w-[60%] h-[60%]" fill="white" />
                  </div>
              </div>
              <div className="absolute top-[8%] right-[8%] w-[28%] h-[28%] rounded-full border-[2px] border-black bg-white flex items-center justify-center">
                   <div className={`w-full h-full rounded-full ${bgColor} border-[2px] border-white flex items-center justify-center shadow-inner`}>
                      <Star className="text-white w-[60%] h-[60%]" fill="white" />
                  </div>
              </div>
              <div className="absolute bottom-[8%] left-[8%] w-[28%] h-[28%] rounded-full border-[2px] border-black bg-white flex items-center justify-center">
                   <div className={`w-full h-full rounded-full ${bgColor} border-[2px] border-white flex items-center justify-center shadow-inner`}>
                      <Star className="text-white w-[60%] h-[60%]" fill="white" />
                  </div>
              </div>
              <div className="absolute bottom-[8%] right-[8%] w-[28%] h-[28%] rounded-full border-[2px] border-black bg-white flex items-center justify-center">
                   <div className={`w-full h-full rounded-full ${bgColor} border-[2px] border-white flex items-center justify-center shadow-inner`}>
                      <Star className="text-white w-[60%] h-[60%]" fill="white" />
                  </div>
              </div>
          </div>
      </div>
  );

  return (
    <div className="w-full max-w-[600px] aspect-square relative bg-[#5c4033] p-3 md:p-6 rounded-sm shadow-2xl mx-auto max-h-[85vh] select-none">
      
      {/* The Board Area */}
      <div className="w-full h-full bg-white relative border-[2px] border-black">
        
        {/* Grid - FIX: Using explicit repeat(15, 1fr) to ensure exact sizing */}
        <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))] w-full h-full">
            {cells}
        </div>

        {/* Bases Overlays */}
        {renderBase(PlayerColor.RED, 0, 0, COLORS.RED, 'text-red-600')}
        {renderBase(PlayerColor.GREEN, 9, 0, COLORS.GREEN, 'text-green-600')}
        {renderBase(PlayerColor.BLUE, 0, 9, COLORS.BLUE, 'text-blue-600')}
        {renderBase(PlayerColor.YELLOW, 9, 9, COLORS.YELLOW, 'text-yellow-500')}

        {/* Center Home Overlay */}
        <div className="absolute left-[40%] top-[40%] w-[20%] h-[20%] z-0 border-[2px] border-black">
            {/* Top (Green) */}
            <div className={`absolute top-0 left-0 w-full h-full ${COLORS.GREEN} border-b-2 border-black`} style={{clipPath: 'polygon(0 0, 100% 0, 50% 50%)'}}></div>
            {/* Right (Yellow) */}
            <div className={`absolute top-0 left-0 w-full h-full ${COLORS.YELLOW} border-l-2 border-black`} style={{clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)'}}></div>
            {/* Bottom (Blue) */}
            <div className={`absolute top-0 left-0 w-full h-full ${COLORS.BLUE} border-t-2 border-black`} style={{clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)'}}></div>
            {/* Left (Red) */}
            <div className={`absolute top-0 left-0 w-full h-full ${COLORS.RED} border-r-2 border-black`} style={{clipPath: 'polygon(0 0, 0 100%, 50% 50%)'}}></div>
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