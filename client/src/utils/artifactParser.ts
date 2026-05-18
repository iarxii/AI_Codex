import type { Artifact } from '../types/chat';

/**
 * Parses the accumulated AI response content for [CANVAS:...] tags.
 * Returns an array of Artifact objects.
 * 
 * Format: [CANVAS:TYPE:TITLE:LANGUAGE] CONTENT [/CANVAS]
 * Extended: [CANVAS:TYPE:TITLE:LANGUAGE:PATH] CONTENT [/CANVAS]
 * Example: [CANVAS:CODE:main.ts:typescript] console.log("hi") [/CANVAS]
 * Example: [CANVAS:CODE:graphify_skill.py:python:backend/skills/builtin] content [/CANVAS]
 */
export const parseArtifacts = (content: string, messageId?: string): Artifact[] => {
  const artifacts: Artifact[] = [];
  
  // Extended regex: Group 5 captures optional filePath
  const regex = /\[CANVAS:(\w+):([^:\]]+)(?::(\w+))?(?::([^\]]+))?\]([\s\S]*?)\[\/CANVAS\]/gi;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    const type = match[1].toLowerCase();
    const title = match[2];
    const language = match[3];
    const pathHint = match[4]; // optional directory path
    let artifactContent = match[5].trim();
    let tutorExplanation: string | undefined = undefined;

    // Extract Spirit Bird tutor explanation if present
    const tutorRegex = /\[TUTOR\]([\s\S]*?)\[\/TUTOR\]/i;
    const tutorMatch = tutorRegex.exec(artifactContent);
    if (tutorMatch) {
      tutorExplanation = tutorMatch[1].trim();
      artifactContent = artifactContent.replace(tutorRegex, '').trim();
    }
    
    const typeNormMap: Record<string, Artifact['type']> = {
      'code': 'code',
      'docs': 'docs',
      'doc': 'docs',
      'documentation': 'docs',
      'research': 'research',
    };
    const artifactType: Artifact['type'] = typeNormMap[type] || 'docs';
    const id = `${artifactType}-${title.replace(/\s+/g, '-').toLowerCase()}`;

    artifacts.push({
      id,
      type: artifactType,
      title,
      content: artifactContent,
      language: language || (artifactType === 'code' ? 'text' : undefined),
      timestamp: Date.now(),
      messageId,
      filePath: pathHint ? `${pathHint}/${title}` : undefined,
      tutorExplanation
    });
  }

  // Fallback: standard markdown code blocks with context-aware naming
  if (artifacts.length === 0) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/gi;
    let cbMatch;
    let count = 1;
    while ((cbMatch = codeBlockRegex.exec(content)) !== null) {
      const language = (cbMatch[1] || 'text').toLowerCase();
      const artifactContent = cbMatch[2].trim();
      
      const title = inferSmartTitle(content, cbMatch, language, artifactContent, count);
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

  // Post-process: infer dependencies between artifacts in the same batch
  inferDependencies(artifacts);

  return artifacts;
};

/**
 * Multi-tiered context-aware title inference for fallback code block artifacts.
 * 
 * Tier 1: Extract nearest preceding markdown header from the message text.
 * Tier 2: Scan the code block content for domain-specific keywords/patterns.
 * Tier 3: Generate a descriptive title from the detected language.
 */
