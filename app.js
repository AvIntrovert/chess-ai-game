const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PIECE_SYMBOLS = {
  w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
  b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" }
};
const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const moveLogEl = document.getElementById("move-log");
const sideSelectEl = document.getElementById("side-select");
const aiLevelEl = document.getElementById("ai-level");
const newGameBtn = document.getElementById("new-game-btn");

const gameState = {
  board: [],
  currentTurn: "w",
  playerColor: "w",
  aiLevel: "medium",
  selected: null,
  legalMoves: [],
  moveHistory: [],
  enPassantTarget: null,
  castlingRights: {
    w: { kingSide: true, queenSide: true },
    b: { kingSide: true, queenSide: true }
  },
  winner: null
};

function createInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  board[0] = [
    { type: "r", color: "b" },
    { type: "n", color: "b" },
    { type: "b", color: "b" },
    { type: "q", color: "b" },
    { type: "k", color: "b" },
    { type: "b", color: "b" },
    { type: "n", color: "b" },
    { type: "r", color: "b" }
  ];

  board[1] = Array(8).fill({ type: "p", color: "b" });
  board[6] = Array(8).fill({ type: "p", color: "w" });

  board[7] = [
    { type: "r", color: "w" },
    { type: "n", color: "w" },
    { type: "b", color: "w" },
    { type: "q", color: "w" },
    { type: "k", color: "w" },
    { type: "b", color: "w" },
    { type: "n", color: "w" },
    { type: "r", color: "w" }
  ];

  return board;
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function opponent(color) {
  return color === "w" ? "b" : "w";
}

function findKing(state, color) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = state.board[row][col];
      if (piece && piece.color === color && piece.type === "k") {
        return { row, col };
      }
    }
  }
  return null;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function squareId(row, col) {
  return `${row},${col}`;
}

function getPieceAt(state, row, col) {
  if (!isInsideBoard(row, col)) return null;
  return state.board[row][col];
}

function isPieceColor(piece, color) {
  return Boolean(piece) && piece.color === color;
}

function isSquareAttacked(state, row, col, byColor) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = state.board[r][c];
      if (!piece || piece.color !== byColor) continue;

      const dr = row - r;
      const dc = col - c;

      if (piece.type === "p") {
        const direction = piece.color === "w" ? -1 : 1;
        if ((dc === 1 || dc === -1) && dr === direction) return true;
        continue;
      }

      if (piece.type === "n") {
        const deltas = [
          [2, 1], [2, -1], [-2, 1], [-2, -1],
          [1, 2], [1, -2], [-1, 2], [-1, -2]
        ];
        if (deltas.some(([rd, cd]) => r + rd === row && c + cd === col)) return true;
        continue;
      }

      if (piece.type === "k") {
        if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && !(dr === 0 && dc === 0)) return true;
        continue;
      }

      if (piece.type === "b" || piece.type === "r" || piece.type === "q") {
        const directions = [];
        if (piece.type === "b" || piece.type === "q") {
          directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        }
        if (piece.type === "r" || piece.type === "q") {
          directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
        }

        for (const [drDir, dcDir] of directions) {
          let rr = r + drDir;
          let cc = c + dcDir;
          while (isInsideBoard(rr, cc)) {
            if (rr === row && cc === col) return true;
            if (state.board[rr][cc]) break;
            rr += drDir;
            cc += dcDir;
          }
        }
      }
    }
  }

  return false;
}

function isKingInCheck(state, color) {
  const king = findKing(state, color);
  if (!king) return false;
  return isSquareAttacked(state, king.row, king.col, opponent(color));
}

