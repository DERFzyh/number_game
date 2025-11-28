// API 配置
const API_BASE_URL = window.location.origin; // 使用同源，或设置为 'http://localhost:3000'

// Game State
const state = {
    target: 0,
    pool: [], // Array of Card objects
    selectedIndices: [],
    playerName: localStorage.getItem('playerName') || '匿名玩家',
    movesCount: 0, // 操作次数
    settings: {
        operators: ['+', '-'],
        targetRange: { min: 10, max: 100 },
        poolRange: { min: 1, max: 50 },
        numberType: 'integer', // integer, decimal1, decimal2, mul10, mul100
        poolSize: 5
    },
    isAnimating: false,
    // 房间相关状态
    room: {
        roomId: null,
        playerId: null,
        isHost: false,
        status: null, // waiting, playing, finished
        currentRound: 0,
        totalRounds: 1
    },
    roomPollInterval: null
};

// DOM Elements
const views = {
    home: document.getElementById('view-home'),
    game: document.getElementById('view-game')
};

const els = {
    targetNum: document.getElementById('target-num'),
    cardPool: document.getElementById('card-pool'),
    btnAdd: document.getElementById('btn-add'),
    btnSub: document.getElementById('btn-sub'),
    btnMul: document.getElementById('btn-mul'),
    btnDiv: document.getElementById('btn-div'),
    btnDecompose: document.getElementById('btn-decompose'),
    btnSubmit: document.getElementById('btn-submit'),
    resultOverlay: document.getElementById('result-overlay'),
    settingsOverlay: document.getElementById('settings-overlay'),
    finalScore: document.getElementById('final-score'),
    scoreDetail: document.getElementById('score-detail'),
    movesCount: document.getElementById('moves-count'),
    roomInfo: document.getElementById('room-info'),
    roomIdDisplay: document.getElementById('room-id-display'),
    currentRound: document.getElementById('current-round'),
    totalRounds: document.getElementById('total-rounds'),
    roomLeaderboard: document.getElementById('room-leaderboard'),
    roomLeaderboardContent: document.getElementById('room-leaderboard-content')
};

// Navigation
function showView(viewName) {
    Object.values(views).forEach(el => el.classList.remove('active'));
    views[viewName].classList.add('active');
}

