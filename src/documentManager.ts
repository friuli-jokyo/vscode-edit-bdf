import * as vscode from "vscode";
import { BDFFont } from "./bdf";

export class DocumentManager {
  static doc2font: Map<vscode.TextDocument, [BDFFont, number]> = new Map();
  private static readonly _onDidUpdateDocument = new vscode.EventEmitter<vscode.TextDocument>();
  static readonly onDidUpdateDocument = DocumentManager._onDidUpdateDocument.event;

  static updateDocument(document: vscode.TextDocument): void {
    const font = BDFFont.from_string(document.getText());
    DocumentManager.doc2font.set(document, [font, document.version]);
    DocumentManager._onDidUpdateDocument.fire(document);
  }

  static getFont(document: vscode.TextDocument): BDFFont {
    const current = DocumentManager.doc2font.get(document);
    if (current !== undefined && current[1] === document.version) {
      return current[0];
    }

    const font = BDFFont.from_string(document.getText());
    DocumentManager.doc2font.set(document, [font, document.version]);
    return font;
  }

  static deleteDocument(document: vscode.TextDocument): void {
    DocumentManager.doc2font.delete(document);
  }
}
