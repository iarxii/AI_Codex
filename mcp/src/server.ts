import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import db, { initializeDatabase } from "./db.js";
import yargs from "yargs";

const server = new McpServer({
    name: "mcp test",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
    // port: 3000,
    // host: "localhost",
})

// name: z.string().describe("The name of the user"),
// email: z.string().email().describe("The email of the user"),
// address: z.string().optional().describe("The address of the user"),
// phone: z.string().optional().describe("The phone number of the user"),

server.tool("create-user", "Create a new user in the database", {
    name: z.string().describe("The name of the user"),
    email: z.string().email().describe("The email of the user"),
    address: z.string().describe("The address of the user"),
    phone: z.string().describe("The phone number of the user"),
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
        const id = await createUser(params)
        return {
            content: [
                { type: "text", text: `User ${id} created successfully.` }
            ]
        }
    } catch (error) {
        return {
            content: [
                { type: "text", text: "An error occurred while creating the user." }
            ]
        }
    }

    // Simulate user creation logic
    // const userId = Math.floor(Math.random() * 10000);
    // return { userId, ...params }; 
})
server.tool("get-user-by-id", "Get a user's details from the database by their ID", {
    id: z.number().int().describe("The ID of the user to retrieve"),
}, {
    title: "Get User by ID",
    description: "Retrieves a single user's information from the database using their unique ID.",
}, async ({ id }) => {
    const user = await db.get('SELECT * FROM users WHERE id = ?', id);
    if (!user) {
        return {
            content: [{ type: "text", text: `User with ID ${id} not found.` }]
        }
    }
    return {
        content: [
            { type: "text", text: `User Details:\n${JSON.stringify(user, null, 2)}` }
        ]
    }
});

async function createUser(user: {
    name: string;
    email: string;
    address: string;
    phone: string;
}) {
    // Use parameterized queries to prevent SQL injection.
    const result = await db.run(
        'INSERT INTO users (name, email, address, phone) VALUES (?, ?, ?, ?)',
        user.name,
        user.email,
        user.address,
        user.phone
    );
    // Return the ID of the newly inserted row.
    return result.lastID;
}

async function main() {
    const argv = await yargs(process.argv.slice(2)).option("stdio", {
        type: "boolean",
        description: "Run the server in stdio mode",
    }).parse();

    await initializeDatabase();

    if (argv.stdio) {
        const transport = new StdioServerTransport();
        await server.connect(transport);
    }
}

main()