function goHome() {
    // 离开房间
    if (state.room.roomId) {
        if (state.roomPollInterval) {
            clearInterval(state.roomPollInterval);
            state.roomPollInterval = null;
        }

        fetch(`${API_BASE_URL}/api/rooms/${state.room.roomId}/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: state.room.playerId })
        }).catch(err => console.error('离开房间失败:', err));

        state.room = {
            roomId: null,
            playerId: null,
            isHost: false,
            status: null,
            currentRound: 0,
            totalRounds: 1
        };
    }

    showView('home');
    updateRoomUI();
}

function startGame() {
    initGame();
    showView('game');
}

function openSettings() {
    renderSettings();
    // 更新玩家名称输入框
    const playerNameInput = document.getElementById('setting-player-name');
    if (playerNameInput) {
        playerNameInput.value = state.playerName;
    }
    els.settingsOverlay.classList.add('visible');
}

function closeSettings() {
    saveSettings();
    els.settingsOverlay.classList.remove('visible');
}

// Settings Logic
function renderSettings() {
    document.getElementById('setting-min-target').value = state.settings.targetRange.min;
    document.getElementById('setting-max-target').value = state.settings.targetRange.max;
    document.getElementById('setting-min-pool').value = state.settings.poolRange.min;
    document.getElementById('setting-max-pool').value = state.settings.poolRange.max;
    document.getElementById('setting-pool-size').value = state.settings.poolSize;
    document.getElementById('setting-type').value = state.settings.numberType;

    document.querySelectorAll('input[name="operator"]').forEach(cb => {
        cb.checked = state.settings.operators.includes(cb.value);
    });
}

function saveSettings() {
    state.settings.targetRange.min = Number(document.getElementById('setting-min-target').value);
    state.settings.targetRange.max = Number(document.getElementById('setting-max-target').value);
    state.settings.poolRange.min = Number(document.getElementById('setting-min-pool').value);
    state.settings.poolRange.max = Number(document.getElementById('setting-max-pool').value);
    state.settings.poolSize = Number(document.getElementById('setting-pool-size').value);
    state.settings.numberType = document.getElementById('setting-type').value;

    const ops = [];
    document.querySelectorAll('input[name="operator"]:checked').forEach(cb => {
        ops.push(cb.value);
    });
    if (ops.length === 0) ops.push('+');
    state.settings.operators = ops;

    // 保存玩家名称
    const playerNameInput = document.getElementById('setting-player-name');
    if (playerNameInput) {
        state.playerName = playerNameInput.value.trim() || '匿名玩家';
        localStorage.setItem('playerName', state.playerName);
    }
}

// Game Logic
function generateNumber(min, max, type) {
    let num = Math.random() * (max - min) + min;
    switch (type) {
        case 'integer': return Math.floor(num);
        case 'decimal1': return Number(num.toFixed(1));
        case 'decimal2': return Number(num.toFixed(2));
        case 'mul10': return Math.floor(num / 10) * 10;
        case 'mul100': return Math.floor(num / 100) * 100;
        default: return Math.floor(num);
    }
}

function initGame() {
    const s = state.settings;
    state.target = generateNumber(s.targetRange.min, s.targetRange.max, s.numberType);

    state.pool = Array.from({ length: s.poolSize }, (_, i) => ({
        id: `init-${Date.now()}-${i}`,
        value: generateNumber(s.poolRange.min, s.poolRange.max, s.numberType),
        history: null
    }));

    state.selectedIndices = [];
    state.isAnimating = false;
    state.movesCount = 0; // 重置操作次数

    render();
    els.resultOverlay.classList.remove('visible');
}

function render() {
    els.targetNum.textContent = state.target;
    if (els.movesCount) {
        els.movesCount.textContent = state.movesCount;
    }

    // Only rebuild DOM if not animating to preserve elements for transitions
    if (!state.isAnimating) {
        els.cardPool.innerHTML = '';
        state.pool.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = `card ${state.selectedIndices.includes(index) ? 'selected' : ''}`;
            cardEl.textContent = card.value;
            cardEl.dataset.id = card.id; // Track ID for animations
            cardEl.onclick = () => toggleSelect(index);
            els.cardPool.appendChild(cardEl);
        });
    } else {
        // Just update selection state if animating (though usually we block interaction)
        Array.from(els.cardPool.children).forEach((el, idx) => {
            if (state.selectedIndices.includes(idx)) el.classList.add('selected');
            else el.classList.remove('selected');
        });
    }

    updateControls();
}

function updateControls() {
    const selLen = state.selectedIndices.length;
    const ops = state.settings.operators;

    els.btnAdd.disabled = selLen !== 2 || !ops.includes('+') || state.isAnimating;
    els.btnSub.disabled = selLen !== 2 || !ops.includes('-') || state.isAnimating;
    els.btnMul.disabled = selLen !== 2 || !ops.includes('*') || state.isAnimating;
    els.btnDiv.disabled = selLen !== 2 || !ops.includes('/') || state.isAnimating;

    let canDecompose = false;
    if (selLen === 1) {
        const card = state.pool[state.selectedIndices[0]];
        if (card.history) canDecompose = true;
    }
    els.btnDecompose.disabled = !canDecompose || state.isAnimating;
}

function toggleSelect(index) {
    if (state.isAnimating) return;

    const selectedIdx = state.selectedIndices.indexOf(index);

    if (selectedIdx >= 0) {
        state.selectedIndices.splice(selectedIdx, 1);
    } else {
        if (state.selectedIndices.length < 2) {
            state.selectedIndices.push(index);
        } else {
            state.selectedIndices.shift();
            state.selectedIndices.push(index);
        }
    }
    render();
}

async function performOperation(op) {
    if (state.selectedIndices.length !== 2 || state.isAnimating) return;
    state.isAnimating = true;
    updateControls();

    const idx1 = state.selectedIndices[0];
    const idx2 = state.selectedIndices[1];
    const card1 = state.pool[idx1];
    const card2 = state.pool[idx2];

    const val1 = card1.value;
    const val2 = card2.value;

    let newVal;
    if (op === '+') newVal = val1 + val2;
    else if (op === '-') newVal = Math.abs(val1 - val2);
    else if (op === '*') newVal = val1 * val2;
    else if (op === '/') {
        // Avoid division by zero and messy decimals if possible, but for now just raw division
        if (val2 === 0) newVal = val1; // Fail safe
        else newVal = val1 / val2;
    }

    // Fix precision
    if (state.settings.numberType.startsWith('decimal') || op === '/') {
        const precision = state.settings.numberType === 'decimal1' ? 1 : 2;
        newVal = Number(newVal.toFixed(precision));
    } else {
        newVal = Math.round(newVal); // Ensure integer if mode is integer
    }

    // Animation: Move cards together
    const cardEls = Array.from(els.cardPool.children);
    const el1 = cardEls[idx1];
    const el2 = cardEls[idx2];

    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();
    const parentRect = els.cardPool.getBoundingClientRect();

    // Calculate midpoint relative to parent
    // We want to move them to the center of the two cards
    const midX = (rect1.left + rect2.left) / 2 - parentRect.left + (rect1.width / 2) - 40; // 40 is half card width
    const midY = (rect1.top + rect2.top) / 2 - parentRect.top + (rect1.height / 2) - 40;

    // Apply transform to move them to midpoint
    // We need to calculate relative translation
    const transX1 = midX - (rect1.left - parentRect.left);
    const transY1 = midY - (rect1.top - parentRect.top);
    const transX2 = midX - (rect2.left - parentRect.left);
    const transY2 = midY - (rect2.top - parentRect.top);

    el1.style.transform = `translate(${transX1}px, ${transY1}px)`;
    el2.style.transform = `translate(${transX2}px, ${transY2}px)`;
    el1.classList.add('merging');
    el2.classList.add('merging');

    // Wait for animation
    await new Promise(r => setTimeout(r, 500));

    const newCard = {
        id: `calc-${Date.now()}`,
        value: newVal,
        history: {
            parents: [card1, card2],
            op: op
        }
    };

    const indicesToRemove = [idx1, idx2].sort((a, b) => b - a);
    const newPool = [...state.pool];
    newPool.splice(indicesToRemove[0], 1);
    newPool.splice(indicesToRemove[1], 1);
    newPool.push(newCard);

    state.pool = newPool;
    state.selectedIndices = [];
    state.isAnimating = false;
    state.movesCount++; // 增加操作次数
    render();

    // Animation for new card
    setTimeout(() => {
        const cards = els.cardPool.children;
        if (cards.length > 0) {
            cards[cards.length - 1].classList.add('new');
        }
    }, 10);
}

async function decompose() {
    if (state.selectedIndices.length !== 1 || state.isAnimating) return;
    state.isAnimating = true;
    updateControls();

    const idx = state.selectedIndices[0];
    const card = state.pool[idx];

    if (!card.history) {
        state.isAnimating = false;
        return;
    }

    // Animation: Split
    const el = els.cardPool.children[idx];
    el.classList.add('decomposing');

    await new Promise(r => setTimeout(r, 400));

    const parent1 = card.history.parents[0];
    const parent2 = card.history.parents[1];

    const newPool = [...state.pool];
    newPool.splice(idx, 1);
    newPool.push(parent1, parent2);

    state.pool = newPool;
    state.selectedIndices = [];
    state.isAnimating = false;
    state.movesCount++; // 增加操作次数（分解也算一次操作）
    render();

    // Animate new cards appearing
    setTimeout(() => {
        const cards = els.cardPool.children;
        const len = cards.length;
        if (len >= 2) {
            cards[len - 1].classList.add('new');
            cards[len - 2].classList.add('new');
        }
    }, 10);
}

function calculateScore() {
    if (state.pool.length === 0) return 0;

    let totalDiff = 0;
    state.pool.forEach(card => {
        totalDiff += Math.abs(card.value - state.target);
    });

    const score = totalDiff / state.pool.length;
    return score.toFixed(2);
}

async function showResult() {
    const score = calculateScore();
    els.finalScore.textContent = score;
    els.scoreDetail.textContent = `(所有数字与 ${state.target} 的差值绝对值之和) / ${state.pool.length}`;
    els.resultOverlay.classList.add('visible');

    // 如果是房间游戏，提交分数到房间
    if (state.room.roomId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/${state.room.roomId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: state.room.playerId,
                    score: parseFloat(score),
                    pool: state.pool
                })
            });

            const data = await response.json();
            if (response.ok && data.data.allReady) {
                // 所有玩家都提交了，等待下一轮或游戏结束
                if (data.data.status === 'finished') {
                    alert('所有题目已完成！');
                    updateRoomLeaderboard();
                } else if (data.data.gameData) {
                    // 下一轮开始
                    state.target = data.data.gameData.target;
                    state.pool = data.data.gameData.pool.map((card, i) => ({
                        id: `room-${Date.now()}-${i}`,
                        value: card.value,
                        history: null
                    }));
                    state.selectedIndices = [];
                    state.movesCount = 0;
                    state.room.currentRound = data.data.currentRound;
                    els.resultOverlay.classList.remove('visible');
                    render();
                    updateRoomUI();
                }
            }
        } catch (error) {
            console.error('提交分数失败:', error);
        }
    } else {
        // 单人游戏，保存到数据库
        try {
            await saveGameRecord({
                playerName: state.playerName,
                targetNumber: state.target,
                finalScore: parseFloat(score),
                poolSize: state.pool.length,
                operators: state.settings.operators,
                numberType: state.settings.numberType,
                movesCount: state.movesCount
            });
        } catch (error) {
            console.error('保存游戏记录失败:', error);
        }
    }
}

// API 函数
async function saveGameRecord(record) {
    const response = await fetch(`${API_BASE_URL}/api/games`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(record)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// 房间管理功能

function openRoomMenu() {
    document.getElementById('room-menu-overlay').classList.add('visible');
}

function closeRoomMenu() {
    document.getElementById('room-menu-overlay').classList.remove('visible');
}

function openCreateRoom() {
    closeRoomMenu();
    const playerNameInput = document.getElementById('create-room-player-name');
    playerNameInput.value = state.playerName;

    // Populate create room settings with current global settings
    document.getElementById('cr-min-target').value = state.settings.targetRange.min;
    document.getElementById('cr-max-target').value = state.settings.targetRange.max;
    document.getElementById('cr-min-pool').value = state.settings.poolRange.min;
    document.getElementById('cr-max-pool').value = state.settings.poolRange.max;
    document.getElementById('cr-pool-size').value = state.settings.poolSize;
    document.getElementById('cr-type').value = state.settings.numberType;

    document.querySelectorAll('input[name="cr-operator"]').forEach(cb => {
        cb.checked = state.settings.operators.includes(cb.value);
    });

    document.getElementById('create-room-overlay').classList.add('visible');
}

function closeCreateRoom() {
    document.getElementById('create-room-overlay').classList.remove('visible');
}

function openJoinRoom() {
    closeRoomMenu();
    const playerNameInput = document.getElementById('join-room-player-name');
    playerNameInput.value = state.playerName;
    document.getElementById('join-room-overlay').classList.add('visible');
}

function closeJoinRoom() {
    document.getElementById('join-room-overlay').classList.remove('visible');
}

async function createRoom() {
    const playerName = document.getElementById('create-room-player-name').value.trim() || '匿名玩家';
    const questionCount = parseInt(document.getElementById('create-room-question-count').value) || 1;

    // Gather settings from create room modal
    const operators = [];
    document.querySelectorAll('input[name="cr-operator"]:checked').forEach(cb => operators.push(cb.value));
    if (operators.length === 0) operators.push('+');

    const settings = {
        operators: operators,
        targetRange: {
            min: Number(document.getElementById('cr-min-target').value),
            max: Number(document.getElementById('cr-max-target').value)
        },
        poolRange: {
            min: Number(document.getElementById('cr-min-pool').value),
            max: Number(document.getElementById('cr-max-pool').value)
        },
        numberType: document.getElementById('cr-type').value,
        poolSize: Number(document.getElementById('cr-pool-size').value),
        questionCount: questionCount
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerName,
                settings
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || '创建房间失败');
        }

        state.room.roomId = data.data.roomId;
        state.room.playerId = data.data.playerId;
        state.room.isHost = true;
        state.playerName = playerName;
        localStorage.setItem('playerName', playerName);

        closeCreateRoom();
        openRoomSettings();
        startRoomPolling();
    } catch (error) {
        alert('创建房间失败: ' + error.message);
    }
}

async function joinRoom() {
    const playerName = document.getElementById('join-room-player-name').value.trim() || '匿名玩家';
    const roomId = document.getElementById('join-room-id').value.trim();

    if (!roomId || roomId.length !== 6) {
        alert('请输入6位房间号');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || '加入房间失败');
        }

        state.room.roomId = roomId;
        state.room.playerId = data.data.playerId;
        state.room.isHost = false;
        state.playerName = playerName;
        localStorage.setItem('playerName', playerName);

        closeJoinRoom();
        openRoomSettings();
        startRoomPolling();
    } catch (error) {
        alert('加入房间失败: ' + error.message);
    }
}

function openRoomSettings() {
    document.getElementById('room-settings-overlay').classList.add('visible');
    updateRoomSettings();
}

function closeRoomSettings() {
    document.getElementById('room-settings-overlay').classList.remove('visible');
}

async function updateRoomSettings() {
    if (!state.room.roomId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${state.room.roomId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '获取房间信息失败');
        }

        const room = data.data;
        state.room.status = room.status;
        state.room.currentRound = room.currentRound || 0;
        state.room.totalRounds = room.settings.questionCount || 1;

        // 更新设置界面
        const content = document.getElementById('room-settings-content');
        content.innerHTML = `
            <div class="settings-section">
                <h3>房间号: <strong>${room.id}</strong></h3>
                <p style="color: #666; font-size: 0.9rem;">分享房间号给其他玩家加入</p>
            </div>
            <div class="settings-section">
                <h3>玩家列表 (${room.players.length})</h3>
                <div style="background: #f5f5f5; padding: 10px; border-radius: 4px;">
                    ${room.players.map(p => `
                        <div style="padding: 5px;">
                            ${p.name} ${p.id === room.hostId ? '(房主)' : ''}
                            ${p.isReady ? '✓' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="settings-section">
                <h3>游戏设置</h3>
                <p>题目数量: ${room.settings.questionCount}</p>
                <p>运算符: ${room.settings.operators.join(', ')}</p>
                <p>数字类型: ${getNumberTypeName(room.settings.numberType)}</p>
            </div>
        `;

        // 显示/隐藏开始游戏按钮
        const btnStart = document.getElementById('btn-start-game');
        if (state.room.isHost && room.status === 'waiting') {
            btnStart.style.display = 'inline-block';
        } else {
            btnStart.style.display = 'none';
        }

        // 如果游戏已开始，进入游戏界面
        if (room.status === 'playing' && room.gameData) {
            state.target = room.gameData.target;
            state.pool = room.gameData.pool.map((card, i) => ({
                id: `room-${Date.now()}-${i}`,
                value: card.value,
                history: null
            }));
            state.selectedIndices = [];
            state.movesCount = 0;
            state.room.currentRound = room.currentRound;
            closeRoomSettings();
            showView('game');
            render();
            updateRoomUI();
        }
    } catch (error) {
        console.error('更新房间设置失败:', error);
    }
}

function getNumberTypeName(type) {
    const names = {
        'integer': '整数',
        'decimal1': '1位小数',
        'decimal2': '2位小数',
        'mul10': '整十数',
        'mul100': '整百数'
    };
    return names[type] || type;
}

async function startRoomGame() {
    if (!state.room.isHost) {
        alert('只有房主可以开始游戏');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${state.room.roomId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostId: state.room.playerId })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || '开始游戏失败');
        }

        // 同步游戏数据
        if (data.data.gameData) {
            state.target = data.data.gameData.target;
            state.pool = data.data.gameData.pool.map((card, i) => ({
                id: `room-${Date.now()}-${i}`,
                value: card.value,
                history: null
            }));
            state.selectedIndices = [];
            state.movesCount = 0;
            state.room.currentRound = data.data.currentRound;
        }

        closeRoomSettings();
        showView('game');
        render();
        updateRoomUI();
    } catch (error) {
        alert('开始游戏失败: ' + error.message);
    }
}

