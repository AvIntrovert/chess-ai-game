# Chess Commander

A browser-based chess game with a playable AI, side-swapping between White and Black, and a built-in explainer for the board, pieces, and movement rules.

## Features

- Play as White or Black against the computer
- AI difficulty levels: Easy, Medium, Hard
- Standard chess board and piece movement
- Support for check, checkmate, stalemate, castling, en passant, and pawn promotion
- Built-in help panel describing the board, pieces, and movement rules

## Run locally

Open `index.html` directly in a browser, or serve the folder with a simple static server:

```bash
cd chess-ai-game
python3 -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

## Controls

- Use the `Play as` selector to swap sides between White and Black.
- Pick the AI difficulty from the `AI Level` menu.
- Click a piece, then click a legal destination square to move it.
- Use `New Game` to reset the board at any time.

## Board and piece guide

- Board: 8x8 grid with files `a` through `h` and ranks `1` through `8`.
- White pieces start on ranks 1 and 2; Black pieces start on ranks 7 and 8.
- Pawn: moves forward one square, two squares from its starting rank, and captures diagonally.
- Rook: slides straight in rows and columns.
- Knight: jumps in an L-shape.
- Bishop: slides diagonally.
- Queen: slides vertically, horizontally, and diagonally.
- King: moves one square in any direction and may castle if the path is clear and the square is not attacked.

## Notes

This is a complete single-page chess game designed to run without a build step or external libraries.
