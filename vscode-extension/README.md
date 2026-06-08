# Spirit Bird AICodex VSCode Extension

Elevate your development workflow with **Spirit Bird AICodex**—an AI-assisted code generation tool working directly within VSCode. By integrating with CodexSpaces private submodules, developers can run prompts directly from comments or selections, leveraging secure cloud or local Neural models.

---

## Features

- **Prompt-to-Code Generation**: Highlight any comment (e.g., `// function to reverse a string`) or text, run the command, and let Spirit Bird insert the generated code immediately below.
- **Premium CodexSpaces Security & Access**: Built-in compatibility with private, public, and premium exclusive spaces. Enforces authentication checks using User JWT tokens.
- **Dynamic loading notifications**: Keeps you informed with a native VSCode progress indicator while the AI model is thinking.
- **Smart Setting Fallbacks**: Prompts for your JWT token interactively if it hasn't been set up yet, storing it securely in global configurations.

---

## Configuration Settings

You can configure the extension via the standard VSCode settings panel under **Spirit Bird AICodex**:

1. `spiritBirdAiCodex.apiKey`: Your user authentication JWT token, generated upon logging into AICodex.
2. `spiritBirdAiCodex.endpoint`: The base URL of the AICodex API (defaults to local development `http://localhost:8000/api`).
3. `spiritBirdAiCodex.spaceSlug`: The specific CodexSpace to query for code generation (defaults to `code-lab` which utilizes Gemma 4).

---

## Installation & Setup

### 1. Install Dependencies
Navigate into the `vscode-extension` directory and install the required compiler packages:
```bash
cd vscode-extension
npm install
```

### 2. Compile the Extension
To compile the TypeScript files:
```bash
npm run compile
```

### 3. Run and Debug (Extension Development Host)
1. Inside VSCode, open the `vscode-extension` folder.
2. Press `F5` (or click `Run -> Start Debugging`).
3. This opens a new window, the **Extension Development Host**.
4. In this new window, open any codebase or file.
5. Highlight a comment or line, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`), and run **Spirit Bird: Generate Code from Comment**.

---

## Testing & Security Measures

- **JWT Authorization**: All backend API interactions require a valid JWT token passed in the `Authorization: Bearer <token>` header.
- **Freemium & Exclusive Space Access Control**: Standard users are blocked from calling codegen on premium/exclusive spaces (like `code-lab`) unless they are explicitly granted permission in the `CodexSpaceAccess` database table or hold administrative privileges.
- **Robust Error Messaging**: Clearly propagates security blockages, missing model api keys, or server timeouts directly to the editor workspace UI.
- **Sanitized Outputs**: Outputs are automatically cleaned to strip formatting blocks (like triple backticks ` ``` `) before writing back to active editors.
