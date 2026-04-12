import { ParseError, Warning } from "./error";
import { LineIterator } from "./iterator";

type Size = {
  pointSize: number;
  xResolution: number;
  yResolution: number;
};

type BoundingBox = {
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
};

type Vec2 = {
  x: number;
  y: number;
};

const metricsSets = [0, 1, 2] as const;

type MetricsSet = (typeof metricsSets)[number];

const isMetricsSet = (value: number): value is MetricsSet => {
  return metricsSets.includes(value as MetricsSet);
};

const commentDump = (comments: string[], linebreak: string) => {
  return comments.length
    ? comments
      .map((comment) => (comment ? `COMMENT ${comment}` : "COMMENT"))
      .join(linebreak) + linebreak
    : "";
};

const consoleWarnOnce = ((warning: Warning) => {
  console.warn(`Warning at line ${warning.line}: ${warning.message}`);
});

/**
 * BDF font data structure
 */
class BDFFont {
  public comments: Map<keyof this, string[]> = new Map();
  // version number of the BDF specification
  public version: number = 2.2;

  public contentversion?: number = undefined;
  public fontName: string = "";
  public size: Size = {
    pointSize: 0,
    xResolution: 0,
    yResolution: 0,
  };
  public fontBoundingBox: BoundingBox = {
    width: 0,
    height: 0,
    xOffset: 0,
    yOffset: 0,
  };
  public metricsSet?: MetricsSet = undefined;
  public sWidth?: Vec2 = undefined;
  public dWidth?: Vec2 = undefined;
  public sWidth1?: Vec2 = undefined;
  public dWidth1?: Vec2 = undefined;
  public vVector?: Vec2 = undefined;
  public properties?: {
    key: string;
    value: string | number;
  }[] = undefined;
  public glyphs: Glyph[] = [];

  static from_string(input: string, warningHandler: (warning: Warning) => void = consoleWarnOnce): BDFFont {
    return BDFFont.parse(LineIterator.from_string(input), warningHandler);
  }

  static parse(lines: LineIterator, warningHandler: (warning: Warning) => void = consoleWarnOnce): BDFFont {
    let font = new BDFFont();
    let glyphCount = 0;
    [font, glyphCount] = BDFFont.__parse_header(font, lines, warningHandler);
    while (true) {
      const glyph = Glyph.parse(lines, warningHandler);
      if (!glyph) {
        break;
      }
      font.glyphs.push(glyph);
    }
    if (font.glyphs.length !== glyphCount) {
      warningHandler(new Warning(lines.lineNumber, `Glyph count mismatch: expected ${glyphCount}, got ${font.glyphs.length}`));
    }
    return font;
  }

