import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SpiritBirdClient } from '../api/client';
import { Logger } from '../utils/logger';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'spirit-bird-chat-view';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionContext: vscode.ExtensionContext
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionContext.extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(async (data) => {
            Logger.log(`Received message event from Webview: "${data.type}"`);
            
            switch (data.type) {
                case 'getSettings': {
                    this.sendSettingsToWebview();
                    break;
                }
                case 'saveSettings': {
                    const config = vscode.workspace.getConfiguration('spiritBirdAiCodex');
                    await config.update('endpoint', data.endpoint, vscode.ConfigurationTarget.Global);
                    await config.update('apiKey', data.apiKey, vscode.ConfigurationTarget.Global);
                    await config.update('spaceSlug', data.spaceSlug, vscode.ConfigurationTarget.Global);
                    
                    Logger.log('Saved updated configurations from Settings view.');
                    vscode.window.showInformationMessage('Spirit Bird settings saved successfully.');
                    
                    this.sendSettingsToWebview();
                    break;
                }
                case 'sendMessage': {
                    await this.handleUserMessage(data.prompt);
                    break;
                }
            }
        });
    }

    private sendSettingsToWebview() {
        if (!this._view) return;

        const config = vscode.workspace.getConfiguration('spiritBirdAiCodex');
        const endpoint = config.get<string>('endpoint') || 'http://localhost:9000/api';
        const apiKey = config.get<string>('apiKey') || '';
        const spaceSlug = config.get<string>('spaceSlug') || 'code-lab';

        Logger.log('Loading configuration state for Settings view.');
        this._view.webview.postMessage({
            type: 'loadSettings',
            endpoint,
            apiKey,
            spaceSlug
        });
    }

    private async handleUserMessage(prompt: string) {
        if (!this._view) return;

        const config = vscode.workspace.getConfiguration('spiritBirdAiCodex');
        const endpoint = config.get<string>('endpoint') || 'http://localhost:9000/api';
        const apiKey = config.get<string>('apiKey') || '';
        const spaceSlug = config.get<string>('spaceSlug') || 'code-lab';

        if (!apiKey.trim()) {
            Logger.warn('Attempted to chat without configuring API key.');
            this._view.webview.postMessage({
                type: 'error',
                text: 'API Key (JWT) is not configured. Please switch to the Settings tab and enter your credentials.'
            });
            return;
        }

        const client = new SpiritBirdClient(apiKey, endpoint, spaceSlug);

        try {
            Logger.log(`Sending user prompt: "${prompt.substring(0, 60)}..."`);
            const generatedCode = await client.generateCode(prompt);
            
            this._view.webview.postMessage({
                type: 'response',
                text: generatedCode
            });
        } catch (error: any) {
            Logger.error('Error generating response inside Chat panel', error);
            this._view.webview.postMessage({
                type: 'error',
                text: error.message || 'An unexpected error occurred.'
            });
        }
    }

    private _getHtmlForWebview(): string {
        const htmlPath = path.join(this._extensionContext.extensionPath, 'src', 'panels', 'chatView.html');
        try {
            return fs.readFileSync(htmlPath, 'utf8');
        } catch (err) {
            Logger.error(`Failed to load Webview HTML file from ${htmlPath}`, err);
            return `<html><body><h3>Error loading panel layout view.</h3></body></html>`;
        }
    }
}
