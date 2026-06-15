import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'game',
    loadComponent: () =>
      import('./game/game-board/game-board.component').then(
        m => m.GameBoardComponent,
      ),
  },
  { path: '', redirectTo: 'game', pathMatch: 'full' },
];
