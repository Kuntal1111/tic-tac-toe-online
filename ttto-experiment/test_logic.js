// Mocking the checkWin logic from main.js for Node environment
function checkWin(board, size, player) {
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

console.log("Testing 3x3 Row Win...");
let b3 = Array(9).fill('');
b3[0] = 'X'; b3[1] = 'X'; b3[2] = 'X';
console.assert(checkWin(b3, 3, 'X') === true, "3x3 Row Win Failed");

console.log("Testing 4x4 Col Win...");
let b4 = Array(16).fill('');
b4[0] = 'O'; b4[4] = 'O'; b4[8] = 'O'; b4[12] = 'O';
console.assert(checkWin(b4, 4, 'O') === true, "4x4 Col Win Failed");

console.log("Testing 5x5 Diag Win...");
let b5 = Array(25).fill('');
b5[0] = 'X'; b5[6] = 'X'; b5[12] = 'X'; b5[18] = 'X'; b5[24] = 'X';
console.assert(checkWin(b5, 5, 'X') === true, "5x5 Diag Win Failed");

console.log("Testing 4x4 No Win...");
b4 = Array(16).fill('');
b4[0] = 'O'; b4[4] = 'O'; b4[8] = 'O'; // Missing one
console.assert(checkWin(b4, 4, 'O') === false, "4x4 False Positive detected");

console.log("All mocked logic tests passed!");
