import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'lobby',
    loadComponent: () =>
      import('./lobby/lobby.component').then(m => m.LobbyComponent),
  },
  {
    path: 'game',
    loadComponent: () =>
      import('./game/game-board/game-board.component').then(
        m => m.GameBoardComponent,
      ),
  },
  { path: '', redirectTo: 'lobby', pathMatch: 'full' },
];
