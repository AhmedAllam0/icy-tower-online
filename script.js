// ==================== ICY TOWER - MAIN GAME ====================
// الرجل النطاط - اللعبة الرئيسية
// ================================================================

// ==================== CANVAS SETUP ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Canvas dimensions
let W = canvas.width;
let H = canvas.height;

// ==================== GAME CONSTANTS ====================
const GRAVITY = 0.6;
const JUMP_FORCE = -15;
const SUPER_JUMP_FORCE = -22;
const MOVE_SPEED = 6;
const MAX_FALL_SPEED = 15;
const PLATFORM_HEIGHT = 15;
const PLAYER_WIDTH = 35;
const PLAYER_HEIGHT = 45;
const FLOOR_HEIGHT = 80;
const COMBO_TIME = 1500; // ms to maintain combo

// ==================== GAME STATE ====================
let gameState = 'menu'; // menu, playing, paused, gameover
let isOnlineMode = false;
let score = 0;
let floor = 0;
let highScore = localStorage.getItem('icyTowerHighScore') || 0;
let combo = 0;
let lastPlatformTime = 0;
let cameraY = 0;
let targetCameraY = 0;
let gameStartTime = 0;
let selectedChar = 0;
let soundEnabled = true;
let lastTime = 0;
let platformSeed = null;
let seededRandom = null;

// ==================== PLAYER ====================
const player = {
    x: 200,
    y: 500,
    vx: 0,
    vy: 0,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    isJumping: false,
    onGround: false,
    direction: 1, // 1 = right, -1 = left
    jumpHeld: false,
    isAlive: true
};

// ==================== PLATFORMS ====================
let platforms = [];
const platformColors = [
    '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784', 
    '#aed581', '#dce775', '#fff176', '#ffd54f'
];

// ==================== CHARACTERS ====================
const characters = [
    { emoji: '🧑', color: '#ffcc80', name: 'Boy' },
    { emoji: '👨', color: '#a1887f', name: 'Man' },
    { emoji: '👩', color: '#f48fb1', name: 'Girl' },
    { emoji: '🤖', color: '#90a4ae', name: 'Robot' }
];

// ==================== DOM ELEMENTS ====================
const startScreen = document.getElementById('startScreen');
const onlineScreen = document.getElementById('onlineScreen');
const waitingScreen = document.getElementById('waitingScreen');
const joinScreen = document.getElementById('joinScreen');
const countdownScreen = document.getElementById('countdownScreen');
const howToPlayScreen = document.getElementById('howToPlayScreen');
const highScoresScreen = document.getElementById('highScoresScreen');
const pauseScreen = document.getElementById('pauseScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const onlineGameOverScreen = document.getElementById('onlineGameOverScreen');
const hudElement = document.getElementById('hud');
const onlineHud = document.getElementById('onlineHud');
const powerupBar = document.getElementById('powerupBar');
const pauseBtn = document.getElementById('pauseBtn');
const soundBtn = document.getElementById('soundBtn');
const mobileControls = document.getElementById('mobileControls');
const connectionStatus = document.getElementById('connectionStatus');

// ==================== OPPONENT (ONLINE MODE) ====================
let opponentData = {
    x: 200,
    y: 500,
    vx: 0,
    vy: 0,
    score: 0,
    floor: 0,
    isAlive: true,
    character: 0
};

// ==================== CONTROLS ====================
const keys = {
    left: false,
    right: false,
    up: false,
    space: false
};

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = true;
    if (e.key === ' ') {
        keys.space = true;
        e.preventDefault();
    }
    if (e.key === 'Escape') {
        if (gameState === 'playing') togglePause();
        else if (gameState === 'paused') resumeGame();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
    if (e.key === ' ') keys.space = false;
});

// ==================== MOBILE DETECTION ====================
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
}

