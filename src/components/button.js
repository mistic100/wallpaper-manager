import { LitElement, css, html, nothing } from 'lit';

export class WpButton extends LitElement {
  static properties = {
    color: { type: String, reflect: true },
    round: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    type: { type: String },
    title: { type: String },
    ariaLabel: { type: String, attribute: 'aria-label' },
    pressed: { type: Boolean, reflect: true },
    toggle: { type: Boolean, reflect: true },
    buttonRole: { type: String, attribute: 'button-role' },
    buttonAriaSelected: { type: String, attribute: 'button-aria-selected' }
  };

  static styles = css`
    :host { display: inline-flex; min-width: 0; box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
    button {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-width: 40px;
      min-height: 40px;
      padding: 0 8px;
      border: 1px solid var(--border-color, rgba(148, 163, 184, 0.22));
      border-radius: var(--radius-control, 10px);
      background: rgba(30, 41, 59, 0.8);
      color: var(--text, #e5e7eb);
      font: inherit;
      line-height: 1;
      cursor: pointer;
      transition: 120ms ease;
    }
    ::slotted(*) { max-width: 100%; max-height: 100%; }
    button:hover:not(:disabled) {
      border-color: rgba(56, 189, 248, 0.7);
    }
    button:focus-visible {
      outline: 2px solid var(--accent, #38bdf8);
      outline-offset: 2px;
    }
    :host([color="accent"]) button {
      background: rgba(14, 165, 233, 0.16);
      border-color: rgba(56, 189, 248, 0.8);
    }
    :host([color="danger"]) button {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(248, 113, 113, 0.5);
      color: #fecaca;
    }
    :host([round]) button {
      border-radius: 50%;
      aspect-ratio: 1;
      padding: 0;
    }
    :host([disabled]) button {
      background: rgba(71, 85, 105, 0.2);
      border-color: rgba(148, 163, 184, 0.18);
      color: rgba(148, 163, 184, 0.8);
      opacity: 0.65;
      cursor: not-allowed;
    }
    :host([pressed]) button {
      background: rgba(14, 165, 233, 0.16);
      border-color: rgba(56, 189, 248, 0.9);
      box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.45);
    }
  `;

  constructor() {
    super();
    this.color = 'neutral';
    this.round = false;
    this.disabled = false;
    this.type = 'button';
    this.title = '';
    this.ariaLabel = '';
    this.pressed = false;
    this.toggle = false;
    this.buttonRole = '';
    this.buttonAriaSelected = '';
  }

  render() {
    return html`
      <button
        type=${this.type}
        title=${this.title}
        aria-label=${this.ariaLabel || ''}
        aria-pressed=${this.toggle ? String(this.pressed) : nothing}
        role=${this.buttonRole || nothing}
        aria-selected=${this.buttonAriaSelected || nothing}
        ?disabled=${this.disabled}
      ><slot></slot></button>
    `;
  }
}
customElements.define('wp-button', WpButton);
