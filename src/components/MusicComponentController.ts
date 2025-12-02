import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { MusicComponentData } from '../types';
import './WeightSlider'; // Import for side effects (registration)
import { WeightSlider } from './WeightSlider';

/** A single music component, representing a correctly guessed word. */
@customElement('music-component-controller')
export class MusicComponentController extends LitElement {
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

    @property({ type: String, reflect: true }) promptId = ''; // Keep promptId as internal ID
    @property({ type: String }) text = ''; // This will be the guessed word
    @property({ type: Number }) weight = 0;
    @property({ type: String }) color = '';
    @property({ type: Boolean, reflect: true }) filtered = false;


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
