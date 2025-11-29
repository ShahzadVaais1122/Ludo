import React, { useState, useEffect } from 'react';
import { Users, Cpu, Play, ShoppingCart, Coins, Check, Sparkles, Globe, Loader2, Copy, AlertCircle, Info, RefreshCw, XCircle, Brain, Palette } from 'lucide-react';
import { DICE_SKINS, THEMES } from '../constants';
import { Difficulty, Theme, PlayerColor } from '../types';

const AVATAR_SEEDS = ['Felix', 'Aneka', 'Zac', 'Milo', 'Buster', 'Bella', 'Joe', 'Lily', 'King', 'Queen'];

interface LobbyProps {
  onStartGame: (mode: 'LOCAL' | 'AI' | 'ONLINE', players: any[], roomCode?: string, myId?: string) => void;
  balance: number;
  ownedSkins: string[];
  selectedSkin: string;
  onBuySkin: (skinId: string, price: number) => void;
  onEquipSkin: (skinId: string) => void;
  
  // Difficulty Control
  difficulty: Difficulty;
  onDifficultyChange: (diff: Difficulty) => void;

  // Theme Control
  currentTheme: Theme;
  onThemeChange: (themeId: string) => void;

  // Online Props
  isOnlineConnected: boolean;
  onlineRoomCode: string;
  onlinePlayers: any[];
  onlineMyId: string;
  onJoinOnline: (code: string, name: string, avatar: string) => Promise<boolean>;
  onCreateOnline: (name: string, avatar: string) => Promise<void>;
  onStartOnlineMatch: () => void;
  isHost: boolean;
}

