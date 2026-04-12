import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./component/glyph-info-header.js";
import "./component/glyph-list-item.js";
import '@lit-labs/virtualizer';
import { grid } from '@lit-labs/virtualizer/layouts/grid.js';
import { BDFFont, Glyph } from "../bdf/index.js";

// @ts-ignore
import "@fontsource/unifont/400.css";

// @ts-ignore
const vscode = acquireVsCodeApi();
vscode.postMessage({ type: "requestRefresh" });

@customElement("glyph-list-view")
export class GlyphListView extends LitElement {
    @property({ type: Object }) font: BDFFont | null = null;
    @state() private selectedIndex: number | null = null;

    constructor() {
        super();
        window.addEventListener("message", (event) => {
            const message = event.data;
            switch (message.type) {
                case "updateDocument": {
                    if (!message.font) {
                        vscode.postMessage({ type: "requestRefresh" });
                        return;
                    }
                    this.font = message.font;
                    break;
                }
            }
        });
    }

    static styles = css`
        glyph-info-header {
            height: 32px;
        }
            
        lit-virtualizer {
            height: calc(100vh - 32px);
        }

        lit-virtualizer > * {
            border: solid 1px var(--vscode-editorWidget-border);
        }
    `;

    render() {
        const maxDWidth = Math.max(
            ...(this.font?.glyphs.map(g => g.dWidth?.x || 0) ?? [0]),
            this.font?.dWidth?.x ?? 0
        );
        let itemWidth = maxDWidth * 48 / (this.font?.fontBoundingBox.height ?? 1);
        if (itemWidth < 48 / 2) {
            itemWidth = 48 / 2;
        }
        return html`
            <glyph-info-header
                glyphNumber=${this.selectedIndex}
                codePoint=${this.selectedIndex !== null && this.font ? this.font.glyphs[this.selectedIndex].encoding[0] : -1}
            ></glyph-info-header>
            <lit-virtualizer
                scroller
                .items=${this.font ? this.font.glyphs : []}
                .renderItem=${(glyph: Glyph, index: number) => html`<glyph-list-item
                    .glyph=${glyph}
                    .selected=${index === this.selectedIndex}
                    .fontBoundingBox=${this.font?.fontBoundingBox}
                    @click=${() => this.selectedIndex = index}
                ></glyph-list-item>`}
                .layout=${grid({
                    itemSize: { width: `${itemWidth+1}px`, height: "73px" },
                    gap: '-1px',
                })}
            ></lit-virtualizer>
        `
    }
}