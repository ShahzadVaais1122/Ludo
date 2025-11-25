import React, { useState, useEffect } from 'react';
import { GameState, GameStatus, Player, PlayerColor, Piece, Difficulty } from './types';
import Lobby from './screens/Lobby';
import Board from './components/Board';
import Dice from './components/Dice';
import { canMovePiece, checkForKill, getBotMove } from './utils/gameLogic';
import { Volume2, Trophy, Coins, Home, Settings, Music, Brain, X } from 'lucide-react';
import { DICE_SKINS } from './constants';

const INITIAL_PIECES = (color: PlayerColor): Piece[] => [
  { id: 0, color, position: -1, isSafe: true },
  { id: 1, color, position: -1, isSafe: true },
  { id: 2, color, position: -1, isSafe: true },
  { id: 3, color, position: -1, isSafe: true },
];

const App: React.FC = () => {
  // Store State
  const [balance, setBalance] = useState(2500); // Give some starter cash
  const [ownedSkins, setOwnedSkins] = useState<string[]>(['default']);
  const [selectedSkinId, setSelectedSkinId] = useState('default');
  
  // Settings State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [showSettings, setShowSettings] = useState(false);

  const [gameState, setGameState] = useState<GameState>({
    status: GameStatus.LOBBY,
    roomCode: '',
    players: [],
    currentTurnIndex: 0,
    diceValue: 1,
    isDiceRolling: false,
    canRoll: false,
    winners: [],
    logs: [],
    waitingForMove: false,
    validMoves: [],
    consecutiveSixes: 0
  });

  // Shop Handlers
  const handleBuySkin = (skinId: string, price: number) => {
    if (balance >= price && !ownedSkins.includes(skinId)) {
      setBalance(prev => prev - price);
      setOwnedSkins(prev => [...prev, skinId]);
    }
  };

  const handleEquipSkin = (skinId: string) => {
    if (ownedSkins.includes(skinId)) {
      setSelectedSkinId(skinId);
    }
  };

  // Audio System using Web Audio API
  const playSound = (type: 'roll' | 'move' | 'kill' | 'win') => {
    if (!soundEnabled) return;

    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        const now = ctx.currentTime;

        switch (type) {
            case 'roll':
                // Rolling sound - rapid low frequency flutter
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(50, now + 0.2);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;

            case 'move':
                // Pop/Click sound
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;

            case 'kill':
                // Falling/Crash sound
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;

            case 'win':
                // Victory Arpeggio (Fanfare)
                osc.disconnect(); // Disconnect default osc
                const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C-E-G-C-E
                notes.forEach((freq, i) => {
                    const noteOsc = ctx.createOscillator();
                    const noteGain = ctx.createGain();
                    noteOsc.connect(noteGain);
                    noteGain.connect(ctx.destination);
                    
                    noteOsc.type = 'square'; // 8-bit style
                    noteOsc.frequency.value = freq;
                    
                    const startTime = now + (i * 0.1);
                    noteGain.gain.setValueAtTime(0, startTime);
                    noteGain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
                    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
                    
                    noteOsc.start(startTime);
                    noteOsc.stop(startTime + 0.6);
                });
                break;
        }
    } catch (e) {
        // Audio context might be blocked if no interaction yet
        console.warn("Sound playback failed:", e);
    }
  };

  const initGame = (_mode: string, initialPlayers: any[]) => {
    // Standard Clockwise Turn Order: Red -> Green -> Yellow -> Blue
    const colors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
    
    const players: Player[] = initialPlayers.map((p, idx) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      color: colors[idx],
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`,
      pieces: INITIAL_PIECES(colors[idx]),
      hasWon: false,
      rank: 0,
      // For local user (usually p1), use selected skin. Bots get random or default.
      diceSkin: (!p.isBot && idx === 0) ? selectedSkinId : (p.isBot ? ['default', 'gold', 'neon', 'ruby'][Math.floor(Math.random()*4)] : 'default')
    }));

    setGameState({
      status: GameStatus.PLAYING,
      roomCode: Math.random().toString(36).substring(7).toUpperCase(),
      players,
      currentTurnIndex: 0,
      diceValue: 1,
      isDiceRolling: false,
      canRoll: true,
      winners: [],
      logs: ['Game Started! Red to roll.'],
      waitingForMove: false,
      validMoves: [],
      consecutiveSixes: 0
    });
  };

  // Bot Logic Hook
  useEffect(() => {
    if (gameState.status !== GameStatus.PLAYING) return;
    
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    
    // Bot Roll
    if (currentPlayer.isBot && gameState.canRoll && !gameState.isDiceRolling) {
      setTimeout(() => handleRollDice(), 1000);
    }
    
    // Bot Move
    if (currentPlayer.isBot && gameState.waitingForMove) {
       setTimeout(() => {
          // Pass difficulty and all players to Bot Logic
          const pieceId = getBotMove(gameState.diceValue, currentPlayer, gameState.players, difficulty);
          if (pieceId !== null) {
            handlePieceClick(pieceId);
          } else {
             // Fallback if bot has no moves (should be handled by handleRollDice logic, but safe fallback)
             nextTurn();
          }
       }, 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.status, gameState.currentTurnIndex, gameState.canRoll, gameState.waitingForMove, gameState.isDiceRolling]);


  const handleRollDice = () => {
    if (!gameState.canRoll || gameState.isDiceRolling) return;

    setGameState(prev => ({ ...prev, isDiceRolling: true, canRoll: false }));
    playSound('roll');

    setTimeout(() => {
      const rolledValue = Math.floor(Math.random() * 6) + 1; // 1-6
      
      setGameState(prev => {
        const currentPlayer = prev.players[prev.currentTurnIndex];
        let logs = [...prev.logs, `${currentPlayer.name} rolled a ${rolledValue}`];
        
        // Rule: 3 Consecutive Sixes -> Turn End Immediately
        let newConsecutiveSixes = prev.consecutiveSixes;
        
        if (rolledValue === 6) {
            newConsecutiveSixes += 1;
        } else {
            newConsecutiveSixes = 0;
        }

        if (newConsecutiveSixes === 3) {
            logs.push(`${currentPlayer.name} rolled three 6s! Turn forfeited.`);
            // Turn ends, next player
            // We return state here, and the useEffect auto-passer won't trigger because we set diceRolling false but NOT canRoll/waiting
            // Actually, we should trigger nextTurn manually or via state
            // Let's set waitingForMove false, canRoll false.
            // But we need to ensure nextTurn is called. 
            // The cleanest way is to set state and let the auto-pass effect handle it, 
            // OR simply return a state that looks like "Done" and let the effect pick it up.
            
            return {
                ...prev,
                diceValue: rolledValue,
                isDiceRolling: false,
                waitingForMove: false,
                canRoll: false,
                validMoves: [],
                logs,
                consecutiveSixes: 0 // Reset for next person or next turn
            };
        }

        // Calculate valid moves
        const validPieceIds: number[] = [];
        currentPlayer.pieces.forEach(p => {
          if (canMovePiece(p, rolledValue, prev.players)) {
            validPieceIds.push(p.id);
          }
        });

        const canMove = validPieceIds.length > 0;
        
        if (!canMove) {
          logs.push(`No valid moves for ${currentPlayer.name}.`);
          // If 6 (and not 3rd), they get to roll again, otherwise turn ends
          // Note: If they rolled 6 but couldn't move (e.g. all blocked), they still get extra roll?
          // Standard rules: "Rolling a six also earns the player an extra roll."
          // Usually yes, unless 3rd 6.
          
          return {
            ...prev,
            diceValue: rolledValue,
            isDiceRolling: false,
            waitingForMove: false,
            canRoll: rolledValue === 6, 
            logs,
            validMoves: [],
            consecutiveSixes: newConsecutiveSixes
          };
        }

        return {
          ...prev,
          diceValue: rolledValue,
          isDiceRolling: false,
          canRoll: false,
          waitingForMove: true,
          validMoves: validPieceIds,
          logs,
          consecutiveSixes: newConsecutiveSixes
        };
      });
      
    }, 800);
  };

  // Effect to handle auto-pass turn if no moves (and not a 6 or forfeited)
  useEffect(() => {
    // Only pass turn if: Not rolling, Not waiting for user to move, Can't roll again (not extra turn), and Playing
    if (!gameState.isDiceRolling && !gameState.canRoll && !gameState.waitingForMove && gameState.status === GameStatus.PLAYING) {
       const timer = setTimeout(nextTurn, 1000);
       return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.isDiceRolling, gameState.canRoll, gameState.waitingForMove, gameState.status]);


  const handlePieceClick = (pieceId: number) => {
    if (!gameState.waitingForMove) return;
    
    setGameState(prev => {
      if (!prev.validMoves.includes(pieceId)) return prev;

      const currentPlayerIndex = prev.currentTurnIndex;
      const currentPlayer = prev.players[currentPlayerIndex];
      const newPlayers = [...prev.players];
      const playerToUpdate = { ...newPlayers[currentPlayerIndex] };
      const pieceToUpdate = playerToUpdate.pieces.find(p => p.id === pieceId)!;

      // Logic: Move piece
      let moveDistance = prev.diceValue;
      let newLogs = [...prev.logs];

      // 1. Leave Base
      if (pieceToUpdate.position === -1) {
        if (moveDistance === 6) {
          pieceToUpdate.position = 0; // Move to start
          newLogs.push(`${currentPlayer.name} deployed a piece!`);
        } else {
            return prev;
        }
      } else {
        // 2. Normal Move
        pieceToUpdate.position += moveDistance;
      }
      
      // 3. Check for Kill
      const { killed, logs: killLogs } = checkForKill(pieceToUpdate, prev, currentPlayer.id);
      newLogs = [...newLogs, ...killLogs];
      if (killed) {
        playSound('kill');
        if (!currentPlayer.isBot) setBalance(b => b + 100);
      } else {
        playSound('move');
      }

      // 4. Update pieces array
      playerToUpdate.pieces = playerToUpdate.pieces.map(p => p.id === pieceId ? pieceToUpdate : p);
      newPlayers[currentPlayerIndex] = playerToUpdate;

      // 5. Check Win Condition
      let pieceFinished = false;
      if (pieceToUpdate.position === 99 || pieceToUpdate.position === 56) {
          // Note: gameLogic checks <= 56. If it was exactly 56, we move it to 99 (HOME STATE)
          if (pieceToUpdate.position === 56) pieceToUpdate.position = 99;
          
          pieceFinished = true;
          playSound('win');
          newLogs.push(`${currentPlayer.name}'s piece reached Home!`);
          if (!currentPlayer.isBot) setBalance(b => b + 500); // Win Reward
      }
      
      // Check if player has won (all 4 pieces at 99)
      const allHome = playerToUpdate.pieces.every(p => p.position === 99);
      let winners = [...prev.winners];
      
      if (allHome && !playerToUpdate.hasWon) {
          playerToUpdate.hasWon = true;
          playerToUpdate.rank = winners.length + 1;
          winners.push(playerToUpdate.color);
          newLogs.push(`🏆 ${currentPlayer.name} HAS FINISHED Rank #${playerToUpdate.rank}!`);
          if (!currentPlayer.isBot) setBalance(b => b + 2000); // Grand Win Reward
      }

      // 6. Turn Logic: 
      // Extra turn if: Rolled 6 OR Killed Opponent OR Piece Finished (but game not over for player)
      // NOTE: 3x 6s check happens at ROLL time. Here we just grant the extra roll if it was a 6.
      const extraTurn = (prev.diceValue === 6) || killed || (pieceFinished && !allHome);
      
      // If extra turn, keep consecutiveSixes. If turn ends (no extra), reset it (handled by nextTurn logic usually, but here we transition to next player via useEffect if !canRoll)
      // Actually, we reset consecutiveSixes only when turn passes to NEXT player.
      
      return {
        ...prev,
        players: newPlayers,
        waitingForMove: false,
        canRoll: extraTurn, 
        winners,
        logs: newLogs,
        validMoves: [] // Clear moves
      };
    });
  };

  const nextTurn = () => {
    setGameState(prev => {
        // Check Game Over
        if (prev.winners.length >= 3) {
            return { ...prev, status: GameStatus.FINISHED };
        }

        // Find next non-winning player
        let nextIndex = (prev.currentTurnIndex + 1) % 4;
        while (prev.players[nextIndex].hasWon) {
           nextIndex = (nextIndex + 1) % 4;
           if (nextIndex === prev.currentTurnIndex) break; 
        }

        return {
            ...prev,
            currentTurnIndex: nextIndex,
            canRoll: true,
            waitingForMove: false,
            diceValue: 1,
            consecutiveSixes: 0 // Reset for new player
        };
    });
  };

  const SettingsModal = () => (
    <div className="absolute inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s]">
      <div className="bg-[#0f172a] w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl">
        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="text-purple-400"/> Settings
          </h2>
          <button onClick={() => setShowSettings(false)} className="bg-white/5 p-2 rounded-full hover:bg-white/10 transition"><X size={18} /></button>
        </div>

        <div className="space-y-6">
          {/* Sound & Music */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
               <div className="flex items-center gap-3">
                  <Volume2 className={soundEnabled ? "text-green-400" : "text-slate-500"} size={20} />
                  <span className="font-bold text-slate-200">Sound Effects</span>
               </div>
               <button 
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${soundEnabled ? 'bg-green-500' : 'bg-slate-700'}`}
               >
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${soundEnabled ? 'left-7' : 'left-1'}`}></div>
               </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
               <div className="flex items-center gap-3">
                  <Music className={musicEnabled ? "text-purple-400" : "text-slate-500"} size={20} />
                  <span className="font-bold text-slate-200">Music</span>
               </div>
               <button 
                  onClick={() => setMusicEnabled(!musicEnabled)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${musicEnabled ? 'bg-purple-500' : 'bg-slate-700'}`}
               >
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${musicEnabled ? 'left-7' : 'left-1'}`}></div>
               </button>
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3 block flex items-center gap-2">
              <Brain size={14}/> Bot Difficulty
            </label>
            <div className="grid grid-cols-3 gap-2">
               {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map(d => (
                 <button
                   key={d}
                   onClick={() => setDifficulty(d)}
                   className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${difficulty === d ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                 >
                   {d}
                 </button>
               ))}
            </div>
          </div>
        </div>

        <button onClick={() => setShowSettings(false)} className="w-full mt-8 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition">
          Close
        </button>
      </div>
    </div>
  );

  if (gameState.status === GameStatus.LOBBY) {
    return (
      <>
        <Lobby 
            onStartGame={initGame} 
            balance={balance}
            ownedSkins={ownedSkins}
            selectedSkin={selectedSkinId}
            onBuySkin={handleBuySkin}
            onEquipSkin={handleEquipSkin}
        />
        {showSettings && <SettingsModal />}
      </>
    );
  }

  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const currentSkinData = DICE_SKINS.find(s => s.id === currentPlayer.diceSkin);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden relative">
       {/* Settings Modal Overlay */}
       {showSettings && <SettingsModal />}

       {/* Background */}
       <div className="absolute inset-0 bg-black/10 pointer-events-none z-0"></div>

      {/* Header */}
      <div className="flex items-center justify-between p-2 sm:p-4 glass-panel z-20 border-b border-white/5 relative flex-shrink-0">
        <div className="flex items-center gap-3">
           <button 
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition backdrop-blur-md" 
                onClick={() => setGameState(p => ({...p, status: GameStatus.LOBBY}))}
            >
              <Home size={20} className="text-white" />
           </button>
           <h1 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-purple-400 text-base sm:text-lg hidden sm:block">
               LUDO MASTER
           </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-2 text-yellow-300 font-bold bg-black/40 border border-yellow-500/20 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full shadow-inner text-sm sm:text-base">
                <Coins size={14} className="sm:w-4 sm:h-4" fill="gold"/> {balance}
            </div>
            <div className="bg-white/5 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-mono text-indigo-200 hidden sm:block border border-white/10">
                Room: <span className="text-white font-bold">{gameState.roomCode}</span>
            </div>
            <button 
                onClick={() => setShowSettings(true)} 
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white"
            >
                <Settings size={20}/>
            </button>
        </div>
      </div>

      {/* Main Game Area */}
      {/* Mobile: Column with scroll if needed. Desktop: Row, no scroll (hidden) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative z-10">
        
        {/* Left: Players & Chat (Order 3 on Mobile, Order 1 on Desktop) */}
        <div className="order-3 md:order-1 w-full md:w-80 glass-panel border-r border-white/5 flex flex-col gap-3 p-3 sm:p-4 min-h-[160px] flex-shrink-0 md:flex-shrink md:h-full md:overflow-y-auto">
           <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1 sticky top-0 bg-transparent">Players</h3>
           <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-4">
               {gameState.players.map((p, i) => (
                 <div key={p.id} className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-2xl border transition-all duration-300 relative overflow-hidden ${gameState.currentTurnIndex === i ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-black/20 border-white/5 opacity-70'}`}>
                    {gameState.currentTurnIndex === i && <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-400"></div>}
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full p-0.5 bg-gradient-to-br ${p.hasWon ? 'from-yellow-400 to-yellow-600' : 'from-slate-500 to-slate-700'}`}>
                       <img src={p.avatarUrl} alt="av" className="w-full h-full rounded-full object-cover bg-slate-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`font-bold text-xs sm:text-sm truncate ${gameState.currentTurnIndex === i ? 'text-white' : 'text-slate-300'}`}>
                            {p.name}
                        </p>
                        {p.hasWon ? (
                            <span className="text-[10px] text-yellow-400 flex items-center gap-1 font-bold"><Trophy size={10}/> #{p.rank}</span>
                        ) : (
                           <span className={`text-[10px] truncate block ${p.color === 'RED' ? 'text-red-400' : p.color === 'GREEN' ? 'text-green-400' : p.color === 'YELLOW' ? 'text-yellow-400' : 'text-blue-400'}`}>
                               {p.color}
                           </span>
                        )}
                    </div>
                 </div>
               ))}
           </div>

           {/* Game Log */}
           <div className="flex-1 mt-4 md:mt-auto min-h-[80px]">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2">Logs</h3>
                <div className="bg-black/30 rounded-xl p-3 h-32 md:h-auto overflow-y-auto text-xs font-mono space-y-2 border border-white/5 shadow-inner">
                    {gameState.logs.slice().reverse().map((log, i) => (
                        <div key={i} className="text-slate-300 border-l-2 border-slate-700 pl-2 py-0.5">{log}</div>
                    ))}
                </div>
           </div>
        </div>

        {/* Center: Board (Order 1 on Mobile, Order 2 on Desktop) */}
        <div className="order-1 md:order-2 flex-1 flex items-center justify-center p-2 md:p-4 relative overflow-visible md:overflow-hidden flex-shrink-0">
             {/* Glow Effect behind board */}
             <div className="absolute w-[90%] aspect-square bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>
             
             <Board gameState={gameState} onPieceClick={handlePieceClick} />
             
             {/* Winner Overlay */}
             {gameState.status === GameStatus.FINISHED && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-8 backdrop-blur-md animate-[fadeIn_0.5s]">
                   <Trophy size={100} className="text-yellow-400 mb-6 animate-bounce drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]"/>
                   <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-yellow-300 mb-8">GAME OVER</h2>
                   <div className="bg-white/10 p-6 rounded-3xl w-full max-w-md border border-white/10 backdrop-blur-xl">
                      {gameState.players.filter(p => p.hasWon).sort((a,b) => a.rank - b.rank).map(p => (
                         <div key={p.id} className="flex justify-between items-center border-b border-white/10 py-4 last:border-0">
                            <span className="font-bold text-xl text-white w-10">#{p.rank}</span>
                            <div className="flex items-center gap-3 flex-1">
                                <img src={p.avatarUrl} className="w-8 h-8 rounded-full" />
                                <span className="font-medium text-slate-200">{p.name}</span>
                            </div>
                            <span className="text-yellow-400 font-bold text-sm flex items-center gap-1">+{p.rank === 1 ? 2000 : 500} <Coins size={14}/></span>
                         </div>
                      ))}
                   </div>
                   <button onClick={() => setGameState(prev => ({...prev, status: GameStatus.LOBBY}))} className="mt-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 px-12 rounded-full hover:scale-105 transition shadow-xl shadow-indigo-900/50">
                       Back to Lobby
                   </button>
                </div>
             )}
        </div>

        {/* Right: Controls (Order 2 on Mobile, Order 3 on Desktop) */}
        <div className="order-2 md:order-3 w-full md:w-72 glass-panel border-l border-white/5 p-4 md:p-6 flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 md:gap-6 z-20 flex-shrink-0">
             <div className="text-left md:text-center w-full">
                <p className="text-indigo-300 text-[10px] uppercase tracking-[0.2em] mb-1 font-bold">Current Turn</p>
                <h2 className={`text-lg sm:text-2xl font-black drop-shadow-md tracking-wider truncate ${currentPlayer.color === 'RED' ? 'text-red-500' : currentPlayer.color === 'GREEN' ? 'text-green-400' : currentPlayer.color === 'YELLOW' ? 'text-yellow-400' : 'text-blue-400'}`}>
                    {currentPlayer.name}
                </h2>
                <div className={`h-1 w-10 md:w-20 md:mx-auto mt-2 rounded-full ${currentPlayer.color === 'RED' ? 'bg-red-500' : currentPlayer.color === 'GREEN' ? 'bg-green-500' : currentPlayer.color === 'YELLOW' ? 'bg-yellow-400' : 'bg-blue-400'} shadow-[0_0_10px_currentColor]`}></div>
             </div>

             <div className="flex-1 flex items-center justify-end md:justify-center w-full my-0 md:my-4">
                 <div className="relative">
                    {/* Dice Glow */}
                    <div className={`absolute inset-0 blur-2xl opacity-40 transition-colors duration-500 ${currentPlayer.color === 'RED' ? 'bg-red-500' : currentPlayer.color === 'GREEN' ? 'bg-green-500' : currentPlayer.color === 'YELLOW' ? 'bg-yellow-400' : 'bg-blue-500'}`}></div>
                    <Dice 
                        value={gameState.diceValue} 
                        rolling={gameState.isDiceRolling} 
                        onRoll={handleRollDice}
                        disabled={!gameState.canRoll || (currentPlayer.isBot && gameState.status === GameStatus.PLAYING)}
                        color={currentPlayer.color === 'RED' ? 'text-red-500' : currentPlayer.color === 'GREEN' ? 'text-green-500' : currentPlayer.color === 'YELLOW' ? 'text-yellow-400' : 'text-blue-500'}
                        skinData={currentSkinData}
                    />
                 </div>
             </div>
             
             {/* Ad Space */}
             <div className="hidden md:flex w-full h-32 bg-black/20 rounded-2xl items-center justify-center border border-dashed border-white/10 relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <span className="text-[10px] text-slate-500 tracking-widest uppercase">Sponsored Ad</span>
             </div>
        </div>
      </div>
    </div>
  );
};

export default App;