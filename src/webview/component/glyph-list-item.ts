import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { BoundingBox, Glyph } from "../../bdf";

const fillColor = getComputedStyle(document.documentElement).getPropertyValue("--vscode-button-background") || "#fd6ebd";

@customElement("glyph-list-item")
export class GlyphListItem extends LitElement {
    @property({ type: Object }) glyph: Glyph | null = null;
    @property({ type: Object }) fontBoundingBox: BoundingBox | null = null;
    @property({ type: Boolean }) selected = false;
    @query('canvas') canvas!: HTMLCanvasElement;

    drawThumbnail() {
        const ctx = this.canvas.getContext("2d");
        if (!ctx || !this.glyph) return;
        this.canvas.width = this.glyph.boundingBox.width;
        this.canvas.height = this.glyph.boundingBox.height;
        ctx.fillStyle = fillColor;
        for (let dy = 0; dy < this.glyph.bitmap.length; dy++) {
            const rowStr = this.glyph.bitmap[dy];
            const rowBin = parseInt(rowStr, 16).toString(2).padStart(rowStr.length * 4, "0");
            for (let dx = 0; dx < this.glyph.bitmap[dy].length * 4; dx++) {
                if (rowBin[dx] === "1") {
                    ctx.fillRect(dx, dy, 1, 1);
                }
            }
        }
    }

    protected updated(_changedProperties: PropertyValues): void {
        this.drawThumbnail();
        
        const pixelSize = 48 / (this.fontBoundingBox?.height ?? 1);
        const bottomOffset = (this.glyph?.boundingBox.yOffset ?? 0) - (this.fontBoundingBox?.yOffset ?? 0);

        this.canvas.style.height = `${pixelSize * (this.glyph?.bitmap.length ?? 0)}px`;
        this.canvas.style.bottom = `${bottomOffset > 0 ? pixelSize * bottomOffset : 0}px`;

        if (this.selected) {
            this.style.backgroundColor = "var(--vscode-button-background)";
            this.canvas.style.mixBlendMode = "difference";
        } else {
            this.style.backgroundColor = "unset";
            this.canvas.style.mixBlendMode = "unset";
        }
    }

    static styles = css`
        :host {
            font-family: var(--vscode-font-family), 'Unifont';
            text-align: center;
            overflow: hidden;
        }
        :host > * {
            position: absolute;
            left: 0;
            right: 0;
            margin: 0 auto;
        }
        div {
            font-size: 16px;
        }
        canvas {
            image-rendering: pixelated;
        }
    `;

    render() {
        let char = String.fromCharCode(this.glyph?.encoding[0] ?? 0);
        switch (char) {
            case "\t":
                char = "␉";
                break;
            case "\n":
                char = "␊";
                break;
            case "\v":
                char = "␋";
                break;
            case "\f": 
                char = "␌";
                break;
            case "\r":
                char = "␍";
                break;
        }
        return html`
            <div>${char}</div>
            <canvas></canvas>
        `
    }
}