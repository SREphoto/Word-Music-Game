export const WORD_LIST_SOURCE = [
  "HAPPY", "MELODY", "RHYTHM", "GROOVE", "HARMONY", "BEAT", "CHORD",
  "TEMPO", "FUNKY", "JAZZY", "SOUND", "MUSIC", "DANCE", "SING", "NOTE",
  "PIANO", "GUITAR", "DRUMS", "BASS", "VOICE", "ROCK", "POP", "BLUES",
  "VIBE", "SOUL", "LOOP", "SYNC", "TUNE", "FLOW"
];

export const COLORS = [
  '#9900ff', '#5200ff', '#ff25f6', '#2af6de',
  '#ffdd28', '#3dffab', '#d8ff3e', '#d9b2ff',
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7B801',
  '#5F4B8B', '#E69A8D', '#00A8E8', '#007EA7'
].sort(() => 0.5 - Math.random()); // Shuffle colors for variety too

export function getUnusedRandomColor(usedColors: string[]): string {
  const availableColors = COLORS.filter((c) => !usedColors.includes(c));
  if (availableColors.length === 0) {
    // If all colors used, pick a random one from the original list again
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }
  return availableColors[Math.floor(Math.random() * availableColors.length)];
}
