"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const db_js_1 = __importStar(require("./db.js"));
const yargs_1 = __importDefault(require("yargs"));
const server = new mcp_js_1.McpServer({
    name: "mcp test",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
    // port: 3000,
    // host: "localhost",
});
// name: z.string().describe("The name of the user"),
// email: z.string().email().describe("The email of the user"),
// address: z.string().optional().describe("The address of the user"),
// phone: z.string().optional().describe("The phone number of the user"),
server.tool("create-user", "Create a new user in the database", {
    name: zod_1.z.string().describe("The name of the user"),
    email: zod_1.z.string().email().describe("The email of the user"),
    address: zod_1.z.string().describe("The address of the user"),
    phone: zod_1.z.string().describe("The phone number of the user"),
}, {
    title: "Create User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
    description: "Create a new user in the database with the provided details",
    icon: "https://example.com/icons/create-user.png",
    color: "#4A90E2",
}, async (params) => {
    try {
        const id = await createUser(params);
        return {
            content: [
                { type: "text", text: `User ${id} created successfully.` }
            ]
        };
    }
    catch (error) {
        return {
            content: [
                { type: "text", text: "An error occurred while creating the user." }
            ]
        };
    }
    // Simulate user creation logic
    // const userId = Math.floor(Math.random() * 10000);
    // return { userId, ...params }; 
});
server.tool("get-user-by-id", "Get a user's details from the database by their ID", {
    id: zod_1.z.number().int().describe("The ID of the user to retrieve"),
}, {
    title: "Get User by ID",
    description: "Retrieves a single user's information from the database using their unique ID.",
}, async ({ id }) => {
    const user = await db_js_1.default.get('SELECT * FROM users WHERE id = ?', id);
    if (!user) {
        return {
            content: [{ type: "text", text: `User with ID ${id} not found.` }]
        };
    }
    return {
        content: [
            { type: "text", text: `User Details:\n${JSON.stringify(user, null, 2)}` }
        ]
    };
});
async function createUser(user) {
    // Use parameterized queries to prevent SQL injection.
    const result = await db_js_1.default.run('INSERT INTO users (name, email, address, phone) VALUES (?, ?, ?, ?)', user.name, user.email, user.address, user.phone);
    // Return the ID of the newly inserted row.
    return result.lastID;
}
async function main() {
    const argv = await (0, yargs_1.default)(process.argv.slice(2)).option("stdio", {
        type: "boolean",
        description: "Run the server in stdio mode",
    }).parse();
    await (0, db_js_1.initializeDatabase)();
    if (argv.stdio) {
        const transport = new stdio_js_1.StdioServerTransport();
        await server.connect(transport);
    }
}
main();
