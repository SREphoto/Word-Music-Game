/**
 * @fileoverview Word game to control real-time music generation.
 * @license
 *  SPDX-License-Identifier: Apache-2.0
 */

import {css, CSSResultGroup, html, LitElement, svg} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {styleMap} from 'lit/directives/style-map.js';

import {
  GoogleGenAI,
  type LiveMusicGenerationConfig,
  type LiveMusicServerMessage,
  type LiveMusicSession,
} from '@google/genai';
import {decode, decodeAudioData} from './utils';

// Corrected API Key usage as per guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY, // Corrected from GEMINI_API_KEY
  apiVersion: 'v1alpha', // Assuming this is specific to Lyria API
});
let model = 'lyria-realtime-exp'; // Lyria specific model

interface MusicComponentData {
  readonly promptId: string; // Unique ID for the component
  readonly color: string;
  text: string; // The guessed word
  weight: number; // Controlled by the slider
}

type PlaybackState = 'stopped' | 'playing' | 'loading' | 'paused';

/** Throttles a callback to be called at most once per `freq` milliseconds. */
function throttle(func: (...args: unknown[]) => void, delay: number) {
  let lastCall = 0;
  return (...args: unknown[]) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    if (timeSinceLastCall >= delay) {
      func(...args);
      lastCall = now;
    }
  };
}

const WORD_LIST_SOURCE = [
  "HAPPY", "MELODY", "RHYTHM", "GROOVE", "HARMONY", "BEAT", "CHORD",
  "TEMPO", "FUNKY", "JAZZY", "SOUND", "MUSIC", "DANCE", "SING", "NOTE",
  "PIANO", "GUITAR", "DRUMS", "BASS", "VOICE", "ROCK", "POP", "BLUES",
  "VIBE", "SOUL", "LOOP", "SYNC", "TUNE", "FLOW"
];

const COLORS = [
  '#9900ff', '#5200ff', '#ff25f6', '#2af6de',
  '#ffdd28', '#3dffab', '#d8ff3e', '#d9b2ff',
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7B801',
  '#5F4B8B', '#E69A8D', '#00A8E8', '#007EA7'
].sort(() => 0.5 - Math.random()); // Shuffle colors for variety too

function getUnusedRandomColor(usedColors: string[]): string {
  const availableColors = COLORS.filter((c) => !usedColors.includes(c));
  if (availableColors.length === 0) {
    // If all colors used, pick a random one from the original list again
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }
  return availableColors[Math.floor(Math.random() * availableColors.length)];
}

// WeightSlider component
// -----------------------------------------------------------------------------
/** A slider for adjusting and visualizing prompt weight. */
@customElement('weight-slider')
class WeightSlider extends LitElement {
  static override styles = css`
    :host {
      cursor: ns-resize;
      position: relative;
      height: 100%;
      display: flex;
      justify-content: center;
      flex-direction: column;
      align-items: center;
      padding: 5px;
    }
    .scroll-container {
      width: 100%;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    .value-display {
      font-size: 1.3vmin;
      color: #ccc;
      margin: 0.5vmin 0;
      user-select: none;
      text-align: center;
    }
    .slider-container {
      position: relative;
      width: 10px;
      height: 100%;
      background-color: #0009;
      border-radius: 4px;
    }
    #thumb {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      border-radius: 4px;
      box-shadow: 0 0 3px rgba(0, 0, 0, 0.7);
    }
  `;

  @property({type: Number}) value = 0; // Range 0-2
  @property({type: String}) color = '#000';

  @query('.scroll-container') private scrollContainer!: HTMLDivElement;

  private dragStartPos = 0;
  private dragStartValue = 0;
  private containerBounds: DOMRect | null = null;

  constructor() {
    super();
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }

  private handlePointerDown(e: PointerEvent) {
    e.preventDefault();
    this.containerBounds = this.scrollContainer.getBoundingClientRect();
    this.dragStartPos = e.clientY;
    this.dragStartValue = this.value;
    document.body.classList.add('dragging');
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('touchmove', this.handleTouchMove, {
      passive: false,
    });
    window.addEventListener('pointerup', this.handlePointerUp, {once: true});
    this.updateValueFromPosition(e.clientY);
  }

