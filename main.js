import './style.css'
import { io } from "socket.io-client";

// --- Game State ---
let board = [];
let currentPlayer = 'X'; // 'X' or 'O'
let gameActive = true;
let gameMode = 'pvp'; // 'pvp', 'pvc', 'online'
let difficulty = 'medium'; // 'easy', 'medium', 'hard'
let gridSize = 3; // 3, 4, 5

// --- Online State ---
const SERVER_URL = 'https://tic-tac-toe-online-m0ju.onrender.com';
const socket = io(SERVER_URL);
let roomCode = null;
let myPlayerSymbol = null; // 'X' or 'O'
let isOnline = false;

// --- Scores ---
let scores = JSON.parse(localStorage.getItem('ttto_scores')) || {
    pvp: { x: 0, o: 0, ties: 0 },
    pvc: {
        easy: { x: 0, o: 0, ties: 0 },
        medium: { x: 0, o: 0, ties: 0 },
        hard: { x: 0, o: 0, ties: 0 }
    },
    online: { me: 0, opp: 0, ties: 0 }
};
// Force reset online scores (ephemeral)
scores.online = { me: 0, opp: 0, ties: 0 };

// --- DOM Elements ---
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const modeButtons = document.querySelectorAll('.mode-btn');
const difficultySection = document.getElementById('difficulty-section');
const gridSizeSection = document.getElementById('grid-size-section');

// Selectors for specific button groups
const difficultyBtns = document.querySelectorAll('#difficulty-section .difficulty-btn');
const gridSizeBtns = document.querySelectorAll('#grid-size-section .difficulty-btn');

const onlineLobby = document.getElementById('online-lobby');
const roomCodeInput = document.getElementById('room-code-input');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const lobbyStatus = document.getElementById('lobby-status');

// --- Initialization ---
function init() {
    setupEventListeners();
    updateScoreDisplay(); // Show initial scores
    createBoard(gridSize);
    updateStatus("Player X's Turn");
}

// --- Event Listeners ---
function setupEventListeners() {
    // Mode Switching
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Confirmation if leaving active room
            if (isOnline && roomCode && !confirm("Disconnect from current room?")) {
                return;
            }
            if (isOnline && roomCode) {
                socket.emit('leave_room', roomCode);
            }

            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setGameMode(btn.id.replace('-mode', ''));
        });
    });

    // Difficulty Switching
    difficultyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            difficultyBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            difficulty = btn.id;
            updateScoreDisplay();
            resetGame();
        });
    });

    // Grid Size Switching
    gridSizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // If in an active online room, request a grid change
            if (isOnline && roomCode) {
                socket.emit('request_grid_change', { roomCode, newSize: parseInt(btn.dataset.size) });
                return;
            }

            gridSizeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gridSize = parseInt(btn.dataset.size);

            // Only reset game if we are offline OR if we are in the lobby (no room code yet).
            if (!isOnline || !roomCode) resetGame();
        });
    });

    // Online Lobby
    createRoomBtn.addEventListener('click', () => {
        socket.emit('create_room', gridSize); // Send selected size
    });

    joinRoomBtn.addEventListener('click', () => {
        const code = roomCodeInput.value.trim().toUpperCase();
        if (code) socket.emit('join_room', code);
    });

    // Global Reset
    window.resetGame = resetGame;
}

function setGameMode(mode) {
    gameMode = mode;
    isOnline = (mode === 'online');

    // UI Visibility
    difficultySection.classList.toggle('hidden', mode !== 'pvc');
    onlineLobby.classList.toggle('hidden', mode !== 'online');

    // Grid size is allowed in all modes, but managed differently in online
    // We keep it visible generally.

    document.getElementById('pvp-scores').classList.toggle('hidden', mode !== 'pvp');
    document.getElementById('pvc-difficulty-score').classList.toggle('hidden', mode !== 'pvc');
    document.getElementById('online-scores').classList.toggle('hidden', mode !== 'online');
    document.documentElement.style.setProperty('--grid-size', gridSize);

    board = Array(gridSize * gridSize).fill('');
    boardElement.innerHTML = '';
    gameActive = true;
    currentPlayer = 'X';

    for (let i = 0; i < board.length; i++) {
        const cell = document.createElement('button');
        cell.classList.add('cell');
        cell.dataset.index = i;
        cell.addEventListener('click', () => handleCellClick(i));
        boardElement.appendChild(cell);
    }
}

