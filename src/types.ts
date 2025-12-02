export interface MusicComponentData {
    readonly promptId: string; // Unique ID for the component
    readonly color: string;
    text: string; // The guessed word
    weight: number; // Controlled by the slider
}

export type PlaybackState = 'stopped' | 'playing' | 'loading' | 'paused';
