const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const turnIndicator = document.getElementById('turn-indicator');
const gameOverScreen = document.getElementById('game-over');
const winnerText = document.getElementById('winner-text');

let width, height, cellSize, boardSize, offsetX, offsetY;
const BOARD_DIM = 8;
const PINK = '#ff69b4';
const WHITE = '#ffffff';
const GOLD = '#ffd700';
const LAVENDER = '#e6e6fa';

const PIECES = {
    PAWN: 'P', ROOK: 'R', KNIGHT: 'N', BISHOP: 'B', QUEEN: 'Q', KING: 'K'
};

const PIECE_ICONS = {
    'wP': '🌸', 'wR': '🏰', 'wN': '🦄', 'wB': '💎', 'wQ': '👑', 'wK': '💖',
    'bP': '🎀', 'bR': '🗼', 'bN': '🎠', 'bB': '✨', 'bQ': '👸', 'bK': '🌙'
};

let board = [];
let selectedSquare = null;
let validMoves = [];
let currentTurn = 'w'; // 'w' for Pink (White), 'b' for Lavender (Black)
let particles = [];
let isGameOver = false;

function initBoard() {
    const layout = [
        ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
        ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
        ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
    ];
    board = layout.map(row => [...row]);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    boardSize = Math.min(width, height) * 0.85;
    cellSize = boardSize / BOARD_DIM;
    offsetX = (width - boardSize) / 2;
    offsetY = (height - boardSize) / 2 + 30;
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.size = Math.random() * 8 + 4;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02;
        this.size *= 0.95;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function getValidMoves(r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = piece[0];
    const type = piece[1];
    const moves = [];

    const addMove = (nr, nc) => {
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (!board[nr][nc] || board[nr][nc][0] !== color) {
                moves.push({ r: nr, c: nc });
                return !board[nr][nc]; // Continue if square was empty
            }
        }
        return false;
    };

    if (type === 'P') {
        const dir = color === 'w' ? -1 : 1;
        // Forward
        if (r + dir >= 0 && r + dir < 8 && !board[r + dir][c]) {
            moves.push({ r: r + dir, c: c });
            // Double step
            if ((color === 'w' && r === 6) || (color === 'b' && r === 1)) {
                if (!board[r + 2 * dir][c]) moves.push({ r: r + 2 * dir, c: c });
            }
        }
        // Capture
        for (let dc of [-1, 1]) {
            let nc = c + dc;
            let nr = r + dir;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                if (board[nr][nc] && board[nr][nc][0] !== color) moves.push({ r: nr, c: nc });
            }
        }
    } else if (type === 'R' || type === 'Q') {
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        dirs.forEach(d => {
            for (let i = 1; i < 8; i++) {
                if (!addMove(r + d[0] * i, c + d[1] * i)) break;
            }
        });
    }
    
    if (type === 'B' || type === 'Q') {
        const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        dirs.forEach(d => {
            for (let i = 1; i < 8; i++) {
                if (!addMove(r + d[0] * i, c + d[1] * i)) break;
            }
        });
    }

    if (type === 'N') {
        const jumps = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
        jumps.forEach(j => addMove(r + j[0], c + j[1]));
    }

    if (type === 'K') {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr !== 0 || dc !== 0) addMove(r + dr, c + dc);
            }
        }
    }

    return moves;
}

function handleMouse(e) {
    if (isGameOver) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const c = Math.floor((mx - offsetX) / cellSize);
    const r = Math.floor((my - offsetY) / cellSize);

    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const clickedMove = validMoves.find(m => m.r === r && m.c === c);
        
        if (clickedMove && selectedSquare) {
            // Move piece
            const targetPiece = board[r][c];
            if (targetPiece && targetPiece[1] === 'K') {
                endGame(currentTurn === 'w' ? 'Pink' : 'Lavender');
            }
            
            board[r][c] = board[selectedSquare.r][selectedSquare.c];
            board[selectedSquare.r][selectedSquare.c] = null;
            
            createExplosion(offsetX + c * cellSize + cellSize/2, offsetY + r * cellSize + cellSize/2, currentTurn === 'w' ? PINK : GOLD);
            
            selectedSquare = null;
            validMoves = [];
            currentTurn = currentTurn === 'w' ? 'b' : 'w';
            turnIndicator.innerText = currentTurn === 'w' ? "Pink's Turn" : "Lavender's Turn";
            turnIndicator.style.color = currentTurn === 'w' ? PINK : '#9370db';
        } else {
            const piece = board[r][c];
            if (piece && piece[0] === currentTurn) {
                selectedSquare = { r, c };
                validMoves = getValidMoves(r, c);
            } else {
                selectedSquare = null;
                validMoves = [];
            }
        }
    } else {
        selectedSquare = null;
        validMoves = [];
    }
}

function endGame(winner) {
    isGameOver = true;
    gameOverScreen.classList.remove('hidden');
    winnerText.innerText = winner + " Wins!";
}

function draw() {
    ctx.clearRect(0, 0, width, height);

    // Draw board shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(offsetX + 10, offsetY + 10, boardSize, boardSize);

    // Draw squares
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const isLight = (r + c) % 2 === 0;
            ctx.fillStyle = isLight ? WHITE : '#ffb6c1';
            
            // Highlight selected
            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                ctx.fillStyle = '#ff1493';
            }

            ctx.fillRect(offsetX + c * cellSize, offsetY + r * cellSize, cellSize, cellSize);
            
            // Board border
            ctx.strokeStyle = '#ff69b4';
            ctx.lineWidth = 1;
            ctx.strokeRect(offsetX + c * cellSize, offsetY + r * cellSize, cellSize, cellSize);

            // Draw pieces
            const piece = board[r][c];
            if (piece) {
                ctx.font = `${cellSize * 0.7}px Montserrat`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(PIECE_ICONS[piece], offsetX + c * cellSize + cellSize / 2, offsetY + r * cellSize + cellSize / 2);
            }
        }
    }

    // Draw valid moves
    validMoves.forEach(m => {
        ctx.beginPath();
        ctx.arc(offsetX + m.c * cellSize + cellSize / 2, offsetY + m.r * cellSize + cellSize / 2, cellSize * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 20, 147, 0.4)';
        ctx.fill();
        
        if (board[m.r][m.c]) {
            ctx.strokeStyle = '#ff1493';
            ctx.lineWidth = 4;
            ctx.strokeRect(offsetX + m.c * cellSize + 5, offsetY + m.r * cellSize + 5, cellSize - 10, cellSize - 10);
        }
    });

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    requestAnimationFrame(draw);
}

window.addEventListener('resize', resize);
canvas.addEventListener('mousedown', handleMouse);

// Initial setup
resize();
initBoard();
draw();

console.log("Barbie Chess initialized. Sparkle on!");