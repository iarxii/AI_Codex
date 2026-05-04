import type { Artifact } from '../types/chat';

/**
 * Parses the accumulated AI response content for [CANVAS:...] tags.
 * Returns an array of Artifact objects.
 * 
 * Format: [CANVAS:TYPE:TITLE:LANGUAGE] CONTENT [/CANVAS]
 * Example: [CANVAS:CODE:main.ts:typescript] console.log("hi") [/CANVAS]
 */
export const parseArtifacts = (content: string, messageId?: string): Artifact[] => {
  const artifacts: Artifact[] = [];
  
  // Regex to match closed canvas tags
  // Group 1: Type (CODE|DOC|RESEARCH)
  // Group 2: Title
  // Group 3: Language (optional)
  // Group 4: Content
  const regex = /\[CANVAS:(\w+):([^:\]]+)(?::(\w+))?\]([\s\S]*?)\[\/CANVAS\]/gi;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    const type = match[1].toLowerCase();
    const title = match[2];
    const language = match[3];
    const artifactContent = match[4].trim();
    
    // Normalize common type variations
    const typeNormMap: Record<string, Artifact['type']> = {
      'code': 'code',
      'docs': 'docs',
      'doc': 'docs',
      'documentation': 'docs',
      'research': 'research',
    };
    const artifactType: Artifact['type'] = typeNormMap[type] || 'docs';

    // Use a hash or a slug of the title+type as ID to prevent duplicates if streaming
    const id = `${artifactType}-${title.replace(/\s+/g, '-').toLowerCase()}`;

    artifacts.push({
      id,
      type: artifactType,
      title,
      content: artifactContent,
      language: language || (artifactType === 'code' ? 'text' : undefined),
      timestamp: Date.now(),
      messageId
    });
  }
  // Fallback: If no CANVAS tags found, check for standard markdown code blocks
  if (artifacts.length === 0) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/gi;
    let cbMatch;
    let count = 1;
    while ((cbMatch = codeBlockRegex.exec(content)) !== null) {
      const language = (cbMatch[1] || 'text').toLowerCase();
      const artifactContent = cbMatch[2].trim();
      
      // Basic heuristic for title
      const title = `Generated Code ${count > 1 ? `(${count})` : ''}`;
      const id = `code-gen-${messageId || 'anon'}-${count}`;

      artifacts.push({
        id,
        type: 'code',
        title,
        content: artifactContent,
        language,
        timestamp: Date.now(),
        messageId
      });
      count++;
    }
  }

  return artifacts;
};
