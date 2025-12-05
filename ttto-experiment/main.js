const app = document.getElementById('app');
const sizeSelector = document.getElementById('size-selector');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('reset-btn');

let gridSize = 3;
let board = [];
let currentPlayer = 'X';
let gameActive = true;

function createBoard(size) {
    gridSize = parseInt(size);
    board = Array(gridSize * gridSize).fill('');
    gameActive = true;
    currentPlayer = 'X';

    app.style.setProperty('--grid-size', gridSize);
    app.innerHTML = '';

    board.forEach((cell, index) => {
        const cellDiv = document.createElement('div');
        cellDiv.classList.add('cell');
        cellDiv.dataset.index = index;
        cellDiv.addEventListener('click', handleCellClick);
        app.appendChild(cellDiv);
    });

    updateStatus(`Player ${currentPlayer}'s Turn`);
}


const modeSelector = document.getElementById('mode-selector');
let gameMode = 'pvp'; // 'pvp' or 'pvc'

sizeSelector.addEventListener('change', (e) => createBoard(e.target.value));
modeSelector.addEventListener('change', (e) => {
    gameMode = e.target.value;
    createBoard(sizeSelector.value);
});
resetBtn.addEventListener('click', () => createBoard(sizeSelector.value));

function handleCellClick(e) {
    const index = parseInt(e.target.dataset.index);
    if (board[index] !== '' || !gameActive) return;

    // Human Move
    makeMove(index, currentPlayer);

    if (!gameActive) return;

    // Computer Move (if PVC and it's O's turn)
    if (gameMode === 'pvc' && currentPlayer === 'O') {
        // Small delay for realism
        setTimeout(makeComputerMove, 500);
    }
}

function makeMove(index, player) {
    board[index] = player;
    const cell = document.querySelector(`.cell[data-index='${index}']`);
    if (cell) {
        cell.textContent = player;
        cell.classList.add(player.toLowerCase());
    }

    if (checkWin(player)) {
        updateStatus(`Player ${player} Wins! 🎉`);
        gameActive = false;
        highlightWin(player);
        return;
    }

    if (!board.includes('')) {
        updateStatus("It's a Tie!");
        gameActive = false;
        return;
    }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateStatus(`Player ${currentPlayer}'s Turn`);
}

function makeComputerMove() {
    if (!gameActive) return;

    const moveIndex = findBestMove();
    makeMove(moveIndex, 'O');
}

function findBestMove() {
    const size = gridSize;

    // 1. Check for Win (O)
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            if (checkWin('O')) {
                board[i] = '';
                return i;
            }
            board[i] = '';
        }
    }

    // 2. Block Opponent (X)
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            board[i] = 'X';
            if (checkWin('X')) {
                board[i] = '';
                return i;
            }
            board[i] = '';
        }
    }

    // 3. Take Center if available (good heuristic)
    const center = Math.floor((size * size) / 2);
    if (board[center] === '') return center;

    // 4. Random Move
    const available = board.map((c, i) => c === '' ? i : null).filter(i => i !== null);
    return available[Math.floor(Math.random() * available.length)];
}

// Init
createBoard(3);

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

    // Diag 1 (Top-Left to Bottom-Right)
    if (Array.from({ length: size }, (_, i) => board[i * size + i]).every(c => c === player)) return true;

    // Diag 2 (Top-Right to Bottom-Left)
    if (Array.from({ length: size }, (_, i) => board[i * size + (size - 1 - i)]).every(c => c === player)) return true;

    return false;
}

function highlightWin(player) {
    // Basic highlight implementation could be added but skipping for core logic check
    const cells = document.querySelectorAll('.cell');
    cells.forEach(c => {
        if (c.textContent === player) c.style.backgroundColor = '#d4edda';
    });
}

function updateStatus(msg) {
    statusDiv.textContent = msg;
}


