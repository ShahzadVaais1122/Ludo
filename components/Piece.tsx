import React from 'react';
import { PlayerColor, Theme } from '../types';

interface PieceProps {
  color: PlayerColor;
  onClick: () => void;
  isClickable: boolean;
  isStacked: number; // Count of pieces on this spot
  theme: Theme;
}

const PieceComponent: React.FC<PieceProps> = ({ color, onClick, isClickable, isStacked, theme }) => {
  const bgColor = theme.palette[color];
  const borderColor = theme.borderColor;
  
  return (
    <div 
      onClick={isClickable ? onClick : undefined}
      className={`relative w-full h-full rounded-full border-[2px] shadow-[0_2px_4px_rgba(0,0,0,0.4)] flex items-center justify-center transition-all duration-200 ${isClickable ? 'cursor-pointer animate-bounce z-20 scale-110 ring-2 ring-yellow-400' : 'z-10'}`}
      style={{
        backgroundColor: bgColor,
        borderColor: isClickable ? '#fff' : borderColor // Highlight border if clickable
      }}
    >
      {/* Inner highlight */}
      <div className="w-[40%] h-[40%] rounded-full bg-white/30"></div>

      {isStacked > 1 && (
        <div className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-white shadow-md z-30">
          {isStacked}
        </div>
      )}
    </div>
  );
};

export default PieceComponent;