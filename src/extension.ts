import * as vscode from "vscode";
import { DocumentManager } from "./documentManager";
import { GlyphListViewProvider } from "./glyphListViewProvider";

const BDF_LANGUAGE_ID = "bdf-font";

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.languageId !== BDF_LANGUAGE_ID) return;
            DocumentManager.updateDocument(document);
        }),
        vscode.workspace.onDidChangeTextDocument((e) => {
            const document = e.document;
            if (document.languageId !== BDF_LANGUAGE_ID) return;
            DocumentManager.updateDocument(document);
        }),
        vscode.workspace.onDidCloseTextDocument((document) => {
            if (document.languageId !== BDF_LANGUAGE_ID) return;
            DocumentManager.deleteDocument(document);
        })
    );

    context.subscriptions.push(GlyphListViewProvider.register(context));
}

export function deactivate() { }