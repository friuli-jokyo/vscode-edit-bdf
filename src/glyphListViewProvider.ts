import * as vscode from "vscode";
import { getNonce } from "./webview/util";
import { DocumentManager } from "./documentManager";

export class GlyphListViewProvider implements vscode.CustomTextEditorProvider {
    private static readonly viewType = "edit-bdf.glyph-list";
    
    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new GlyphListViewProvider(context);
        const registration = vscode.window.registerCustomEditorProvider(GlyphListViewProvider.viewType, provider);
        return registration;
    }

    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): Thenable<void> | void {
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        function updateWebview() {
            const font = DocumentManager.getFont(document);

            webviewPanel.webview.postMessage({
                type: "updateDocument",
                font: font,
            })
        }

        const changeDocumentSubscription = DocumentManager.onDidUpdateDocument((updatedDocument) => {
            if (updatedDocument.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        webviewPanel.webview.onDidReceiveMessage((message) => {
            switch (message.type) {
                case "requestRefresh": {
                    updateWebview();
                    break;
                }
            }
        }, undefined, this.context.subscriptions);

        updateWebview();
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview", "glyph-list-view.js"));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview", "glyph-list-view.css"));
        const nonce = getNonce();

        return /*html*/`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                
                <link href="${styleUri}" rel="stylesheet" />
                
                <title>Glyph List</title>
            </head>
            <body>
                <glyph-list-view></glyph-list-view>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}