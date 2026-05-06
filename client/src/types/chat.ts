export interface Message {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  status?: 'typing' | 'done';
  tool_calls?: any[];
  metadata?: any;
}

export interface ThoughtLogEntry {
  text: string;
  timestamp: number;
  details?: string;
  type?: string;
}

export interface Artifact {
  id: string;
  type: 'code' | 'docs' | 'research';
  title: string;
  content: string;
  language?: string;
  timestamp: number;
  messageId?: string; // Link to the message that generated this artifact
  // Multi-modular support
  module?: string;         // Groups related files (e.g., "graphify-integration")
  filePath?: string;       // Full relative path (e.g., "backend/skills/graphify_skill.py")
  dependencies?: string[]; // IDs of other artifacts this one references
}

export interface ModelTelemetry {
  request_id: string;
  ttft: number;
  total_tokens: number;
  usage: {
    input: number;
    output: number;
  };
  latencies: Record<string, number>;
  capabilities: string[];
  provider: string;
  model: string;
}