function handleCellClick(index) {
    if (board[index] !== '' || !gameActive) return;

    if (isOnline) {
        if (currentPlayer !== myPlayerSymbol) return; // Not your turn
        socket.emit('make_move', { roomCode, index, player: myPlayerSymbol });
        return;
    }

    // Local Move
    makeMove(index, currentPlayer);

    if (!gameActive) return;

    // AI Move
    if (gameMode === 'pvc' && currentPlayer === 'O') {
        setTimeout(makeComputerMove, 500);
    }
}

function makeMove(index, player) {
    board[index] = player;
    const cell = boardElement.children[index];

    // SVG X/O Logic
    if (player === 'X') {
        cell.innerHTML = `<svg viewBox="0 0 100 100"><line x1="20" y1="20" x2="80" y2="80" style="stroke:#667eea;stroke-width:10;stroke-linecap:round" /><line x1="80" y1="20" x2="20" y2="80" style="stroke:#667eea;stroke-width:10;stroke-linecap:round" /></svg>`;
        cell.classList.add('x', 'taken');
    } else {
        cell.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" style="fill:none;stroke:#764ba2;stroke-width:10" /></svg>`;
        cell.classList.add('o', 'taken');
    }

    if (checkWin(player)) {
        endGame(player);
    } else if (!board.includes('')) {
        endGame('draw');
    } else {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        if (isOnline) {
            updateStatus(currentPlayer === myPlayerSymbol ? "Your Turn (X)" : "Opponent's Turn (O)");
        } else {
            updateStatus(`Player ${currentPlayer}'s Turn`);
        }
    }
}

function checkWin(player) {
    const size = gridSize;
    // Rows
    for (let r = 0; r < size; r++) {
        if (Array.from({ length: size }, (_, i) => board[r * size + i]).every(c => c === player)) return true;
    }
    // Cols
    for (let c = 0; c < size; c++) {
        if (Array.from({ length: size }, (_, i) => board[i * size + c]).every(c => c === player)) return true;
    }
    // Diag 1
    if (Array.from({ length: size }, (_, i) => board[i * size + i]).every(c => c === player)) return true;
    // Diag 2
    if (Array.from({ length: size }, (_, i) => board[i * size + (size - 1 - i)]).every(c => c === player)) return true;

    return false;
}

function endGame(winner) {
    gameActive = false;
    let message = "";

    if (winner === 'draw') {
        message = "It's a Draw!";
        updateScores('draw');
    } else {
        message = `Player ${winner} Wins! 🎉`;
        updateScores(winner);
        highlightWin(winner);
    }

    updateStatus(message);
    updateScoreDisplay();
}

function updateScores(winner) {
    if (gameMode === 'pvp') {
        if (winner === 'draw') scores.pvp.ties++;
        else scores.pvp[winner.toLowerCase()]++;
    } else if (gameMode === 'pvc') {
        if (winner === 'draw') scores.pvc[difficulty].ties++;
        else scores.pvc[difficulty][winner.toLowerCase()]++;
    } else if (gameMode === 'online') {
        // Online scoring logic
        if (winner === 'draw') scores.online.ties++;
        else if (winner === myPlayerSymbol) scores.online.me++;
        else scores.online.opp++;
    }
    saveScores();
}

function updateScoreDisplay() {
    // PvP
    document.getElementById('pvp-x-score').textContent = scores.pvp.x;
    document.getElementById('pvp-o-score').textContent = scores.pvp.o;
    document.getElementById('pvp-tie-score').textContent = scores.pvp.ties;

    // PvC
    if (scores.pvc[difficulty]) {
        document.getElementById('pvc-difficulty-x').textContent = scores.pvc[difficulty].x;
        document.getElementById('pvc-difficulty-o').textContent = scores.pvc[difficulty].o;
        document.getElementById('pvc-difficulty-tie').textContent = scores.pvc[difficulty].ties;
        document.getElementById('difficulty-title').textContent = capitalize(difficulty);
    }

    // Online
    document.getElementById('online-me-score').textContent = scores.online.me;
    document.getElementById('online-opp-score').textContent = scores.online.opp;
    document.getElementById('online-tie-score').textContent = scores.online.ties;
}

// --- AI Logic (Generic) ---
function makeComputerMove() {
    if (!gameActive) return;

    // Win > Block > Center > Random
    // Difficulty Variation:
    // Easy: Random
    // Medium: Block sometimes?
    // Hard: Always Win/Block + Center

    let move = -1;

    if (difficulty === 'easy') {
        move = getRandomMove();
    } else if (difficulty === 'medium') {
        // 50% chance to be smart
        if (Math.random() > 0.5) move = getBestMove();
        else move = getRandomMove();
    } else {
        move = getBestMove();
    }

    // Fallback if getBestMove returns nothing (e.g. board full, shouldn't happen)
    if (move === -1 || board[move] !== '') move = getRandomMove();

    makeMove(move, 'O');
}