// ==================== MOBILE CONTROLS ====================
if (isMobile()) {
    mobileControls.classList.remove('hidden');
    
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const jumpBtn = document.getElementById('jumpBtn');
    
    // Touch events for left button
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.left = true;
    });
    leftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.left = false;
    });
    
    // Touch events for right button
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.right = true;
    });
    rightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.right = false;
    });
    
    // Touch events for jump button
    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.up = true;
        keys.space = true;
    });
    jumpBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.up = false;
        keys.space = false;
    });
}

// ==================== CHARACTER SELECTION ====================
document.querySelectorAll('.char-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.char-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        selectedChar = parseInt(option.dataset.char);
    });
});

// ==================== PLATFORM GENERATION ====================
function generatePlatform(y, index) {
    let x, width;
    
    if (seededRandom) {
        // Online mode: use seeded random
        width = seededRandom.nextInt(80, 150);
        x = seededRandom.nextInt(10, W - width - 10);
    } else {
        // Offline mode: regular random
        width = Math.random() * 70 + 80;
        x = Math.random() * (W - width - 20) + 10;
    }
    
    // Make platforms narrower as you go higher
    const difficultyFactor = Math.max(0.5, 1 - (index * 0.005));
    width *= difficultyFactor;
    width = Math.max(60, width);
    
    return {
        x: x,
        y: y,
        width: width,
        height: PLATFORM_HEIGHT,
        color: platformColors[index % platformColors.length],
        index: index
    };
}

function initializePlatforms() {
    platforms = [];
    
    // Ground platform
    platforms.push({
        x: 0,
        y: H - 30,
        width: W,
        height: 30,
        color: '#5d4037',
        index: 0,
        isGround: true
    });
    
    // Generate initial platforms
    for (let i = 1; i <= 20; i++) {
        const y = H - 30 - (i * FLOOR_HEIGHT);
        platforms.push(generatePlatform(y, i));
    }
}

function updatePlatforms() {
    // Add new platforms above
    const highestPlatform = Math.min(...platforms.map(p => p.y));
    const screenTop = -cameraY - 200;
    
    while (highestPlatform > screenTop) {
        const newIndex = platforms.length;
        const newY = highestPlatform - FLOOR_HEIGHT;
        platforms.push(generatePlatform(newY, newIndex));
        break;
    }
    
    // Remove platforms that are too far below
    const screenBottom = -cameraY + H + 200;
    platforms = platforms.filter(p => p.y < screenBottom || p.isGround);
}

// ==================== PLAYER PHYSICS ====================
function updatePlayer() {
    if (gameState !== 'playing' || !player.isAlive) return;
    
    // Horizontal movement
    if (keys.left) {
        player.vx = -MOVE_SPEED;
        player.direction = -1;
    } else if (keys.right) {
        player.vx = MOVE_SPEED;
        player.direction = 1;
    } else {
        player.vx *= 0.8; // Friction
        if (Math.abs(player.vx) < 0.1) player.vx = 0;
    }
    
    // Jump
    if ((keys.up || keys.space) && player.onGround && !player.jumpHeld) {
        // Super jump if combo is high
        if (combo >= 3) {
            player.vy = SUPER_JUMP_FORCE;
        } else {
            player.vy = JUMP_FORCE;
        }
        player.isJumping = true;
        player.onGround = false;
        player.jumpHeld = true;
    }
    
    if (!keys.up && !keys.space) {
        player.jumpHeld = false;
    }
    
    // Apply gravity
    player.vy += GRAVITY;
    if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;
    
    // Update position
    player.x += player.vx;
    player.y += player.vy;
    
    // Wall collision (wrap around)
    if (player.x < -player.width) {
        player.x = W;
    } else if (player.x > W) {
        player.x = -player.width;
    }
    
    // Platform collision
    player.onGround = false;
    
    for (const platform of platforms) {
        if (checkPlatformCollision(player, platform)) {
            if (player.vy > 0) {
                player.y = platform.y - player.height;
                player.vy = 0;
                player.onGround = true;
                player.isJumping = false;
                
                // Update score and combo
                if (!platform.isGround && platform.index > floor) {
                    const floorsClimbed = platform.index - floor;
                    floor = platform.index;
                    
                    // Combo system
                    const now = Date.now();
                    if (now - lastPlatformTime < COMBO_TIME) {
                        combo += floorsClimbed;
                    } else {
                        combo = floorsClimbed;
                    }
                    lastPlatformTime = now;
                    
                    // Score calculation
                    const comboBonus = Math.min(combo, 10);
                    score += floorsClimbed * 10 * (1 + comboBonus * 0.5);
                    
                    updateHUD();
                }
            }
        }
    }
    
    // Check if player fell off screen (game over)
    const deathLine = -cameraY + H + 50;
    if (player.y > deathLine) {
        if (isOnlineMode) {
            player.isAlive = false;
            MultiplayerManager.playerDied();
        } else {
            gameOver();
        }
    }
    
    // Sync position in online mode
    if (isOnlineMode && player.isAlive) {
        MultiplayerManager.updatePosition(
            player.x, player.y,
            player.vx, player.vy,
            score, floor,
            player.isAlive
        );
    }
}