function generatePseudoMovesForPiece(state, row, col, piece) {
  if (!piece) return [];
  const moves = [];

  if (piece.type === "p") {
    const direction = piece.color === "w" ? -1 : 1;
    const startRow = piece.color === "w" ? 6 : 1;
    const oneStepRow = row + direction;

    if (isInsideBoard(oneStepRow, col) && !state.board[oneStepRow][col]) {
      moves.push({ fromRow: row, fromCol: col, toRow: oneStepRow, toCol: col, pieceType: piece.type, pieceColor: piece.color, promotion: oneStepRow === 0 || oneStepRow === 7 });

      const twoStepRow = row + direction * 2;
      if (row === startRow && !state.board[twoStepRow][col]) {
        moves.push({ fromRow: row, fromCol: col, toRow: twoStepRow, toCol: col, pieceType: piece.type, pieceColor: piece.color, isDoublePawnMove: true });
      }
    }

    for (const deltaCol of [-1, 1]) {
      const targetRow = row + direction;
      const targetCol = col + deltaCol;
      if (!isInsideBoard(targetRow, targetCol)) continue;

      const targetPiece = state.board[targetRow][targetCol];
      if (targetPiece && targetPiece.color !== piece.color) {
        moves.push({ fromRow: row, fromCol: col, toRow: targetRow, toCol: targetCol, pieceType: piece.type, pieceColor: piece.color, capture: true, promotion: targetRow === 0 || targetRow === 7 });
      }

      if (
        state.enPassantTarget &&
        targetRow === state.enPassantTarget.row &&
        targetCol === state.enPassantTarget.col &&
        Math.abs(col - targetCol) === 1
      ) {
        moves.push({
          fromRow: row,
          fromCol: col,
          toRow: targetRow,
          toCol: targetCol,
          pieceType: piece.type,
          pieceColor: piece.color,
          isEnPassant: true,
          capture: true,
          promotion: targetRow === 0 || targetRow === 7
        });
      }
    }
  }

  if (piece.type === "r" || piece.type === "b" || piece.type === "q") {
    const directions = [];
    if (piece.type === "r" || piece.type === "q") {
      directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    }
    if (piece.type === "b" || piece.type === "q") {
      directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    }

    for (const [dr, dc] of directions) {
      let rr = row + dr;
      let cc = col + dc;
      while (isInsideBoard(rr, cc)) {
        const occupant = state.board[rr][cc];
        if (!occupant) {
          moves.push({ fromRow: row, fromCol: col, toRow: rr, toCol: cc, pieceType: piece.type, pieceColor: piece.color });
        } else {
          if (occupant.color !== piece.color) {
            moves.push({ fromRow: row, fromCol: col, toRow: rr, toCol: cc, pieceType: piece.type, pieceColor: piece.color, capture: true });
          }
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }

  if (piece.type === "n") {
    const offsets = [
      [2, 1], [2, -1], [-2, 1], [-2, -1],
      [1, 2], [1, -2], [-1, 2], [-1, -2]
    ];

    for (const [dr, dc] of offsets) {
      const rr = row + dr;
      const cc = col + dc;
      if (!isInsideBoard(rr, cc)) continue;
      const occupant = state.board[rr][cc];
      if (!occupant || occupant.color !== piece.color) {
        moves.push({ fromRow: row, fromCol: col, toRow: rr, toCol: cc, pieceType: piece.type, pieceColor: piece.color, capture: Boolean(occupant) });
      }
    }
  }

  if (piece.type === "k") {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const rr = row + dr;
        const cc = col + dc;
        if (!isInsideBoard(rr, cc)) continue;
        const occupant = state.board[rr][cc];
        if (!occupant || occupant.color !== piece.color) {
          moves.push({ fromRow: row, fromCol: col, toRow: rr, toCol: cc, pieceType: piece.type, pieceColor: piece.color, capture: Boolean(occupant) });
        }
      }
    }

    const rights = state.castlingRights[piece.color];
    if (rights && !isKingInCheck(state, piece.color)) {
      if (rights.kingSide) {
        const rookCol = 7;
        const pathClear = [5, 6].every((targetCol) => !state.board[row][targetCol]);
        const rookExists = state.board[row][rookCol] && state.board[row][rookCol].type === "r" && state.board[row][rookCol].color === piece.color;
        if (pathClear && rookExists) {
          const kingPathSquares = [5, 6];
          const safe = kingPathSquares.every((targetCol) => !isSquareAttacked(state, row, targetCol, opponent(piece.color)));
          if (safe) {
            moves.push({ fromRow: row, fromCol: col, toRow: row, toCol: 6, pieceType: piece.type, pieceColor: piece.color, castle: "king" });
          }
        }
      }

      if (rights.queenSide) {
        const rookCol = 0;
        const pathClear = [1, 2, 3].every((targetCol) => !state.board[row][targetCol]);
        const rookExists = state.board[row][rookCol] && state.board[row][rookCol].type === "r" && state.board[row][rookCol].color === piece.color;
        if (pathClear && rookExists) {
          const kingPathSquares = [2, 3];
          const safe = kingPathSquares.every((targetCol) => !isSquareAttacked(state, row, targetCol, opponent(piece.color)));
          if (safe) {
            moves.push({ fromRow: row, fromCol: col, toRow: row, toCol: 2, pieceType: piece.type, pieceColor: piece.color, castle: "queen" });
          }
        }
      }
    }
  }

  return moves;
}

function applyMoveToState(state, move) {
  const next = cloneState(state);
  const { fromRow, fromCol, toRow, toCol } = move;
  const movingPiece = next.board[fromRow][fromCol];
  if (!movingPiece) return next;

  next.board[fromRow][fromCol] = null;
  let capturedPiece = next.board[toRow][toCol];

  if (move.isEnPassant) {
    capturedPiece = next.board[fromRow][toCol];
    next.board[fromRow][toCol] = null;
  }

  let movingPieceAfterMove = { ...movingPiece };
  if (movingPiece.type === "p" && (toRow === 0 || toRow === 7)) {
    movingPieceAfterMove = { type: "q", color: movingPiece.color };
  }

  next.board[toRow][toCol] = movingPieceAfterMove;

  if (movingPiece.type === "k") {
    next.castlingRights[movingPiece.color] = { kingSide: false, queenSide: false };
  }

  if (movingPiece.type === "r") {
    if (fromRow === 0 && fromCol === 0) next.castlingRights.b.queenSide = false;
    if (fromRow === 0 && fromCol === 7) next.castlingRights.b.kingSide = false;
    if (fromRow === 7 && fromCol === 0) next.castlingRights.w.queenSide = false;
    if (fromRow === 7 && fromCol === 7) next.castlingRights.w.kingSide = false;
  }

  if (capturedPiece && capturedPiece.type === "r") {
    if (toRow === 0 && toCol === 0) next.castlingRights.b.queenSide = false;
    if (toRow === 0 && toCol === 7) next.castlingRights.b.kingSide = false;
    if (toRow === 7 && toCol === 0) next.castlingRights.w.queenSide = false;
    if (toRow === 7 && toCol === 7) next.castlingRights.w.kingSide = false;
  }

  if (move.castle === "king") {
    next.board[rowForSide(movingPiece.color)][5] = { type: "r", color: movingPiece.color };
    next.board[rowForSide(movingPiece.color)][7] = null;
  }

  if (move.castle === "queen") {
    next.board[rowForSide(movingPiece.color)][3] = { type: "r", color: movingPiece.color };
    next.board[rowForSide(movingPiece.color)][0] = null;
  }

  if (movingPiece.type === "p" && Math.abs(toRow - fromRow) === 2) {
    next.enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
  } else {
    next.enPassantTarget = null;
  }

  next.currentTurn = opponent(movingPiece.color);
  next.moveHistory.push({
    notation: formatMoveNotation(move, movingPiece),
    color: movingPiece.color,
    move
  });

  return next;
}

function rowForSide(color) {
  return color === "w" ? 7 : 0;
}

function formatMoveNotation(move, piece) {
  if (move.castle === "king") return "O-O";
  if (move.castle === "queen") return "O-O-O";

  const pieceLetter = piece.type === "p" ? "" : piece.type.toUpperCase();
  const from = `${FILES[move.fromCol]}${8 - move.fromRow}`;
  const to = `${FILES[move.toCol]}${8 - move.toRow}`;
  const capture = move.capture ? "x" : "-";
  return `${pieceLetter}${from}${capture}${to}`;
}

function getLegalMovesForSquare(state, row, col) {
  const piece = state.board[row][col];
  if (!piece || piece.color !== state.currentTurn) return [];

  const pseudoMoves = generatePseudoMovesForPiece(state, row, col, piece);
  const legalMoves = [];

  for (const move of pseudoMoves) {
    const nextState = applyMoveToState(state, move);
    if (!isKingInCheck(nextState, piece.color)) {
      legalMoves.push(move);
    }
  }

  return legalMoves;
}

function generateLegalMovesForColor(state, color) {
  const moves = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = state.board[row][col];
      if (piece && piece.color === color) {
        moves.push(...getLegalMovesForSquare({ ...state, currentTurn: color }, row, col));
      }
    }
  }
  return moves;
}

