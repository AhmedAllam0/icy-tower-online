// ==================== LEADERBOARD MANAGER ====================
// Icy Tower Online - Global Leaderboard System
// ================================================================

const LeaderboardManager = {
    database: null,
    currentPeriod: 'allTime',
    
    // ==================== INITIALIZATION ====================
    init() {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase not loaded');
            return false;
        }
        
        this.database = firebase.database();
        console.log('✅ Leaderboard Manager initialized');
        return true;
    },
    
    // ==================== SAVE SCORE ====================
    async saveScore(playerName, score, floor, character = 0, gameMode = 'classic') {
        try {
            if (!this.database) this.init();
            
            const scoreData = {
                playerName: playerName.substring(0, 15), // Max 15 characters
                score: score,
                floor: floor,
                character: character,
                gameMode: gameMode,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            
            // Save to all-time leaderboard
            const allTimeRef = this.database.ref('leaderboard/allTime');
            await allTimeRef.push(scoreData);
            
            // Save to weekly leaderboard
            const weeklyRef = this.database.ref('leaderboard/weekly');
            await weeklyRef.push(scoreData);
            
            // Save to daily leaderboard
            const dailyRef = this.database.ref('leaderboard/daily');
            await dailyRef.push(scoreData);
            
            console.log('✅ Score saved to leaderboard:', scoreData);
            return true;
            
        } catch (error) {
            console.error('❌ Error saving score:', error);
            return false;
        }
    },
    
    // ==================== GET TOP SCORES ====================
    async getTopScores(limit = 20, period = 'allTime') {
        try {
            if (!this.database) this.init();
            
            const ref = this.database.ref(`leaderboard/${period}`);
            const snapshot = await ref.orderByChild('score').limitToLast(limit).once('value');
            
            if (!snapshot.exists()) {
                return [];
            }
            
            const scores = [];
            snapshot.forEach((childSnapshot) => {
                scores.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // Sort by score descending
            scores.sort((a, b) => b.score - a.score);
            
            // Clean old scores based on period
            this.cleanOldScores(period);
            
            return scores;
            
        } catch (error) {
            console.error('❌ Error getting scores:', error);
            return [];
        }
    },
    
    // ==================== GET PLAYER RANK ====================
    async getPlayerRank(score, period = 'allTime') {
        try {
            if (!this.database) this.init();
            
            const ref = this.database.ref(`leaderboard/${period}`);
            const snapshot = await ref.orderByChild('score').startAt(score).once('value');
            
            if (!snapshot.exists()) {
                return null;
            }
            
            let rank = 1;
            snapshot.forEach(() => {
                rank++;
            });
            
            return rank;
            
        } catch (error) {
            console.error('❌ Error getting rank:', error);
            return null;
        }
    },
    
    // ==================== CLEAN OLD SCORES ====================
    async cleanOldScores(period) {
        try {
            if (!this.database) this.init();
            
            const now = Date.now();
            let cutoffTime;
            
            // Determine cutoff time based on period
            if (period === 'daily') {
                cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours
            } else if (period === 'weekly') {
                cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days
            } else {
                return; // Don't clean all-time scores
            }
            
            const ref = this.database.ref(`leaderboard/${period}`);
            const snapshot = await ref.orderByChild('timestamp').endAt(cutoffTime).once('value');
            
            if (snapshot.exists()) {
                const updates = {};
                snapshot.forEach((childSnapshot) => {
                    updates[childSnapshot.key] = null; // Mark for deletion
                });
                
                await ref.update(updates);
                console.log(`🧹 Cleaned ${Object.keys(updates).length} old ${period} scores`);
            }
            
        } catch (error) {
            console.error('❌ Error cleaning old scores:', error);
        }
    },
    
    // ==================== DISPLAY LEADERBOARD ====================
    displayLeaderboard(scores, containerElement) {
        if (!containerElement) return;
        
        containerElement.innerHTML = '';
        
        if (scores.length === 0) {
            containerElement.innerHTML = '<div style="text-align: center; color: #81d4fa; font-size: 10px; padding: 20px;">No scores yet. Be the first!</div>';
            return;
        }
        
        scores.forEach((scoreData, index) => {
            const rank = index + 1;
            const item = document.createElement('div');
            item.className = 'score-item';
            
            // Add special class for top 3
            if (rank === 1) item.style.borderLeftColor = '#ffd700';
            else if (rank === 2) item.style.borderLeftColor = '#c0c0c0';
            else if (rank === 3) item.style.borderLeftColor = '#cd7f32';
            
            // Format timestamp
            const date = new Date(scoreData.timestamp);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            // Get character emoji
            const characters = ['🧑', '👨', '👩', '🤖'];
            const charEmoji = characters[scoreData.character] || '🧑';
            
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="score-rank" style="min-width: 25px;">#${rank}</span>
                    <span style="font-size: 14px;">${charEmoji}</span>
                    <span style="color: #fff;">${scoreData.playerName}</span>
                </div>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <span style="color: #81d4fa; font-size: 8px;">${dateStr}</span>
                    <span style="color: #90caf9; font-size: 8px;">FL ${scoreData.floor}</span>
                    <span class="score-value">${scoreData.score}</span>
                </div>
            `;
            
            containerElement.appendChild(item);
        });
    },
    
    // ==================== SHOW NAME INPUT ====================
    showNameInput(score, onSubmit) {
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.style.zIndex = '1000';
        
        overlay.innerHTML = `
            <div class="title">🏆 NEW HIGH SCORE!</div>
            <div class="score-display">SCORE: ${score}</div>
            <div style="margin: 20px 0;">
                <div style="font-size: 10px; color: #81d4fa; margin-bottom: 10px;">ENTER YOUR NAME:</div>
                <input type="text" id="playerNameInput" maxlength="15" 
                    style="font-family: 'Press Start 2P', cursive; font-size: 14px; padding: 12px 20px; 
                    text-align: center; background: rgba(0,0,0,0.7); border: 3px solid #4fc3f7; 
                    color: #fff; border-radius: 10px; width: 250px; outline: none;"
                    placeholder="PLAYER" autocomplete="off">
            </div>
            <button class="btn btn-play" id="submitNameBtn">✅ SUBMIT</button>
            <button class="btn btn-small" id="skipNameBtn">SKIP</button>
        `;
        
        document.body.appendChild(overlay);
        
        const input = document.getElementById('playerNameInput');
        const submitBtn = document.getElementById('submitNameBtn');
        const skipBtn = document.getElementById('skipNameBtn');
        
        input.focus();
        
        const submit = () => {
            const name = input.value.trim() || 'Player';
            document.body.removeChild(overlay);
            if (onSubmit) onSubmit(name);
        };
        
        submitBtn.addEventListener('click', submit);
        skipBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            if (onSubmit) onSubmit('Player');
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submit();
        });
    }
};

// Initialize on load
if (typeof firebase !== 'undefined') {
    LeaderboardManager.init();
}