  static __parse_header(font: BDFFont, lines: LineIterator, warningHandler: (warning: Warning) => void = consoleWarnOnce): [BDFFont, number] {
    let tmpComments: string[] = [];
    let glyphCount = null;
    while (true) {
      if (glyphCount) {
        break;
      }
      const { value: line, done } = lines.next();
      if (done) {
        throw new ParseError(lines.lineNumber, "Unexpected end of input");
      }
      const [key, ...values] = line.split(" ");
      switch (key) {
        case "COMMENT":
          tmpComments.push(values.join(" "));
          break;
        case "STARTFONT":
          font.version = Number(values[0]);
          break;
        case "CONTENTVERSION":
          font.contentversion = Number(values[0]);
          font.comments.set("contentversion", tmpComments);
          tmpComments = [];
          break;
        case "FONT":
          font.fontName = values.join(" ");
          font.comments.set("fontName", tmpComments);
          tmpComments = [];
          break;
        case "SIZE":
          font.size = {
            pointSize: Number(values[0]),
            xResolution: Number(values[1]),
            yResolution: Number(values[2]),
          };
          font.comments.set("size", tmpComments);
          tmpComments = [];
          break;
        case "FONTBOUNDINGBOX":
          font.fontBoundingBox = {
            width: Number(values[0]),
            height: Number(values[1]),
            xOffset: Number(values[2]),
            yOffset: Number(values[3]),
          };
          font.comments.set("fontBoundingBox", tmpComments);
          tmpComments = [];
          break;
        case "METRICSSET":
          const tmpMetricsSet = Number(values[0]);
          if (!isMetricsSet(tmpMetricsSet)) {
            throw new ParseError(
              lines.lineNumber,
              `Invalid metrics set: ${tmpMetricsSet}`,
            );
          }
          font.metricsSet = tmpMetricsSet;
          font.comments.set("metricsSet", tmpComments);
          tmpComments = [];
          break;
        case "SWIDTH":
        case "DWIDTH":
        case "SWIDTH1":
        case "DWIDTH1":
        case "VVECTOR":
          const [x, y] = values.map(Number);
          const propertyName = ((key: string) => {
            switch (key) {
              case "SWIDTH":
                return "sWidth";
              case "DWIDTH":
                return "dWidth";
              case "SWIDTH1":
                return "sWidth1";
              case "DWIDTH1":
                return "dWidth1";
              case "VVECTOR":
                return "vVector";
              default:
                throw new ParseError(lines.lineNumber, "Unreachable");
            }
          })(key);
          font[propertyName] = { x, y };
          font.comments.set(propertyName, tmpComments);
          tmpComments = [];
          break;
        case "STARTPROPERTIES":
          font.properties = [];
          font.comments.set("properties", tmpComments);
          tmpComments = [];
          let propertyCounter = Number(values[0]);
          while (true) {
            const { value: line, done } = lines.next();
            if (line.startsWith("ENDPROPERTIES")) {
              if (propertyCounter !== 0) {
                warningHandler(new Warning(lines.lineNumber, `Number of properties enumerated (${font.properties.length}) does not match expected (${Number(values[0])})`));
              }
              break;
            }
            if (done) {
              throw new ParseError(lines.lineNumber, "Unexpected end of input");
            }
            const [key, ...valueParts] = line.split(" ");
            const value = valueParts.join(" ");
            propertyCounter--;
            if (value.startsWith('"') && value.endsWith('"')) {
              font.properties.push({
                key,
                value: value.slice(1, -1).replaceAll('""', '"'),
              });
            } else {
              font.properties.push({ key, value: Number(value) });
            }
          }
          break;
        case "CHARS":
          glyphCount = Number(values[0]);
          font.comments.set("glyphs", tmpComments);
          tmpComments = [];
          break;
        default:
          warningHandler(new Warning(lines.lineNumber, `Unknown key "${key}"`));
          break;
      }
    }
    if (font.fontName === "") {
      throw new ParseError(lines.lineNumber, "Missing font name");
    }
    if (
      font.size.pointSize === 0 &&
      font.size.xResolution === 0 &&
      font.size.yResolution === 0
    ) {
      throw new ParseError(lines.lineNumber, "Missing font size");
    }
    return [font, glyphCount];
  }