  private handlePointerMove(e: PointerEvent) {
    this.updateValueFromPosition(e.clientY);
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    this.updateValueFromPosition(e.touches[0].clientY);
  }

  private handlePointerUp(e: PointerEvent) {
    window.removeEventListener('pointermove', this.handlePointerMove);
    document.body.classList.remove('dragging');
    this.containerBounds = null;
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY;
    this.value = this.value + delta * -0.005;
    this.value = Math.max(0, Math.min(2, this.value));
    this.dispatchInputEvent();
  }

  private updateValueFromPosition(clientY: number) {
    if (!this.containerBounds) return;

    const trackHeight = this.containerBounds.height;
    const relativeY = clientY - this.containerBounds.top;
    const normalizedValue =
      1 - Math.max(0, Math.min(trackHeight, relativeY)) / trackHeight;
    this.value = normalizedValue * 2;

    this.dispatchInputEvent();
  }

  private dispatchInputEvent() {
    this.dispatchEvent(new CustomEvent<number>('input', {detail: this.value}));
  }

  override render() {
    const thumbHeightPercent = (this.value / 2) * 100;
    const thumbStyle = styleMap({
      height: `${thumbHeightPercent}%`,
      backgroundColor: this.color,
      display: this.value > 0.01 ? 'block' : 'none',
    });
    const displayValue = this.value.toFixed(2);

    return html`
      <div
        class="scroll-container"
        @pointerdown=${this.handlePointerDown}
        @wheel=${this.handleWheel}>
        <div class="slider-container">
          <div id="thumb" style=${thumbStyle}></div>
        </div>
        <div class="value-display">${displayValue}</div>
      </div>
    `;
  }
}

// Base class for icon buttons.
class IconButton extends LitElement {
  static override styles = css`
    :host {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none; /* Hitbox will handle pointer events */
    }
    :host(:hover) svg {
      transform: scale(1.1); /* Subtle hover effect */
    }
    svg {
      width: 100%;
      height: 100%;
      transition: transform 0.3s cubic-bezier(0.25, 1.56, 0.32, 0.99);
    }
    .hitbox {
      pointer-events: all;
      position: absolute;
      width: 70%; /* Adjusted for better touch/click accuracy */
      aspect-ratio: 1;
      top: 15%; /* Centering hitbox */
      left: 15%;
      border-radius: 50%;
      cursor: pointer;
      /* background-color: #ff000030; */ /* For debugging hitbox */
    }
  ` as CSSResultGroup;

  protected renderIcon() {
    return svg``;
  }

  private renderSVG() { // Simplified SVG structure
    return html` <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="rgba(255, 255, 255, 0.08)" />
      <circle cx="50" cy="50" r="48" stroke="rgba(0, 0, 0, 0.3)" stroke-width="3"/>
      <g filter="url(#icon_button_shadow)">
         <circle cx="50" cy="50" r="42" fill="rgba(255, 255, 255, 0.1)" />
      </g>
      ${this.renderIcon()}
      <defs>
        <filter id="icon_button_shadow" x="-20" y="-20" width="140" height="140" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix"/>
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
          <feOffset dy="2"/>
          <feGaussianBlur stdDeviation="3"/>
          <feComposite in2="hardAlpha" operator="out"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"/>
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
        </filter>
      </defs>
    </svg>`;
  }

  override render() {
    return html`${this.renderSVG()}<div class="hitbox"></div>`;
  }
}

// PlayPauseButton
// -----------------------------------------------------------------------------
@customElement('play-pause-button')
export class PlayPauseButton extends IconButton {
  @property({type: String}) playbackState: PlaybackState = 'stopped';

  static override styles = [
    IconButton.styles,
    css`
      .loader {
        stroke: #ffffff;
        stroke-width: 6; /* Thicker loader */
        stroke-linecap: round;
        animation: spin linear 1s infinite;
        transform-origin: center;
        transform-box: fill-box;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(359deg); }
      }
      /* Icon specific styles */
      path {
        fill: var(--icon-color, #FEFEFE);
      }
    `,
  ];

  private renderPause() {
    return svg`<g transform="translate(5, 5)">
      <path d="M30 70 V30 H42 V70 H30 Z M58 70 V30 H70 V70 H58 Z" />
    </g>`;
  }

