import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unicodeName } from "unicode-name";

@customElement("glyph-info-header")
export class GlyphInfoHeader extends LitElement {
    @property({ type: Number }) glyphNumber = -1;
    @property({ type: Number }) codePoint = -1;

    static styles = css`
        :host {
            white-space: nowrap;
        }
        span {
            font-size: 16px;
        }
    `

    render() {
        if (this.glyphNumber === -1) {
            return html`<span>No glyph selected</span>`;
        }
        return html`
            <span>#${this.glyphNumber}</span>
            ${this.codePoint === -1 ? "" : html`<span>${"U+" + this.codePoint.toString(16).toUpperCase().padStart(4, "0")} (${this.codePoint})</span>`}
            ${this.codePoint === -1 ? "" : html`<span>${unicodeName(this.codePoint) ?? ""}</span>`}
        `
    }
}