function checkPlatformCollision(player, platform) {
    const playerBottom = player.y + player.height;
    const playerRight = player.x + player.width;
    const platformBottom = platform.y + platform.height;
    
    return (
        player.x < platform.x + platform.width &&
        playerRight > platform.x &&
        playerBottom >= platform.y &&
        playerBottom <= platform.y + 20 &&
        player.vy >= 0
    );
}

// ==================== CAMERA ====================
function updateCamera() {
    // Camera follows player
    const targetY = player.y - H * 0.6;
    
    if (targetY < targetCameraY) {
        targetCameraY = targetY;
    }
    
    // Smooth camera movement
    cameraY += (targetCameraY - cameraY) * 0.1;
}

// ==================== DRAWING ====================
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, W, H);
    
    // Draw background gradient
    drawBackground();
    
    // Draw platforms
    drawPlatforms();
    
    // Draw opponent (online mode)
    if (isOnlineMode && opponentData.isAlive) {
        drawOpponent();
    }
    
    // Draw player
    if (player.isAlive) {
        drawPlayer();
    }
    
    // Draw combo indicator
    if (combo >= 2 && gameState === 'playing') {
        drawComboIndicator();
    }
    
    // Draw particles
    drawParticles();
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    
    // Color changes based on height
    const heightFactor = Math.min(floor / 100, 1);
    
    if (heightFactor < 0.33) {
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
    } else if (heightFactor < 0.66) {
        gradient.addColorStop(0, '#0f3460');
        gradient.addColorStop(1, '#16213e');
    } else {
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f23');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    
    // Draw stars
    drawStars();
}

function drawStars() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 50; i++) {
        const x = (i * 73) % W;
        const y = ((i * 137 + Math.floor(cameraY * 0.1)) % H + H) % H;
        const size = (i % 3) + 1;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPlatforms() {
    for (const platform of platforms) {
        const screenY = platform.y + cameraY;
        
        // Skip if off screen
        if (screenY < -50 || screenY > H + 50) continue;
        
        // Platform shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(platform.x + 3, screenY + 3, platform.width, platform.height);
        
        // Platform body
        if (platform.isGround) {
            ctx.fillStyle = '#5d4037';
        } else {
            ctx.fillStyle = platform.color;
        }
        ctx.fillRect(platform.x, screenY, platform.width, platform.height);
        
        // Platform highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(platform.x, screenY, platform.width, 3);
        
        // Platform border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(platform.x, screenY, platform.width, platform.height);
        
        // Floor number
        if (!platform.isGround && platform.index % 10 === 0) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px "Press Start 2P"';
            ctx.textAlign = 'center';
            ctx.fillText(platform.index.toString(), platform.x + platform.width / 2, screenY - 5);
        }
    }
}