// 轮询房间状态
function startRoomPolling() {
    if (state.roomPollInterval) {
        clearInterval(state.roomPollInterval);
    }

    state.roomPollInterval = setInterval(async () => {
        if (!state.room.roomId) {
            clearInterval(state.roomPollInterval);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/${state.room.roomId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error);
            }

            const room = data.data;

            // 如果游戏开始，同步游戏数据
            if (room.status === 'playing' && room.gameData &&
                (state.room.status !== 'playing' || state.room.currentRound !== room.currentRound)) {

                state.target = room.gameData.target;
                state.pool = room.gameData.pool.map((card, i) => ({
                    id: `room-${Date.now()}-${i}`,
                    value: card.value,
                    history: null
                }));
                state.selectedIndices = [];
                state.movesCount = 0;
                state.room.currentRound = room.currentRound;

                if (views.game.classList.contains('active')) {
                    render();
                } else {
                    showView('game');
                    render();
                }
            }

            state.room.status = room.status;
            state.room.currentRound = room.currentRound || 0;

            // 如果房间设置界面打开，更新它
            const roomSettingsOverlay = document.getElementById('room-settings-overlay');
            if (roomSettingsOverlay && roomSettingsOverlay.classList.contains('visible')) {
                updateRoomSettings();
            }

            updateRoomUI();
            updateRoomLeaderboard();
        } catch (error) {
            console.error('轮询房间状态失败:', error);
        }
    }, 2000); // 每2秒轮询一次
}