function isMoveLegal(move, state) {
  const piece = state.board[move.fromRow][move.fromCol];
  if (!piece) return false;
  const nextState = applyMoveToState(state, move);
  return !isKingInCheck(nextState, piece.color);
}

function selectSquare(row, col) {
  const piece = gameState.board[row][col];

  if (!piece) {
    if (gameState.selected && gameState.legalMoves.some((move) => move.toRow === row && move.toCol === col)) {
      performMove(gameState.legalMoves.find((move) => move.toRow === row && move.toCol === col));
    }
    return;
  }

  if (piece.color !== gameState.currentTurn) {
    if (gameState.selected && gameState.legalMoves.some((move) => move.toRow === row && move.toCol === col)) {
      performMove(gameState.legalMoves.find((move) => move.toRow === row && move.toCol === col));
    }
    return;
  }

  gameState.selected = { row, col };
  gameState.legalMoves = getLegalMovesForSquare(gameState, row, col);
  renderBoard();
}

function updateStatusMessage() {
  const king = findKing(gameState, gameState.currentTurn);
  const inCheck = king && isSquareAttacked(gameState, king.row, king.col, opponent(gameState.currentTurn));
  const isAIToMove = gameState.currentTurn !== gameState.playerColor;

  if (gameState.winner) {
    statusEl.textContent = gameState.winner;
    return;
  }

  const base = isAIToMove ? `AI (${gameState.currentTurn === "w" ? "White" : "Black"}) thinking...` : `${gameState.currentTurn === "w" ? "White" : "Black"} to move.`;
  statusEl.textContent = inCheck ? `${base} Check!` : base;
}

