import { css, CSSResultGroup, html, LitElement, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { PlaybackState } from '../types';

// Base class for icon buttons.
export class IconButton extends LitElement {
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
    @property({ type: String }) playbackState: PlaybackState = 'stopped';

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
