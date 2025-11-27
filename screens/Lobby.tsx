import React, { useState, useEffect } from 'react';
import { Users, Cpu, Play, ShoppingCart, Coins, Check, Sparkles, Globe, Loader2, Copy, Plus } from 'lucide-react';
import { DICE_SKINS } from '../constants';

interface LobbyProps {
  onStartGame: (mode: 'LOCAL' | 'AI' | 'ONLINE', players: any[], roomCode?: string) => void;
  balance: number;
  ownedSkins: string[];
  selectedSkin: string;
  onBuySkin: (skinId: string, price: number) => void;
  onEquipSkin: (skinId: string) => void;
  onOpenSettings?: () => void;
}

const Lobby: React.FC<LobbyProps> = ({ onStartGame, balance, ownedSkins, selectedSkin, onBuySkin, onEquipSkin }) => {
  const [playerName, setPlayerName] = useState('Player 1');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'LOCAL' | 'ONLINE' | 'AI'>('AI');
  const [showShop, setShowShop] = useState(false);

  // Online Simulation State
  const [onlineState, setOnlineState] = useState<'IDLE' | 'SEARCHING' | 'LOBBY'>('IDLE');
  const [onlineMessage, setOnlineMessage] = useState('');
  
  // Track specific players in the lobby
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([]);

  // Sync with LocalStorage for Local Multiplayer Simulation across tabs
  useEffect(() => {
    const handleStorageChange = () => {
        const storedRoom = localStorage.getItem('ludo_online_room');
        if (storedRoom) {
            const parsed = JSON.parse(storedRoom);
            if (parsed.code === roomCode) {
                 // Update players if code matches
                 // Merge existing with new, avoiding duplicates based on ID
                 setLobbyPlayers(parsed.players);
            }
        }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [roomCode]);

  // Update localStorage whenever lobbyPlayers changes (if we are in a room)
  useEffect(() => {
      if (roomCode && lobbyPlayers.length > 0) {
          localStorage.setItem('ludo_online_room', JSON.stringify({
              code: roomCode,
              players: lobbyPlayers
          }));
      }
  }, [lobbyPlayers, roomCode]);

  // Reset online state if switching to other modes manually
  useEffect(() => {
    if (mode !== 'ONLINE') {
        setOnlineState('IDLE');
        setLobbyPlayers([]);
        if (onlineState === 'IDLE') setRoomCode('');
    }
  }, [mode, onlineState]);

  const handleOnlineAction = (action: 'CREATE' | 'JOIN') => {
      if (action === 'JOIN' && !roomCode) return;
      
      setMode('ONLINE');
      setOnlineState('SEARCHING');
      setOnlineMessage(action === 'CREATE' ? 'Creating Room...' : 'Connecting to Room...');
      
      // Simulate Network Delay
      setTimeout(() => {
          if (action === 'CREATE') {
             const code = Math.random().toString(36).substring(2, 8).toUpperCase();
             setRoomCode(code);
             // Creator is Player 1
             const initialPlayers = [{ id: 'p1', name: playerName, isBot: false, color: 'RED' }];
             setLobbyPlayers(initialPlayers);
             
             // Initial Sync
             localStorage.setItem('ludo_online_room', JSON.stringify({ code, players: initialPlayers }));
             
          } else {
             // Joiner logic (Simulated)
             const storedRoomStr = localStorage.getItem('ludo_online_room');
             let currentPlayers = [];
             
             if (storedRoomStr) {
                 const storedRoom = JSON.parse(storedRoomStr);
                 if (storedRoom.code === roomCode) {
                     currentPlayers = storedRoom.players;
                 }
             }

             // If no local storage room found (clean simulation), mock a host
             if (currentPlayers.length === 0) {
                  currentPlayers = [{ id: 'host', name: 'Host_Player', isBot: false, color: 'RED' }];
             }
             
             // Add Self
             const myId = `p_${Date.now()}`;
             // Assign next color based on count
             const colorMap = ['RED', 'GREEN', 'YELLOW', 'BLUE'];
             const nextColor = colorMap[currentPlayers.length % 4];
             
             const newPlayer = { id: myId, name: playerName, isBot: false, color: nextColor };
             const updatedPlayers = [...currentPlayers, newPlayer];
             
             setLobbyPlayers(updatedPlayers);
             
             // Sync back
             localStorage.setItem('ludo_online_room', JSON.stringify({ code: roomCode, players: updatedPlayers }));
          }
          
          setOnlineState('LOBBY');
          setOnlineMessage('Waiting for players...');
      }, 1500);
  };

  const addParticipantToLobby = () => {
      if (lobbyPlayers.length >= 4) return;
      const botNames = ["Guest_Player", "Alex", "Jordan", "Taylor", "Casey"];
      const nextId = `guest_${Date.now()}`;
      // Ensure unique name
      let nextName = botNames[Math.floor(Math.random() * botNames.length)];
      if(lobbyPlayers.some(p => p.name === nextName)) {
           nextName += `_${Math.floor(Math.random()*10)}`;
      }
      
      const updated = [...lobbyPlayers, { id: nextId, name: nextName, isBot: false }];
      setLobbyPlayers(updated);
  };

  const copyRoomCode = () => {
      navigator.clipboard.writeText(roomCode);
      setOnlineMessage('Code Copied!');
      setTimeout(() => setOnlineMessage('Waiting for players...'), 2000);
  };

  const handleStart = () => {
    let players: any[] = [];
    if (mode === 'AI') {
        // Red (P1) -> Green (Bot) -> Yellow (Bot) -> Blue (Bot)
        players = [
            { name: playerName, isBot: false, id: 'p1' },
            { name: 'Bot Green', isBot: true, id: 'bot1' },
            { name: 'Bot Yellow', isBot: true, id: 'bot2' },
            { name: 'Bot Blue', isBot: true, id: 'bot3' },
        ];
    } else if (mode === 'LOCAL') {
        players = [
            { name: 'Red Player', isBot: false, id: 'p1' },
            { name: 'Green Player', isBot: false, id: 'p2' },
            { name: 'Yellow Player', isBot: false, id: 'p3' },
            { name: 'Blue Player', isBot: false, id: 'p4' },
        ];
    } else if (mode === 'ONLINE') {
        // Use the lobbyPlayers state
        // IMPORTANT: In this frontend-only simulation, any player that is NOT the current user
        // must be treated as a Bot so the game logic moves for them.
        players = lobbyPlayers.map(p => ({
            ...p,
            isBot: p.name !== playerName
        }));
    }
    // Pass the roomCode to the game initializer
    onStartGame(mode, players, roomCode);
  };

  return (
    // FIX: Changed min-h-[100dvh] to h-[100dvh] and added overflow-y-auto to fix mobile scrolling hang
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
        
        {/* Input */}
        <div className="mb-6">
          <label className="text-xs font-bold text-indigo-300 ml-2 uppercase tracking-wide">Player Name</label>
          <input 
            type="text" 
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full bg-black/30 text-white p-3 sm:p-4 rounded-2xl mt-2 focus:ring-2 focus:ring-purple-500 outline-none border border-white/10 transition-all placeholder:text-white/20 text-sm sm:text-base"
            placeholder="Enter nickname"
          />
        </div>

        {/* Quick Mode Selection */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <button 
                onClick={() => setMode('AI')}
                className={`relative overflow-hidden flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 ${mode === 'AI' ? 'border-purple-500 bg-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            >
                <Cpu className={`w-8 h-8 mb-2 z-10 ${mode === 'AI' ? 'text-purple-300' : 'text-slate-400'}`} />
                <span className={`font-bold z-10 ${mode === 'AI' ? 'text-white' : 'text-slate-300'}`}>Vs Bot</span>
                {mode === 'AI' && <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent"></div>}
            </button>
            <button 
                onClick={() => setMode('LOCAL')}
                className={`relative overflow-hidden flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 ${mode === 'LOCAL' ? 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            >
                <Users className={`w-8 h-8 mb-2 z-10 ${mode === 'LOCAL' ? 'text-emerald-300' : 'text-slate-400'}`} />
                <span className={`font-bold z-10 ${mode === 'LOCAL' ? 'text-white' : 'text-slate-300'}`}>Local</span>
                {mode === 'LOCAL' && <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 to-transparent"></div>}
            </button>
        </div>

        {/* Online Section */}
        <div className={`glass-card p-4 rounded-2xl mb-6 border transition-all duration-300 min-h-[160px] flex flex-col justify-center ${mode === 'ONLINE' ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-white/10 border-dashed hover:border-white/20'}`}>
            <div className="flex items-center justify-between mb-4 w-full">
                <span className={`font-bold flex items-center gap-2 ${mode === 'ONLINE' ? 'text-blue-300' : 'text-slate-400'}`}>
                    {onlineState === 'SEARCHING' || onlineState === 'LOBBY' ? <Loader2 className="animate-spin" size={16}/> : <Globe size={16}/>} 
                    Online Match
                </span>
                {onlineState === 'IDLE' && <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-1 rounded-full border border-green-500/30">Live</span>}
                {onlineState !== 'IDLE' && <span className="text-[10px] bg-blue-500 text-white px-2 py-1 rounded-full animate-pulse flex items-center gap-1">{onlineMessage}</span>}
            </div>
            
            {/* CONTENT AREA */}
            {onlineState === 'IDLE' && (
                <div className="flex gap-2 w-full animate-fadeIn">
                    <input 
                        type="text" 
                        placeholder="Enter Code" 
                        value={roomCode}
                        onChange={(e) => {
                            setRoomCode(e.target.value.toUpperCase());
                            setMode('ONLINE'); 
                        }}
                        className="flex-1 bg-black/30 p-3 rounded-xl text-sm border border-white/10 focus:border-blue-500 outline-none transition text-white placeholder:text-slate-600 uppercase font-mono w-0"
                    />
                    <button 
                        onClick={() => handleOnlineAction('JOIN')}
                        disabled={!roomCode}
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
                </div>
            )}

            {onlineState === 'SEARCHING' && (
                <div className="flex flex-col items-center justify-center py-4 space-y-3 animate-fadeIn w-full text-center">
                    <Loader2 className="animate-spin text-blue-400" size={32} />
                    <p className="text-sm text-slate-300">Establishing secure connection...</p>
                </div>
            )}

            {onlineState === 'LOBBY' && (
                <div className="flex flex-col items-center justify-center py-2 space-y-3 animate-fadeIn w-full">
                     {/* Room Code Display */}
                     {roomCode && (
                         <div className="flex flex-col items-center w-full">
                             <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-slate-400 uppercase tracking-widest">Room Code</span>
                             </div>
                             <button 
                                onClick={copyRoomCode}
                                className="flex items-center gap-3 text-2xl font-mono font-bold text-white tracking-[0.2em] bg-black/40 px-6 py-3 rounded-xl border border-white/10 hover:bg-black/60 transition group w-full justify-center"
                             >
                                 {roomCode}
                                 <Copy size={16} className="text-slate-500 group-hover:text-white transition" />
                             </button>
                         </div>
                     )}
                     
                     {/* Lobby List */}
                     <div className="w-full mt-4 space-y-2">
                         <div className="text-xs text-slate-400 flex justify-between px-1">
                             <span className="font-bold text-blue-300">Participants ({lobbyPlayers.length}/4)</span>
                             {lobbyPlayers.length < 2 && <span className="text-[10px] text-red-400 font-bold uppercase animate-pulse">Min 2 Players</span>}
                         </div>
                         
                         {/* Player Slots */}
                         <div className="space-y-2">
                             {lobbyPlayers.map((p, i) => (
                                 <div key={i} className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5">
                                     <div className="flex items-center gap-3">
                                         <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${i===0 ? 'from-red-500 to-red-700' : 'from-slate-600 to-slate-800'} flex items-center justify-center font-bold text-xs text-white`}>
                                             {p.name.charAt(0)}
                                         </div>
                                         <span className={`text-sm font-medium ${p.name === playerName ? 'text-white' : 'text-slate-300'}`}>
                                             {p.name} {p.name === playerName && '(You)'}
                                         </span>
                                     </div>
                                     <span className="text-[10px] bg-black/30 px-2 py-1 rounded-md text-slate-400 border border-white/5">
                                         {i === 0 ? 'HOST' : p.isBot ? 'BOT' : 'PLAYER'}
                                     </span>
                                 </div>
                             ))}
                             
                             {/* Empty Slots (Clickable to Add) */}
                             {Array.from({ length: 4 - lobbyPlayers.length }).map((_, i) => (
                                 <button 
                                     key={`empty-${i}`} 
                                     onClick={addParticipantToLobby}
                                     className={`w-full flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-dashed border-white/10 hover:bg-white/10 hover:border-white/30 transition group ${lobbyPlayers.length < 2 && i === 0 ? 'ring-1 ring-yellow-500/50 bg-yellow-500/10' : ''}`}
                                 >
                                     <div className="flex items-center gap-3">
                                         <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/20 transition flex items-center justify-center">
                                             <Plus size={14} className="text-slate-500 group-hover:text-white"/>
                                         </div>
                                         <span className={`text-sm italic group-hover:text-slate-300 ${lobbyPlayers.length < 2 && i === 0 ? 'text-yellow-200' : 'text-slate-500'}`}>
                                            {lobbyPlayers.length < 2 && i === 0 ? 'Add Participant (Required)' : 'Tap to add participant...'}
                                         </span>
                                     </div>
                                 </button>
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

        <button 
            onClick={handleStart}
            disabled={mode === 'ONLINE' && (lobbyPlayers.length < 2 || onlineState !== 'LOBBY')}
            className={`w-full font-extrabold text-xl py-4 rounded-2xl shadow-xl transform transition active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden group ${
                mode === 'ONLINE' && lobbyPlayers.length < 2
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:from-pink-400 hover:to-yellow-400 text-white shadow-red-900/40'
            }`}
        >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md"></div>
            <Play fill={mode === 'ONLINE' && lobbyPlayers.length < 2 ? 'gray' : 'white'} className="relative z-10" /> 
            <span className="relative z-10">
                {mode === 'ONLINE' ? (onlineState === 'IDLE' ? 'Create or Join first' : lobbyPlayers.length < 2 ? 'Add Participants' : 'START MATCH') : 'PLAY NOW'}
            </span>
        </button>
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