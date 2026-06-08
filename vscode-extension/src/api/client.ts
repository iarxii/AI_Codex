import { CodexRequest, CodexResponse } from './types';
import { Logger } from '../utils/logger';

export class SpiritBirdClient {
    constructor(
        private apiKey: string,
        private endpoint: string,
        private spaceSlug: string
    ) {}

    async generateCode(prompt: string): Promise<string> {
        const url = `${this.endpoint.replace(/\/$/, '')}/spaces/${this.spaceSlug}/codegen`;
        
        Logger.log(`Initiating codegen request to Space: "${this.spaceSlug}"`);
        Logger.log(`Request URL: POST ${url}`);
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (this.apiKey) {
            const maskedToken = this.apiKey.length > 20 
                ? `${this.apiKey.substring(0, 10)}...${this.apiKey.substring(this.apiKey.length - 10)}` 
                : '****';
            Logger.log(`Using Authorization JWT: Bearer ${maskedToken}`);
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        } else {
            Logger.warn('No Authorization JWT provided in settings.');
        }

        const body: CodexRequest = { prompt };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            Logger.log(`Response status received: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                let errorMessage = `HTTP Error ${response.status}`;
                try {
                    const errorData = await response.json() as { detail?: string };
                    if (errorData && errorData.detail) {
                        errorMessage = errorData.detail;
                    }
                } catch {
                    // Ignore parsing errors
                }

                Logger.error(`API response indicates error status: ${response.status}. Detail: "${errorMessage}"`);

                if (response.status === 401) {
                    throw new Error('Unauthorized: Please check your Spirit Bird API Key/JWT.');
                } else if (response.status === 403) {
                    throw new Error(`Access Denied: ${errorMessage}`);
                } else if (response.status === 404) {
                    throw new Error(`Space '${this.spaceSlug}' not found. Check your Space Slug configuration.`);
                } else {
                    throw new Error(errorMessage);
                }
            }

            const data = await response.json() as CodexResponse;
            if (!data || typeof data.generatedCode !== 'string') {
                Logger.error('API response payload missing "generatedCode" property.');
                throw new Error('Invalid response payload from Spirit Bird backend.');
            }

            Logger.log(`Successfully received generated code (${data.generatedCode.length} chars).`);
            return data.generatedCode;

        } catch (error: any) {
            Logger.error(`Network or fetch request failed to reach the server at ${url}`, error);
            throw error;
        }
    }
}