  stringify(linebreak: string = "\n"): string {
    let s = "";
    s += `STARTFONT ${this.version}${linebreak}`;
    s += commentDump(this.comments.get("contentversion") ?? [], linebreak);
    if (this.contentversion) {
      s += `CONTENTVERSION ${this.contentversion}${linebreak}`;
    }
    s += commentDump(this.comments.get("fontName") ?? [], linebreak);
    s += `FONT ${this.fontName}${linebreak}`;
    s += commentDump(this.comments.get("size") ?? [], linebreak);
    s += `SIZE ${this.size.pointSize} ${this.size.xResolution} ${this.size.yResolution}${linebreak}`;
    s += commentDump(this.comments.get("fontBoundingBox") ?? [], linebreak);
    s += `FONTBOUNDINGBOX ${this.fontBoundingBox.width} ${this.fontBoundingBox.height} ${this.fontBoundingBox.xOffset} ${this.fontBoundingBox.yOffset}${linebreak}`;
    s += commentDump(this.comments.get("metricsSet") ?? [], linebreak);
    if (this.metricsSet !== undefined) {
      s += `METRICSSET ${this.metricsSet}${linebreak}`;
    }
    s += commentDump(this.comments.get("sWidth") ?? [], linebreak);
    if (this.sWidth) {
      s += `SWIDTH ${this.sWidth.x} ${this.sWidth.y}${linebreak}`;
    }
    s += commentDump(this.comments.get("dWidth") ?? [], linebreak);
    if (this.dWidth) {
      s += `DWIDTH ${this.dWidth.x} ${this.dWidth.y}${linebreak}`;
    }
    s += commentDump(this.comments.get("sWidth1") ?? [], linebreak);
    if (this.sWidth1) {
      s += `SWIDTH1 ${this.sWidth1.x} ${this.sWidth1.y}${linebreak}`;
    }
    s += commentDump(this.comments.get("dWidth1") ?? [], linebreak);
    if (this.dWidth1) {
      s += `DWIDTH1 ${this.dWidth1.x} ${this.dWidth1.y}${linebreak}`;
    }
    s += commentDump(this.comments.get("vVector") ?? [], linebreak);
    if (this.vVector) {
      s += `VVECTOR ${this.vVector.x} ${this.vVector.y}${linebreak}`;
    }
    s += commentDump(this.comments.get("properties") ?? [], linebreak);
    if (this.properties && this.properties.length > 0) {
      s += `STARTPROPERTIES ${this.properties.length}${linebreak}`;
      for (const prop of this.properties) {
        if (typeof prop.value === "string") {
          s += `${prop.key} "${prop.value.replaceAll('"', '""')}"${linebreak}`;
        } else {
          s += `${prop.key} ${prop.value}${linebreak}`;
        }
      }
      s += `ENDPROPERTIES${linebreak}`;
    }
    s += commentDump(this.comments.get("glyphs") ?? [], linebreak);
    s += `CHARS ${this.glyphs.length}${linebreak}`;
    for (const glyph of this.glyphs) {
      s += glyph.stringify(linebreak);
    }
    s += `ENDFONT${linebreak}`;
    return s;
  }
}

class Glyph {
  public comments: Map<keyof this, string[]> = new Map();
  public name: String = "";
  public encoding: [number] | [number, number] = [-1];
  public sWidth?: Vec2 = undefined;
  public dWidth?: Vec2 = undefined;
  public sWidth1?: Vec2 = undefined;
  public dWidth1?: Vec2 = undefined;
  public vVector?: Vec2 = undefined;
  public boundingBox: BoundingBox = {
    width: 0,
    height: 0,
    xOffset: 0,
    yOffset: 0,
  };
  public bitmap: string[] = [];

