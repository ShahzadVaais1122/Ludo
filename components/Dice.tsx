import React, { useEffect, useState } from 'react';
import { DiceSkin } from '../types';

interface DiceProps {
  value: number;
  rolling: boolean;
  onRoll: () => void;
  disabled: boolean;
  color: string;
  skinData?: DiceSkin; // Optional, falls back to default if missing
}

const Dice: React.FC<DiceProps> = ({ value, rolling, onRoll, disabled, skinData }) => {
  const [displayValue, setDisplayValue] = useState(1);

  // Default skin fallback
  const skin = skinData || {
    colorClass: 'bg-white border-gray-300',
    dotClass: 'bg-black'
  };

  useEffect(() => {
    if (rolling) {
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setDisplayValue(value);
    }
  }, [rolling, value]);

  // Dice dot positions
  const renderDots = (num: number) => {
    const dots = [];
    const dotBaseClass = `absolute w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full ${skin.dotClass}`;

    if ([1, 3, 5].includes(num)) dots.push(<div key="c" className={`${dotBaseClass} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`} />);
    if ([2, 3, 4, 5, 6].includes(num)) {
       dots.push(<div key="tl" className={`${dotBaseClass} top-2 left-2`} />);
       dots.push(<div key="br" className={`${dotBaseClass} bottom-2 right-2`} />);
    }
    if ([4, 5, 6].includes(num)) {
       dots.push(<div key="tr" className={`${dotBaseClass} top-2 right-2`} />);
       dots.push(<div key="bl" className={`${dotBaseClass} bottom-2 left-2`} />);
    }
    if (num === 6) {
       dots.push(<div key="ml" className={`${dotBaseClass} top-1/2 left-2 transform -translate-y-1/2`} />);
       dots.push(<div key="mr" className={`${dotBaseClass} top-1/2 right-2 transform -translate-y-1/2`} />);
    }
    return dots;
  };

  return (
    <div className="relative flex flex-col items-center z-20 pointer-events-auto">
      <button 
        onClick={onRoll} 
        disabled={disabled || rolling}
        className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl shadow-[0_6px_0_rgb(0,0,0,0.2)] sm:shadow-[0_10px_0_rgb(0,0,0,0.2)] border-2 sm:border-4 relative transition-all duration-300 active:shadow-none active:translate-y-2 ${rolling ? 'animate-spin' : ''} ${disabled ? 'opacity-80 scale-90 cursor-not-allowed grayscale' : 'cursor-pointer hover:-translate-y-1 scale-100 hover:scale-105'} ${skin.colorClass}`}
        style={rolling ? { animation: 'spin 0.5s linear infinite' } : {}}
      >
        {renderDots(displayValue)}
      </button>
      {!disabled && !rolling && (
         <div className="absolute -bottom-8 animate-bounce font-bold text-[10px] sm:text-xs text-white bg-black/50 px-2 py-1 rounded-full whitespace-nowrap backdrop-blur-sm pointer-events-none">
            TAP TO ROLL
         </div>
      )}
    </div>
  );
};

export default Dice;