function updateRoomUI() {
    if (state.room.roomId) {
        els.roomInfo.style.display = 'block';
        els.roomIdDisplay.textContent = state.room.roomId;
        els.currentRound.textContent = state.room.currentRound;
        els.totalRounds.textContent = state.room.totalRounds;
        els.roomLeaderboard.style.display = 'block';
    } else {
        els.roomInfo.style.display = 'none';
        els.roomLeaderboard.style.display = 'none';
    }
}

async function updateRoomLeaderboard() {
    if (!state.room.roomId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${state.room.roomId}/leaderboard`);
        const data = await response.json();

        if (!response.ok) {
            return;
        }

        const leaderboard = data.data || [];

        if (leaderboard.length === 0) {
            els.roomLeaderboardContent.innerHTML = '<p style="text-align: center; color: #666;">暂无排名</p>';
            return;
        }

        const html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead>
                    <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                        <th style="padding: 8px; text-align: left;">排名</th>
                        <th style="padding: 8px; text-align: left;">玩家</th>
                        <th style="padding: 8px; text-align: right;">平均分</th>
                    </tr>
                </thead>
                <tbody>
                    ${leaderboard.map((player, index) => `
                        <tr style="border-bottom: 1px solid #eee; ${player.playerId === state.room.playerId ? 'background: #e3f2fd;' : ''}">
                            <td style="padding: 8px; font-weight: bold; color: ${index < 3 ? '#e74c3c' : '#333'};">
                                ${index + 1}
                            </td>
                            <td style="padding: 8px;">${escapeHtml(player.playerName)}</td>
                            <td style="padding: 8px; text-align: right; font-weight: bold; color: #4a90e2;">
                                ${player.avgScore}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        els.roomLeaderboardContent.innerHTML = html;
    } catch (error) {
        console.error('更新房间排行榜失败:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event Listeners
els.btnAdd.onclick = () => performOperation('+');
els.btnSub.onclick = () => performOperation('-');
els.btnMul.onclick = () => performOperation('*');
els.btnDiv.onclick = () => performOperation('/');
els.btnDecompose.onclick = decompose;
els.btnSubmit.onclick = showResult;
document.getElementById('btn-reset').onclick = () => {
    els.resultOverlay.classList.remove('visible');
    initGame();
};

// Init
goHome();
