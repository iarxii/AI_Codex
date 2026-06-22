import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";

const execPromise = promisify(exec);

/**
 * GitMCP Server implementation for the Spirit Bird Platform.
 * Provides tools to analyze local git state and generate commit messages.
 */
export class GitMCP {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "git-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_git_diff",
            description: "Get the current unstaged changes from git diff",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "generate_commit_suggestion",
            description: "Analyze diff and suggest a conventional commit message",
            inputSchema: {
              type: "object",
              properties: {
                diff: { type: "string", description: "The git diff content" },
              },
              required: ["diff"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === "get_git_diff") {
          const { stdout } = await execPromise("git diff");
          return {
            content: [{ type: "text", text: stdout || "No unstaged changes found." }],
          };
        }

        if (name === "generate_commit_suggestion") {
          const DiffSchema = z.object({ diff: z.string() });
          const parsed = DiffSchema.parse(args);

          // Note: In a real production scenario, this would call the Gemma 4 API
          // For this server, we provide the structural prompt and the logic.
          const suggestion = this.mockLLMSuggestion(parsed.diff);
          
          return {
            content: [{ type: "text", text: suggestion }],
          };
        }

        throw new Error(`Tool not found: ${name}`);
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  private mockLLMSuggestion(diff: string): string {
    if (!diff || diff.includes("No unstaged changes")) return "No changes to commit.";
    
    // Simple heuristic to simulate Gemma 4's MTP behavior for the demo
    if (diff.includes("test")) return "test: implement unit tests for core logic";
    if (diff.includes("fix")) return "fix: resolve race condition in async handler";
    if (diff.includes("feat")) return "feat: add new MCP tool for git integration";
    
    return "chore: update codebase and refine implementation";
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Git MCP Server running on stdio");
  }
}

// If run directly, start the server
if (typeof require !== "undefined" && require.main === module) {
  const gitMcp = new GitMCP();
  gitMcp.start().catch(console.error);
}