  private renderPlay() {
    return svg`<g transform="translate(5, 5)">
      <path d="M35 75 V25 L75 50 L35 75 Z" />
    </g>`;
  }

  private renderLoading() {
     // Centered and scaled loader
    return svg`<circle class="loader" cx="50" cy="50" r="25" fill="none" />`;
  }

  override renderIcon() {
    if (this.playbackState === 'playing') {
      return this.renderPause();
    } else if (this.playbackState === 'loading') {
      return this.renderLoading();
    } else {
      return this.renderPlay();
    }
  }
}

@customElement('reset-button')
export class ResetButton extends IconButton {
   static override styles = [
    IconButton.styles,
    css`
      path {
        fill: var(--icon-color, #FEFEFE);
      }
    `
  ];
  private renderResetIcon() {
    // Simplified reset icon (FontAwesome-like refresh)
    return svg`<g transform="scale(0.9) translate(5,5)">
      <path d="M74.44,61.85a32.07,32.07,0,1,1-6.6-20.73l6.2,6.2a2,2,0,0,0,2.83-2.83l-10-10a2,2,0,0,0-2.83,0l-10,10a2,2,0,0,0,2.83,2.83l5.81-5.81A24.06,24.06,0,1,0,70,48a23.51,23.51,0,0,0-1.55-8.43,2,2,0,0,0-3.82,1.06A19.5,19.5,0,0,1,66,48,19.92,19.92,0,1,1,48.15,28,2,2,0,0,0,46.3,30.3a2,2,0,0,0,2.43,1.61A16,16,0,1,1,32,48a15.78,15.78,0,0,1-3.09-9.57,2,2,0,1,0-4,.41A20.34,20.34,0,0,0,28,48,20,20,0,0,0,48,68a19.77,19.77,0,0,0,14.14-5.86A19.89,19.89,0,0,0,74.44,61.85Z"/>
    </g>`;
  }
  override renderIcon() {
    return this.renderResetIcon();
  }
}

// AddPromptButton is no longer used, so it can be removed.

// Toast Message component
// -----------------------------------------------------------------------------
@customElement('toast-message')
class ToastMessage extends LitElement {
  static override styles = css`
    .toast {
      line-height: 1.6;
      position: fixed;
      bottom: 30px; /* Adjusted position */
      left: 50%;
      transform: translateX(-50%);
      background-color: #333; /* Darker background */
      color: white;
      padding: 12px 20px;
      border-radius: 8px; /* Softer corners */
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      min-width: 250px;
      max-width: 80vw;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2); /* Added shadow */
      transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.4s ease-out;
      z-index: 1100; /* Ensure it's above other elements */
      opacity: 0;
      pointer-events: none; /* Initially not interactive */
    }
    .toast.showing {
      transform: translate(-50%, 0); /* Slide in from bottom */
      opacity: 1;
      pointer-events: auto;
    }
    .message {
      font-size: 1.6vmin;
    }
    .close-button {
      background: transparent;
      color: #aaa;
      border: none;
      font-size: 2vmin;
      cursor: pointer;
      padding: 0 5px;
      line-height: 1;
    }
    .close-button:hover {
      color: white;
    }
  `;

  @property({type: String}) message = '';
  @property({type: Boolean}) showing = false;
  private timeoutId: number | undefined;

  override render() {
    return html`<div class=${classMap({showing: this.showing, toast: true})}>
      <div class="message">${this.message}</div>
      <button class="close-button" @click=${this.hide} aria-label="Close message">✕</button>
    </div>`;
  }

  show(message: string, duration: number = 3000) {
    this.message = message;
    this.showing = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = window.setTimeout(() => {
      this.hide();
    }, duration);
  }