function drawPlayer() {
    const screenY = player.y + cameraY;
    const char = characters[selectedChar];
    
    // Player shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(player.x + player.width / 2 + 3, screenY + player.height + 3, player.width / 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Player body
    ctx.fillStyle = char.color;
    ctx.fillRect(player.x, screenY, player.width, player.height);
    
    // Player face/emoji
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Flip emoji based on direction
    ctx.save();
    if (player.direction === -1) {
        ctx.translate(player.x + player.width / 2, screenY + player.height / 2);
        ctx.scale(-1, 1);
        ctx.fillText(char.emoji, 0, 0);
    } else {
        ctx.fillText(char.emoji, player.x + player.width / 2, screenY + player.height / 2);
    }
    ctx.restore();
    
    // Jump effect
    if (player.isJumping && player.vy < 0) {
        ctx.fillStyle = 'rgba(79, 195, 247, 0.5)';
        ctx.beginPath();
        ctx.ellipse(player.x + player.width / 2, screenY + player.height, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Combo glow effect
    if (combo >= 3) {
        ctx.shadowColor = '#ffd54f';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 2;
        ctx.strokeRect(player.x - 2, screenY - 2, player.width + 4, player.height + 4);
        ctx.shadowBlur = 0;
    }
}

function drawOpponent() {
    if (!opponentData || !opponentData.isAlive) return;
    
    // Update interpolation
    const interpolated = OpponentInterpolator.update();
    const screenY = interpolated.y + cameraY;
    
    // Skip if off screen
    if (screenY < -100 || screenY > H + 100) {
        // Draw arrow indicator
        drawOpponentIndicator(interpolated.y);
        return;
    }
    
    ctx.save();
    ctx.globalAlpha = 0.6;
    
    const char = characters[opponentData.character || 0];
    
    // Ghost effect
    ctx.fillStyle = 'rgba(255, 107, 107, 0.5)';
    ctx.fillRect(interpolated.x, screenY, PLAYER_WIDTH, PLAYER_HEIGHT);
    
    // Opponent emoji
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char.emoji, interpolated.x + PLAYER_WIDTH / 2, screenY + PLAYER_HEIGHT / 2);
    
    // Name tag
    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('OPPONENT', interpolated.x + PLAYER_WIDTH / 2, screenY - 15);
    ctx.fillText(`🏆 ${opponentData.score}`, interpolated.x + PLAYER_WIDTH / 2, screenY - 5);
    
    ctx.restore();
}

function drawOpponentIndicator(opponentY) {
    const screenY = opponentY + cameraY;
    
    ctx.save();
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    
    if (screenY < 0) {
        // Opponent is above
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('▲ OPPONENT ▲', W / 2, 80);
        ctx.fillText(`Floor: ${opponentData.floor}`, W / 2, 95);
    } else if (screenY > H) {
        // Opponent is below
        ctx.fillStyle = '#4caf50';
        ctx.fillText('▼ OPPONENT ▼', W / 2, H - 90);
    }
    
    ctx.restore();
}

function drawComboIndicator() {
    const comboEl = document.getElementById('comboDisplay');
    if (combo >= 2) {
        comboEl.textContent = `COMBO x${combo}`;
        comboEl.classList.remove('hidden');
    } else {
        comboEl.classList.add('hidden');
    }
}

// ==================== PARTICLES ====================
let particles = [];

function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10 - 5,
            size: Math.random() * 5 + 2,
            color: color,
            life: 1
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // Gravity
        p.life -= 0.02;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    for (const p of particles) {
        const screenY = p.y + cameraY;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, screenY, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ==================== HUD ====================
function updateHUD() {
    document.getElementById('scoreDisplay').textContent = `SCORE: ${Math.floor(score)}`;
    document.getElementById('floorDisplay').textContent = `FLOOR: ${floor}`;
    
    // Update powerup bar based on combo
    const fill = Math.min(combo / 10, 1) * 100;
    document.getElementById('powerupFill').style.width = `${fill}%`;
    
    // Online HUD
    if (isOnlineMode) {
        document.getElementById('myScoreOnline').textContent = `YOU: ${Math.floor(score)}`;
        document.getElementById('opponentScoreOnline').textContent = `OPP: ${Math.floor(opponentData.score)}`;
    }
}

// ==================== GAME LOOP ====================
function gameLoop(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    if (gameState === 'playing') {
        updatePlayer();
        updateCamera();
        updatePlatforms();
        updateParticles();
        
        // Combo decay
        if (Date.now() - lastPlatformTime > COMBO_TIME) {
            combo = Math.max(0, combo - 1);
            lastPlatformTime = Date.now();
        }
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

// ==================== GAME FUNCTIONS ====================
function startGame() {
    gameState = 'playing';
    isOnlineMode = false;
    score = 0;
    floor = 0;
    combo = 0;
    cameraY = 0;
    targetCameraY = 0;
    lastPlatformTime = Date.now();
    gameStartTime = Date.now();
    particles = [];
    seededRandom = null;
    
    // Reset player
    player.x = W / 2 - player.width / 2;
    player.y = H - 80;
    player.vx = 0;
    player.vy = 0;
    player.isJumping = false;
    player.onGround = false;
    player.isAlive = true;
    
    // Initialize platforms
    initializePlatforms();
    
    // Update canvas size
    W = canvas.width;
    H = canvas.height;
    
    // Show HUD
    startScreen.classList.add('hidden');
    hudElement.classList.remove('hidden');
    powerupBar.classList.remove('hidden');
    pauseBtn.classList.remove('hidden');
    soundBtn.classList.remove('hidden');
    onlineHud.classList.add('hidden');
    
    if (isMobile()) {
        mobileControls.classList.remove('hidden');
    }
    
    updateHUD();
}

function startOnlineGame(seed) {
    gameState = 'playing';
    isOnlineMode = true;
    score = 0;
    floor = 0;
    combo = 0;
    cameraY = 0;
    targetCameraY = 0;
    lastPlatformTime = Date.now();
    gameStartTime = Date.now();
    particles = [];
    
    // Use seeded random for synchronized platforms
    platformSeed = seed;
    seededRandom = new SeededRandom(seed);
    
    // Reset player
    player.x = W / 2 - player.width / 2;
    player.y = H - 80;
    player.vx = 0;
    player.vy = 0;
    player.isJumping = false;
    player.onGround = false;
    player.isAlive = true;
    
    // Reset opponent interpolator
    OpponentInterpolator.reset();
    
    // Initialize platforms
    initializePlatforms();
    
    // Update canvas size
    W = canvas.width;
    H = canvas.height;
    
    // Show HUD
    countdownScreen.classList.add('hidden');
    hudElement.classList.remove('hidden');
    powerupBar.classList.remove('hidden');
    pauseBtn.classList.remove('hidden');
    soundBtn.classList.remove('hidden');
    onlineHud.classList.remove('hidden');
    
    if (isMobile()) {
        mobileControls.classList.remove('hidden');
    }
    
    updateHUD();
}

function gameOver() {
    gameState = 'gameover';
    
    // Check for new high score
    const finalScore = Math.floor(score);
    const isNewRecord = finalScore > highScore;
    
    if (isNewRecord) {
        highScore = finalScore;
        localStorage.setItem('icyTowerHighScore', highScore);
        saveHighScore(finalScore);
    }
    
    // Update game over screen
    document.getElementById('finalScore').textContent = finalScore;
    document.getElementById('bestScore').textContent = highScore;
    
    const newRecordEl = document.getElementById('newHighScore');
    if (isNewRecord) {
        newRecordEl.classList.remove('hidden');
        createParticles(W / 2, H / 2, '#ffd54f', 30);
    } else {
        newRecordEl.classList.add('hidden');
    }
    
    // Hide game elements
    hudElement.classList.add('hidden');
    powerupBar.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    soundBtn.classList.add('hidden');
    mobileControls.classList.add('hidden');
    
    // Show game over screen
    gameOverScreen.classList.remove('hidden');
}

function endOnlineGame(winnerId, winnerName) {
    gameState = 'gameover';
    
    const isWinner = winnerId === MultiplayerManager.playerId;
    
    // Update online game over screen
    const winnerTitle = document.getElementById('winnerTitle');
    winnerTitle.textContent = isWinner ? '🏆 YOU WIN!' : '😢 YOU LOSE';
    winnerTitle.className = isWinner ? 'title winner' : 'title loser';
    
    document.getElementById('onlineFinalScore').textContent = Math.floor(score);
    document.getElementById('opponentFinalScore').textContent = Math.floor(opponentData.score);
    
    // Hide game elements
    hudElement.classList.add('hidden');
    powerupBar.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    soundBtn.classList.add('hidden');
    onlineHud.classList.add('hidden');
    mobileControls.classList.add('hidden');
    
    // Show online game over screen
    onlineGameOverScreen.classList.remove('hidden');
    
    // Particles
    if (isWinner) {
        createParticles(W / 2, H / 2, '#4caf50', 50);
    }
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        pauseScreen.classList.remove('hidden');
    }
}

function resumeGame() {
    if (gameState === 'paused') {
        gameState = 'playing';
        pauseScreen.classList.add('hidden');
        lastTime = performance.now();
    }
}

function restartGame() {
    pauseScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    startGame();
}

function goToMenu() {
    gameState = 'menu';
    
    // Hide all screens
    pauseScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    onlineGameOverScreen.classList.add('hidden');
    hudElement.classList.add('hidden');
    powerupBar.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    soundBtn.classList.add('hidden');
    onlineHud.classList.add('hidden');
    mobileControls.classList.add('hidden');
    
    // Show start screen
    startScreen.classList.remove('hidden');
    
    // Reset online mode
    isOnlineMode = false;
    if (MultiplayerManager.currentRoom) {
        MultiplayerManager.leaveRoom();
    }
}

// ==================== HIGH SCORES ====================
function saveHighScore(score) {
    let scores = JSON.parse(localStorage.getItem('icyTowerScores') || '[]');
    scores.push({
        score: score,
        date: new Date().toLocaleDateString()
    });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10); // Keep top 10
    localStorage.setItem('icyTowerScores', JSON.stringify(scores));
}

function displayHighScores() {
    const scores = JSON.parse(localStorage.getItem('icyTowerScores') || '[]');
    const scoresList = document.getElementById('scoresList');
    
    if (scores.length === 0) {
        scoresList.innerHTML = '<p style="color: #bdbdbd; font-size: 10px;">No scores yet!</p>';
        return;
    }
    
    scoresList.innerHTML = scores.map((s, i) => `
        <div class="score-item">
            <span class="score-rank">#${i + 1}</span>
            <span class="score-value">${s.score}</span>
        </div>
    `).join('');
}

// ==================== ONLINE MODE FUNCTIONS ====================
function setupMultiplayerCallbacks() {
    MultiplayerManager.onConnectionChange = (connected) => {
        if (connected) {
            connectionStatus.classList.add('connected');
            document.getElementById('connectionText').textContent = '🟢 Connected';
        } else {
            connectionStatus.classList.remove('connected');
            document.getElementById('connectionText').textContent = '🔴 Disconnected';
        }
    };
    
    MultiplayerManager.onPlayerJoined = (opponent) => {
        console.log("🎮 Opponent joined:", opponent.name);
        opponentData.character = opponent.character || 0;
        
        if (MultiplayerManager.isHost) {
            document.getElementById('player2Status').textContent = `👤 Player 2: ${opponent.name} ✅`;
            document.getElementById('player2Status').className = 'player-status player-ready';
        } else {
            document.getElementById('player1Status').textContent = `👤 Player 1: ${opponent.name} ✅`;
            document.getElementById('player1Status').className = 'player-status player-ready';
        }
        
        showToast('Opponent joined! اللاعب انضم');
    };
    
    MultiplayerManager.onOpponentUpdate = (opponent) => {
        opponentData = { ...opponentData, ...opponent };
        OpponentInterpolator.setTarget(opponent.x, opponent.y, opponent.vx, opponent.vy);
    };
    
    MultiplayerManager.onOpponentLeft = () => {
        if (gameState === 'playing' && isOnlineMode) {
            // Auto-win if opponent leaves during game
            MultiplayerManager.iWon();
            showToast('Opponent left! You win!');
        } else {
            document.getElementById('player2Status').textContent = '👤 Player 2: Waiting...';
            document.getElementById('player2Status').className = 'player-status';
            showToast('Opponent left الخصم خرج');
        }
    };
    
    MultiplayerManager.onStatusChange = (status) => {
        console.log("📊 Status changed:", status);
        if (status === 'countdown') {
            startOnlineCountdown();
        }
    };
    
    MultiplayerManager.onGameStart = (gameState) => {
        console.log("🎮 Game started with seed:", gameState.platformSeed);
        startOnlineGame(gameState.platformSeed);
    };
    
    MultiplayerManager.onGameEnd = (winnerId, winnerName) => {
        console.log("🏁 Game ended. Winner:", winnerName);
        endOnlineGame(winnerId, winnerName);
    };
    
    MultiplayerManager.onRoomDeleted = () => {
        showToast('Room deleted الغرفة اتمسحت');
        goToMenu();
    };
}

function startOnlineCountdown() {
    waitingScreen.classList.add('hidden');
    countdownScreen.classList.remove('hidden');
    
    let count = 3;
    const countdownEl = document.getElementById('countdownNumber');
    countdownEl.textContent = count;
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownEl.textContent = count;
        } else if (count === 0) {
            countdownEl.textContent = 'GO!';
        } else {
            clearInterval(interval);
        }
    }, 1000);
}