const Lobby: React.FC<LobbyProps> = ({ 
    onStartGame, balance, ownedSkins, selectedSkin, onBuySkin, onEquipSkin,
    difficulty, onDifficultyChange,
    currentTheme, onThemeChange,
    isOnlineConnected, onlineRoomCode, onlinePlayers, onlineMyId, onJoinOnline, onCreateOnline, onStartOnlineMatch, isHost
}) => {
  const [playerName, setPlayerName] = useState(() => sessionStorage.getItem('ludo_player_name') || 'Player 1');
  const [selectedAvatar, setSelectedAvatar] = useState(() => sessionStorage.getItem('ludo_player_avatar') || AVATAR_SEEDS[0]);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [mode, setMode] = useState<'LOCAL' | 'ONLINE' | 'AI'>(() => (sessionStorage.getItem('ludo_mode') as any) || 'AI');
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);

  const [showShop, setShowShop] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAutoRejoining, setIsAutoRejoining] = useState(false);

  // Persist Data
  useEffect(() => {
      sessionStorage.setItem('ludo_player_name', playerName);
      sessionStorage.setItem('ludo_player_avatar', selectedAvatar);
  }, [playerName, selectedAvatar]);

  // Sync mode if online is active
  useEffect(() => {
      if (isOnlineConnected) {
          setMode('ONLINE');
          setIsAutoRejoining(false);
      }
  }, [isOnlineConnected]);

  // Auto-Rejoin Logic
  useEffect(() => {
      const lastRoom = sessionStorage.getItem('ludo_last_room');
      // Attempt rejoin if we have a room, we aren't connected, we aren't already processing, and we aren't the host (host code is ephemeral unless stored specifically)
      if (lastRoom && !isOnlineConnected && !isProcessing && !isHost) {
          handleAutoRejoin(lastRoom);
      }
  }, []);

  const handleAutoRejoin = async (code: string) => {
      setIsAutoRejoining(true);
      setIsProcessing(true);
      setMode('ONLINE');
      try {
          // Add a small delay for UX so user sees what's happening
          await new Promise(r => setTimeout(r, 1000));
          await onJoinOnline(code, playerName, selectedAvatar);
      } catch (e) {
          sessionStorage.removeItem('ludo_last_room');
          setErrorMessage("Could not rejoin previous session");
          setIsAutoRejoining(false);
          // Wait to clear error
          setTimeout(() => setErrorMessage(''), 4000);
      } finally {
          setIsProcessing(false);
      }
  };

  const cancelAutoRejoin = () => {
      sessionStorage.removeItem('ludo_last_room');
      setIsAutoRejoining(false);
      setIsProcessing(false);
      window.location.reload(); // Hard reset to clear any pending peer connections
  };

  const handleOnlineAction = async (action: 'CREATE' | 'JOIN') => {
      if (!playerName.trim()) {
          setErrorMessage('Please enter a name');
          setTimeout(() => setErrorMessage(''), 3000);
          return;
      }

      setIsProcessing(true);
      setErrorMessage('');

      try {
          if (action === 'CREATE') {
              await onCreateOnline(playerName, selectedAvatar);
          } else {
              if (!roomCodeInput.trim()) {
                  throw new Error('Enter Room Code');
              }
              const success = await onJoinOnline(roomCodeInput.toUpperCase().trim(), playerName, selectedAvatar);
              if (!success) {
                  throw new Error('Room not found or connection failed');
              }
          }
      } catch (err: any) {
          setErrorMessage(err.message || 'Connection Failed');
          setTimeout(() => setErrorMessage(''), 4000);
      } finally {
          setIsProcessing(false);
      }
  };

  const copyRoomCode = () => {
      navigator.clipboard.writeText(onlineRoomCode);
      setErrorMessage('Code Copied!'); // Using error message slot for success toast temporarily
      setTimeout(() => setErrorMessage(''), 2000);
  };

  const handleStartLocal = () => {
    let players: any[] = [];
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAvatar}`;
    
    if (mode === 'AI') {
        players.push({ name: playerName, isBot: false, id: 'p1', avatar: avatarUrl });
        if (playerCount === 2) {
            players.push({ name: 'Bot Yellow', isBot: true, id: 'bot1' });
        } else {
            players.push({ name: 'Bot Green', isBot: true, id: 'bot1' });
            players.push({ name: 'Bot Yellow', isBot: true, id: 'bot2' });
            if (playerCount === 4) players.push({ name: 'Bot Blue', isBot: true, id: 'bot3' });
        }
        onStartGame('AI', players, undefined, 'p1');
    } else if (mode === 'LOCAL') {
        players.push({ name: playerName || 'Player 1', isBot: false, id: 'p1', avatar: avatarUrl });
        players.push({ name: 'Player 2', isBot: false, id: 'p2' });
        if (playerCount >= 3) players.push({ name: 'Player 3', isBot: false, id: 'p3' });
        if (playerCount === 4) players.push({ name: 'Player 4', isBot: false, id: 'p4' });
        onStartGame('LOCAL', players, undefined, 'p1');
    }
  };

  return (
    <div className="flex flex-col items-center h-[100dvh] w-full relative p-4 sm:p-6 overflow-y-auto overflow-x-hidden">
      
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-md w-full glass-panel rounded-3xl p-5 sm:p-8 shadow-2xl relative animate-[fadeIn_0.5s_ease-out] my-auto flex-shrink-0">
        
        {/* Header with Balance */}
        <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-500 to-purple-500 drop-shadow-sm">
                    LUDO MASTER
                </h1>
                <span className="text-xs text-indigo-200 tracking-widest uppercase opacity-70">Royal Edition</span>
            </div>
            
            <div 
                className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-yellow-500/30 cursor-pointer hover:bg-black/60 transition shadow-lg shadow-yellow-500/10"
                onClick={() => setShowShop(true)}
            >
                <Coins className="text-yellow-400 w-4 h-4" fill="gold" />
                <span className="font-mono font-bold text-yellow-100">{balance}</span>
            </div>
        </div>

        {isAutoRejoining ? (
            <div className="flex flex-col items-center justify-center py-10 animate-fadeIn relative">
                 <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                 <h2 className="text-xl font-bold text-white mb-1">Connection Dropped</h2>
                 <p className="text-sm text-blue-300 mb-6 flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Attempting to rejoin previous room...
                 </p>
                 <button 
                    onClick={cancelAutoRejoin}
                    className="flex items-center gap-2 px-6 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-full text-sm font-bold border border-red-500/30 transition"
                 >
                    <XCircle size={16} /> Cancel
                 </button>
            </div>
        ) : (
            <>
                {/* Input */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-indigo-300 ml-2 uppercase tracking-wide">Player Name</label>
                  <input 
                    type="text" 
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    disabled={isOnlineConnected}
                    className="w-full bg-black/30 text-white p-3 sm:p-4 rounded-2xl mt-2 focus:ring-2 focus:ring-purple-500 outline-none border border-white/10 transition-all placeholder:text-white/20 text-sm sm:text-base disabled:opacity-50"
                    placeholder="Enter nickname"
                  />
                </div>

                {/* Avatar Selector */}
                {!isOnlineConnected && (
                    <div className="mb-6">
                        <label className="text-xs font-bold text-indigo-300 ml-2 uppercase tracking-wide">Select Avatar</label>
                        <div className="flex gap-3 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide mask-image-fade">
                            {AVATAR_SEEDS.map(seed => (
                            <button 
                                key={seed}
                                onClick={() => setSelectedAvatar(seed)}
                                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 transition-all flex-shrink-0 ${selectedAvatar === seed ? 'border-yellow-400 scale-110 shadow-lg shadow-yellow-500/50 z-10' : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100 grayscale hover:grayscale-0'}`}
                            >
                                <img 
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} 
                                    alt={seed}
                                    className="w-full h-full rounded-full bg-slate-800" 
                                />
                                {selectedAvatar === seed && (
                                    <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black rounded-full p-0.5 border border-black">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                )}
                            </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Theme Selector */}
                {!isOnlineConnected && (
                    <div className="mb-6">
                        <label className="text-xs font-bold text-indigo-300 ml-2 uppercase tracking-wide flex items-center gap-1"><Palette size={12}/> Board Theme</label>
                        <div className="flex gap-3 overflow-x-auto pb-2 pt-2 px-1 scrollbar-hide">
                            {THEMES.map(theme => {
                                const isSelected = currentTheme.id === theme.id;
                                return (
                                    <button
                                        key={theme.id}
                                        onClick={() => onThemeChange(theme.id)}
                                        className={`flex flex-col items-center gap-2 min-w-[80px] p-2 rounded-xl transition-all border ${isSelected ? 'bg-white/10 border-indigo-400 scale-105' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
                                    >
                                        <div 
                                            className="w-12 h-12 rounded-lg shadow-inner flex flex-wrap p-1 gap-0.5 justify-center content-center border"
                                            style={{ backgroundColor: theme.boardBaseColor, borderColor: theme.borderColor }}
                                        >
                                            {/* Mini Preview of Colors */}
                                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: theme.palette[PlayerColor.RED]}}></div>
                                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: theme.palette[PlayerColor.GREEN]}}></div>
                                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: theme.palette[PlayerColor.BLUE]}}></div>
                                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: theme.palette[PlayerColor.YELLOW]}}></div>
                                        </div>
                                        <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>{theme.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Quick Mode Selection */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                    <button 
                        onClick={() => { if(!isOnlineConnected) { setMode('AI'); sessionStorage.setItem('ludo_mode', 'AI'); } }}
                        disabled={isOnlineConnected}
                        className={`relative overflow-hidden flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 ${mode === 'AI' ? 'border-purple-500 bg-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-white/5 hover:bg-white/10'} ${isOnlineConnected ? 'opacity-30 grayscale' : ''}`}
                    >
                        <Cpu className={`w-8 h-8 mb-2 z-10 ${mode === 'AI' ? 'text-purple-300' : 'text-slate-400'}`} />
                        <span className={`font-bold z-10 ${mode === 'AI' ? 'text-white' : 'text-slate-300'}`}>Vs Bot</span>
                    </button>
                    <button 
                        onClick={() => { if(!isOnlineConnected) { setMode('LOCAL'); sessionStorage.setItem('ludo_mode', 'LOCAL'); } }}
                        disabled={isOnlineConnected}
                        className={`relative overflow-hidden flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 ${mode === 'LOCAL' ? 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-white/10 bg-white/5 hover:bg-white/10'} ${isOnlineConnected ? 'opacity-30 grayscale' : ''}`}
                    >
                        <Users className={`w-8 h-8 mb-2 z-10 ${mode === 'LOCAL' ? 'text-emerald-300' : 'text-slate-400'}`} />
                        <span className={`font-bold z-10 ${mode === 'LOCAL' ? 'text-white' : 'text-slate-300'}`}>Local</span>
                    </button>
                </div>

                {/* Player Count Selection (Visible for AI & LOCAL) */}
                {!isOnlineConnected && (mode === 'AI' || mode === 'LOCAL') && (
                    <div className="mb-6 animate-fadeIn">
                        <label className="text-xs font-bold text-indigo-300 ml-2 uppercase tracking-wide">Number of Players</label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            {[2, 3, 4].map((count) => (
                                <button
                                    key={count}
                                    onClick={() => setPlayerCount(count as 2|3|4)}
                                    className={`p-3 rounded-xl font-bold text-sm transition border ${playerCount === count ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30' : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                >
                                    {count} Players
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Difficulty Selection - Only for AI */}
                {!isOnlineConnected && mode === 'AI' && (
                    <div className="mb-6 animate-fadeIn">
                        <label className="text-xs font-bold text-indigo-300 ml-2 uppercase tracking-wide flex items-center gap-1"><Brain size={12}/> Bot Difficulty</label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => onDifficultyChange(d)}
                                    className={`p-3 rounded-xl font-bold text-sm transition border uppercase ${difficulty === d ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-500/30' : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Online Section */}
                <div className={`glass-card p-4 rounded-2xl mb-6 border transition-all duration-300 min-h-[160px] flex flex-col justify-center ${mode === 'ONLINE' ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-white/10 border-dashed hover:border-white/20'}`}>
                    <div className="flex items-center justify-between mb-4 w-full">
                        <span className={`font-bold flex items-center gap-2 ${mode === 'ONLINE' ? 'text-blue-300' : 'text-slate-400'}`}>
                            {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <Globe size={16}/>} 
                            Online Match
                        </span>
                        
                        {errorMessage && (
                            <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-1 rounded-full border border-red-500/30 animate-pulse flex items-center gap-1">
                                <AlertCircle size={10}/> {errorMessage}
                            </span>
                        )}
                    </div>
                    
                    {/* IDLE STATE: Input & Buttons */}
                    {!isOnlineConnected && (
                        <div className="flex gap-2 w-full animate-fadeIn relative">
                            {isProcessing ? (
                                <div className="w-full flex flex-col items-center py-4 text-blue-300 gap-2">
                                    <Loader2 className="animate-spin" size={24}/>
                                    <span className="text-xs">Connecting to Network...</span>
                                </div>
                            ) : (
                                <>
                                    <input 
                                        type="text" 
                                        placeholder="ROOM CODE" 
                                        value={roomCodeInput}
                                        onChange={(e) => {
                                            setRoomCodeInput(e.target.value.toUpperCase());
                                            setMode('ONLINE');
                                        }}
                                        className="flex-1 bg-black/30 p-3 rounded-xl text-sm border border-white/10 focus:border-blue-500 outline-none transition text-white placeholder:text-slate-600 uppercase font-mono w-0"
                                    />
                                    <button 
                                        onClick={() => handleOnlineAction('JOIN')}
                                        disabled={!roomCodeInput}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 rounded-xl font-bold text-sm transition shadow-lg shadow-blue-900/20 whitespace-nowrap"
                                    >
                                        Join
                                    </button>
                                    <button 
                                        onClick={() => handleOnlineAction('CREATE')}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-xl font-bold text-sm transition shadow-lg shadow-purple-900/20 whitespace-nowrap"
                                    >
                                        Create
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* CONNECTED STATE: Lobby List */}
                    {isOnlineConnected && (
                        <div className="flex flex-col items-center justify-center py-2 space-y-3 animate-fadeIn w-full">
                            {/* Room Code Display */}
                            <div className="flex flex-col items-center w-full">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-slate-400 uppercase tracking-widest">Room Code</span>
                                </div>
                                <button 
                                    onClick={copyRoomCode}
                                    className="flex items-center gap-3 text-2xl font-mono font-bold text-white tracking-[0.2em] bg-black/40 px-6 py-3 rounded-xl border border-white/10 hover:bg-black/60 transition group w-full justify-center"
                                >
                                    {onlineRoomCode}
                                    <Copy size={16} className="text-slate-500 group-hover:text-white transition" />
                                </button>
                                <div className="flex items-center gap-1 mt-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                    <Info size={10} className="text-yellow-400" />
                                    <p className="text-[9px] text-slate-300">Share code with friends on ANY device.</p>
                                </div>
                            </div>
                            
                            {/* Lobby List */}
                            <div className="w-full mt-4 space-y-2">
                                <div className="text-xs text-slate-400 flex justify-between px-1">
                                    <span className="font-bold text-blue-300">Participants ({onlinePlayers.length}/4)</span>
                                    {onlinePlayers.length < 2 && <span className="text-[10px] text-red-400 font-bold uppercase animate-pulse">Min 2 Players</span>}
                                </div>
                                
                                {/* Player Slots */}
                                <div className="space-y-2">
                                    {onlinePlayers.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/20">
                                                    <img src={p.avatarUrl} alt="av" className="w-full h-full rounded-full" />
                                                </div>
                                                <span className={`text-sm font-medium ${p.id === onlineMyId ? 'text-white' : 'text-slate-300'}`}>
                                                    {p.name} {p.id === onlineMyId && '(You)'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] bg-black/30 px-2 py-1 rounded-md text-slate-400 border border-white/5">
                                                {i === 0 ? 'HOST' : 'PLAYER'}
                                            </span>
                                        </div>
                                    ))}
                                    
                                    {/* Empty Slots */}
                                    {[...Array(4 - onlinePlayers.length)].map((_, i) => (
                                        <div key={`empty-${i}`} className="flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-white/5 opacity-50">
                                            <div className="w-8 h-8 rounded-full bg-white/5"></div>
                                            <span className="text-xs text-slate-600 italic">Waiting...</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Shop Button */}
                <button 
                    onClick={() => setShowShop(true)}
                    className="w-full mb-6 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 hover:from-indigo-800/50 hover:to-purple-800/50 text-indigo-100 font-bold py-3 px-4 rounded-xl border border-indigo-500/30 flex items-center justify-center gap-2 transition group"
                >
                    <ShoppingCart className="text-purple-300 group-hover:scale-110 transition-transform" size={18} /> 
                    <span>Dice Store</span>
                </button>

                {/* Start Game Button Area */}
                {isOnlineConnected ? (
                    isHost ? (
                        <button 
                            onClick={onStartOnlineMatch}
                            disabled={onlinePlayers.length < 2}
                            className={`w-full font-extrabold text-xl py-4 rounded-2xl shadow-xl transform transition active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden group ${
                                onlinePlayers.length < 2
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none'
                                : 'bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:from-pink-400 hover:to-yellow-400 text-white shadow-red-900/40'
                            }`}
                        >
                            <Play fill={onlinePlayers.length < 2 ? 'gray' : 'white'} className="relative z-10" /> 
                            <span className="relative z-10">START ONLINE MATCH</span>
                        </button>
                    ) : (
                        <div className="w-full bg-slate-800 text-slate-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 animate-pulse border border-white/10 shadow-inner">
                            <Loader2 className="animate-spin" /> Waiting for Host to Start...
                        </div>
                    )
                ) : (
                    <button 
                        onClick={handleStartLocal}
                        disabled={mode === 'ONLINE'} // Should have connected first
                        className={`w-full font-extrabold text-xl py-4 rounded-2xl shadow-xl transform transition active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden group bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-green-900/40`}
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md"></div>
                        <Play fill="white" className="relative z-10" /> 
                        <span className="relative z-10">PLAY {mode === 'AI' ? 'VS BOT' : 'LOCAL'}</span>
                    </button>
                )}
            </>
        )}

      </div>

      {/* Shop Modal */}
      {showShop && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-end md:items-center justify-center p-4 animate-[fadeIn_0.2s] fixed">
           <div className="bg-[#0f172a] w-full max-w-md rounded-3xl p-6 border border-white/10 max-h-[85vh] overflow-y-auto shadow-2xl relative">
               
               {/* Modal Header */}
               <div className="flex justify-between items-center mb-6 sticky top-0 bg-[#0f172a] z-10 pb-4 border-b border-white/5">
                   <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                       <ShoppingCart className="text-purple-400"/> Dice Shop
                   </h2>
                   <button onClick={() => setShowShop(false)} className="bg-white/5 hover:bg-white/10 p-2 rounded-full transition text-white">&times;</button>
               </div>
               
               <div className="mb-6 bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl flex justify-between items-center border border-white/5 shadow-inner">
                   <span className="text-slate-400 text-sm font-medium">Your Balance</span>
                   <span className="text-yellow-400 font-bold text-xl flex items-center gap-2"><Coins size={20} fill="gold"/> {balance}</span>
               </div>

               <div className="space-y-4">
                   {DICE_SKINS.map((skin) => {
                       const isOwned = ownedSkins.includes(skin.id);
                       const isSelected = selectedSkin === skin.id;
                       const canAfford = balance >= skin.price;

                       return (
                           <div key={skin.id} className={`p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden ${isSelected ? 'border-green-500/50 bg-green-500/5' : 'border-white/5 bg-white/5'}`}>
                               <div className="flex items-center gap-4 relative z-10">
                                   <div className={`w-14 h-14 rounded-xl shadow-lg flex items-center justify-center transform group-hover:scale-105 transition ${skin.colorClass}`}>
                                       {/* Mini dice preview */}
                                       <div className={`w-3 h-3 rounded-full ${skin.dotClass}`}></div>
                                   </div>
                                   <div>
                                       <h3 className="font-bold text-white text-lg">{skin.name}</h3>
                                       <p className="text-xs text-slate-400">{skin.description}</p>
                                   </div>
                               </div>
                               
                               <div className="flex flex-col items-end mt-4 sm:mt-0 sm:absolute sm:right-4 sm:top-1/2 sm:-translate-y-1/2 z-10">
                                   {isOwned ? (
                                       <button 
                                           onClick={() => onEquipSkin(skin.id)}
                                           disabled={isSelected}
                                           className={`px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-lg ${isSelected ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                                       >
                                           {isSelected ? <span className="flex items-center gap-1"><Check size={14}/> Active</span> : 'Equip'}
                                       </button>
                                   ) : (
                                       <button 
                                            onClick={() => onBuySkin(skin.id, skin.price)}
                                            disabled={!canAfford}
                                            className={`px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-1 transition-all shadow-lg ${canAfford ? 'bg-yellow-400 hover:bg-yellow-300 text-black shadow-yellow-400/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'}`}
                                       >
                                            {skin.price > 0 ? <><Coins size={14}/> {skin.price}</> : 'Free'}
                                       </button>
                                   )}
                               </div>
                               {/* Decor */}
                               {isSelected && <Sparkles className="absolute top-2 right-2 text-green-500/20 w-24 h-24 -rotate-12" />}
                           </div>
                       );
                   })}
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;