  hide() {
    this.showing = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}


/** A single music component, representing a correctly guessed word. */
@customElement('music-component-controller')
class MusicComponentController extends LitElement {
  static override styles = css`
    .music-component {
      position: relative;
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
      overflow: hidden;
      background-color: rgba(42, 42, 42, 0.8); /* Slightly transparent */
      border-radius: 8px; /* Softer corners */
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .remove-button {
      position: absolute;
      top: 0.8vmin; /* Adjusted position */
      right: 0.8vmin; /* Adjusted position */
      background: #555; /* Darker button */
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 2.5vmin; /* Slightly smaller */
      height: 2.5vmin;
      font-size: 1.6vmin;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s, background-color 0.2s;
      z-index: 10;
    }
    .remove-button:hover {
      opacity: 1;
      background-color: #c84040; /* Red hover for delete */
    }
    weight-slider {
      max-height: calc(100% - 7vmin); /* Adjusted for text display */
      flex: 1;
      min-height: 8vmin;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      margin: 1.5vmin 0 0.5vmin; /* Adjusted margin */
    }
    .controls { /* Renamed from .controls to better reflect its purpose */
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      align-items: center;
      width: 100%;
      height: 5vmin; /* Fixed height for the text area */
      padding: 0 0.5vmin;
      box-sizing: border-box;
      margin-bottom: 1vmin;
      justify-content: center; /* Center the text */
    }
    #word-text { /* Renamed from #text */
      font-family: 'Google Sans', sans-serif;
      font-size: 1.8vmin;
      font-weight: 500; /* Bolder text */
      width: 100%;
      max-height: 100%;
      padding: 0.4vmin;
      box-sizing: border-box;
      text-align: center;
      word-wrap: break-word;
      overflow: hidden; /* No scroll needed for single line */
      text-overflow: ellipsis; /* Add ellipsis if text is too long */
      white-space: nowrap; /* Prevent wrapping */
      color: #fff;
      user-select: none; /* Text is not selectable */
    }
    :host([filtered='true']) #word-text { /* Style for filtered words */
      color: #ff8a80; /* Softer red for filtered text */
      text-decoration: line-through;
    }
  `;

  @property({type: String, reflect: true}) promptId = ''; // Keep promptId as internal ID
  @property({type: String}) text = ''; // This will be the guessed word
  @property({type: Number}) weight = 0;
  @property({type: String}) color = '';
  @property({type: Boolean, reflect: true}) filtered = false;


  @query('weight-slider') private weightInput!: WeightSlider;

  // Text is no longer editable, so event handlers for text input are removed.

  private dispatchMusicComponentChanged() { // Renamed event
    this.dispatchEvent(
      new CustomEvent<MusicComponentData>('music-component-changed', { // Renamed event
        detail: {
          promptId: this.promptId,
          text: this.text,
          weight: this.weight,
          color: this.color,
        },
      }),
    );
  }

  private updateWeight() {
    this.weight = this.weightInput.value;
    this.dispatchMusicComponentChanged();
  }

