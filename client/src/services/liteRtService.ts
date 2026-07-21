import { loadLiteRt } from '@litertjs/core';

export type AcceleratorType = 'webgpu' | 'wasm' | 'webnn' | 'cpu';

export interface ModelMetadata {
  id: string;
  name: string;
  size: string;
  description: string;
  url?: string;
}

export const AVAILABLE_MODELS: ModelMetadata[] = [
  {
    id: 'google/gemma-3n-E4B-it-litert-lm',
    name: 'Gemma 3n E4B (LiteRT-LM Web)',
    size: '4.28 GB',
    description: 'Local text-generation model. Requires explicit download consent and Hugging Face Gemma access.',
    url: 'https://huggingface.co/google/gemma-3n-E4B-it-litert-lm',
  },
  {
    id: 'litert-community/Gecko-110m-en',
    name: 'Gecko 110m (Embedding only)',
    size: '145.6 MB',
    description: 'Optional local embedding model for retrieval. It cannot generate chat responses.',
    url: 'https://huggingface.co/litert-community/Gecko-110m-en',
  }
];

export interface SystemCapabilities {
  webgpu: boolean;
  wasm: boolean;
  webnn: boolean;
  preferredAccelerator: AcceleratorType;
}

class LiteRtService {
  private isInitialized = false;
  private loadedModel: any = null;
  private wasmPath = '/wasm/';

  public getLoadedModel(): any {
    return this.loadedModel;
  }

  public async checkCapabilities(): Promise<SystemCapabilities> {
    const webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const wasm = typeof WebAssembly !== 'undefined';
    
    // WebNN is currently experimental in modern Chrome/Edge browsers
    const webnn = typeof navigator !== 'undefined' && ('ml' in navigator || 'webnn' in window);
    
    let preferredAccelerator: AcceleratorType = 'cpu';
    if (webgpu) {
      preferredAccelerator = 'webgpu';
    } else if (webnn) {
      preferredAccelerator = 'webnn';
    } else if (wasm) {
      preferredAccelerator = 'wasm';
    }

    return {
      webgpu,
      wasm,
      webnn,
      preferredAccelerator
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      // In a real build, LiteRT.js needs its WASM files served statically.
      // We load the WASM runtime pointing to our local public directory.
      await loadLiteRt(this.wasmPath);
      this.isInitialized = true;
    } catch (error) {
      console.warn('Failed to load native LiteRT WASM backend. Using local hybrid mode.', error);
      // We do not crash; we will allow running in fallback/simulated edge mode.
    }
  }

  public async loadModel(
    modelId: string, 
    onProgress?: (progress: number) => void
  ): Promise<void> {
    void modelId;
    onProgress?.(0);
    throw new Error('LiteRT-LM web generation is not installed yet; download confirmation is available, but local inference is disabled until the runtime adapter is added.');
  }

  public async generateLocalResponse(
    prompt: string, 
    onChunk: (chunk: string) => void
  ): Promise<string> {
    void prompt;
    void onChunk;
    throw new Error('Local Gemma generation is unavailable until the LiteRT-LM web runtime adapter is installed and the model is ready.');
  }

  public unloadModel(): void {
    this.loadedModel = null;
  }
}

export const liteRtService = new LiteRtService();