function renderBoard() {
  boardEl.innerHTML = "";

  const displayRows = gameState.playerColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const displayCols = gameState.playerColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  for (let displayRow of displayRows) {
    for (let displayCol of displayCols) {
      const actualRow = gameState.playerColor === "w" ? displayRow : 7 - displayRow;
      const actualCol = gameState.playerColor === "w" ? displayCol : 7 - displayCol;
      const square = document.createElement("button");
      const piece = gameState.board[actualRow][actualCol];
      square.type = "button";
      square.className = `square ${(displayRow + displayCol) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.row = String(actualRow);
      square.dataset.col = String(actualCol);

      if (gameState.selected && gameState.selected.row === actualRow && gameState.selected.col === actualCol) {
        square.classList.add("selected");
      }

      const moveTarget = gameState.legalMoves.some((move) => move.toRow === actualRow && move.toCol === actualCol);
      if (moveTarget) {
        const captures = gameState.board[actualRow][actualCol] !== null;
        square.classList.add(captures ? "capture" : "legal");
      }

      if (piece) {
        const pieceSymbol = document.createElement("span");
        pieceSymbol.textContent = PIECE_SYMBOLS[piece.color][piece.type];
        pieceSymbol.className = `piece ${piece.color === "w" ? "white-piece" : "black-piece"}`;
        square.appendChild(pieceSymbol);
      }

      square.addEventListener("click", () => {
        selectSquare(actualRow, actualCol);
      });

      boardEl.appendChild(square);
    }
  }

  renderRankFiles();
  updateStatusMessage();
  renderMoveLog();
}

function renderRankFiles() {
  const labelContainer = document.querySelector("#rank-file-labels");
  if (!labelContainer) return;

  const labels = [];
  const rankLabels = [8, 7, 6, 5, 4, 3, 2, 1];
  const fileLabels = FILES;

  for (let index = 0; index < 8; index += 1) {
    labels.push(`<span>${fileLabels[index]}</span>`);
  }

  labelContainer.innerHTML = labels.join("");

  const combined = [];
  for (let rank = 0; rank < 8; rank += 1) {
    combined.push(`<span>${rankLabels[rank]}</span>`);
  }
  labelContainer.setAttribute("data-ranks", combined.join(""));
}

function renderMoveLog() {
  moveLogEl.innerHTML = "";
  if (!gameState.moveHistory.length) {
    const item = document.createElement("li");
    item.textContent = "No moves yet.";
    moveLogEl.appendChild(item);
    return;
  }

  for (const entry of gameState.moveHistory) {
    const item = document.createElement("li");
    item.textContent = entry.notation;
    moveLogEl.appendChild(item);
  }
}

function evaluateBoard(state, perspectiveColor) {
  let score = 0;

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = state.board[row][col];
      if (!piece) continue;

      const baseValue = PIECE_VALUES[piece.type];
      const colorBonus = piece.color === perspectiveColor ? 1 : -1;
      const centralBias = (row === 3 || row === 4 || col === 3 || col === 4) ? 12 : 0;
      score += (baseValue + centralBias) * colorBonus;
    }
  }

  return score;
}

function chooseAiMove(moves) {
  const level = gameState.aiLevel;
  if (level === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (level === "medium") {
    const scored = moves.map((move) => {
      const next = applyMoveToState(gameState, move);
      const captureValue = next.board[move.toRow][move.toCol] ? PIECE_VALUES[next.board[move.toRow][move.toCol].type] : 0;
      return { move, score: captureValue + Math.random() * 20 };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].move;
  }

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const next = applyMoveToState(gameState, move);
    const score = minimax(next, 2, gameState.playerColor, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function minimax(state, depth, perspectiveColor, maximizing) {
  const legalMoves = generateLegalMovesForColor(state, state.currentTurn);

  if (depth === 0 || !legalMoves.length) {
    return evaluateBoard(state, perspectiveColor);
  }

  if (maximizing) {
    let maxScore = -Infinity;
    for (const move of legalMoves) {
      const nextState = applyMoveToState(state, move);
      const score = minimax(nextState, depth - 1, perspectiveColor, false);
      maxScore = Math.max(maxScore, score);
    }
    return maxScore;
  }

  let minScore = Infinity;
  for (const move of legalMoves) {
    const nextState = applyMoveToState(state, move);
    const score = minimax(nextState, depth - 1, perspectiveColor, true);
    minScore = Math.min(minScore, score);
  }
  return minScore;
}

function completeTurn() {
  const currentMoves = generateLegalMovesForColor(gameState, gameState.currentTurn);

  if (!currentMoves.length) {
    if (isKingInCheck(gameState, gameState.currentTurn)) {
      gameState.winner = `${opponent(gameState.currentTurn) === "w" ? "White" : "Black"} wins by checkmate!`;
    } else {
      gameState.winner = "Draw by stalemate.";
    }
    renderBoard();
    return;
  }

  if (gameState.currentTurn !== gameState.playerColor) {
    setTimeout(() => {
      const aiMoves = generateLegalMovesForColor(gameState, gameState.currentTurn);
      if (!aiMoves.length) {
        completeTurn();
        return;
      }
      const move = chooseAiMove(aiMoves);
      performMove(move);
    }, 350);
  }
}

function performMove(move) {
  const nextState = applyMoveToState(gameState, move);
  Object.assign(gameState, nextState);
  gameState.selected = null;
  gameState.legalMoves = [];

  const legalMovesForNextTurn = generateLegalMovesForColor(gameState, gameState.currentTurn);
  if (!legalMovesForNextTurn.length) {
    if (isKingInCheck(gameState, gameState.currentTurn)) {
      gameState.winner = `${opponent(gameState.currentTurn) === "w" ? "White" : "Black"} wins by checkmate!`;
    } else {
      gameState.winner = "Draw by stalemate.";
    }
  }

  renderBoard();

  if (!gameState.winner && gameState.currentTurn !== gameState.playerColor) {
    setTimeout(() => {
      const aiMoves = generateLegalMovesForColor(gameState, gameState.currentTurn);
      if (!aiMoves.length) {
        completeTurn();
        return;
      }
      const moveChoice = chooseAiMove(aiMoves);
      performMove(moveChoice);
    }, 350);
  }
}

function resetGame() {
  Object.assign(gameState, {
    board: createInitialBoard(),
    currentTurn: "w",
    playerColor: sideSelectEl.value,
    selected: null,
    legalMoves: [],
    moveHistory: [],
    enPassantTarget: null,
    castlingRights: {
      w: { kingSide: true, queenSide: true },
      b: { kingSide: true, queenSide: true }
    },
    winner: null
  });

  renderBoard();

  if (gameState.currentTurn !== gameState.playerColor) {
    setTimeout(() => {
      const aiMoves = generateLegalMovesForColor(gameState, gameState.currentTurn);
      if (aiMoves.length) {
        const move = chooseAiMove(aiMoves);
        performMove(move);
      }
    }, 250);
  }
}

sideSelectEl.addEventListener("change", () => {
  gameState.playerColor = sideSelectEl.value;
  resetGame();
});

aiLevelEl.addEventListener("change", () => {
  gameState.aiLevel = aiLevelEl.value;
  resetGame();
});

newGameBtn.addEventListener("click", resetGame);

resetGame();
