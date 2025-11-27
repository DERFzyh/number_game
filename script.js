// Game State
const state = {
    target: 0,
    pool: [], // Array of Card objects
    selectedIndices: [],
    settings: {
        operators: ['+', '-'],
        targetRange: { min: 10, max: 100 },
        poolRange: { min: 1, max: 50 },
        numberType: 'integer', // integer, decimal1, decimal2, mul10, mul100
        poolSize: 5
    },
    isAnimating: false
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
    scoreDetail: document.getElementById('score-detail')
};

// Navigation
function showView(viewName) {
    Object.values(views).forEach(el => el.classList.remove('active'));
    views[viewName].classList.add('active');
}

function goHome() {
    showView('home');
}

function startGame() {
    initGame();
    showView('game');
}

function openSettings() {
    renderSettings();
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

    render();
    els.resultOverlay.classList.remove('visible');
}

function render() {
    els.targetNum.textContent = state.target;

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

function showResult() {
    const score = calculateScore();
    els.finalScore.textContent = score;
    els.scoreDetail.textContent = `(所有数字与 ${state.target} 的差值绝对值之和) / ${state.pool.length}`;
    els.resultOverlay.classList.add('visible');
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
