// ==================== FIREBASE MULTIPLAYER MODULE ====================
// Icy Tower Online - Firebase Multiplayer System
// ================================================================

// Firebase Config (الكونفج بتاعك)
const firebaseConfig = {
    apiKey: "AIzaSyCcKB7mkStLNj1raHPwjS0FdCRfNO_PlCA",
    authDomain: "icy-tower-online.firebaseapp.com",
    databaseURL: "https://icy-tower-online-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "icy-tower-online",
    storageBucket: "icy-tower-online.firebasestorage.app",
    messagingSenderId: "955755565970",
    appId: "1:955755565970:web:9c08d9dd018db46617274b",
    measurementId: "G-1EFECX1BR7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// ==================== MULTIPLAYER MANAGER ====================
const MultiplayerManager = {
    // State
    currentRoom: null,
    roomCode: null,
    playerId: null,
    playerNumber: null,
    playerName: 'Player',
    isHost: false,
    opponent: null,
    gameStarted: false,
    isConnected: false,
    listeners: [],
    lastUpdateTime: 0,
    updateInterval: 100, // 10 updates per second

    // ==================== AUTHENTICATION ====================
    async signInAnonymously() {
        try {
            const result = await auth.signInAnonymously();
            this.playerId = result.user.uid;
            this.isConnected = true;
            console.log("✅ Signed in anonymously:", this.playerId);
            
            // Setup connection monitoring
            this.setupConnectionMonitoring();
            
            return this.playerId;
        } catch (error) {
            console.error("❌ Auth error:", error);
            this.isConnected = false;
            throw error;
        }
    },

    // ==================== CONNECTION MONITORING ====================
    setupConnectionMonitoring() {
        const connectedRef = database.ref('.info/connected');
        connectedRef.on('value', (snapshot) => {
            this.isConnected = snapshot.val() === true;
            if (this.onConnectionChange) {
                this.onConnectionChange(this.isConnected);
            }
            console.log(this.isConnected ? "🟢 Connected" : "🔴 Disconnected");
        });
    },

    // ==================== ROOM CODE GENERATOR ====================
    generateRoomCode() {
        // Characters that are easy to read and type (no 0/O, 1/I/L confusion)
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    // ==================== CREATE ROOM ====================
    async createRoom(playerName = 'Player 1', character = 0) {
        try {
            if (!this.playerId) await this.signInAnonymously();
            
            this.roomCode = this.generateRoomCode();
            this.isHost = true;
            this.playerNumber = 1;
            this.playerName = playerName;
            
            const roomRef = database.ref(`rooms/${this.roomCode}`);
            
            // Check if room code already exists (unlikely but possible)
            const existing = await roomRef.once('value');
            if (existing.exists()) {
                // Generate new code and try again
                return this.createRoom(playerName, character);
            }
            
            const roomData = {
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                status: 'waiting',
                hostId: this.playerId,
                players: {
                    [this.playerId]: {
                        name: playerName,
                        character: character,
                        playerNumber: 1,
                        ready: false,
                        x: 200,
                        y: 500,
                        vx: 0,
                        vy: 0,
                        score: 0,
                        floor: 0,
                        isAlive: true,
                        lastUpdate: firebase.database.ServerValue.TIMESTAMP
                    }
                },
                gameState: {
                    startTime: null,
                    platformSeed: Math.floor(Math.random() * 1000000),
                    winner: null,
                    winnerName: null
                }
            };
            
            await roomRef.set(roomData);
            this.currentRoom = roomRef;
            
            // Add to matchmaking queue
            await database.ref(`matchmaking/waiting/${this.roomCode}`).set({
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                playerCount: 1,
                hostName: playerName
            });
            
            // Cleanup on disconnect
            roomRef.child(`players/${this.playerId}`).onDisconnect().remove();
            database.ref(`matchmaking/waiting/${this.roomCode}`).onDisconnect().remove();
            
            // Setup listeners
            this.setupRoomListeners();
            
            console.log("✅ Room created:", this.roomCode);
            return this.roomCode;
            
        } catch (error) {
            console.error("❌ Create room error:", error);
            throw error;
        }
    },

    // ==================== JOIN ROOM ====================
    async joinRoom(roomCode, playerName = 'Player 2', character = 0) {
        try {
            if (!this.playerId) await this.signInAnonymously();
            
            this.roomCode = roomCode.toUpperCase().trim();
            this.playerName = playerName;
            const roomRef = database.ref(`rooms/${this.roomCode}`);
            
            // Check if room exists
            const snapshot = await roomRef.once('value');
            if (!snapshot.exists()) {
                throw new Error('الغرفة مش موجودة! Room not found');
            }
            
            const roomData = snapshot.val();
            
            // Check room status
            if (roomData.status !== 'waiting') {
                throw new Error('اللعبة بدأت خلاص! Game already started');
            }
            
            // Check if room is full
            const playerCount = Object.keys(roomData.players || {}).length;
            if (playerCount >= 2) {
                throw new Error('الغرفة مليانة! Room is full');
            }
            
            // Check if player is already in room
            if (roomData.players && roomData.players[this.playerId]) {
                throw new Error('أنت موجود في الغرفة! Already in room');
            }
            
            this.isHost = false;
            this.playerNumber = 2;
            this.currentRoom = roomRef;
            
            // Add player to room
            await roomRef.child(`players/${this.playerId}`).set({
                name: playerName,
                character: character,
                playerNumber: 2,
                ready: false,
                x: 200,
                y: 500,
                vx: 0,
                vy: 0,
                score: 0,
                floor: 0,
                isAlive: true,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
            
            // Remove from matchmaking queue
            await database.ref(`matchmaking/waiting/${this.roomCode}`).remove();
            
            // Cleanup on disconnect
            roomRef.child(`players/${this.playerId}`).onDisconnect().remove();
            
            // Setup listeners
            this.setupRoomListeners();
            
            console.log("✅ Joined room:", this.roomCode);
            return true;
            
        } catch (error) {
            console.error("❌ Join room error:", error);
            this.currentRoom = null;
            this.roomCode = null;
            throw error;
        }
    },

    // ==================== QUICK MATCH ====================
    async quickMatch(playerName = 'Player', character = 0) {
        try {
            if (!this.playerId) await this.signInAnonymously();
            
            // Look for waiting rooms
            const waitingRooms = await database.ref('matchmaking/waiting')
                .orderByChild('playerCount')
                .equalTo(1)
                .limitToFirst(1)
                .once('value');
            
            if (waitingRooms.exists()) {
                const rooms = waitingRooms.val();
                const roomCode = Object.keys(rooms)[0];
                console.log("🔍 Found waiting room:", roomCode);
                
                try {
                    await this.joinRoom(roomCode, playerName, character);
                    return { action: 'joined', roomCode: roomCode };
                } catch (e) {
                    // Room might have been taken, create new one
                    console.log("⚠️ Room taken, creating new...");
                    const newCode = await this.createRoom(playerName, character);
                    return { action: 'created', roomCode: newCode };
                }
            } else {
                console.log("🆕 No rooms available, creating new...");
                const roomCode = await this.createRoom(playerName, character);
                return { action: 'created', roomCode: roomCode };
            }
            
        } catch (error) {
            console.error("❌ Quick match error:", error);
            throw error;
        }
    },

    // ==================== ROOM LISTENERS ====================
    setupRoomListeners() {
        if (!this.currentRoom) return;
        
        // Clear existing listeners
        this.clearListeners();
        
        // Listen for player changes
        const playersRef = this.currentRoom.child('players');
        const playersListener = playersRef.on('value', (snapshot) => {
            const players = snapshot.val();
            if (!players) {
                // Room was deleted
                if (this.onRoomDeleted) {
                    this.onRoomDeleted();
                }
                return;
            }
            
            const playerList = Object.entries(players);
            
            // Find opponent
            for (const [id, data] of playerList) {
                if (id !== this.playerId) {
                    const oldOpponent = this.opponent;
                    this.opponent = { id, ...data };
                    
                    // Notify opponent update
                    if (this.onOpponentUpdate) {
                        this.onOpponentUpdate(this.opponent);
                    }
                    
                    // Notify if new player joined
                    if (!oldOpponent && this.onPlayerJoined) {
                        this.onPlayerJoined(this.opponent);
                    }
                }
            }
            
            // Check if opponent left
            if (playerList.length === 1 && this.opponent) {
                const remainingPlayer = playerList[0];
                if (remainingPlayer[0] === this.playerId) {
                    console.log("👋 Opponent left");
                    if (this.onOpponentLeft) {
                        this.onOpponentLeft();
                    }
                    this.opponent = null;
                }
            }
            
            // Update all players callback
            if (this.onPlayersUpdate) {
                this.onPlayersUpdate(players);
            }
        });
        this.listeners.push({ ref: playersRef, event: 'value', callback: playersListener });
        
        // Listen for room status changes
        const statusRef = this.currentRoom.child('status');
        const statusListener = statusRef.on('value', (snapshot) => {
            const status = snapshot.val();
            if (!status) return;
            
            console.log("📊 Room status:", status);
            
            if (this.onStatusChange) {
                this.onStatusChange(status);
            }
        });
        this.listeners.push({ ref: statusRef, event: 'value', callback: statusListener });
        
        // Listen for game state changes
        const gameStateRef = this.currentRoom.child('gameState');
        const gameStateListener = gameStateRef.on('value', (snapshot) => {
            const gameState = snapshot.val();
            if (!gameState) return;
            
            // Game started
            if (gameState.startTime && !this.gameStarted) {
                this.gameStarted = true;
                if (this.onGameStart) {
                    this.onGameStart(gameState);
                }
            }
            
            // Game ended
            if (gameState.winner) {
                if (this.onGameEnd) {
                    this.onGameEnd(gameState.winner, gameState.winnerName);
                }
            }
        });
        this.listeners.push({ ref: gameStateRef, event: 'value', callback: gameStateListener });
    },

    // ==================== CLEAR LISTENERS ====================
    clearListeners() {
        for (const { ref, event, callback } of this.listeners) {
            ref.off(event, callback);
        }
        this.listeners = [];
    },

    // ==================== PLAYER ACTIONS ====================
    async setReady(ready = true) {
        if (!this.currentRoom || !this.playerId) return;
        
        try {
            await this.currentRoom.child(`players/${this.playerId}/ready`).set(ready);
            console.log("✅ Ready status:", ready);
            
            // Check if both players ready (host only starts the countdown)
            if (this.isHost && ready) {
                const snapshot = await this.currentRoom.child('players').once('value');
                const players = snapshot.val();
                
                if (players) {
                    const playerList = Object.values(players);
                    const allReady = playerList.every(p => p.ready);
                    const enoughPlayers = playerList.length === 2;
                    
                    if (allReady && enoughPlayers) {
                        console.log("🎮 All players ready! Starting countdown...");
                        this.startCountdown();
                    }
                }
            }
        } catch (error) {
            console.error("❌ Set ready error:", error);
        }
    },

    async startCountdown() {
        if (!this.isHost || !this.currentRoom) return;
        
        try {
            await this.currentRoom.child('status').set('countdown');
            
            // Start game after 3 seconds
            setTimeout(async () => {
                if (this.currentRoom) {
                    await this.currentRoom.child('status').set('playing');
                    await this.currentRoom.child('gameState/startTime').set(
                        firebase.database.ServerValue.TIMESTAMP
                    );
                }
            }, 3000);
            
        } catch (error) {
            console.error("❌ Start countdown error:", error);
        }
    },

    // ==================== GAME SYNC ====================
    updatePosition(x, y, vx, vy, score, floor, isAlive = true) {
        if (!this.currentRoom || !this.playerId || !this.gameStarted) return;
        
        // Rate limiting
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateInterval) return;
        this.lastUpdateTime = now;
        
        // Anti-cheat: Basic validation
        const maxSpeed = 50;
        if (Math.abs(vx) > maxSpeed || Math.abs(vy) > maxSpeed * 2) {
            console.warn("⚠️ Invalid velocity detected");
            return;
        }
        
        this.currentRoom.child(`players/${this.playerId}`).update({
            x: Math.round(x),
            y: Math.round(y),
            vx: Math.round(vx * 100) / 100,
            vy: Math.round(vy * 100) / 100,
            score: Math.max(0, Math.round(score)),
            floor: Math.max(0, Math.round(floor)),
            isAlive: isAlive,
            lastUpdate: firebase.database.ServerValue.TIMESTAMP
        });
    },

    // ==================== GAME END ====================
    async setWinner(winnerId, winnerName = 'Player') {
        if (!this.currentRoom) return;
        
        try {
            await this.currentRoom.child('gameState').update({
                winner: winnerId,
                winnerName: winnerName
            });
            await this.currentRoom.child('status').set('finished');
            console.log("🏆 Winner set:", winnerName);
        } catch (error) {
            console.error("❌ Set winner error:", error);
        }
    },

    async playerDied() {
        if (!this.currentRoom || !this.playerId) return;
        
        try {
            await this.currentRoom.child(`players/${this.playerId}/isAlive`).set(false);
            
            // Opponent wins
            if (this.opponent) {
                await this.setWinner(this.opponent.id, this.opponent.name);
            }
        } catch (error) {
            console.error("❌ Player died error:", error);
        }
    },

    async iWon() {
        if (!this.currentRoom || !this.playerId) return;
        
        try {
            await this.setWinner(this.playerId, this.playerName);
        } catch (error) {
            console.error("❌ I won error:", error);
        }
    },

    // ==================== LEAVE ROOM ====================
    async leaveRoom() {
        try {
            // Clear all listeners
            this.clearListeners();
            
            if (this.currentRoom && this.playerId) {
                // Remove player from room
                await this.currentRoom.child(`players/${this.playerId}`).remove();
                
                // Check if room should be deleted
                const snapshot = await this.currentRoom.child('players').once('value');
                const players = snapshot.val();
                
                if (!players || Object.keys(players).length === 0) {
                    // Delete empty room
                    await this.currentRoom.remove();
                    await database.ref(`matchmaking/waiting/${this.roomCode}`).remove();
                    console.log("🗑️ Empty room deleted");
                }
            }
            
            // Reset state
            this.currentRoom = null;
            this.roomCode = null;
            this.opponent = null;
            this.gameStarted = false;
            this.isHost = false;
            this.playerNumber = null;
            
            console.log("👋 Left room");
            
        } catch (error) {
            console.error("❌ Leave room error:", error);
            // Reset state anyway
            this.currentRoom = null;
            this.roomCode = null;
            this.opponent = null;
            this.gameStarted = false;
        }
    },

    // ==================== GET ROOM INFO ====================
    async getRoomInfo() {
        if (!this.currentRoom) return null;
        
        try {
            const snapshot = await this.currentRoom.once('value');
            return snapshot.val();
        } catch (error) {
            console.error("❌ Get room info error:", error);
            return null;
        }
    },

    // ==================== CALLBACKS ====================
    // These should be set by the game
    onConnectionChange: null,
    onOpponentUpdate: null,
    onPlayerJoined: null,
    onOpponentLeft: null,
    onPlayersUpdate: null,
    onStatusChange: null,
    onGameStart: null,
    onGameEnd: null,
    onRoomDeleted: null
};

// ==================== OPPONENT INTERPOLATION ====================
const OpponentInterpolator = {
    targetX: 200,
    targetY: 500,
    targetVx: 0,
    targetVy: 0,
    currentX: 200,
    currentY: 500,
    smoothing: 0.15, // Interpolation factor
    
    setTarget(x, y, vx, vy) {
        this.targetX = x;
        this.targetY = y;
        this.targetVx = vx;
        this.targetVy = vy;
    },
    
    update() {
        // Smooth interpolation towards target
        this.currentX += (this.targetX - this.currentX) * this.smoothing;
        this.currentY += (this.targetY - this.currentY) * this.smoothing;
        
        // Predict position based on velocity
        this.currentX += this.targetVx * 0.016; // Assuming 60fps
        this.currentY += this.targetVy * 0.016;
        
        return {
            x: this.currentX,
            y: this.currentY
        };
    },
    
    reset() {
        this.targetX = 200;
        this.targetY = 500;
        this.targetVx = 0;
        this.targetVy = 0;
        this.currentX = 200;
        this.currentY = 500;
    }
};

// ==================== SEEDED RANDOM ====================
// For synchronized platform generation
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
    
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

// ==================== EXPORTS ====================
window.MultiplayerManager = MultiplayerManager;
window.OpponentInterpolator = OpponentInterpolator;
window.SeededRandom = SeededRandom;

console.log("🎮 Firebase Multiplayer Module Loaded!");