function resetWaitingScreen() {
    document.getElementById('roomCodeDisplay').textContent = '------';
    document.getElementById('player1Status').textContent = '👤 Player 1: Waiting...';
    document.getElementById('player2Status').textContent = '👤 Player 2: Waiting...';
    document.getElementById('player1Status').className = 'player-status';
    document.getElementById('player2Status').className = 'player-status';
    document.getElementById('readyBtn').textContent = '✅ READY';
    document.getElementById('readyBtn').disabled = false;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.getElementById('gameContainer').appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ==================== EVENT LISTENERS ====================

// Start Screen
document.getElementById('startBtn').addEventListener('click', startGame);

document.getElementById('onlineBtn').addEventListener('click', () => {
    startScreen.classList.add('hidden');
    onlineScreen.classList.remove('hidden');
});

document.getElementById('howToPlayBtn').addEventListener('click', () => {
    startScreen.classList.add('hidden');
    howToPlayScreen.classList.remove('hidden');
});

document.getElementById('highScoresBtn').addEventListener('click', () => {
    displayHighScores();
    startScreen.classList.add('hidden');
    highScoresScreen.classList.remove('hidden');
});

document.getElementById('closeHowToBtn').addEventListener('click', () => {
    howToPlayScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

document.getElementById('closeScoresBtn').addEventListener('click', () => {
    highScoresScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

// Online Screen
document.getElementById('createRoomBtn').addEventListener('click', async () => {
    try {
        onlineScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
        document.getElementById('roomCodeDisplay').textContent = 'Creating...';
        connectionStatus.classList.remove('hidden');
        
        const roomCode = await MultiplayerManager.createRoom('Player 1', selectedChar);
        document.getElementById('roomCodeDisplay').textContent = roomCode;
        document.getElementById('player1Status').textContent = '👤 Player 1 (You): Joined ✅';
        document.getElementById('player1Status').className = 'player-status player-ready';
        
        setupMultiplayerCallbacks();
        
    } catch (error) {
        alert('Error: ' + error.message);
        waitingScreen.classList.add('hidden');
        onlineScreen.classList.remove('hidden');
        connectionStatus.classList.add('hidden');
    }
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    onlineScreen.classList.add('hidden');
    joinScreen.classList.remove('hidden');
    document.getElementById('roomCodeInput').value = '';
    document.getElementById('joinError').textContent = '';
});

document.getElementById('quickMatchBtn').addEventListener('click', async () => {
    try {
        onlineScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
        document.getElementById('roomCodeDisplay').textContent = 'Searching...';
        connectionStatus.classList.remove('hidden');
        
        const result = await MultiplayerManager.quickMatch('Player', selectedChar);
        
        document.getElementById('roomCodeDisplay').textContent = MultiplayerManager.roomCode;
        
        if (MultiplayerManager.isHost) {
            document.getElementById('player1Status').textContent = '👤 Player 1 (You): Joined ✅';
            document.getElementById('player1Status').className = 'player-status player-ready';
        } else {
            document.getElementById('player2Status').textContent = '👤 Player 2 (You): Joined ✅';
            document.getElementById('player2Status').className = 'player-status player-ready';
        }
        
        setupMultiplayerCallbacks();
        
    } catch (error) {
        alert('Error: ' + error.message);
        waitingScreen.classList.add('hidden');
        onlineScreen.classList.remove('hidden');
        connectionStatus.classList.add('hidden');
    }
});

document.getElementById('backToMenuBtn').addEventListener('click', () => {
    onlineScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

// Join Screen
document.getElementById('confirmJoinBtn').addEventListener('click', async () => {
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    
    if (code.length !== 6) {
        document.getElementById('joinError').textContent = 'Enter 6 character code!';
        return;
    }
    
    try {
        document.getElementById('joinError').textContent = '';
        connectionStatus.classList.remove('hidden');
        
        await MultiplayerManager.joinRoom(code, 'Player 2', selectedChar);
        
        joinScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
        document.getElementById('roomCodeDisplay').textContent = code;
        document.getElementById('player2Status').textContent = '👤 Player 2 (You): Joined ✅';
        document.getElementById('player2Status').className = 'player-status player-ready';
        
        setupMultiplayerCallbacks();
        
    } catch (error) {
        document.getElementById('joinError').textContent = error.message;
        connectionStatus.classList.add('hidden');
    }
});

document.getElementById('backToOnlineBtn').addEventListener('click', () => {
    joinScreen.classList.add('hidden');
    onlineScreen.classList.remove('hidden');
});

// Waiting Screen
document.getElementById('readyBtn').addEventListener('click', async () => {
    const btn = document.getElementById('readyBtn');
    btn.textContent = '⏳ WAITING...';
    btn.disabled = true;
    await MultiplayerManager.setReady(true);
});

document.getElementById('leaveRoomBtn').addEventListener('click', async () => {
    await MultiplayerManager.leaveRoom();
    waitingScreen.classList.add('hidden');
    onlineScreen.classList.remove('hidden');
    connectionStatus.classList.add('hidden');
    resetWaitingScreen();
});

// Pause Screen
pauseBtn.addEventListener('click', togglePause);
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('quitBtn').addEventListener('click', goToMenu);

// Sound Button
soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
});

// Game Over Screen
document.getElementById('retryBtn').addEventListener('click', restartGame);
document.getElementById('menuBtn').addEventListener('click', goToMenu);

// Online Game Over Screen
document.getElementById('playAgainOnlineBtn').addEventListener('click', async () => {
    await MultiplayerManager.leaveRoom();
    onlineGameOverScreen.classList.add('hidden');
    onlineScreen.classList.remove('hidden');
    resetWaitingScreen();
    isOnlineMode = false;
});

document.getElementById('backToMenuOnlineBtn').addEventListener('click', async () => {
    await MultiplayerManager.leaveRoom();
    goToMenu();
});

// Room Code Input - Auto uppercase
document.getElementById('roomCodeInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
});

// ==================== INITIALIZE GAME ====================
function init() {
    // Load high score
    highScore = parseInt(localStorage.getItem('icyTowerHighScore')) || 0;
    
    // Start game loop
    requestAnimationFrame(gameLoop);
    
    console.log("🎮 Icy Tower initialized!");
    console.log("🏆 High Score:", highScore);
}

// Start the game
init();
