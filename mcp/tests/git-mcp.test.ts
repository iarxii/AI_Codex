import { describe, it, expect, vi } from 'vitest';
import { GitMCP } from '../src/git-mcp';

describe('GitMCP Server Logic', () => {
  it('should return a valid commit suggestion for a feature change', () => {
    const gitMcp = new GitMCP();
    // Accessing private method for testing purposes via type casting
    const result = (gitMcp as any).mockLLMSuggestion('feat: added new login logic');
    expect(result).toContain('feat:');
  });

  it('should return a chore suggestion for generic changes', () => {
    const gitMcp = new GitMCP();
    const result = (gitMcp as any).mockLLMSuggestion('updated some comments');
    expect(result).toContain('chore:');
  });

  it('should handle empty diffs', () => {
    const gitMcp = new GitMCP();
    const result = (gitMcp as any).mockLLMSuggestion('');
    expect(result).toBe('No changes to commit.');
  });
});
