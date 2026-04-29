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
}
