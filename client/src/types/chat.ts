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