  private dispatchMusicComponentRemoved() { // Renamed event
    this.dispatchEvent(
      new CustomEvent<string>('music-component-removed', { // Renamed event
        detail: this.promptId,
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    return html`<div class="music-component">
      <button class="remove-button" @click=${this.dispatchMusicComponentRemoved} aria-label="Remove ${this.text} component">
        ✕
      </button>
      <weight-slider
        id="weight"
        .value=${this.weight}
        .color=${this.color}
        @input=${this.updateWeight}></weight-slider>
      <div class="controls">
        <span id="word-text" title=${this.text}>${this.text}</span>
      </div>
    </div>`;
  }
}

/** A panel for managing real-time music generation settings. */
@customElement('settings-controller')
class SettingsController extends LitElement {
  static override styles = css`
    :host {
      display: block;
      padding: 2vmin;
      background-color: rgba(42, 42, 42, 0.8); /* Slightly transparent */
      color: #eee;
      box-sizing: border-box;
      border-radius: 8px;
      font-family: 'Google Sans', sans-serif;
      font-size: 1.5vmin;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #666 #1a1a1a;
      transition: width 0.3s ease-out max-height 0.3s ease-out;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    :host([showadvanced]) {
      max-height: 40vmin; /* Keep existing behavior */
    }
    /* ... (rest of the styles are largely unchanged, minor tweaks for consistency if any) ... */
     :host::-webkit-scrollbar {
      width: 6px;
    }
    :host::-webkit-scrollbar-track {
      background: #1a1a1a;
      border-radius: 3px;
    }
    :host::-webkit-scrollbar-thumb {
      background-color: #666;
      border-radius: 3px;
    }
    .setting {
      margin-bottom: 0.5vmin;
      display: flex;
      flex-direction: column;
      gap: 0.5vmin;
    }
    label {
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
      white-space: nowrap;
      user-select: none;
    }
    label span:last-child {
      font-weight: normal;
      color: #ccc;
      min-width: 3em;
      text-align: right;
    }
    input[type='range'] {
      --track-height: 8px;
      --track-bg: #0009;
      --track-border-radius: 4px;
      --thumb-size: 16px;
      --thumb-bg: var(--accent-color, #5200ff); /* Use accent color */
      --thumb-border-radius: 50%;
      --thumb-box-shadow: 0 0 3px rgba(0, 0, 0, 0.7);
      --value-percent: 0%;
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: var(--track-height);
      background: transparent;
      cursor: pointer;
      margin: 0.5vmin 0;
      border: none;
      padding: 0;
      vertical-align: middle;
    }
    input[type='range']::-webkit-slider-runnable-track {
      width: 100%;
      height: var(--track-height);
      cursor: pointer;
      border: none;
      background: linear-gradient(
        to right,
        var(--thumb-bg) var(--value-percent),
        var(--track-bg) var(--value-percent)
      );
      border-radius: var(--track-border-radius);
    }
    input[type='range']::-moz-range-track {
      width: 100%;
      height: var(--track-height);
      cursor: pointer;
      background: var(--track-bg);
      border-radius: var(--track-border-radius);
      border: none;
    }
    input[type='range']::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      height: var(--thumb-size);
      width: var(--thumb-size);
      background: var(--thumb-bg);
      border-radius: var(--thumb-border-radius);
      box-shadow: var(--thumb-box-shadow);
      cursor: pointer;
      margin-top: calc((var(--thumb-size) - var(--track-height)) / -2);
    }
    input[type='range']::-moz-range-thumb {
      height: var(--thumb-size);
      width: var(--thumb-size);
      background: var(--thumb-bg);
      border-radius: var(--thumb-border-radius);
      box-shadow: var(--thumb-box-shadow);
      cursor: pointer;
      border: none;
    }
    input[type='number'],
    input[type='text'],
    select {
      background-color: #2a2a2a;
      color: #eee;
      border: 1px solid #666;
      border-radius: 3px;
      padding: 0.4vmin;
      font-size: 1.5vmin;
      font-family: inherit;
      box-sizing: border-box;
    }
    input[type='number'] {
      width: 6em;
    }
    input[type='text'] {
      width: 100%;
    }
    input[type='text']::placeholder {
      color: #888;
    }
    input[type='number']:focus,
    input[type='text']:focus,
    select:focus {
      outline: none;
      border-color: var(--accent-color, #5200ff);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color, #5200ff) 30%, transparent);
    }
    select option {
      background-color: #2a2a2a;
      color: #eee;
    }
    .checkbox-setting {
      flex-direction: row;
      align-items: center;
      gap: 1vmin;
    }
    input[type='checkbox'] {
      cursor: pointer;
      accent-color: var(--accent-color, #5200ff);
    }
    .core-settings-row {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 4vmin;
      margin-bottom: 1vmin;
      justify-content: space-evenly;
    }
    .core-settings-row .setting {
      min-width: 16vmin;
    }
    .core-settings-row label span:last-child {
      min-width: 2.5em;
    }
    .advanced-toggle {
      cursor: pointer;
      margin: 2vmin 0 1vmin 0;
      color: #aaa;
      text-decoration: underline;
      user-select: none;
      font-size: 1.4vmin;
      width: fit-content;
    }
    .advanced-toggle:hover {
      color: #eee;
    }
    .advanced-settings {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10vmin, 1fr));
      gap: 3vmin;
      overflow: hidden;
      max-height: 0;
      opacity: 0;
      transition:
        max-height 0.3s ease-out,
        opacity 0.3s ease-out;
    }
    .advanced-settings.visible {
      max-width: 120vmin;
      max-height: 40vmin; /* Keep existing behavior */
      opacity: 1;
    }
    hr.divider {
      display: none;
      border: none;
      border-top: 1px solid #666;
      margin: 2vmin 0;
      width: 100%;
    }
    :host([showadvanced]) hr.divider {
      display: block;
    }
    .auto-row {
      display: flex;
      align-items: center;
      gap: 0.5vmin;
    }
    .setting[auto='true'] input[type='range'] {
      pointer-events: none;
      filter: grayscale(100%);
    }
    .auto-row span {
      margin-left: auto;
    }
    .auto-row label {
      cursor: pointer;
    }
    .auto-row input[type='checkbox'] {
      cursor: pointer;
      margin: 0;
    }
  `;

  private readonly defaultConfig: LiveMusicGenerationConfig = { // Explicitly type
    temperature: 1.1,
    topK: 40,
    guidance: 4.0,
    // bpm, seed, density, brightness, scale etc. can be undefined by default
  };

  @state() private config: LiveMusicGenerationConfig = {...this.defaultConfig};
  @state() showAdvanced = false;
  @state() autoDensity = true;
  @state() private lastDefinedDensity: number | undefined = undefined; // Explicitly undefined
  @state() autoBrightness = true;
  @state() private lastDefinedBrightness: number | undefined = undefined; // Explicitly undefined

  public resetToDefaults() {
    this.config = {...this.defaultConfig};
    this.autoDensity = true;
    this.lastDefinedDensity = undefined;
    this.autoBrightness = true;
    this.lastDefinedBrightness = undefined;
    this.dispatchSettingsChange();
    // Force update sliders after resetting config
    this.requestUpdate('config', this.config);
  }

  private updateSliderBackground(inputEl: HTMLInputElement) {
    if (inputEl.type !== 'range') {
      return;
    }
    const min = Number(inputEl.min) || 0;
    const max = Number(inputEl.max) || (inputEl.id === 'density' || inputEl.id === 'brightness' ? 1 : 100); // Default max for density/brightness
    const value = Number(inputEl.value);
    const percentage = ((value - min) / (max - min)) * 100;
    inputEl.style.setProperty('--value-percent', `${percentage}%`);
  }

 private handleInputChange(e: Event) {
    const target = e.target as (HTMLInputElement | HTMLSelectElement);
    const key = target.id as keyof LiveMusicGenerationConfig | 'auto-density' | 'auto-brightness';
    let value: string | number | boolean | undefined;

    const newConfig = { ...this.config };

    if (target instanceof HTMLInputElement) {
      if (target.type === 'number' || target.type === 'range') {
        value = target.value === '' ? undefined : Number(target.value);
        if (target.type === 'range') {
          this.updateSliderBackground(target);
        }
      } else if (target.type === 'checkbox') {
        value = target.checked;
      } else { // Assumes text input or other input types
         value = target.value;
      }
    } else if (target instanceof HTMLSelectElement) { // Check if it's an HTMLSelectElement
       // The 'type' property for select is 'select-one' or 'select-multiple'
       // This explicit check handles the specific case for select elements.
      value = target.value === "SCALE_UNSPECIFIED_PLACEHOLDER" ? undefined : target.value;
    }


    if (key === 'auto-density') {
      this.autoDensity = Boolean(value);
      newConfig.density = this.autoDensity ? undefined : (this.lastDefinedDensity ?? 0.5);
    } else if (key === 'auto-brightness') {
      this.autoBrightness = Boolean(value);
      newConfig.brightness = this.autoBrightness ? undefined : (this.lastDefinedBrightness ?? 0.5);
    } else {
      (newConfig as any)[key] = value; // Assign to the config object
       if (key === 'density' && typeof value === 'number') {
        this.lastDefinedDensity = value;
      }
      if (key === 'brightness' && typeof value === 'number') {
        this.lastDefinedBrightness = value;
      }
    }
    this.config = newConfig;
    this.dispatchSettingsChange();
  }


  override updated(changedProperties: Map<string | symbol, unknown>) {
    super.updated(changedProperties);
    // Ensure sliders are correctly updated when config changes, especially after reset
    if (changedProperties.has('config') || (this.config === this.defaultConfig && changedProperties.size === 0) ) {
      this.shadowRoot?.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((slider: HTMLInputElement) => {
        const configKey = slider.id as keyof LiveMusicGenerationConfig;
        let sliderValue: number | undefined;

        if (configKey === 'density') {
            sliderValue = this.autoDensity ? (this.lastDefinedDensity ?? 0.5) : this.config.density;
            if (sliderValue === undefined) sliderValue = 0.5; // Default for UI if still undefined
        } else if (configKey === 'brightness') {
            sliderValue = this.autoBrightness ? (this.lastDefinedBrightness ?? 0.5) : this.config.brightness;
            if (sliderValue === undefined) sliderValue = 0.5; // Default for UI
        } else {
            sliderValue = this.config[configKey] as number | undefined;
        }

        if (typeof sliderValue === 'number') {
          slider.value = String(sliderValue);
        } else if (this.defaultConfig[configKey] !== undefined) {
           slider.value = String(this.defaultConfig[configKey]); // Fallback to default if undefined
        }
        this.updateSliderBackground(slider);
      });
    }
  }


  private dispatchSettingsChange() {
    this.dispatchEvent(
      new CustomEvent<LiveMusicGenerationConfig>('settings-changed', {
        detail: this.config,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private toggleAdvancedSettings() {
    this.showAdvanced = !this.showAdvanced;
  }

  override render() {
    const cfg = this.config;
    const advancedClasses = classMap({
      'advanced-settings': true,
      'visible': this.showAdvanced,
    });
    const scaleMap = new Map<string, string>([
      ['Auto', 'SCALE_UNSPECIFIED_PLACEHOLDER'], // Use a placeholder for "Auto" to allow undefined
      ['C Major / A Minor', 'C_MAJOR_A_MINOR'],
      ['C# Major / A# Minor', 'D_FLAT_MAJOR_B_FLAT_MINOR'],
      ['D Major / B Minor', 'D_MAJOR_B_MINOR'],
      ['D# Major / C Minor', 'E_FLAT_MAJOR_C_MINOR'],
      ['E Major / C# Minor', 'E_MAJOR_D_FLAT_MINOR'],
      ['F Major / D Minor', 'F_MAJOR_D_MINOR'],
      ['F# Major / D# Minor', 'G_FLAT_MAJOR_E_FLAT_MINOR'],
      ['G Major / E Minor', 'G_MAJOR_E_MINOR'],
      ['G# Major / F Minor', 'A_FLAT_MAJOR_F_MINOR'],
      ['A Major / F# Minor', 'A_MAJOR_G_FLAT_MINOR'],
      ['A# Major / G Minor', 'B_FLAT_MAJOR_G_MINOR'],
      ['B Major / G# Minor', 'B_MAJOR_A_FLAT_MINOR'],
    ]);

    return html`
      <div class="core-settings-row">
        <div class="setting">
          <label for="temperature">Temperature<span>${(cfg.temperature ?? this.defaultConfig.temperature!).toFixed(1)}</span></label>
          <input type="range" id="temperature" min="0" max="3" step="0.1" .value=${(cfg.temperature ?? this.defaultConfig.temperature!).toString()} @input=${this.handleInputChange} />
        </div>
        <div class="setting">
          <label for="guidance">Guidance<span>${(cfg.guidance ?? this.defaultConfig.guidance!).toFixed(1)}</span></label>
          <input type="range" id="guidance" min="0" max="6" step="0.1" .value=${(cfg.guidance ?? this.defaultConfig.guidance!).toString()} @input=${this.handleInputChange} />
        </div>
        <div class="setting">
          <label for="topK">Top K<span>${cfg.topK ?? this.defaultConfig.topK!}</span></label>
          <input type="range" id="topK" min="1" max="100" step="1" .value=${(cfg.topK ?? this.defaultConfig.topK!).toString()} @input=${this.handleInputChange} />
        </div>
      </div>
      <hr class="divider" />
      <div class=${advancedClasses}>
        <div class="setting">
          <label for="seed">Seed</label>
          <input type="number" id="seed" .value=${cfg.seed ?? ''} @input=${this.handleInputChange} placeholder="Auto" />
        </div>
        <div class="setting">
          <label for="bpm">BPM</label>
          <input type="number" id="bpm" min="60" max="180" .value=${cfg.bpm ?? ''} @input=${this.handleInputChange} placeholder="Auto" />
        </div>
        <div class="setting" auto=${this.autoDensity}>
          <label for="density">Density</label>
          <input type="range" id="density" min="0" max="1" step="0.05" .value=${(this.autoDensity ? (this.lastDefinedDensity ?? 0.5) : (cfg.density ?? 0.5)).toString()} @input=${this.handleInputChange} />
          <div class="auto-row">
            <input type="checkbox" id="auto-density" .checked=${this.autoDensity} @input=${this.handleInputChange} />
            <label for="auto-density">Auto</label>
            <span>${(this.autoDensity ? (this.lastDefinedDensity ?? 0.5) : (cfg.density ?? 0.5)).toFixed(2)}</span>
          </div>
        </div>
        <div class="setting" auto=${this.autoBrightness}>
          <label for="brightness">Brightness</label>
          <input type="range" id="brightness" min="0" max="1" step="0.05" .value=${(this.autoBrightness ? (this.lastDefinedBrightness ?? 0.5) : (cfg.brightness ?? 0.5)).toString()} @input=${this.handleInputChange} />
          <div class="auto-row">
            <input type="checkbox" id="auto-brightness" .checked=${this.autoBrightness} @input=${this.handleInputChange} />
            <label for="auto-brightness">Auto</label>
            <span>${(this.autoBrightness ? (this.lastDefinedBrightness ?? 0.5) : (cfg.brightness ?? 0.5)).toFixed(2)}</span>
          </div>
        </div>
        <div class="setting">
          <label for="scale">Scale</label>
          <select id="scale" .value=${cfg.scale || 'SCALE_UNSPECIFIED_PLACEHOLDER'} @change=${this.handleInputChange}>
            ${[...scaleMap.entries()].map(
              ([displayName, enumValue]) =>
                html`<option value=${enumValue} ?selected=${cfg.scale === enumValue || (!cfg.scale && enumValue === 'SCALE_UNSPECIFIED_PLACEHOLDER')}>${displayName}</option>`,
            )}
          </select>
        </div>
        <div class="setting">
          <div class="setting checkbox-setting">
            <input type="checkbox" id="muteBass" .checked=${!!cfg.muteBass} @change=${this.handleInputChange} />
            <label for="muteBass" style="font-weight: normal;">Mute Bass</label>
          </div>
          <div class="setting checkbox-setting">
            <input type="checkbox" id="muteDrums" .checked=${!!cfg.muteDrums} @change=${this.handleInputChange} />
            <label for="muteDrums" style="font-weight: normal;">Mute Drums</label>
          </div>
          <div class="setting checkbox-setting">
            <input type="checkbox" id="onlyBassAndDrums" .checked=${!!cfg.onlyBassAndDrums} @change=${this.handleInputChange} />
            <label for="onlyBassAndDrums" style="font-weight: normal;">Only Bass & Drums</label>
          </div>
        </div>
      </div>
      <div class="advanced-toggle" @click=${this.toggleAdvancedSettings}>
        ${this.showAdvanced ? 'Hide' : 'Show'} Advanced Settings
      </div>
    `;
  }
}

/** Main component for the Word Music Game. */
@customElement('word-music-game')
class WordMusicGame extends LitElement {
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
                  setTimeout(() => { if(this.playbackState === 'loading') this.playbackState = 'playing'; }, this.bufferTime * 1000);
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
        weightedPrompts: componentsToSend.map(c => ({text: c.text, weight: c.weight})),
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
    } else if (container.scrollHeight > container.clientHeight && Math.abs(e.deltaY) > 0){
      
      
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

function main(container: HTMLElement) {
  // No stored prompts to get, WordMusicGame initializes itself.
  const gameInstance = new WordMusicGame();
  container.appendChild(gameInstance);
}

main(document.body);

declare global {
  interface HTMLElementTagNameMap {
    'word-music-game': WordMusicGame; // Renamed from 'prompt-dj'
    'music-component-controller': MusicComponentController; // Renamed
    'settings-controller': SettingsController;
    // AddPromptButton is removed
    'play-pause-button': PlayPauseButton;
    'reset-button': ResetButton;
    'weight-slider': WeightSlider;
    'toast-message': ToastMessage;
  }
}
