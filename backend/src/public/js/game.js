const socket = io();
const chess = new Chess();

const boardElement = document.getElementById('board');
const statusPill = document.getElementById('statusPill');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const roleBadge = document.getElementById('roleBadge');
const balanceMarker = document.getElementById('balanceMarker');
const trayTop = document.getElementById('trayTop');       // captured white pieces
const trayBottom = document.getElementById('trayBottom'); // captured black pieces
const moveCounter = document.getElementById('moveCounter');
const materialDiffEl = document.getElementById('materialDiff');

let draggedEl = null;
let sourceSquare = null;
let playerRole = null;   // 'w' | 'b' | null (spectator)
let lastMove = null;     // { from, to }
let moveCount = 0;

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const toSquare = (row, col) => `${files[col]}${8 - row}`;

const UNICODE = {
    w: { p: '\u2659', r: '\u2656', n: '\u2658', b: '\u2657', q: '\u2655', k: '\u2654' },
    b: { p: '\u265F', r: '\u265C', n: '\u265E', b: '\u265D', q: '\u265B', k: '\u265A' },
};

const START_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const getPieceUnicode = (piece) => UNICODE[piece.color]?.[piece.type] || '';

// ---------------------------------------------------------------
// Board rendering
// ---------------------------------------------------------------

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = '';

    const flipped = playerRole === 'b';
    const rows = flipped ? [...board].reverse() : board;

    rows.forEach((row, rIdx) => {
        const displayRow = flipped ? [...row].reverse() : row;

        displayRow.forEach((square, cIdx) => {
            const rowIndex = flipped ? 7 - rIdx : rIdx;
            const colIndex = flipped ? 7 - cIdx : cIdx;
            const squareName = toSquare(rowIndex, colIndex);
            const isLight = (rowIndex + colIndex) % 2 === 0;

            const squareEl = document.createElement('div');
            squareEl.classList.add('square', isLight ? 'light' : 'dark');
            squareEl.dataset.square = squareName;

            if (lastMove && (squareName === lastMove.from || squareName === lastMove.to)) {
                squareEl.classList.add('is-last-move');
            }

            if (chess.in_check && chess.in_check() && square && square.type === 'k' && square.color === chess.turn()) {
                squareEl.classList.add('is-check');
            }

            // coordinate labels along the outer edge
            if (colIndex === 0) {
                const rankLabel = document.createElement('span');
                rankLabel.className = 'coord-rank';
                rankLabel.textContent = 8 - rowIndex;
                squareEl.appendChild(rankLabel);
            }
            if (rowIndex === 7) {
                const fileLabel = document.createElement('span');
                fileLabel.className = 'coord-file';
                fileLabel.textContent = files[colIndex];
                squareEl.appendChild(fileLabel);
            }

            if (square) {
                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece', square.color === 'w' ? 'white' : 'black');
                pieceEl.innerText = getPieceUnicode(square);
                pieceEl.draggable = playerRole === square.color;
                pieceEl.dataset.square = squareName;
                pieceEl.tabIndex = pieceEl.draggable ? 0 : -1;

                pieceEl.addEventListener('dragstart', (e) => {
                    if (!pieceEl.draggable) { e.preventDefault(); return; }
                    draggedEl = pieceEl;
                    sourceSquare = squareName;
                    pieceEl.classList.add('is-dragging');
                    e.dataTransfer.setData('text/plain', '');
                    e.dataTransfer.effectAllowed = 'move';
                    // Patch dots in without touching the DOM node being dragged —
                    // a full renderBoard() here would remove the drag source and
                    // cancel the drag in most browsers.
                    showLegalDots(squareName);
                });

                pieceEl.addEventListener('dragend', () => {
                    pieceEl.classList.remove('is-dragging');
                    clearLegalDots();
                    draggedEl = null;
                    sourceSquare = null;
                });

                squareEl.appendChild(pieceEl);
            }

            squareEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                squareEl.classList.add('is-dragover');
            });

            squareEl.addEventListener('dragleave', () => {
                squareEl.classList.remove('is-dragover');
            });

            squareEl.addEventListener('drop', (e) => {
                e.preventDefault();
                squareEl.classList.remove('is-dragover');
                if (!draggedEl || !sourceSquare) return;
                handleMove(sourceSquare, squareEl.dataset.square);
            });

            boardElement.appendChild(squareEl);
        });
    });
};

const clearLegalDots = () => {
    boardElement.querySelectorAll('.legal-dot').forEach((d) => d.remove());
};

