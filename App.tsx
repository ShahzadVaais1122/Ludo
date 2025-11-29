import React, { useState, useEffect, useRef } from 'react';
import { GameState, GameStatus, Player, PlayerColor, Piece, Difficulty } from './types';
import Lobby from './screens/Lobby';
import Board from './components/Board';
// Dice is now used inside Board
import { canMovePiece, checkForKill, getBotMove } from './utils/gameLogic';
import { Volume2, Trophy, Coins, Home, Settings, Music, Brain, X, VolumeX } from 'lucide-react';
import { DICE_SKINS, THEMES } from './constants';

declare const Peer: any; // Global from script tag

const INITIAL_PIECES = (color: PlayerColor): Piece[] => [
  { id: 0, color, position: -1, isSafe: true },
  { id: 1, color, position: -1, isSafe: true },
  { id: 2, color, position: -1, isSafe: true },
  { id: 3, color, position: -1, isSafe: true },
];

const App: React.FC = () => {
  // Store State
  const [balance, setBalance] = useState(2500); 
  const [ownedSkins, setOwnedSkins] = useState<string[]>(['default']);
  const [selectedSkinId, setSelectedSkinId] = useState('default');
  
  // Settings State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [currentThemeId, setCurrentThemeId] = useState('classic');
  const [showSettings, setShowSettings] = useState(false);

  // NETWORKING REFS
  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null); // For Client to talk to Host
  const connectionsRef = useRef<any[]>([]); // For Host to talk to Clients
  const isHostRef = useRef<boolean>(false);

  // AUDIO REFS
  const audioContextRef = useRef<AudioContext | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null); // For Dice Roll Sound

  // ANIMATION REFS
  const moveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    status: GameStatus.LOBBY,
    roomCode: '',
    players: [],
    currentTurnIndex: 0,
    diceValue: 1,
    isDiceRolling: false,
    canRoll: false,
    winners: [],
    logs: ['Welcome to Ludo Master!'],
    waitingForMove: false,
    validMoves: [],
    consecutiveSixes: 0,
    mode: 'AI',
    myId: 'p1'
  });

  // Ref to access state in event listeners
  const gameStateRef = useRef<GameState>(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const currentTheme = THEMES.find(t => t.id === currentThemeId) || THEMES[0];

  // --- AUDIO INITIALIZATION ---
  useEffect(() => {
    // 1. Setup Audio Context for SFX
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
        audioContextRef.current = new AudioContext();

        // Generate White Noise Buffer for Dice Sounds
        const bufferSize = audioContextRef.current.sampleRate * 1.0; // 1 second buffer
        const buffer = audioContextRef.current.createBuffer(1, bufferSize, audioContextRef.current.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        noiseBufferRef.current = buffer;
    }

    // 2. Setup Background Music
    const bgAudio = new Audio('https://cdn.pixabay.com/audio/2022/11/22/audio_febc508520.mp3'); 
    bgAudio.loop = true;
    bgAudio.volume = 0.25; 
    bgMusicRef.current = bgAudio;

    // 3. Autoplay / Interaction Handler
    const tryPlayMusic = () => {
        if (musicEnabled && bgAudio.paused) {
            bgAudio.play().catch(() => {
                console.log("Waiting for user interaction to play music");
            });
        }
        
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };

    if (musicEnabled) tryPlayMusic();

    const unlockAudio = () => {
        tryPlayMusic();
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    return () => {
        bgAudio.pause();
        bgMusicRef.current = null;
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
        if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // --- MUSIC TOGGLE EFFECT ---
  useEffect(() => {
      if (!bgMusicRef.current) return;
      if (musicEnabled) {
          if (bgMusicRef.current.paused) {
              bgMusicRef.current.play().catch(() => console.warn("Interaction needed for music"));
          }
      } else {
          bgMusicRef.current.pause();
      }
  }, [musicEnabled]);

  // --- CLEANUP INTERVAL ON UNMOUNT ---
  useEffect(() => {
    return () => {
        if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
    }
  }, []);


  // --- NETWORKING FUNCTIONS ---

  const cleanupPeer = () => {
      if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
      }
      connectionsRef.current = [];
      connRef.current = null;
      isHostRef.current = false;
  };

  const syncStateToClients = (state: GameState) => {
      if (!isHostRef.current) return;
      const payload = { type: 'SYNC_STATE', state };
      connectionsRef.current.forEach(conn => {
          if (conn.open) conn.send(payload);
      });
  };

  const getPeerConfig = () => ({
    debug: 1,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ]
    }
  });

  const handleCreateOnlineGame = async (playerName: string, avatar: string) => {
      cleanupPeer();
      isHostRef.current = true;
      
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const peerId = `LUDO_PRO_${code}`; 

      return new Promise<void>((resolve, reject) => {
          const peer = new Peer(peerId, getPeerConfig());
          
          peer.on('open', (id: string) => {
              console.log('Host Open:', id);
              sessionStorage.setItem('ludo_last_room', code);

              const hostPlayer = {
                  id: `host_${Date.now()}`,
                  name: playerName,
                  isBot: false,
                  color: PlayerColor.RED,
                  pieces: INITIAL_PIECES(PlayerColor.RED),
                  avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar}`,
                  hasWon: false,
                  rank: 0,
                  diceSkin: selectedSkinId
              };
              
              peerRef.current = peer;
              
              setGameState(prev => ({
                  ...prev,
                  mode: 'ONLINE',
                  status: GameStatus.LOBBY,
                  roomCode: code,
                  myId: hostPlayer.id,
                  players: [hostPlayer],
                  logs: ['Room Created. Waiting for players...']
              }));
              resolve();
          });

          peer.on('connection', (conn: any) => {
              conn.on('data', (data: any) => {
                  if (data.type === 'JOIN_REQUEST') {
                      setGameState(currentState => {
                          if (currentState.players.length >= 4) {
                              conn.send({ type: 'ERROR', message: 'Room Full' });
                              return currentState;
                          }
                          
                          const colors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
                          const nextColor = colors[currentState.players.length];
                          
                          const newPlayer = {
                              id: data.playerId,
                              name: data.playerName,
                              isBot: false,
                              color: nextColor,
                              pieces: INITIAL_PIECES(nextColor),
                              avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.avatar}`,
                              hasWon: false,
                              rank: 0,
                              diceSkin: 'default' 
                          };
                          
                          const newPlayers = [...currentState.players, newPlayer];
                          const newState = { ...currentState, players: newPlayers };
                          
                          connectionsRef.current.push(conn);
                          
                          setTimeout(() => {
                              const payload = { type: 'SYNC_STATE', state: newState };
                              connectionsRef.current.forEach(c => c.open && c.send(payload));
                          }, 100);

                          return newState;
                      });
                  } 
                  else if (data.type === 'ACTION') {
                       handleRemoteAction(data);
                  }
              });
          });

          peer.on('error', (err: any) => {
              console.error(err);
              reject(err);
          });
      });
  };

  const handleJoinOnlineGame = async (code: string, playerName: string, avatar: string) => {
      cleanupPeer();
      isHostRef.current = false;
      const peerId = `LUDO_PRO_${code}`;

      return new Promise<boolean>((resolve, reject) => {
          const peer = new Peer(getPeerConfig()); 
          
          peer.on('open', () => {
              const conn = peer.connect(peerId);
              
              const connectionTimeout = setTimeout(() => {
                  if (!conn.open) {
                      reject(new Error("Room not found or timed out."));
                      conn.close();
                  }
              }, 10000); 

              conn.on('open', () => {
                  clearTimeout(connectionTimeout);
                  connRef.current = conn;
                  peerRef.current = peer;
                  sessionStorage.setItem('ludo_last_room', code);

                  const myId = `player_${Date.now()}`;
                  conn.send({
                      type: 'JOIN_REQUEST',
                      playerId: myId,
                      playerName: playerName,
                      avatar: avatar
                  });
                  
                  setGameState(prev => ({ ...prev, myId, mode: 'ONLINE', roomCode: code }));
                  resolve(true);
              });

              conn.on('data', (data: any) => {
                  if (data.type === 'SYNC_STATE') {
                      setGameState(prev => ({
                          ...data.state,
                          myId: prev.myId 
                      }));
                  } else if (data.type === 'ERROR') {
                      sessionStorage.removeItem('ludo_last_room');
                      reject(new Error(data.message));
                  }
              });

              conn.on('close', () => {
                  setGameState(prev => ({...prev, status: GameStatus.LOBBY, roomCode: '', players: [], logs: [...prev.logs, "Disconnected from host"]}));
              });

              conn.on('error', (err: any) => {
                  clearTimeout(connectionTimeout);
                  reject(err);
              });
          });

          peer.on('error', (err: any) => {
              if (err.type === 'peer-unavailable') {
                  reject(new Error("Room not found. Check code."));
              } else {
                  reject(err);
              }
          });
      });
  };

  const handleStartOnlineMatch = () => {
      if (!isHostRef.current) return;
      
      setGameState(prev => {
          const newState = {
              ...prev,
              status: GameStatus.PLAYING,
              canRoll: true,
              logs: [...prev.logs, "Host started the match!"]
          };
          syncStateToClients(newState);
          return newState;
      });
  };

  // --- GAME LOGIC ---

  const handleRemoteAction = (data: any) => {
      if (!isHostRef.current) return;
      
      // Use Ref for fresh state
      const currentGs = gameStateRef.current;

      if (data.action === 'ROLL') {
          handleRollDice(data.playerId, currentGs);
      } else if (data.action === 'MOVE') {
          handlePieceClick(data.pieceId, data.playerId, currentGs);
      }
  };

  const handleRollDice = (triggeringPlayerId?: string, overrideState?: GameState) => {
    // Prefer passed state (from ref) for event listeners, else current state
    const gs = overrideState || gameState;
    const currentPlayer = gs.players[gs.currentTurnIndex];
    if (!currentPlayer) return;

    // Online Client Logic
    if (gs.mode === 'ONLINE' && !isHostRef.current) {
        if (currentPlayer.id !== gs.myId) return;
        connRef.current?.send({ type: 'ACTION', action: 'ROLL', playerId: gs.myId });
        return;
    }

    // Permission Logic
    const actorId = triggeringPlayerId || gs.myId;
    
    if (gs.mode === 'LOCAL') {
        // In Local Mode (Pass & Play), ignore identity check for humans.
        // Only prevent humans from rolling if it is explicitly a Bot's turn
        if (currentPlayer.isBot) return;
    } else {
        // In AI or ONLINE mode, strict identity check
        if (currentPlayer.id !== actorId && !currentPlayer.isBot) return; 
    }

    if (!gs.canRoll || gs.isDiceRolling) return;

    const stateWithRollAnim = { ...gs, isDiceRolling: true, canRoll: false };
    setGameState(stateWithRollAnim);
    playSound('roll');
    if (isHostRef.current) syncStateToClients(stateWithRollAnim);

    setTimeout(() => {
      const rolledValue = Math.floor(Math.random() * 6) + 1;
      applyRollResult(rolledValue);
    }, 800);
  };

  const applyRollResult = (rolledValue: number) => {
      setGameState(prev => {
        const currentPlayer = prev.players[prev.currentTurnIndex];
        if (!currentPlayer) return prev; // Safety check

        let logs = [...prev.logs, `${currentPlayer.name} rolled a ${rolledValue}`];
        
        let newConsecutiveSixes = prev.consecutiveSixes;
        if (rolledValue === 6) newConsecutiveSixes += 1;
        else newConsecutiveSixes = 0;

        let newState: GameState;

        if (newConsecutiveSixes === 3) {
            logs.push(`${currentPlayer.name} rolled three 6s! Turn forfeited.`);
            newState = {
                ...prev,
                diceValue: rolledValue,
                isDiceRolling: false,
                waitingForMove: false,
                canRoll: false,
                validMoves: [],
                logs,
                consecutiveSixes: 0 
            };
        } else {
            const validPieceIds: number[] = [];
            currentPlayer.pieces.forEach(p => {
              if (canMovePiece(p, rolledValue, prev.players)) validPieceIds.push(p.id);
            });

            const canMove = validPieceIds.length > 0;
            
            if (!canMove) {
              logs.push(`No valid moves for ${currentPlayer.name}.`);
              newState = {
                ...prev,
                diceValue: rolledValue,
                isDiceRolling: false,
                waitingForMove: false,
                canRoll: rolledValue === 6, 
                logs,
                validMoves: [],
                consecutiveSixes: newConsecutiveSixes
              };
            } else {
                newState = {
                  ...prev,
                  diceValue: rolledValue,
                  isDiceRolling: false,
                  canRoll: false,
                  waitingForMove: true,
                  validMoves: validPieceIds,
                  logs,
                  consecutiveSixes: newConsecutiveSixes
                };
            }
        }
        
        if (isHostRef.current) syncStateToClients(newState);
        return newState;
    });
  }

  // Effect for Auto-Pass Turn
  useEffect(() => {
    if (gameState.mode === 'ONLINE' && !isHostRef.current) return;

    if (!gameState.isDiceRolling && !gameState.canRoll && !gameState.waitingForMove && gameState.status === GameStatus.PLAYING) {
       const timer = setTimeout(nextTurn, 1000);
       return () => clearTimeout(timer);
    }
  }, [gameState.isDiceRolling, gameState.canRoll, gameState.waitingForMove, gameState.status]);

  const handlePieceClick = (pieceId: number, triggeringPlayerId?: string, overrideState?: GameState) => {
    const gs = overrideState || gameState;
    const currentPlayer = gs.players[gs.currentTurnIndex];
    if (!currentPlayer) return;

    // Online Client Logic
    if (gs.mode === 'ONLINE' && !isHostRef.current) {
        if (currentPlayer.id !== gs.myId) return;
        connRef.current?.send({ type: 'ACTION', action: 'MOVE', pieceId, playerId: gs.myId });
        return;
    }

    // Permission Logic
    const actorId = triggeringPlayerId || gs.myId;
    
    if (gs.mode === 'LOCAL') {
         // In Local Mode (Pass & Play), humans can interact for any human player
         if (currentPlayer.isBot) return;
    } else {
         // In AI or ONLINE mode, strict identity check
         if (currentPlayer.id !== actorId && !currentPlayer.isBot) return;
    }

    if (!gs.waitingForMove) return;

    // Trigger Animation instead of instant move
    movePieceStepByStep(pieceId, gs.diceValue);
  };

  const movePieceStepByStep = (pieceId: number, totalSteps: number) => {
    // Lock UI
    setGameState(prev => ({...prev, waitingForMove: false}));
    
    const player = gameState.players[gameState.currentTurnIndex];
    if (!player) return;

    const piece = player.pieces.find(p => p.id === pieceId);
    if (!piece) return;

    // Deployment is instant (no walking animation)
    if (piece.position === -1) {
        finalizeMove(pieceId, true);
        return;
    }

    let currentSteps = 0;
    
    if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);

    moveIntervalRef.current = setInterval(() => {
        currentSteps++;
        playSound('move');
        
        setGameState(prev => {
            // Deep copy for mutation safety
            const newPlayers = prev.players.map(p => {
                if (p.id !== player.id) return p;
                return {
                    ...p,
                    pieces: p.pieces.map(pc => {
                        if (pc.id !== pieceId) return pc;
                        return { ...pc, position: pc.position + 1 };
                    })
                };
            });
            
            const newState = { ...prev, players: newPlayers };
            if (isHostRef.current) syncStateToClients(newState);
            return newState;
        });

        if (currentSteps >= totalSteps) {
            if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
            moveIntervalRef.current = null;
            // Short delay to let the final visual step settle before running game rules
            setTimeout(() => finalizeMove(pieceId, false), 250);
        }
    }, 250); // Speed of animation (matched with CSS transition)
  };

  const finalizeMove = (pieceId: number, wasDeployment: boolean) => {
    setGameState(prev => {
      const currentPlayerIndex = prev.currentTurnIndex;
      const currentPlayer = prev.players[currentPlayerIndex];
      if (!currentPlayer) return prev;

      // Deep copy needed for checkForKill mutation
      const newPlayers = JSON.parse(JSON.stringify(prev.players));
      const playerToUpdate = newPlayers[currentPlayerIndex];
      const pieceToUpdate = playerToUpdate.pieces.find((p: any) => p.id === pieceId);
      
      let newLogs = [...prev.logs];

      if (wasDeployment) {
        pieceToUpdate.position = 0; 
        newLogs.push(`${currentPlayer.name} deployed a piece!`);
        playSound('move');
      }

      // Check for Kill
      // We pass the temp state because checking for kill needs to know current board layout
      const tempStateForLogic = { ...prev, players: newPlayers };
      const { killed, logs: killLogs } = checkForKill(pieceToUpdate, tempStateForLogic, currentPlayer.id);
      newLogs = [...newLogs, ...killLogs];
      
      if (killed) {
        playSound('kill');
        if (!currentPlayer.isBot) setBalance(b => b + 100);
      } else {
        // If not a kill and not deployment, we already played step sounds. 
        // Maybe play a land sound? For now, silence is fine or reuse move.
      }

      // Win Check
      let pieceFinished = false;
      if (pieceToUpdate.position === 56 || pieceToUpdate.position === 99) {
          pieceToUpdate.position = 99;
          pieceFinished = true;
          playSound('win');
          newLogs.push(`${currentPlayer.name}'s piece reached Home!`);
          if (!currentPlayer.isBot) setBalance(b => b + 500); 
      }
      
      const allHome = playerToUpdate.pieces.every((p: any) => p.position === 99);
      let winners = [...prev.winners];
      
      if (allHome && !playerToUpdate.hasWon) {
          playerToUpdate.hasWon = true;
          playerToUpdate.rank = winners.length + 1;
          winners.push(playerToUpdate.color);
          newLogs.push(`🏆 ${currentPlayer.name} FINISHED Rank #${playerToUpdate.rank}!`);
          if (!currentPlayer.isBot) setBalance(b => b + 2000); 
      }

      const extraTurn = (prev.diceValue === 6) || killed || (pieceFinished && !allHome);
      
      const newState = {
        ...prev,
        players: newPlayers,
        waitingForMove: false,
        canRoll: extraTurn, 
        winners,
        logs: newLogs,
        validMoves: [] 
      };

      if (isHostRef.current) syncStateToClients(newState);
      return newState;
    });
  }

  const nextTurn = () => {
    setGameState(prev => {
        const totalPlayers = prev.players.length;
        if (totalPlayers === 0) return prev; // Safety

        if (prev.winners.length >= totalPlayers - 1) {
             const finishedState = { ...prev, status: GameStatus.FINISHED };
             if (isHostRef.current) syncStateToClients(finishedState);
             return finishedState;
        }

        let nextIndex = (prev.currentTurnIndex + 1) % totalPlayers;
        let loopCount = 0;
        while (prev.players[nextIndex].hasWon && loopCount < totalPlayers) {
           nextIndex = (nextIndex + 1) % totalPlayers;
           loopCount++;
        }

        const nextState = {
            ...prev,
            currentTurnIndex: nextIndex,
            canRoll: true,
            waitingForMove: false,
            diceValue: 1,
            consecutiveSixes: 0 
        };

        if (isHostRef.current) syncStateToClients(nextState);
        return nextState;
    });
  };

  // --- LOCAL INIT ---
  const initLocalGame = (mode: 'LOCAL' | 'AI' | 'ONLINE', initialPlayers: any[], roomCode?: string, myId?: string) => {
    let colors: PlayerColor[] = [];
    if (initialPlayers.length === 2) {
        colors = [PlayerColor.RED, PlayerColor.YELLOW];
    } else {
        colors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
    }
    
    const players: Player[] = initialPlayers.map((p, idx) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      color: colors[idx],
      avatarUrl: p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`,
      pieces: INITIAL_PIECES(colors[idx]),
      hasWon: false,
      rank: 0,
      diceSkin: (p.id === myId || (mode === 'LOCAL' && idx === 0)) ? selectedSkinId : (p.isBot ? ['default', 'gold', 'neon', 'ruby'][Math.floor(Math.random()*4)] : 'default')
    }));

    setGameState({
      status: GameStatus.PLAYING,
      roomCode: roomCode || '',
      players,
      currentTurnIndex: 0,
      diceValue: 1,
      isDiceRolling: false,
      canRoll: true,
      winners: [],
      logs: ['Game Started! Red to roll.'],
      waitingForMove: false,
      validMoves: [],
      consecutiveSixes: 0,
      mode: mode as any,
      myId: myId || 'p1'
    });
  };

  // --- BOT EFFECT ---
  useEffect(() => {
    if (gameState.status !== GameStatus.PLAYING) return;
    if (gameState.mode === 'ONLINE') return; 

    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    if (!currentPlayer) return;
    
    if (currentPlayer.isBot && gameState.canRoll && !gameState.isDiceRolling) {
      setTimeout(() => handleRollDice(), 1000);
    }
    
    if (currentPlayer.isBot && gameState.waitingForMove) {
       setTimeout(() => {
          const pieceId = getBotMove(gameState.diceValue, currentPlayer, gameState.players, difficulty);
          if (pieceId !== null) {
            handlePieceClick(pieceId);
          } else {
             nextTurn();
          }
       }, 1500);
    }
  }, [gameState.status, gameState.currentTurnIndex, gameState.canRoll, gameState.waitingForMove, gameState.isDiceRolling]);

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

  // Audio System
  const playSound = (type: 'roll' | 'move' | 'kill' | 'win') => {
    if (!soundEnabled) return;
    try {
        const ctx = audioContextRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const gainNode = ctx.createGain();
        gainNode.connect(ctx.destination);

        if (type === 'roll') {
            // Dice Roll: Filtered white noise for a rattle/shaker sound
            if (noiseBufferRef.current) {
                const source = ctx.createBufferSource();
                source.buffer = noiseBufferRef.current;
                
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(800, now);
                
                source.connect(filter);
                filter.connect(gainNode);
                
                // Rapid volume envelope for a "shake" burst
                gainNode.gain.setValueAtTime(0.5, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                
                source.start(now);
                source.stop(now + 0.4);
            }
        } else if (type === 'move') {
            // Move: Short, clean "Wood Block" tap
            const osc = ctx.createOscillator();
            osc.type = 'sine'; // Sine gives a rounder, wood-like tone compared to triangle
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.08); // Fast pitch drop
            
            osc.connect(gainNode);
            
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08); // Very short decay
            
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'kill') {
            // Kill: Retro "Power Down" / "Slide" sound
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth'; // Sawtooth for "buzz/video game" feel
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3); // Distinct slide down
            
            osc.connect(gainNode);
            
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
            
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'win') {
             // Win: Major Chord Fanfare (C-E-G-C)
             // Play multiple oscillators slightly staggered
             const root = 523.25; // C5
             const ratios = [1, 1.25, 1.5, 2]; // Major chord intervals
             
             ratios.forEach((ratio, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'triangle'; // Brighter than sine, softer than saw
                osc.frequency.setValueAtTime(root * ratio, now + i * 0.08); // Staggered start
                
                const noteGain = ctx.createGain();
                noteGain.gain.setValueAtTime(0, now + i * 0.08);
                noteGain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.05); // Attack
                noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 1.2); // Decay
                
                osc.connect(noteGain);
                noteGain.connect(ctx.destination);
                
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 1.2);
             });
        }
    } catch (e) { console.warn(e); }
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
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
               <div className="flex items-center gap-3">
                  {soundEnabled ? <Volume2 className="text-green-400" size={20} /> : <VolumeX className="text-slate-500" size={20} />}
                  <span className="font-bold text-slate-200">Sound Effects</span>
               </div>
               <button onClick={() => setSoundEnabled(!soundEnabled)} className={`w-12 h-6 rounded-full relative transition-colors ${soundEnabled ? 'bg-green-500' : 'bg-slate-700'}`}>
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${soundEnabled ? 'left-7' : 'left-1'}`}></div>
               </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
               <div className="flex items-center gap-3">
                  {musicEnabled ? <Music className="text-purple-400" size={20} /> : <div className="relative"><Music className="text-slate-500 opacity-50" size={20} /><div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-400 -rotate-45"></div></div>}
                  <span className="font-bold text-slate-200">Music</span>
               </div>
               <button onClick={() => setMusicEnabled(!musicEnabled)} className={`w-12 h-6 rounded-full relative transition-colors ${musicEnabled ? 'bg-purple-500' : 'bg-slate-700'}`}>
                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${musicEnabled ? 'left-7' : 'left-1'}`}></div>
               </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3 block flex items-center gap-2">
              <Brain size={14}/> Bot Difficulty
            </label>
            <div className="grid grid-cols-3 gap-2">
               {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map(d => (
                 <button key={d} onClick={() => setDifficulty(d)} className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${difficulty === d ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}>
                   {d}
                 </button>
               ))}
            </div>
          </div>
        </div>
        <button onClick={() => setShowSettings(false)} className="w-full mt-8 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition">Close</button>
      </div>
    </div>
  );

  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const currentSkinData = currentPlayer ? DICE_SKINS.find(s => s.id === currentPlayer.diceSkin) : undefined;
  
  if (gameState.status === GameStatus.LOBBY) {
    return (
      <>
        <Lobby 
            onStartGame={initLocalGame} 
            balance={balance}
            ownedSkins={ownedSkins}
            selectedSkin={selectedSkinId}
            onBuySkin={handleBuySkin}
            onEquipSkin={handleEquipSkin}
            
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}

            currentTheme={currentTheme}
            onThemeChange={setCurrentThemeId}

            isOnlineConnected={!!gameState.roomCode}
            onlineRoomCode={gameState.roomCode}
            onlinePlayers={gameState.players}
            onlineMyId={gameState.myId || ''}
            onJoinOnline={handleJoinOnlineGame}
            onCreateOnline={handleCreateOnlineGame}
            onStartOnlineMatch={handleStartOnlineMatch}
            isHost={isHostRef.current}
        />
        {showSettings && <SettingsModal />}
      </>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden relative">
       {showSettings && <SettingsModal />}
       <div className="absolute inset-0 bg-black/10 pointer-events-none z-0"></div>

      {/* Header */}
      <div className="flex items-center justify-between p-2 sm:p-4 glass-panel z-20 border-b border-white/5 relative flex-shrink-0">
        <div className="flex items-center gap-3">
           <button className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition backdrop-blur-md" 
                onClick={() => {
                   if (gameState.mode === 'ONLINE') {
                       sessionStorage.removeItem('ludo_last_room');
                       cleanupPeer();
                   }
                   setGameState(p => ({...p, status: GameStatus.LOBBY, roomCode: '', players: []}));
                }}>
              <Home size={20} className="text-white" />
           </button>
           <h1 className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-purple-400 text-base sm:text-lg hidden sm:block">LUDO MASTER</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-2 text-yellow-300 font-bold bg-black/40 border border-yellow-500/20 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full shadow-inner text-sm sm:text-base">
                <Coins size={14} className="sm:w-4 sm:h-4" fill="gold"/> {balance}
            </div>
            {gameState.mode === 'ONLINE' && (
                <div className="bg-white/5 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-mono text-indigo-200 hidden sm:block border border-white/10">
                    Room: <span className="text-white font-bold">{gameState.roomCode}</span>
                </div>
            )}
            <button onClick={() => setShowSettings(true)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white"><Settings size={20}/></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative z-10">
        
        {/* Left: Players */}
        <div className="order-3 md:order-1 w-full md:w-80 glass-panel border-r border-white/5 flex flex-col gap-3 p-3 sm:p-4 min-h-[160px] flex-shrink-0 md:flex-shrink md:h-full md:overflow-y-auto">
           <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-4">
               {gameState.players.map((p, i) => (
                 <div key={p.id} className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-2xl border transition-all duration-300 relative overflow-hidden ${gameState.currentTurnIndex === i ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border-purple-400/50' : 'bg-black/20 border-white/5 opacity-70'}`}>
                    {gameState.currentTurnIndex === i && <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-400"></div>}
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full p-0.5 bg-gradient-to-br ${p.hasWon ? 'from-yellow-400 to-yellow-600' : 'from-slate-500 to-slate-700'}`}>
                       <img src={p.avatarUrl} alt="av" className="w-full h-full rounded-full object-cover bg-slate-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`font-bold text-xs sm:text-sm truncate ${gameState.currentTurnIndex === i ? 'text-white' : 'text-slate-300'}`}>
                            {p.name} {p.id === gameState.myId && '(You)'}
                        </p>
                         <span className={`text-[10px] truncate block ${p.color === 'RED' ? 'text-red-400' : p.color === 'GREEN' ? 'text-green-400' : p.color === 'YELLOW' ? 'text-yellow-400' : 'text-blue-400'}`}>{p.color}</span>
                    </div>
                 </div>
               ))}
           </div>
           <div className="flex-1 mt-4 md:mt-auto min-h-[80px]">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2">Logs</h3>
                <div className="bg-black/30 rounded-xl p-3 h-32 md:h-auto overflow-y-auto text-xs font-mono space-y-2 border border-white/5 shadow-inner">
                    {gameState.logs.slice().reverse().map((log, i) => (
                        <div key={i} className="text-slate-300 border-l-2 border-slate-700 pl-2 py-0.5">{log}</div>
                    ))}
                </div>
           </div>
        </div>

        {/* Center: Board */}
        <div className="order-1 md:order-2 flex-1 flex items-center justify-center p-2 md:p-4 relative overflow-visible md:overflow-hidden flex-shrink-0">
             <div className="absolute w-[90%] aspect-square bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>
             <Board
                 gameState={gameState}
                 onPieceClick={(id) => handlePieceClick(id)}
                 theme={currentTheme}
                 diceValue={gameState.diceValue}
                 isDiceRolling={gameState.isDiceRolling}
                 onDiceRoll={() => handleRollDice()}
                 isDiceDisabled={
                    !gameState.canRoll ||
                    gameState.isDiceRolling ||
                    (currentPlayer && currentPlayer.isBot && gameState.status === GameStatus.PLAYING) ||
                    (gameState.mode === 'ONLINE' && currentPlayer && currentPlayer.id !== gameState.myId) ||
                    !currentPlayer
                 }
                 diceSkin={currentSkinData}
             />
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
                   <button onClick={() => { cleanupPeer(); setGameState(prev => ({...prev, status: GameStatus.LOBBY, roomCode: '', players: []})); }} className="mt-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 px-12 rounded-full hover:scale-105 transition shadow-xl shadow-indigo-900/50">
                       Back to Lobby
                   </button>
                </div>
             )}
        </div>

        {/* Right: Controls */}
        <div className="order-2 md:order-3 w-full md:w-72 glass-panel border-l border-white/5 p-4 md:p-6 flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 md:gap-6 z-20 flex-shrink-0">
             <div className="text-left md:text-center w-full">
                <p className="text-indigo-300 text-[10px] uppercase tracking-[0.2em] mb-1 font-bold">Current Turn</p>
                <h2 className="text-lg sm:text-2xl font-black drop-shadow-md tracking-wider truncate" style={{color: currentPlayer ? currentTheme.palette[currentPlayer.color] : '#fff'}}>
                    {currentPlayer ? currentPlayer.name : 'Unknown'}
                </h2>
                <div className="h-1 w-10 md:w-20 md:mx-auto mt-2 rounded-full shadow-[0_0_10px_currentColor]" style={{backgroundColor: currentPlayer ? currentTheme.palette[currentPlayer.color] : '#fff', color: currentPlayer ? currentTheme.palette[currentPlayer.color] : '#fff'}}></div>
             </div>

             {/* Moved Dice to Board Center - Placeholder or Status info */}
             <div className="flex-1 flex items-center justify-end md:justify-center w-full my-0 md:my-4">
                 <div className="text-center">
                    <p className="text-xs text-slate-400 mb-2">Game Info</p>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                        <div className="flex justify-between gap-4 text-xs font-mono">
                           <span className="text-slate-500">Mode</span>
                           <span className="text-white font-bold">{gameState.mode}</span>
                        </div>
                        {gameState.mode === 'ONLINE' && (
                           <div className="flex justify-between gap-4 text-xs font-mono mt-2">
                             <span className="text-slate-500">Host</span>
                             <span className="text-white font-bold">{isHostRef.current ? 'You' : 'Remote'}</span>
                           </div>
                        )}
                    </div>
                 </div>
             </div>
             
             <div className="hidden md:flex w-full h-32 bg-black/20 rounded-2xl items-center justify-center border border-dashed border-white/10 relative overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <span className="text-[10px] text-slate-500 tracking-widest uppercase">Ludo Master Pro</span>
             </div>
        </div>
      </div>
    </div>
  );
};

export default App;