function inferSmartTitle(
  fullContent: string,
  cbMatch: RegExpExecArray,
  language: string,
  snippetContent: string,
  index: number
): string {
  // --- Tier 1: Nearest Markdown Header ---
  const preText = fullContent.substring(Math.max(0, cbMatch.index - 400), cbMatch.index);

  // Check for explicit file references first (e.g., "File: main.py" or "### index.ts")
  const filenameRegex = /(?:###?|File:|Path:)\s*`?([a-zA-Z0-9._/-]+\.[a-zA-Z0-9]+)`?/i;
  const fnMatch = filenameRegex.exec(preText);
  if (fnMatch) return fnMatch[1];

  // Check for nearest markdown heading (any level)
  const headingMatches = [...preText.matchAll(/^(?:#{1,4})\s+(?:\d+\.\s*)?(.+)$/gm)];
  if (headingMatches.length > 0) {
    const lastHeading = headingMatches[headingMatches.length - 1][1].trim();
    const cleaned = lastHeading
      .replace(/[*_`~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    if (cleaned.length > 2 && cleaned.length <= 60) return cleaned;
  }

  // --- Tier 2: Content Keyword Heuristics ---
  const lower = snippetContent.toLowerCase();

  // Trading / Financial signals
  if (/\[ai\s*(?:frt|alert)\]|long\s*trigger|short\s*trigger|confidence:\s*\d/i.test(snippetContent)) {
    const pairMatch = snippetContent.match(/(?:USD|EUR|GBP|JPY|AUD|NZD|CHF|CAD)\/(?:USD|EUR|GBP|JPY|AUD|NZD|CHF|CAD)/i);
    return pairMatch ? `Trading Alert: ${pairMatch[0].toUpperCase()}` : 'AI Trading Signals';
  }

  // API configuration / keys
  if (lower.includes('api_key') || lower.includes('api-key') || lower.includes('apikey') ||
      lower.includes('oanda') || lower.includes('alpaca') || lower.includes('broker')) {
    return 'API Configuration';
  }

  // Environment / .env files
  if (lower.includes('export ') && lower.includes('=') && !lower.includes('function')) {
    return 'Environment Variables';
  }

  // Installation commands
  if (lower.startsWith('pip install') || lower.startsWith('npm install') || lower.startsWith('npm i ') ||
      lower.startsWith('yarn add') || lower.startsWith('conda install')) {
    return 'Package Installation';
  }

  // Shell/CLI commands
  if (language === 'bash' || language === 'sh' || language === 'shell' || language === 'zsh') {
    if (lower.includes('curl ') || lower.includes('wget ')) return 'API Request';
    if (lower.includes('docker ')) return 'Docker Command';
    if (lower.includes('git ')) return 'Git Command';
    return 'Shell Command';
  }

  // JSON configuration
  if (language === 'json' || language === 'jsonc') {
    if (lower.includes('"model"') || lower.includes('"provider"')) return 'Model Configuration';
    if (lower.includes('"host"') || lower.includes('"port"') || lower.includes('"url"')) return 'Connection Config';
    return 'JSON Document';
  }

  if (language === 'sql') return 'SQL Query';
  if (language === 'yaml' || language === 'yml' || language === 'toml') return 'Configuration File';

  // --- Tier 3: Language-Based Descriptive Fallback ---
  const langTitleMap: Record<string, string> = {
    'python': 'Python Script', 'py': 'Python Script',
    'javascript': 'JavaScript Snippet', 'js': 'JavaScript Snippet',
    'typescript': 'TypeScript Module', 'ts': 'TypeScript Module',
    'tsx': 'React Component', 'jsx': 'React Component',
    'html': 'HTML Template', 'css': 'Stylesheet', 'scss': 'Stylesheet',
    'rust': 'Rust Module', 'go': 'Go Module', 'java': 'Java Class',
    'c': 'C Source', 'cpp': 'C++ Source',
    'ruby': 'Ruby Script', 'php': 'PHP Script',
    'markdown': 'Documentation', 'md': 'Documentation',
    'text': 'Text Snippet',
  };

  const baseName = langTitleMap[language] || `${language.charAt(0).toUpperCase() + language.slice(1)} Snippet`;
  return index > 1 ? `${baseName} (${index})` : baseName;
}

/**
 * Infers dependency relationships between artifacts by scanning
 * import/require/from statements in code artifacts.
 */
export function inferDependencies(artifacts: Artifact[]): void {
  const titleToId = new Map<string, string>();
  for (const art of artifacts) {
    // Map both the exact title and a "base name" variant
    titleToId.set(art.title.toLowerCase(), art.id);
    const baseName = art.title.replace(/\.\w+$/, '').toLowerCase();
    if (baseName !== art.title.toLowerCase()) {
      titleToId.set(baseName, art.id);
    }
  }

  for (const art of artifacts) {
    if (art.type !== 'code') continue;
    const deps: string[] = [];

    // Scan for Python imports: from X import Y / import X
    const pyImportRe = /(?:from\s+[\w.]+\s+import\s+[\w, ]+|import\s+[\w.]+)/g;
    let pyMatch;
    while ((pyMatch = pyImportRe.exec(art.content)) !== null) {
      const statement = pyMatch[0];
      // Extract the module path segments
      const moduleMatch = statement.match(/(?:from|import)\s+([\w.]+)/);
      if (moduleMatch) {
        const parts = moduleMatch[1].split('.');
        const lastPart = parts[parts.length - 1].toLowerCase();
        const depId = titleToId.get(lastPart);
        if (depId && depId !== art.id && !deps.includes(depId)) {
          deps.push(depId);
        }
      }
    }

    // Scan for JS/TS imports: import X from './Y' / require('./Y')
    const jsImportRe = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    let jsMatch;
    while ((jsMatch = jsImportRe.exec(art.content)) !== null) {
      const importPath = jsMatch[1] || jsMatch[2];
      // Extract filename from path
      const segments = importPath.replace(/^[./]+/, '').split('/');
      const fileName = segments[segments.length - 1].replace(/\.\w+$/, '').toLowerCase();
      const depId = titleToId.get(fileName);
      if (depId && depId !== art.id && !deps.includes(depId)) {
        deps.push(depId);
      }
    }

    if (deps.length > 0) {
      art.dependencies = deps;
    }
  }
}

/**
 * Given a batch of artifacts from workspace_writer tool calls,
 * auto-assigns a shared module name based on common path prefixes.
 */
export function assignModuleFromBatch(artifacts: Artifact[]): void {
  if (artifacts.length <= 1) return;

  // Try to find a common directory prefix from filePaths
  const paths = artifacts.map(a => a.filePath || a.title).filter(Boolean);
  if (paths.length === 0) return;

  const segments = paths.map(p => p.split('/'));
  const minLen = Math.min(...segments.map(s => s.length));
  
  let commonPrefix: string[] = [];
  for (let i = 0; i < minLen - 1; i++) {
    const seg = segments[0][i];
    if (segments.every(s => s[i] === seg)) {
      commonPrefix.push(seg);
    } else {
      break;
    }
  }

  // If we found a common prefix, use the last meaningful segment as module name
  const moduleName = commonPrefix.length > 0
    ? commonPrefix[commonPrefix.length - 1]
    : `batch-${Date.now()}`;

  for (const art of artifacts) {
    if (!art.module) {
      art.module = moduleName;
    }
  }
}
