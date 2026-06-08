import * as vscode from 'vscode';

export class Logger {
    private static channel: vscode.OutputChannel | undefined;

    static initialize() {
        if (!this.channel) {
            this.channel = vscode.window.createOutputChannel('Spirit Bird AICodex');
            this.log('Logger initialized.');
        }
    }

    static log(message: string) {
        this.append('INFO', message);
    }

    static warn(message: string) {
        this.append('WARN', message);
    }

    static error(message: string, error?: any) {
        let fullMessage = message;
        if (error) {
            if (error instanceof Error) {
                fullMessage += ` | Error: ${error.message}\nStack: ${error.stack}`;
            } else {
                fullMessage += ` | Error: ${JSON.stringify(error)}`;
            }
        }
        this.append('ERROR', fullMessage);
    }

    static show() {
        if (this.channel) {
            this.channel.show(true);
        }
    }

    private static append(level: string, message: string) {
        if (!this.channel) {
            this.initialize();
        }
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] [${level}] ${message}`;
        this.channel?.appendLine(line);
        console.log(line);
    }
}
