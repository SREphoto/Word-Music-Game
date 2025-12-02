import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { type LiveMusicGenerationConfig } from '@google/genai';

/** A panel for managing real-time music generation settings. */
@customElement('settings-controller')
export class SettingsController extends LitElement {
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

    public readonly defaultConfig: LiveMusicGenerationConfig = { // Explicitly type
        temperature: 1.1,
        topK: 40,
        guidance: 4.0,
        // bpm, seed, density, brightness, scale etc. can be undefined by default
    };

    @state() private config: LiveMusicGenerationConfig = { ...this.defaultConfig };
    @state() showAdvanced = false;
    @state() autoDensity = true;
    @state() private lastDefinedDensity: number | undefined = undefined; // Explicitly undefined
    @state() autoBrightness = true;
    @state() private lastDefinedBrightness: number | undefined = undefined; // Explicitly undefined

    public resetToDefaults() {
        this.config = { ...this.defaultConfig };
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
        if (changedProperties.has('config') || (this.config === this.defaultConfig && changedProperties.size === 0)) {
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
