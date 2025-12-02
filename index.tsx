/**
 * @fileoverview Word game to control real-time music generation.
 * @license
 *  SPDX-License-Identifier: Apache-2.0
 */

import './src/WordMusicGame';

function main(container: HTMLElement) {
  const gameInstance = document.createElement('word-music-game');
  container.appendChild(gameInstance);
}

main(document.body);
