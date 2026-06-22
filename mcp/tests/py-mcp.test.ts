import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generatePytestSkeletonHandler, suggestTypeHintsHandler } from '../src/py-mcp';
import * as fs from 'fs';

describe('py-mcp Server Logic', () => {
  const mockFilePath = 'test_file.py';
  const mockFuncName = 'calculate_sum';

  beforeAll(() => {
    fs.writeFileSync(mockFilePath, 'def calculate_sum(a, b):\n    return a + b\n');
  });

  afterAll(() => {
    if (fs.existsSync(mockFilePath)) {
      fs.unlinkSync(mockFilePath);
    }
  });

  it('should correctly format a pytest skeleton', async () => {
    const result = await generatePytestSkeletonHandler({ filePath: mockFilePath, functionName: mockFuncName });
    
    expect(result.content[0].text).toContain(`def test_${mockFuncName}_basic():`);
    expect(result.content[0].text).toContain(`import pytest`);
  });

  it('should handle non-existent files gracefully', async () => {
    const result = await generatePytestSkeletonHandler({ filePath: 'non_existent.py', functionName: 'fail' });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error analyzing Python file');
  });

  it('should suggest type hints', async () => {
    const codeSnippet = 'def calculate_sum(a, b): return a + b';
    const result = await suggestTypeHintsHandler({ codeSnippet });
    expect(result.content[0].text).toContain('Suggested hints for snippet:');
  });
});
