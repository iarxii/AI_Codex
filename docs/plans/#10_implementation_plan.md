# Relocation of ContextInspector and Creation of Agent Canvas

The goal is to move the `ContextInspector` component from the right drawer into the chat stream to provide real-time visibility into the agent's thinking process (tool calls, RAG context). The right drawer will then be repurposed as the "Agent Canvas" for high-fidelity outputs like code, documents, and research.

## User Review Required

> [!IMPORTANT]
> The `ContextInspector` will now appear inline within the chat stream, specifically during the "Thinking" phase.
> The right drawer will be transformed into the `AgentCanvas`. I'll need to define what the `AgentCanvas` displays initially. Based on your request, it will be for "code, docs, research". I'll implement a placeholder/initial structure for these.

## Proposed Changes

### [Component Refactoring]

#### [MODIFY] [ContextInspector.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/ContextInspector.tsx)
- Refactor the component to be an inline "reasoning block" instead of a full-height `aside`.
- Remove the `isOpen` and `onClose` props (it will be rendered conditionally by the parent).
- Adjust styling to fit within the chat message stream (no fixed width, no slide-in animation).
- Keep the "Tool Activity" and "RAG Grounding" sections.

#### [NEW] [AgentCanvas.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/AgentCanvas.tsx)
- Create a new component for the right drawer.
- This will be the target for "agent generated outputs".
- It will feature a tabs or section-based layout for "Code", "Docs", and "Research".

#### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)
- Integrate `ContextInspector` into the message rendering loop, specifically within the "Thinking" section.
- Replace the right-drawer `ContextInspector` with the new `AgentCanvas`.
- Add state to manage content for the `AgentCanvas` (e.g., `canvasContent`).
- Update the header "Inspector" button to "Canvas" or similar, or just have the Canvas always accessible/toggable.

## Verification Plan

### Automated Tests
- Not applicable for this UI refactor, but I will verify through manual inspection of the code structure and styles.

### Manual Verification
- I will use the browser tool to verify the new layout and ensure the "Thinking" block looks good inline.
- I will check that the `AgentCanvas` appears correctly in the right drawer.
- I will verify that `tool_calls` still populate the `ContextInspector` correctly when they happen.