function getBestMove() {
    // 1. Check Win
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            if (checkWin('O')) { board[i] = ''; return i; }
            board[i] = '';
        }
    }
    // 2. Block Win
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            board[i] = 'X';
            if (checkWin('X')) { board[i] = ''; return i; }
            board[i] = '';
        }
    }
    // 3. Center
    const center = Math.floor((gridSize * gridSize) / 2);
    if (board[center] === '') return center;

    // 4. Random Priority
    return getRandomMove();
}

function getRandomMove() {
    const available = board.map((c, i) => c === '' ? i : null).filter(c => c !== null);
    if (available.length === 0) return -1;
    return available[Math.floor(Math.random() * available.length)];
}

// --- Socket Events ---
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('room_created', (code) => {
    roomCode = code;
    myPlayerSymbol = 'X';
    lobbyStatus.textContent = `Room Created! Code: ${code} (Size: ${gridSize}x${gridSize})`;
    updateStatus(`Waiting for opponent... (Code: ${code})`);
});

socket.on('game_start', (data) => {
    roomCode = data.roomCode;
    // If I didn't create the room, I must be O
    if (!myPlayerSymbol) myPlayerSymbol = 'O';

    // IMPORTANT: Sync Grid Size
    if (data.gridSize) {
        gridSize = data.gridSize;
        createBoard(gridSize);

        // Update UI button state
        gridSizeBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size) === gridSize);
        });
    }

    document.getElementById('online-lobby').classList.add('hidden');
    document.getElementById('online-scores').classList.remove('hidden');

    lobbyStatus.textContent = "";
    updateStatus(myPlayerSymbol === 'X' ? "Your Turn (X)" : "Opponent's Turn (X)");
    alert(`Game Started! You are Player ${myPlayerSymbol}`);
});

socket.on('move_made', (data) => {
    makeMove(data.index, data.player);
});

socket.on('opponent_left', () => {
    alert("Opponent Left!");
    setGameMode('online'); // Reset to lobby
});

socket.on('game_restarted', () => {
    createBoard(gridSize);
    updateStatus(myPlayerSymbol === 'X' ? "Your Turn (X)" : "Opponent's Turn (X)");
});

socket.on('error_message', (msg) => alert(msg));

// --- Helpers ---
function resetGame() {
    if (isOnline && roomCode) {
        socket.emit('restart_request', roomCode);
    } else {
        createBoard(gridSize);
        updateStatus("Player X's Turn");
    }
}

function highlightWin(player) {
    const size = gridSize;
    // Re-check to find winning line for highlight
    // Rows
    for (let r = 0; r < size; r++) {
        let indices = Array.from({ length: size }, (_, i) => r * size + i);
        if (indices.every(i => board[i] === player)) {
            indices.forEach(i => boardElement.children[i].classList.add('winner'));
            return;
        }
    }
    // Cols
    for (let c = 0; c < size; c++) {
        let indices = Array.from({ length: size }, (_, i) => i * size + c);
        if (indices.every(i => board[i] === player)) {
            indices.forEach(i => boardElement.children[i].classList.add('winner'));
            return;
        }
    }
    // Diag 1
    let d1 = Array.from({ length: size }, (_, i) => i * size + i);
    if (d1.every(i => board[i] === player)) {
        d1.forEach(i => boardElement.children[i].classList.add('winner'));
        return;
    }
    // Diag 2
    let d2 = Array.from({ length: size }, (_, i) => i * size + (size - 1 - i));
    if (d2.every(i => board[i] === player)) {
        d2.forEach(i => boardElement.children[i].classList.add('winner'));
        return;
    }
}

function saveScores() {
    // Persist only PvP and PvC. Online scores are ephemeral.
    const scoresToSave = {
        ...scores,
        online: { me: 0, opp: 0, ties: 0 }
    };
    localStorage.setItem('ttto_scores', JSON.stringify(scoresToSave));
}

function updateStatus(msg) {
    statusElement.textContent = msg;
    statusElement.classList.remove('status-change');
    void statusElement.offsetWidth; // Trigger reflow
    statusElement.classList.add('status-change');
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Start
init();