const showLegalDots = (square) => {
    const moves = chess.moves({ square, verbose: true });
    moves.forEach((m) => {
        const targetEl = boardElement.querySelector(`.square[data-square="${m.to}"]`);
        if (!targetEl) return;
        const dot = document.createElement('span');
        dot.className = 'legal-dot' + (m.flags.includes('c') ? ' capture' : '');
        targetEl.appendChild(dot);
    });
};

// ---------------------------------------------------------------
// Move handling
// ---------------------------------------------------------------

const handleMove = (source, target) => {
    const move = { from: source, to: target, promotion: 'q' };
    socket.emit('move', move);
};

// ---------------------------------------------------------------
// Captured-piece trays + material diff
// ---------------------------------------------------------------

const renderTrays = () => {
    const board = chess.board();
    const onBoard = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } };

    board.forEach((row) => row.forEach((sq) => { if (sq) onBoard[sq.color][sq.type]++; }));

    trayTop.innerHTML = '';
    trayBottom.innerHTML = '';

    let materialDiff = 0;

    ['p', 'n', 'b', 'r', 'q'].forEach((type) => {
        const capturedWhite = START_COUNTS[type] - onBoard.w[type];
        const capturedBlack = START_COUNTS[type] - onBoard.b[type];

        for (let i = 0; i < capturedWhite; i++) {
            const chip = document.createElement('span');
            chip.className = 'chip white';
            chip.textContent = UNICODE.w[type];
            trayTop.appendChild(chip);
        }
        for (let i = 0; i < capturedBlack; i++) {
            const chip = document.createElement('span');
            chip.className = 'chip black';
            chip.textContent = UNICODE.b[type];
            trayBottom.appendChild(chip);
        }

        materialDiff += PIECE_VALUE[type] * (onBoard.w[type] - onBoard.b[type]);
    });

    materialDiffEl.textContent = materialDiff === 0 ? '' : (materialDiff > 0 ? `+${materialDiff}` : `${materialDiff}`);
};

// ---------------------------------------------------------------
// Status / toast
// ---------------------------------------------------------------

const setStatus = (text, { check = false } = {}) => {
    statusText.textContent = text;
    statusPill.classList.toggle('is-check', check);
};

const setTurnDot = () => {
    const isBlackTurn = chess.turn() === 'b';
    statusDot.classList.toggle('turn-b', isBlackTurn);
    balanceMarker.classList.toggle('turn-b', isBlackTurn);
};

let toastTimer = null;
const showToast = (message) => {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
};

const refreshStatus = () => {
    setTurnDot();

    if (chess.in_checkmate && chess.in_checkmate()) {
        const winner = chess.turn() === 'w' ? 'Black' : 'White';
        setStatus(`Checkmate — ${winner} wins`, { check: true });
        return;
    }
    if (chess.in_stalemate && chess.in_stalemate()) {
        setStatus('Stalemate — draw');
        return;
    }
    if (chess.in_draw && chess.in_draw()) {
        setStatus('Draw');
        return;
    }

    const turnLabel = chess.turn() === 'w' ? 'White' : 'Black';
    const inCheck = chess.in_check && chess.in_check();

    if (playerRole) {
        const yourTurn = playerRole === chess.turn();
        setStatus(inCheck ? `${turnLabel} to move — check` : (yourTurn ? 'Your move' : `${turnLabel} to move`), { check: inCheck });
    } else {
        setStatus(inCheck ? `${turnLabel} to move — check` : `${turnLabel} to move`, { check: inCheck });
    }
};

// ---------------------------------------------------------------
// Socket events
// ---------------------------------------------------------------

socket.on('playerRole', (role) => {
    playerRole = role;
    roleBadge.textContent = role === 'w' ? 'Playing White' : 'Playing Black';
    renderBoard();
    refreshStatus();
});

socket.on('spectatorRole', () => {
    playerRole = null;
    roleBadge.textContent = 'Spectating';
    renderBoard();
    refreshStatus();
});

socket.on('boardState', (fen) => {
    chess.load(fen);
    renderBoard();
    renderTrays();
    refreshStatus();
});

socket.on('move', (move) => {
    lastMove = { from: move.from, to: move.to };
    moveCount += 1;
    moveCounter.textContent = `MOVE ${moveCount}`;
    renderBoard();
});

socket.on('invalidMove', () => {
    showToast('Invalid move');
});

socket.on('gameOver', (reason) => {
    setStatus(reason, { check: true });
});

renderBoard();
renderTrays();