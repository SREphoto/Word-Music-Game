import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

// Toast Message component
// -----------------------------------------------------------------------------
@customElement('toast-message')
export class ToastMessage extends LitElement {
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

    @property({ type: String }) message = '';
    @property({ type: Boolean }) showing = false;
    private timeoutId: number | undefined;

    override render() {
        return html`<div class=${classMap({ showing: this.showing, toast: true })}>
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
