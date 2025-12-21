import { css, html, LitElement } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
    GoogleGenAI,
    type LiveMusicGenerationConfig,
    type LiveMusicServerMessage,
    type LiveMusicSession,
} from '@google/genai';

import { decode, decodeAudioData, throttle } from './utils';
import { WORD_LIST_SOURCE, getUnusedRandomColor } from './constants';
import { MusicComponentData, PlaybackState } from './types';

import './components/Buttons';
import './components/MusicComponentController';
import './components/SettingsController';
import './components/ToastMessage';

import { PlayPauseButton } from './components/Buttons';
import { ToastMessage } from './components/ToastMessage';
import { SettingsController } from './components/SettingsController';

// Corrected API Key usage as per guidelines
const getApiKey = () => {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) return process.env.API_KEY;
    if (typeof process !== 'undefined' && process.env && process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
    // @ts-ignore
    if (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
    return '';
};

const ai = new GoogleGenAI({
    apiKey: getApiKey(),
    apiVersion: 'v1alpha',
});
let model = 'lyria-realtime-exp';

/** Main component for the Word Music Game. */
@customElement('word-music-game')
export class WordMusicGame extends LitElement {
    static override styles = css`
    :host {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between; /* Distribute space */
      align-items: center;
      box-sizing: border-box;
      padding: 2vmin;
      position: relative;
      font-size: 1.8vmin;
      background-color: #1a1a1a; /* Base background */
      overflow: hidden; /* Prevent scrollbars on host */
    }
    #background-effects { /* Renamed from #background */
      position: absolute;
      top:0; left:0; right:0; bottom:0;
      height: 100%;
      width: 100%;
      z-index: 0; /* Behind content */
      background: #111; /* Fallback */
      transition: background-image 0.5s ease-out;
    }

    .game-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2vmin;
      margin-bottom: 2vmin;
      z-index: 1;
      width: 100%;
      max-width: 70vmin; /* Limit width of game area */
    }
    .word-display {
      font-size: 5vmin;
      font-weight: bold;
      color: #eee;
      padding: 1vmin 2vmin;
      background-color: rgba(0,0,0,0.3);
      border-radius: 8px;
      min-height: 6vmin;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      letter-spacing: 0.3vmin;
      text-transform: uppercase;
    }
    .stats {
      color: #aaa;
      font-size: 1.5vmin;
      margin-bottom: 0.5vmin;
    }
    .guess-container {
      display: flex;
      gap: 1vmin;
      width: 100%;
    }
    #guess-input {
      flex-grow: 1;
      padding: 1.5vmin;
      font-size: max(16px, 2.2vmin); /* Prevent auto-zoom on mobile */
      border: 2px solid #444;
      background-color: #222;
      color: #eee;
      border-radius: 6px;
      outline: none;
      transition: border-color 0.3s, box-shadow 0.3s;
    }
    #guess-input:focus {
      border-color: var(--accent-color, #9900ff);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color, #9900ff) 30%, transparent);
    }
    #guess-button {
      padding: 1.5vmin 2.5vmin;
      font-size: 2.2vmin;
      background-color: var(--accent-color, #7b00cc);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    #guess-button:hover {
      background-color: color-mix(in srgb, var(--accent-color, #7b00cc) 85%, #000000);
    }
    #skip-button {
      padding: 1.5vmin 2.5vmin;
      font-size: 2.2vmin;
      background-color: #444;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    #skip-button:hover {
      background-color: #666;
    }

    #music-components-area {
      display: flex;
      align-items: flex-end; /* Align controllers to bottom */
      justify-content: center; /* Center horizontally */
      flex-grow: 1; /* Take remaining space */
      width: 100%;
      /* margin-top: 2vmin; */ /* Removed top margin */
      gap: 1.5vmin; /* Gap between components */
      overflow: hidden; /* Prevent parent scroll */
      padding: 1vmin 0; /* Padding for aesthetic spacing */
      z-index: 1;
    }
    #music-components-container {
      display: flex;
      flex-direction: row;
      align-items: flex-end; /* Children align to bottom */
      flex-shrink: 1; /* Allow shrinking */
      height: 100%; /* Fill music-components-area */
      max-height: 45vmin; /* Max height for components area */
      gap: 1.5vmin;
      padding: 1vmin;
      overflow-x: auto; /* Horizontal scroll if needed */
      overflow-y: hidden; /* No vertical scroll here */
      scrollbar-width: thin;
      scrollbar-color: #666 #1a1a1a;
      /* Centering pseudo-elements if needed, but flexbox should handle it */
    }
    #music-components-container::-webkit-scrollbar {
      height: 8px;
    }
    #music-components-container::-webkit-scrollbar-track {
      background: #111;
      border-radius: 4px;
    }
    #music-components-container::-webkit-scrollbar-thumb {
      background-color: #666;
      border-radius: 4px;
    }
    #music-components-container::-webkit-scrollbar-thumb:hover {
      background-color: #777;
    }

    music-component-controller { /* Styling for the individual components */
      height: 100%; /* Fill available height in container */
      max-height: 40vmin; /* Max height of a single component */
      min-width: 13vmin; /* Min width */
      max-width: 15vmin; /* Max width */
      flex: 0 0 auto; /* Don't grow or shrink, use base width */
    }

    #settings-area-container { /* Renamed from #settings-container */
      flex-shrink: 0; /* Don't shrink settings */
      width: 100%;
      max-width: 80vmin; /* Limit width */
      margin: 2vmin 0;
      z-index: 1;
    }
    .playback-controls-container { /* Renamed from .playback-container */
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 2vmin; /* Gap between buttons */
      flex-shrink: 0;
      z-index: 1;
      margin-bottom: 1vmin;
    }
    play-pause-button,
    reset-button {
      width: 10vmin; /* Slightly smaller buttons */
      height: 10vmin;
      flex-shrink: 0;
      --icon-color: #e0e0e0; /* Lighter icon color */
    }
    /* Define accent color for the app */
    :host {
      --accent-color: #9900ff; /* Purple accent */
    }
  `;

    @state() private musicComponents = new Map<string, MusicComponentData>();
    private nextComponentId: number = 0;
    private session!: LiveMusicSession; // Definite assignment assertion
    private readonly sampleRate = 48000;
    private audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: this.sampleRate });
    private outputNode: GainNode = this.audioContext.createGain();
    private nextStartTime = 0;
    private readonly bufferTime = 0.5; // Reduced buffer time
    @state() private playbackState: PlaybackState = 'stopped';
    @state() private filteredComponents = new Set<string>(); // Store promptId of filtered components
    private connectionError = false;

    @query('play-pause-button') private playPauseButton!: PlayPauseButton;
    @query('toast-message') private toastMessage!: ToastMessage;
    @query('settings-controller') private settingsController!: SettingsController;
    @query('#guess-input') private guessInputEl!: HTMLInputElement;

    // Game State
    @state() private availableWords: string[] = [];
    @state() private currentWordToGuess: string = '';
    @state() private currentWordIndex: number = -1;
    @state() private gameWon: boolean = false;


    constructor() {
        super();
        this.outputNode.connect(this.audioContext.destination);
        this.initializeGame();
    }

    private initializeGame() {
        this.availableWords = [...WORD_LIST_SOURCE].sort(() => 0.5 - Math.random());
        this.musicComponents.clear(); // Clear existing components
        this.nextComponentId = 0;
        this.currentWordIndex = -1;
        this.gameWon = false;
        this.filteredComponents.clear();
        this.fetchNextWord();
        // If session exists, update it
        if (this.session) {
            this.setSessionMusicComponents();
        }
    }

    private fetchNextWord() {
        this.currentWordIndex++;
        if (this.currentWordIndex < this.availableWords.length) {
            this.currentWordToGuess = this.availableWords[this.currentWordIndex];
        } else {
            this.currentWordToGuess = "YOU WON!"; // Or handle game completion
            this.gameWon = true;
            this.toastMessage.show("Congratulations! You've guessed all words!", 5000);
        }
    }

    private skipWord() {
        this.toastMessage.show(`Skipped: ${this.currentWordToGuess}`, 2000);
        this.fetchNextWord();
    }

    override async firstUpdated() {
        await this.connectToSession();
        this.setSessionMusicComponents(); // Initial call with empty components
    }

    private async connectToSession() {
        try {
            this.session = await ai.live.music.connect({
                model: model,
                callbacks: {
                    onmessage: async (e: LiveMusicServerMessage) => {
                        console.log('Received message from the server:', e);
                        if (e.setupComplete) {
                            this.connectionError = false;
                        }
                        if (e.filteredPrompt) { // Lyria API uses "prompt" for text inputs
                            const component = [...this.musicComponents.values()].find(p => p.text === e.filteredPrompt!.text);
                            if (component) {
                                this.filteredComponents.add(component.promptId);
                                this.toastMessage.show(`"${e.filteredPrompt.text}" was filtered: ${e.filteredPrompt.filteredReason}`);
                                this.requestUpdate();
                            }
                        }
                        if (e.serverContent?.audioChunks !== undefined && e.serverContent.audioChunks.length > 0) {
                            if (this.playbackState === 'paused' || this.playbackState === 'stopped') return;
                            try {
                                const audioDataString = e.serverContent.audioChunks[0].data;
                                if (!audioDataString || audioDataString.trim() === "") {
                                    console.warn("Received empty audio chunk data.");
                                    return;
                                }
                                const decodedData = decode(audioDataString);
                                if (decodedData.length === 0) {
                                    console.warn("Decoded audio data is empty.");
                                    return;
                                }

                                const audioBuffer = await decodeAudioData(
                                    decodedData,
                                    this.audioContext,
                                    this.sampleRate, 2,
                                );

                                if (audioBuffer.duration === 0) {
                                    console.warn("Processed audio buffer has zero duration.");
                                    return;
                                }

                                const source = this.audioContext.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(this.outputNode);

                                if (this.nextStartTime === 0) {
                                    this.nextStartTime = this.audioContext.currentTime + this.bufferTime;
                                    setTimeout(() => { if (this.playbackState === 'loading') this.playbackState = 'playing'; }, this.bufferTime * 1000);
                                }

                                if (this.nextStartTime < this.audioContext.currentTime) {
                                    console.warn('Audio under-run detected.');
                                    this.toastMessage.show('Audio buffer under-run. Resyncing...', 2000);
                                    this.playbackState = 'loading';
                                    this.nextStartTime = 0;
                                    return;
                                }
                                source.start(this.nextStartTime);
                                this.nextStartTime += audioBuffer.duration;

                            } catch (audioError) {
                                console.error("Error processing audio chunk:", audioError);
                                this.toastMessage.show("Error playing audio. Check console.", 3000);
                                if (this.playbackState === 'playing' || this.playbackState === 'loading') {
                                    this.pauseAudio(); // Attempt to gracefully pause on audio error
                                }
                            }
                        }
                    },
                    onerror: (errorEvent: ErrorEvent) => {
                        console.error('Connection error:', errorEvent.message);
                        this.connectionError = true;
                        this.pauseAudio();
                        this.toastMessage.show(`Connection error: ${errorEvent.message}. Please try again.`, 5000);
                    },
                    onclose: (closeEvent: CloseEvent) => {
                        console.log('Connection closed.', closeEvent.reason);
                        if (!closeEvent.wasClean) {
                            this.connectionError = true;
                            this.pauseAudio();
                            this.toastMessage.show('Connection closed unexpectedly. Please check console.', 5000);
                        }
                    },
                },
            });
            this.connectionError = false;
        } catch (err) {
            console.error("Failed to connect to session:", err);
            this.toastMessage.show("Failed to connect to music session. Retrying may be needed.", 5000);
            this.connectionError = true;
        }
    }

    private setSessionMusicComponents = throttle(async () => {
        if (!this.session) return;
        const componentsToSend = Array.from(this.musicComponents.values()).filter(p => {
            return !this.filteredComponents.has(p.promptId) && p.weight > 0.01;
        });
        try {
            await this.session.setWeightedPrompts({
                weightedPrompts: componentsToSend.map(c => ({ text: c.text, weight: c.weight })),
            });
        } catch (e: any) {
            this.toastMessage.show(e.message || "Error updating music components.", 4000);
            if (this.playbackState === 'playing' || this.playbackState === 'loading') this.pauseAudio();
        }
    }, 200);


    private handleMusicComponentChanged(e: CustomEvent<MusicComponentData>) {
        const changedComponentData = e.detail;
        const component = this.musicComponents.get(changedComponentData.promptId);

        if (!component) {
            console.error('Music component not found for changing:', changedComponentData.promptId);
            return;
        }
        component.text = changedComponentData.text;
        component.weight = changedComponentData.weight;

        this.musicComponents.set(component.promptId, component);
        this.setSessionMusicComponents();
        this.requestUpdate('musicComponents');
    }

    private makeBackground() {
        const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
        const MAX_WEIGHT = 0.5;
        const MAX_ALPHA = 0.5;

        const bg: string[] = [];
        let i = 0;
        this.musicComponents.forEach((p) => {
            if (p.weight <= 0.01) return;

            const alphaPct = clamp01(p.weight / MAX_WEIGHT) * MAX_ALPHA;
            const alphaHex = Math.round(alphaPct * 255).toString(16).padStart(2, '0');


            const x = ((i * 37) % 100) / 100;
            const y = ((i * 61) % 100) / 100;
            const stop = (p.weight / 2) * 100;

            const s = `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${p.color}${alphaHex} 0%, ${p.color}00 ${Math.max(20, stop)}%)`;
            bg.push(s);
            i++;
        });

        bg.unshift('linear-gradient(135deg, rgba(20,20,30,0.8) 0%, rgba(40,20,50,0.7) 100%)');
        return bg.join(', ');
    }

    private async handlePlayPause() {
        if (this.playbackState === 'playing') {
            this.pauseAudio();
        } else if (this.playbackState === 'paused' || this.playbackState === 'stopped') {
            if (this.connectionError || !this.session) {
                this.toastMessage.show("Reconnecting...", 2000);
                await this.connectToSession();
                if (!this.connectionError && this.session) {
                    await this.setSessionMusicComponents();
                    this.loadAudio();
                } else {
                    this.toastMessage.show("Failed to reconnect. Please try again.", 3000);
                    this.playbackState = 'stopped';
                }
            } else {
                this.loadAudio();
            }
        } else if (this.playbackState === 'loading') {

            this.pauseAudio();
            this.toastMessage.show("Playback stopped. Please try playing again.", 3000);
        }
    }

    private pauseAudio() {
        if (this.session) this.session.pause();
        this.playbackState = 'paused';
        if (this.audioContext.state === 'running') {
            this.outputNode.gain.setValueAtTime(this.outputNode.gain.value, this.audioContext.currentTime);
            this.outputNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.2);
        }
        this.nextStartTime = 0;

        this.outputNode.disconnect();
        this.outputNode = this.audioContext.createGain();
        this.outputNode.connect(this.audioContext.destination);
    }

    private loadAudio() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        if (this.session) this.session.play();
        this.playbackState = 'loading';
        this.outputNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.outputNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.2);
    }

    private stopAudioAndSession() {
        if (this.session) {
            this.session.stop();

        }
        this.playbackState = 'stopped';
        if (this.audioContext.state === 'running') {
            this.outputNode.gain.setValueAtTime(this.outputNode.gain.value, this.audioContext.currentTime);
            this.outputNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.2);
        }
        this.nextStartTime = 0;
        this.outputNode.disconnect();
        this.outputNode = this.audioContext.createGain();
        this.outputNode.connect(this.audioContext.destination);
    }

    private handleGuessSubmit() {
        if (this.gameWon) {
            this.toastMessage.show("Game over! Reset to play again.", 3000);
            return;
        }
        const guess = this.guessInputEl.value.trim().toUpperCase();
        if (!guess) return;

        if (guess === this.currentWordToGuess) {
            this.toastMessage.show(`Correct: ${this.currentWordToGuess}!`, 2000);
            const newComponentId = `component-${this.nextComponentId++}`;
            const usedColors = [...this.musicComponents.values()].map(c => c.color);
            const newComponent: MusicComponentData = {
                promptId: newComponentId,
                text: this.currentWordToGuess,
                weight: 0.5,
                color: getUnusedRandomColor(usedColors),
            };
            this.musicComponents.set(newComponentId, newComponent);
            this.setSessionMusicComponents();
            this.fetchNextWord();
            this.requestUpdate('musicComponents');
        } else {
            this.toastMessage.show('Incorrect guess. Try again!', 2000);
            this.guessInputEl.select();

            this.guessInputEl.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(-5px)' },
                { transform: 'translateX(5px)' },
                { transform: 'translateX(0)' }
            ], { duration: 300, easing: 'ease-in-out' });

        }
        this.guessInputEl.value = '';
    }

    private handleGuessInputKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            this.handleGuessSubmit();
        }
    }

    private handleMusicComponentRemoved(e: CustomEvent<string>) {
        e.stopPropagation();
        const componentIdToRemove = e.detail;
        if (this.musicComponents.has(componentIdToRemove)) {
            this.musicComponents.delete(componentIdToRemove);
            this.filteredComponents.delete(componentIdToRemove);
            this.setSessionMusicComponents();
            this.requestUpdate('musicComponents');
        } else {
            console.warn(`Attempted to remove non-existent component ID: ${componentIdToRemove}`);
        }
    }

    private handlePromptsContainerWheel(e: WheelEvent) {
        const container = e.currentTarget as HTMLElement;
        if (e.deltaY !== 0 && e.deltaX === 0) {

            return;
        }
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.preventDefault();
            container.scrollLeft += e.deltaX;
        } else if (container.scrollHeight > container.clientHeight && Math.abs(e.deltaY) > 0) {


        }
    }


    private updateSettings = throttle(async (e: CustomEvent<LiveMusicGenerationConfig>) => {
        if (this.session) {
            await this.session.setMusicGenerationConfig({
                musicGenerationConfig: e.detail,
            });
        }
    }, 200);

    private async handleReset() {
        this.toastMessage.show("Resetting game and music...", 2000);
        if (this.connectionError || !this.session) {
            await this.connectToSession();
        }
        this.pauseAudio();

        this.initializeGame();
        this.settingsController.resetToDefaults();

        if (this.session) {
            this.session.resetContext();

            await this.session.setMusicGenerationConfig({
                musicGenerationConfig: this.settingsController['defaultConfig'],
            });
        }

        if (this.playbackState !== 'stopped') {
            setTimeout(() => {
                if (this.playbackState === 'paused' && !this.connectionError && this.session) {

                }
            }, 300);
        }
    }

    override render() {
        const bgStyles = styleMap({
            backgroundImage: this.makeBackground(),
        });

        return html`
      <div id="background-effects" style=${bgStyles}></div>

      <div class="game-area">
        <div class="word-display" aria-live="polite">${this.currentWordToGuess}</div>
        <div class="stats">
            Words Left: ${this.availableWords.length - this.currentWordIndex - 1}
        </div>
        <div class="guess-container">
          <input
            type="text"
            id="guess-input"
            placeholder="Type your guess"
            aria-label="Type your guess for the word"
            @keydown=${this.handleGuessInputKeydown}
            ?disabled=${this.gameWon} />
          <button id="guess-button" @click=${this.handleGuessSubmit} ?disabled=${this.gameWon}>
            Guess
          </button>
          <button id="skip-button" @click=${this.skipWord} ?disabled=${this.gameWon}>
            Skip
          </button>
        </div>
      </div>

      <div id="music-components-area">
        <div id="music-components-container"
             @music-component-removed=${this.handleMusicComponentRemoved}
             @wheel=${this.handlePromptsContainerWheel}>
          ${this.renderMusicComponents()}
        </div>
      </div>

      <div id="settings-area-container">
        <settings-controller @settings-changed=${this.updateSettings}></settings-controller>
      </div>

      <div class="playback-controls-container">
        <play-pause-button
          @click=${this.handlePlayPause}
          .playbackState=${this.playbackState}
          aria-label=${this.playbackState === 'playing' ? 'Pause music' : 'Play music'}>
        </play-pause-button>
        <reset-button @click=${this.handleReset} aria-label="Reset game and music settings"></reset-button>
      </div>
      <toast-message></toast-message>
    `;
    }

    private renderMusicComponents() {
        return [...this.musicComponents.values()].map((component) => {
            return html`<music-component-controller
        .promptId=${component.promptId}
        .text=${component.text}
        .weight=${component.weight}
        .color=${component.color}
        ?filtered=${this.filteredComponents.has(component.promptId)}
        @music-component-changed=${this.handleMusicComponentChanged}>
      </music-component-controller>`;
        });
    }
}
