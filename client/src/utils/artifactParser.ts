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
    const artifactContent = match[5].trim();
    
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
    });
  }

  // Fallback: standard markdown code blocks
  if (artifacts.length === 0) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/gi;
    let cbMatch;
    let count = 1;
    while ((cbMatch = codeBlockRegex.exec(content)) !== null) {
      const language = (cbMatch[1] || 'text').toLowerCase();
      const artifactContent = cbMatch[2].trim();
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

  // Post-process: infer dependencies between artifacts in the same batch
  inferDependencies(artifacts);

  return artifacts;
};

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
