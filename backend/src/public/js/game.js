const socket = io();
const chess = new Chess();
const boardElement = document.querySelector('.board');

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = ''
    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement('div');
            squareElement.classList.add('square',
            (rowIndex + squareIndex) % 2 === 0 ? 'bg-amber-100' : 'bg-amber-800');

            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = squareIndex;

            if (square) {
                const pieceElement = document.createElement('div');
                pieceElement.classList.add('piece',square.color === 'white' ? 'white' : 'black');
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = true;
                pieceElement.dataset.piece = square.type;
                pieceElement.dataset.color = square.color;
                squareElement.appendChild(pieceElement);
            }
            boardElement.appendChild(squareElement);
        });
    });
};

const handleMove = () =>{};

const getPieceUnicode = () => {};