// ==================== ONLINE MODE INTEGRATION ====================
// Integration between Icy Tower game and Firebase Multiplayer
// ================================================================

// ==================== SCREEN REFERENCES ====================
const onlineScreen = document.getElementById('onlineScreen');
const waitingScreen = document.getElementById('waitingScreen');
const joinScreen = document.getElementById('joinScreen');
const countdownScreen = document.getElementById('countdownScreen');
const onlineGameOverScreen = document.getElementById('onlineGameOverScreen');
const leaderboardScreen = document.getElementById('leaderboardScreen');
const startScreen = document.getElementById('startScreen');

// ==================== BUTTON REFERENCES ====================
const onlineBtn = document.getElementById('onlineBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const quickMatchBtn = document.getElementById('quickMatchBtn');
const backFromOnlineBtn = document.getElementById('backFromOnlineBtn');
const readyBtn = document.getElementById('readyBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const joinConfirmBtn = document.getElementById('joinConfirmBtn');
const backFromJoinBtn = document.getElementById('backFromJoinBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');
const backFromLeaderboardBtn = document.getElementById('backFromLeaderboardBtn');

// ==================== ONLINE STATE ====================
let isOnlineMode = false;
let currentLeaderboardPeriod = 'allTime';

// ==================== SHOW ONLINE MENU ====================
function showOnlineMenu() {
    hideAllScreens();
    onlineScreen.classList.remove('hidden');
    
    // Show connection status
    const statusEl = document.getElementById('connectionStatus');
    if (MultiplayerManager.isConnected) {
        statusEl.textContent = '🟢 Connected';
        statusEl.style.color = '#4caf50';
    } else {
        statusEl.textContent = '🔴 Connecting...';
        statusEl.style.color = '#ff9800';
    }
    statusEl.classList.remove('hidden');
}

// ==================== CREATE ROOM ====================
async function createRoom() {
    try {
        const playerName = prompt('Enter your name:', 'Player 1') || 'Player 1';
        const character = window.selectedChar || 0;
        
        showLoadingMessage('Creating room...');
        
        const roomCode = await MultiplayerManager.createRoom(playerName, character);
        
        hideLoadingMessage();
        showWaitingRoom(roomCode);
        
    } catch (error) {
        hideLoadingMessage();
        alert('Failed to create room: ' + error.message);
    }
}

// ==================== JOIN ROOM ====================
function showJoinRoomScreen() {
    hideAllScreens();
    joinScreen.classList.remove('hidden');
    document.getElementById('roomCodeInput').value = '';
    document.getElementById('joinError').textContent = '';
}

async function joinRoom() {
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    const errorEl = document.getElementById('joinError');
    
    if (!roomCode || roomCode.length !== 6) {
        errorEl.textContent = 'Please enter a 6-character room code';
        return;
    }
    
    try {
        const playerName = prompt('Enter your name:', 'Player 2') || 'Player 2';
        const character = window.selectedChar || 0;
        
        showLoadingMessage('Joining room...');
        errorEl.textContent = '';
        
        await MultiplayerManager.joinRoom(roomCode, playerName, character);
        
        hideLoadingMessage();
        showWaitingRoom(roomCode);
        
    } catch (error) {
        hideLoadingMessage();
        errorEl.textContent = error.message;
    }
}

// ==================== QUICK MATCH ====================
async function quickMatch() {
    try {
        const playerName = prompt('Enter your name:', 'Player') || 'Player';
        const character = window.selectedChar || 0;
        
        showLoadingMessage('Finding match...');
        
        const result = await MultiplayerManager.quickMatch(playerName, character);
        
        hideLoadingMessage();
        showWaitingRoom(result.roomCode);
        
    } catch (error) {
        hideLoadingMessage();
        alert('Failed to find match: ' + error.message);
    }
}

// ==================== WAITING ROOM ====================
function showWaitingRoom(roomCode) {
    hideAllScreens();
    waitingScreen.classList.remove('hidden');
    
    document.getElementById('roomCodeDisplay').textContent = roomCode;
    
    // Setup multiplayer callbacks
    setupMultiplayerCallbacks();
}

function setupMultiplayerCallbacks() {
    // Player joined/left
    MultiplayerManager.onPlayersUpdate = (players) => {
        updatePlayersStatus(players);
    };
    
    // Game countdown
    MultiplayerManager.onCountdown = (count) => {
        showCountdown(count);
    };
    
    // Game start
    MultiplayerManager.onGameStart = (platformSeed) => {
        startOnlineGame(platformSeed);
    };
    
    // Opponent update
    MultiplayerManager.onOpponentUpdate = (opponentData) => {
        updateOpponent(opponentData);
    };
    
    // Game end
    MultiplayerManager.onGameEnd = (winner, winnerName) => {
        endOnlineGame(winner, winnerName);
    };
    
    // Room deleted
    MultiplayerManager.onRoomDeleted = () => {
        alert('Room was closed');
        backToMenu();
    };
}

function updatePlayersStatus(players) {
    const playerArray = Object.values(players);
    
    playerArray.forEach((player, index) => {
        const statusEl = document.getElementById(`player${index + 1}Status`);
        if (statusEl) {
            const isReady = player.ready ? '✅ Ready' : 'Waiting...';
            statusEl.textContent = `👤 ${player.name}: ${isReady}`;
            statusEl.className = player.ready ? 'player-status player-ready' : 'player-status player-waiting';
        }
    });
}

// ==================== READY BUTTON ====================
async function setReady() {
    try {
        await MultiplayerManager.setReady(true);
        readyBtn.disabled = true;
        readyBtn.textContent = '✅ READY!';
    } catch (error) {
        alert('Failed to set ready: ' + error.message);
    }
}

// ==================== LEAVE ROOM ====================
async function leaveRoom() {
    try {
        await MultiplayerManager.leaveRoom();
        backToMenu();
    } catch (error) {
        console.error('Error leaving room:', error);
        backToMenu();
    }
}

// ==================== COUNTDOWN ====================
function showCountdown(count) {
    hideAllScreens();
    countdownScreen.classList.remove('hidden');
    
    const countdownEl = document.getElementById('countdownNumber');
    
    if (count > 0) {
        countdownEl.textContent = count;
    } else {
        countdownEl.textContent = 'GO!';
    }
}

// ==================== START ONLINE GAME ====================
function startOnlineGame(platformSeed) {
    isOnlineMode = true;
    
    // Initialize seeded random for platform generation
    window.seededRandom = new SeededRandom(platformSeed);
    
    // Hide all screens
    hideAllScreens();
    
    // Start the game (call existing startGame function)
    if (typeof window.startGame === 'function') {
        window.startGame();
    }
}

// ==================== UPDATE OPPONENT ====================
function updateOpponent(opponentData) {
    // Update opponent interpolator
    OpponentInterpolator.setTarget(
        opponentData.x,
        opponentData.y,
        opponentData.vx || 0,
        opponentData.vy || 0
    );
    
    // Store opponent data for rendering
    window.opponentData = opponentData;
}

// ==================== END ONLINE GAME ====================
function endOnlineGame(winnerId, winnerName) {
    isOnlineMode = false;
    
    hideAllScreens();
    onlineGameOverScreen.classList.remove('hidden');
    
    const isWinner = winnerId === MultiplayerManager.playerId;
    
    document.getElementById('winnerTitle').textContent = isWinner ? '🎉 YOU WIN! 🎉' : '😢 YOU LOSE';
    document.getElementById('winnerText').textContent = `Winner: ${winnerName}`;
    
    // Show scores
    const myScore = window.score || 0;
    const opponentScore = window.opponentData?.score || 0;
    
    document.getElementById('myFinalScore').textContent = myScore;
    document.getElementById('opponentFinalScore').textContent = opponentScore;
}

// ==================== LEADERBOARD ====================
async function showLeaderboard() {
    hideAllScreens();
    leaderboardScreen.classList.remove('hidden');
    
    await refreshLeaderboard();
}

async function refreshLeaderboard() {
    const scoresListEl = document.getElementById('scoresList');
    scoresListEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #81d4fa;">Loading...</div>';
    
    try {
        const scores = await LeaderboardManager.getTopScores(20, currentLeaderboardPeriod);
        LeaderboardManager.displayLeaderboard(scores, scoresListEl);
    } catch (error) {
        scoresListEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error loading leaderboard</div>';
        console.error('Error loading leaderboard:', error);
    }
}

// ==================== HELPER FUNCTIONS ====================
function hideAllScreens() {
    const screens = [
        startScreen, onlineScreen, waitingScreen, joinScreen,
        countdownScreen, onlineGameOverScreen, leaderboardScreen
    ];
    
    screens.forEach(screen => {
        if (screen) screen.classList.add('hidden');
    });
}

function backToMenu() {
    isOnlineMode = false;
    window.seededRandom = null;
    
    hideAllScreens();
    startScreen.classList.remove('hidden');
    
    // Reset ready button
    if (readyBtn) {
        readyBtn.disabled = false;
        readyBtn.textContent = '✅ READY';
    }
}

let loadingOverlay = null;

function showLoadingMessage(message) {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'overlay';
        loadingOverlay.style.zIndex = '9999';
        document.body.appendChild(loadingOverlay);
    }
    
    loadingOverlay.innerHTML = `
        <div style="font-size: 14px; color: #4fc3f7; animation: pulse 1s infinite;">${message}</div>
    `;
}

function hideLoadingMessage() {
    if (loadingOverlay && loadingOverlay.parentNode) {
        loadingOverlay.parentNode.removeChild(loadingOverlay);
        loadingOverlay = null;
    }
}

// ==================== EVENT LISTENERS ====================
if (onlineBtn) onlineBtn.addEventListener('click', showOnlineMenu);
if (createRoomBtn) createRoomBtn.addEventListener('click', createRoom);
if (joinRoomBtn) joinRoomBtn.addEventListener('click', showJoinRoomScreen);
if (quickMatchBtn) quickMatchBtn.addEventListener('click', quickMatch);
if (backFromOnlineBtn) backFromOnlineBtn.addEventListener('click', backToMenu);
if (readyBtn) readyBtn.addEventListener('click', setReady);
if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', leaveRoom);
if (joinConfirmBtn) joinConfirmBtn.addEventListener('click', joinRoom);
if (backFromJoinBtn) backFromJoinBtn.addEventListener('click', showOnlineMenu);
if (playAgainBtn) playAgainBtn.addEventListener('click', () => {
    leaveRoom();
    showOnlineMenu();
});
if (backToMenuBtn) backToMenuBtn.addEventListener('click', () => {
    leaveRoom();
    backToMenu();
});
if (leaderboardBtn) leaderboardBtn.addEventListener('click', showLeaderboard);
if (refreshLeaderboardBtn) refreshLeaderboardBtn.addEventListener('click', refreshLeaderboard);
if (backFromLeaderboardBtn) backFromLeaderboardBtn.addEventListener('click', backToMenu);

// Leaderboard period selector
document.querySelectorAll('#leaderboardScreen .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#leaderboardScreen .mode-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        currentLeaderboardPeriod = btn.dataset.period;
        refreshLeaderboard();
    });
});

// Room code input - auto uppercase
const roomCodeInput = document.getElementById('roomCodeInput');
if (roomCodeInput) {
    roomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
    
    roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinRoom();
        }
    });
}

console.log('🎮 Online Integration Module Loaded!');
