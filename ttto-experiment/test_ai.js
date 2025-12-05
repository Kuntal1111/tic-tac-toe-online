
// Mock Board and Helpers
let board = [];
let gridSize = 3;

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

function findBestMove() {
    const size = gridSize;
    // 1. Win
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
    // 2. Block
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
    return -1; // No critical move
}

console.log('--- Testing AI Logic ---');

// Test 1: Block Win (3x3)
gridSize = 3;
board = ['X', 'X', '', '', '', '', '', '', ''];
console.log('Test 1 (Block 3x3): AI should pick index 2.');
let move = findBestMove();
console.assert(move === 2, `Expected 2, got ${move}`);

// Test 2: Take Win (4x4)
gridSize = 4;
board = Array(16).fill('');
board[0] = 'O'; board[1] = 'O'; board[2] = 'O'; // One left to win
console.log('Test 2 (Win 4x4): AI should pick index 3.');
move = findBestMove();
console.assert(move === 3, `Expected 3, got ${move}`);

// Test 3: Block Diagonal (5x5)
gridSize = 5;
board = Array(25).fill('');
board[0] = 'X'; board[6] = 'X'; board[12] = 'X'; board[18] = 'X'; // 4 in a row diag
console.log('Test 3 (Block 5x5 Diag): AI should pick index 24.');
move = findBestMove();
console.assert(move === 24, `Expected 24, got ${move}`);

console.log('AI Logic Tests Passed!');
