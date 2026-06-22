import { describe, it, expect } from 'vitest';
import { listTablesHandler, describeTableHandler, validateSqlQueryHandler } from '../src/sql-mcp';

describe('sql-mcp Server Logic', () => {
  it('should list all available tables', async () => {
    const result = await listTablesHandler();
    expect(result.content[0].text).toContain('Available tables:');
    expect(result.content[0].text).toContain('users');
    expect(result.content[0].text).toContain('orders');
    expect(result.content[0].text).toContain('products');
  });

  it('should describe a table successfully', async () => {
    const result = await describeTableHandler({ tableName: 'users' });
    expect(result.content[0].text).toContain('Schema for users:');
    expect(result.content[0].text).toContain('username TEXT');
  });

  it('should handle non-existent tables gracefully', async () => {
    const result = await describeTableHandler({ tableName: 'non_existent' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Table 'non_existent' not found");
  });

  it('should validate valid queries', async () => {
    const result = await validateSqlQueryHandler({ query: 'SELECT * FROM users' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('syntax appears valid');
  });

  it('should fail validation for invalid queries', async () => {
    const result = await validateSqlQueryHandler({ query: 'DROP TABLE users' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Query is invalid');
  });
});
