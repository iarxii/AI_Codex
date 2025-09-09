"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const promises_1 = __importDefault(require("node:fs/promises"));
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
server.resource("users", "users://all", {
    description: "Get all users data from the database",
    title: "Users",
    mimeType: "application/json",
}, async (uri) => {
    const users = await import("./data/users.json", {
        with: { type: "json" }
    }).then(mod => mod.default); //mod is the 'module' object
    return {
        contents: [
            {
                uri: uri.href,
                text: JSON.stringify(users),
                mimeType: "application/json"
            }
        ]
    };
});
// name: z.string().describe("The name of the user"),
// email: z.string().email().describe("The email of the user"),
// address: z.string().optional().describe("The address of the user"),
// phone: z.string().optional().describe("The phone number of the user"),
server.tool("create-user", "Create a new user in the database", {
    name: zod_1.z.string().describe("The name of the user"),
    email: zod_1.z.string().email().describe("The email of the user"),
    address: zod_1.z.string().describe("The address of the user"),
    phone: zod_1.z.string().describe("The address of the user"),
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
async function createUser(user) {
    const users = await import("./data/users.json", {
        with: { type: "json" }
    }).then(mod => mod.default); //mod is the 'module' object
    const id = users.length + 1;
    users.push({ id, ...user });
    await promises_1.default.writeFile("./data/users.json", JSON.stringify(users, null, 2));
    return id;
}
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    // transport protocol: standard-input-io / http / websocket 
    // const transport = "http"
    // if (transport === "standard-input-io") {
    //     server.startStdio()
    // } else if (transport === "http") {
    //     server.startHttp()
    // } else if (transport === "websocket") {
    //     server.startWebSocket()
    // }
}
main();
