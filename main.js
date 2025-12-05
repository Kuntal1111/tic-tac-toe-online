import './style.css'
import { io } from "socket.io-client";

// --- NEW SVG MARKERS ---
// Playful, hand-drawn style 'X'
const X_SVG = `<svg viewBox="0 0 100 100"><line x1="20" y1="20" x2="80" y2="80"></line><line x1="80" y1="20" x2="20" y2="80"></line></svg>`;
// Playful, hand-drawn style 'O' (a circle)
const O_SVG = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30"></circle></svg>`;

let scores = JSON.parse(localStorage.getItem('ttto_scores')) || {
    pvp: { x: 0, o: 0, tie: 0 },
    pvc: {
        easy: { x: 0, o: 0, tie: 0 },
        medium: { x: 0, o: 0, tie: 0 },
        hard: { x: 0, o: 0, tie: 0 }
    }
};

function saveScores() {
    localStorage.setItem('ttto_scores', JSON.stringify(scores));
}

let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;
let gameMode = 'pvp';
let computerDifficulty = 'medium';
let moveHistory = [];

// Online Mode Variables
const socket = io();
let roomCode = null;
let myPlayerSymbol = null; // 'X' or 'O'
let isOnline = false;
let onlineScores = { me: 0, opponent: 0, tie: 0 };

const winConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    const cells = document.querySelectorAll('.cell');
    const status = document.getElementById('status');

    // Make resetGame available globally for the onclick handler in HTML
    window.resetGame = resetGame;

    // --- NEW STATUS UPDATE FUNCTION ---
    // Helper to update status text and trigger animation
    function updateStatus(newText) {
        status.textContent = newText;
        status.classList.add('status-change');
        // Remove class after animation to allow re-triggering
        setTimeout(() => {
            status.classList.remove('status-change');
        }, 300);
    }

    // --- MODE SWITCHING ---
    document.getElementById('pvp-mode').addEventListener('click', () => {
        switchMode('pvp');
    });

    document.getElementById('pvc-mode').addEventListener('click', () => {
        switchMode('pvc');
    });

    document.getElementById('online-mode').addEventListener('click', () => {
        switchMode('online');
    });

    function switchMode(mode) {
        gameMode = mode;
        isOnline = (mode === 'online');

        // Reset active classes
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${mode}-mode`).classList.add('active');

        // Hide all sections first
        document.getElementById('difficulty-section').classList.add('hidden');
        document.getElementById('pvp-scores').classList.add('hidden');
        document.getElementById('pvc-difficulty-score').classList.add('hidden');
        document.getElementById('online-scores').classList.add('hidden');
        document.getElementById('online-lobby').classList.add('hidden');

        if (mode === 'pvp') {
            document.getElementById('pvp-scores').classList.remove('hidden');
            resetGame();
        } else if (mode === 'pvc') {
            document.getElementById('difficulty-section').classList.remove('hidden');
            document.getElementById('pvc-difficulty-score').classList.remove('hidden');
            computerDifficulty = 'medium';
            document.getElementById('medium').classList.add('active');
            updateScoreDisplay();
            resetGame();
        } else if (mode === 'online') {
            document.getElementById('online-lobby').classList.remove('hidden');
            updateStatus("Join or Create a Room");
            // Don't reset game immediately, wait for connection
        }
    }

    // --- ONLINE LOBBY HANDLERS ---
    document.getElementById('create-room-btn').addEventListener('click', () => {
        socket.emit('create_room');
        document.getElementById('lobby-status').textContent = "Creating room...";
    });

    document.getElementById('join-room-btn').addEventListener('click', () => {
        const code = document.getElementById('room-code-input').value.toUpperCase();
        if (code.length === 4) {
            socket.emit('join_room', code);
            document.getElementById('lobby-status').textContent = "Joining room...";
        } else {
            document.getElementById('lobby-status').textContent = "Invalid Code";
        }
    });

    // --- SOCKET EVENTS ---
    socket.on('room_created', (code) => {
        roomCode = code;
        myPlayerSymbol = 'X';
        document.getElementById('lobby-status').textContent = `Room Created! Code: ${code}. Waiting for opponent...`;
        updateStatus(`Waiting for opponent... (Code: ${code})`);
    });

    socket.on('game_start', (data) => {
        roomCode = data.roomCode;
        // If I didn't create the room, I must be O
        if (!myPlayerSymbol) myPlayerSymbol = 'O';

        document.getElementById('online-lobby').classList.add('hidden');
        document.getElementById('online-scores').classList.remove('hidden');
        document.getElementById('lobby-status').textContent = "";
        resetGame(); // Clear board
        updateScoreDisplay(); // Show initial 0-0
        updateStatus(myPlayerSymbol === 'X' ? "Your Turn (X)" : "Opponent's Turn (X)");
        alert(`Game Started! You are Player ${myPlayerSymbol}`);
    });

    socket.on('move_made', (data) => {
        makeMove(data.index, data.player);
        moveHistory.push({ player: data.player, position: data.index });

        if (checkWin()) {
            endGame(data.player);
            return;
        }
        if (checkTie()) {
            endGame('tie');
            return;
        }

        currentPlayer = data.nextTurn;
        if (currentPlayer === myPlayerSymbol) {
            updateStatus(`Your Turn (${myPlayerSymbol})`);
        } else {
            updateStatus(`Opponent's Turn (${currentPlayer})`);
        }
    });

    socket.on('opponent_left', () => {
        alert("Opponent disconnected!");
        resetGame();
        switchMode('online'); // Go back to lobby
    });

    socket.on('error_message', (msg) => {
        document.getElementById('lobby-status').textContent = msg;
    });


    // --- DIFFICULTY HANDLERS ---
    document.getElementById('easy').addEventListener('click', () => {
        computerDifficulty = 'easy';
        updateDifficultyUI('easy', 'Easy');
    });

    document.getElementById('medium').addEventListener('click', () => {
        computerDifficulty = 'medium';
        updateDifficultyUI('medium', 'Medium');
    });

    document.getElementById('hard').addEventListener('click', () => {
        computerDifficulty = 'hard';
        updateDifficultyUI('hard', 'Hard');
    });

    function updateDifficultyUI(level, title) {
        document.querySelectorAll('.difficulty-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(level).classList.add('active');
        document.getElementById('difficulty-title').textContent = title;
        updateScoreDisplay();
    }

    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });

    function handleCellClick(e) {
        const index = parseInt(e.target.closest('.cell').dataset.index);

        // Check if move is valid
        if (board[index] !== '' || !gameActive) {
            if (gameActive) shakeCell(e.target.closest('.cell'));
            return;
        }

        // Online Mode Validation
        if (isOnline) {
            if (currentPlayer !== myPlayerSymbol) {
                updateStatus("Not your turn!");
                return;
            }
            // Send move to server
            socket.emit('make_move', { roomCode, index, player: myPlayerSymbol });
            // We wait for server 'move_made' event to actually update UI
            return;
        }

        // Local Mode Logic
        makeMove(index, currentPlayer);
        moveHistory.push({ player: currentPlayer, position: index });

        if (checkWin()) {
            endGame(currentPlayer);
            return;
        }

        if (checkTie()) {
            endGame('tie');
            return;
        }

        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';

        if (gameMode === 'pvc' && currentPlayer === 'O' && gameActive) {
            updateStatus("Computer's Turn...");
            setTimeout(makeComputerMove, 800);
        } else {
            updateStatus(`Player ${currentPlayer}'s Turn`);
        }
    }

    function shakeCell(cell) {
        cell.classList.add('shake');
        setTimeout(() => cell.classList.remove('shake'), 400);
    }

    function endGame(winner) {
        gameActive = false;
        if (winner === 'tie') {
            updateStatus("It's a Tie! 🤝");
            if (!isOnline) {
                if (gameMode === 'pvp') scores.pvp.tie++;
                else scores.pvc[computerDifficulty].tie++;
            }
        } else {
            updateStatus(`🎉 Player ${winner} Wins!`);
            highlightWinningCells();
            if (!isOnline) {
                if (gameMode === 'pvp') scores.pvp[winner.toLowerCase()]++;
                else scores.pvc[computerDifficulty][winner.toLowerCase()]++;
            }
        }

        if (isOnline) {
            if (winner === 'tie') {
                onlineScores.tie++;
            } else if (winner === myPlayerSymbol) {
                onlineScores.me++;
            } else {
                onlineScores.opponent++;
            }
            updateScoreDisplay();
        } else {
            saveScores();
            updateScoreDisplay();
        }
    }

    function makeMove(index, player) {
        board[index] = player;
        if (player === 'X') {
            cells[index].innerHTML = X_SVG;
        } else {
            cells[index].innerHTML = O_SVG;
        }
        cells[index].classList.add('taken', player.toLowerCase());
    }

    function makeComputerMove() {
        if (!gameActive) return;
        let moveIndex;
        switch (computerDifficulty) {
            case 'easy':
                moveIndex = getRandomMove();
                break;
            case 'medium':
                moveIndex = Math.random() > 0.5 ? getSmartMove() : getRandomMove();
                break;
            case 'hard':
                moveIndex = getHardMove();
                break;
        }
        makeMove(moveIndex, 'O');
        moveHistory.push({ player: 'O', position: moveIndex });

        if (checkWin()) {
            endGame('O');
            return;
        }

        if (checkTie()) {
            endGame('tie');
            return;
        }

        currentPlayer = 'X';
        updateStatus(`Player ${currentPlayer}'s Turn`);
    }

    function getRandomMove() {
        const availableMoves = board
            .map((cell, index) => cell === '' ? index : null)
            .filter(index => index !== null);
        const randomIndex = Math.floor(Math.random() * availableMoves.length);
        return availableMoves[randomIndex];
    }

    function getHardMove() {
        const computerMoves = moveHistory.filter(m => m.player === 'O').length;
        const playerMoves = moveHistory.filter(m => m.player === 'X');

        if (computerMoves === 0 && playerMoves.length === 1) {
            const firstMove = playerMoves[0].position;
            const corners = [0, 2, 6, 8];
            if (corners.includes(firstMove) && board[4] === '') {
                return 4;
            }
        }

        if (computerMoves === 1 && playerMoves.length === 2) {
            const firstMove = playerMoves[0].position;
            const secondMove = playerMoves[1].position;
            const corners = [0, 2, 6, 8];

            if (corners.includes(firstMove) && corners.includes(secondMove)) {
                if ((firstMove === 0 && secondMove === 8) || (firstMove === 8 && secondMove === 0) ||
                    (firstMove === 2 && secondMove === 6) || (firstMove === 6 && secondMove === 2)) {
                    const sides = [1, 3, 5, 7];
                    const availableSides = sides.filter(index => board[index] === '');
                    if (availableSides.length > 0) {
                        return availableSides[Math.floor(Math.random() * availableSides.length)];
                    }
                }
            }
        }

        return getSmartMove();
    }

    function getSmartMove() {
        for (const condition of winConditions) {
            const [a, b, c] = condition;
            if (board[a] === 'O' && board[b] === 'O' && board[c] === '') return c;
            if (board[a] === 'O' && board[c] === 'O' && board[b] === '') return b;
            if (board[b] === 'O' && board[c] === 'O' && board[a] === '') return a;
        }
        for (const condition of winConditions) {
            const [a, b, c] = condition;
            if (board[a] === 'X' && board[b] === 'X' && board[c] === '') return c;
            if (board[a] === 'X' && board[c] === 'X' && board[b] === '') return b;
            if (board[b] === 'X' && board[c] === 'X' && board[a] === '') return a;
        }
        if (board[4] === '') return 4;
        const corners = [0, 2, 6, 8];
        const availableCorners = corners.filter(index => board[index] === '');
        if (availableCorners.length > 0) {
            return availableCorners[Math.floor(Math.random() * availableCorners.length)];
        }
        const sides = [1, 3, 5, 7];
        const availableSides = sides.filter(index => board[index] === '');
        if (availableSides.length > 0) {
            return availableSides[Math.floor(Math.random() * availableSides.length)];
        }
        return getRandomMove();
    }

    function checkWin() {
        return winConditions.some(condition => {
            return condition.every(index => {
                return board[index] === currentPlayer;
            });
        });
    }

    function checkTie() {
        return board.every(cell => cell !== '');
    }

    function highlightWinningCells() {
        winConditions.forEach(condition => {
            if (condition.every(index => board[index] === currentPlayer)) {
                condition.forEach(index => {
                    cells[index].classList.add('winner');
                });
            }
        });
    }

    function updateScoreDisplay() {
        document.getElementById('pvp-x-score').textContent = scores.pvp.x;
        document.getElementById('pvp-o-score').textContent = scores.pvp.o;
        document.getElementById('pvp-tie-score').textContent = scores.pvp.tie;
        document.getElementById('pvc-difficulty-x').textContent = scores.pvc[computerDifficulty].x;
        document.getElementById('pvc-difficulty-o').textContent = scores.pvc[computerDifficulty].o;
        document.getElementById('pvc-difficulty-tie').textContent = scores.pvc[computerDifficulty].tie;

        // Online Scores
        document.getElementById('online-me-score').textContent = onlineScores.me;
        document.getElementById('online-opp-score').textContent = onlineScores.opponent;
        document.getElementById('online-tie-score').textContent = onlineScores.tie;
    }

    socket.on('game_restarted', () => {
        resetLocalBoard();
        updateStatus(myPlayerSymbol === 'X' ? "Your Turn (X)" : "Opponent's Turn (X)");
        alert("Game Restarted!");
    });



    function resetGame() {
        if (isOnline) {
            if (roomCode) {
                socket.emit('restart_request', roomCode);
            }
            return;
        }
        resetLocalBoard();
    }

    function resetLocalBoard() {
        board = ['', '', '', '', '', '', '', '', ''];
        currentPlayer = 'X';
        gameActive = true;
        moveHistory = [];

        if (gameMode === 'pvc') {
            if (currentPlayer === 'X') {
                updateStatus(`Player ${currentPlayer}'s Turn`);
            } else {
                updateStatus("Computer's Turn...");
                setTimeout(makeComputerMove, 800);
            }
        } else if (gameMode === 'pvp') {
            updateStatus(`Player ${currentPlayer}'s Turn`);
        }

        cells.forEach(cell => {
            cell.innerHTML = '';
            cell.classList.remove('taken', 'x', 'o', 'winner');
        });
    }

    // Initialize the status on first load
    updateStatus("Player X's Turn");
});

