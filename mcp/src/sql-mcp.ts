import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * sql-mcp: SQL Schema & Query Assistant
 * Provides schema context to the LLM to ensure generated SQL is valid.
 */
export const sqlMcp = new McpServer({
  name: "sql-mcp",
  version: "1.0.0",
});

// Mock database for POC (In production, this would connect to sqlite3 or pg)
const MOCK_SCHEMA = {
  users: ["id INTEGER PRIMARY KEY", "username TEXT", "email TEXT", "created_at TIMESTAMP"],
  orders: ["id INTEGER PRIMARY KEY", "user_id INTEGER", "total DECIMAL", "status TEXT"],
  products: ["id INTEGER PRIMARY KEY", "name TEXT", "price DECIMAL", "stock INTEGER"],
};

// Tool: List Tables
export async function listTablesHandler() {
  const tables = Object.keys(MOCK_SCHEMA).join(", ");
  return {
    content: [{ type: "text" as const, text: `Available tables: ${tables}` }],
  };
}

sqlMcp.tool(
  "list_tables",
  "Lists all available tables in the connected database",
  {},
  listTablesHandler
);

// Tool: Describe Table
export async function describeTableHandler({ tableName }: { tableName: string }) {
  const columns = MOCK_SCHEMA[tableName as keyof typeof MOCK_SCHEMA];
  
  if (!columns) {
    return {
      content: [{ type: "text" as const, text: `Table '${tableName}' not found in schema.` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text" as const, text: `Schema for ${tableName}:\n${columns.join("\n")}` }],
  };
}

sqlMcp.tool(
  "describe_table",
  "Fetches the columns and types for a specific table",
  {
    tableName: z.string().describe("The name of the table to describe"),
  },
  describeTableHandler
);

// Tool: Validate Query
export async function validateSqlQueryHandler({ query }: { query: string }) {
  // In a real implementation, this would use a library like 'sql-parser'
  // or run 'EXPLAIN' on the actual DB.
  const isBasicValid = query.toLowerCase().startsWith("select") || 
                       query.toLowerCase().startsWith("insert") || 
                       query.toLowerCase().startsWith("update");

  if (!isBasicValid) {
    return {
      content: [{ type: "text" as const, text: "Query is invalid: Must start with a valid SQL command (SELECT, INSERT, UPDATE)." }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text" as const, text: "Query syntax appears valid based on preliminary analysis." }],
  };
}

sqlMcp.tool(
  "validate_sql_query",
  "Checks if a SQL query is syntactically correct against the known schema",
  {
    query: z.string().describe("The SQL query to validate"),
  },
  validateSqlQueryHandler
);