  public static parse(lines: LineIterator, warningHandler: (warning: Warning) => void = consoleWarnOnce): Glyph | null {
    const glyph = new Glyph();
    let tmpComments: string[] = [];
    while (true) {
      const { value: line, done } = lines.next();
      if (done) {
        throw new ParseError(lines.lineNumber, "Unexpected end of input");
      }
      const [key, ...values] = line.split(" ");
      switch (key) {
        case "COMMENT":
          tmpComments.push(values.join(" "));
          break;
        case "STARTCHAR":
          glyph.name = values.join(" ");
          glyph.comments.set("name", tmpComments);
          tmpComments = [];
          break;
        case "ENCODING":
          const encodingValues = values.map(Number);
          if (!(encodingValues.length === 1 || encodingValues.length === 2)) {
            throw new ParseError(
              lines.lineNumber,
              "Invalid number of encoding values",
            );
          }
          glyph.encoding = encodingValues as [number] | [number, number];
          glyph.comments.set("encoding", tmpComments);
          tmpComments = [];
          if (glyph.encoding.length === 2 && glyph.encoding[0] !== -1) {
            throw new ParseError(
              lines.lineNumber,
              "Invalid encoding value: first value must be -1 if two values are provided",
            );
          }
          break;
        case "SWIDTH":
        case "DWIDTH":
        case "SWIDTH1":
        case "DWIDTH1":
        case "VVECTOR":
          const [x, y] = values.map(Number);
          const propertyName = (() => {
            switch (key) {
              case "SWIDTH":
                return "sWidth";
              case "DWIDTH":
                return "dWidth";
              case "SWIDTH1":
                return "sWidth1";
              case "DWIDTH1":
                return "dWidth1";
              case "VVECTOR":
                return "vVector";
              default:
                throw new ParseError(lines.lineNumber, "Unreachable");
            }
          })();
          glyph[propertyName] = { x, y };
          glyph.comments.set(propertyName, tmpComments);
          tmpComments = [];
          break;
        case "BBX":
          glyph.boundingBox = {
            width: Number(values[0]),
            height: Number(values[1]),
            xOffset: Number(values[2]),
            yOffset: Number(values[3]),
          };
          glyph.comments.set("boundingBox", tmpComments);
          tmpComments = [];
          break;
        case "BITMAP":
          glyph.bitmap = [];
          while (true) {
            const { value: bitmapLine, done: bitmapDone } = lines.next();
            if (bitmapDone) {
              throw new ParseError(lines.lineNumber, "Unexpected end of input");
            }
            if (bitmapLine.startsWith("ENDCHAR")) {
              return glyph;
            }
            if (
              bitmapLine.length !==
              Math.ceil(glyph.boundingBox.width / 8) * 2
            ) {
              throw new ParseError(
                lines.lineNumber,
                `Invalid bitmap line length: expected ${Math.ceil(glyph.boundingBox.width / 8) * 2}, got ${bitmapLine.length}`,
              );
            }
            glyph.bitmap.push(bitmapLine);
          }
        case "ENDFONT":
          return null;
        default:
          warningHandler(new Warning(lines.lineNumber, `Unknown key "${key}"`));
          break;
      }
    }
  }

  public stringify(linebreak: string): string {
    let s = "";
    s += commentDump(this.comments.get("name") ?? [], linebreak);
    s += `STARTCHAR ${this.name}${linebreak}`;
    s += commentDump(this.comments.get("encoding") ?? [], linebreak);
    s += `ENCODING ${this.encoding.join(" ")}${linebreak}`;
    s += commentDump(this.comments.get("sWidth") ?? [], linebreak);
    if (this.sWidth) {
      s += `SWIDTH ${this.sWidth.x} ${this.sWidth.y}${linebreak}`;
    }
    s += commentDump(this.comments.get("dWidth") ?? [], linebreak);
    if (this.dWidth) {
      s += `DWIDTH ${this.dWidth.x} ${this.dWidth.y}${linebreak}`;
    }
    s += commentDump(this.comments.get("sWidth1") ?? [], linebreak);
    if (this.sWidth1) {
      s += `SWIDTH1 ${this.sWidth1.x} ${this.sWidth1.y}${linebreak}`;
    }
    s += commentDump(this.comments.get("dWidth1") ?? [], linebreak);
    if (this.dWidth1) {
      s += `DWIDTH1 ${this.dWidth1.x} ${this.dWidth1.y}${linebreak}`;
    }
    s += commentDump(this.comments.get("vVector") ?? [], linebreak);
    if (this.vVector) {
      s += `VVECTOR ${this.vVector.x} ${this.vVector.y}${linebreak}`;
    }
    s += commentDump(this.comments.get("boundingBox") ?? [], linebreak);
    s += `BBX ${this.boundingBox.width} ${this.boundingBox.height} ${this.boundingBox.xOffset} ${this.boundingBox.yOffset}${linebreak}`;
    s += commentDump(this.comments.get("bitmap") ?? [], linebreak);
    s += `BITMAP${linebreak}`;
    s += this.bitmap.join(linebreak);
    s += `${linebreak}ENDCHAR${linebreak}`;
    return s;
  }
}

export { BDFFont, Glyph, Size, BoundingBox, Vec2, MetricsSet };
