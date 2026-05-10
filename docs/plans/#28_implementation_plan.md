# Agent Canvas Refinement & Spirit Bird Integration

This plan outlines the steps to evolve the Agent Canvas into a more professional development environment by displaying full filenames and integrating "Spirit Bird," an educational mascot designed to explain code and upskill users.

## User Review Required

> [!IMPORTANT]
> The new `SpiritBird` component will be visible on all artifacts where a tutor explanation is provided. We need to decide if we want to force the agent to always provide3.  **Enhanced Data Flow**: Update `Artifact` and `artifactParser` for `[TUTOR]` tagging.
4.  **Backend Capability**: Update `telemetry.py` to recognize Gemma 4 as a premium model.
5.  **Local Infrastructure**: Download `gemma4:31b` (or appropriate variant) via Ollama and configure it as the recommended model for the Code Lab.

## Proposed Changes

### [Frontend] Core Artifact System

#### [MODIFY] [chat.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/types/chat.ts)
- Add `tutorExplanation?: string` to the `Artifact` interface.

#### [MODIFY] [artifactParser.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/utils/artifactParser.ts)
- Update the parser to support a `[TUTOR]...[/TUTOR]` sub-tag within the `[CANVAS]` block.
- This allows the agent to provide both the code and the educational context in a single block.

---

### [Frontend] UI Components

#### [NEW] [SpiritBird.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/SpiritBird.tsx)
- Create a new premium component representing the Spirit Bird mascot.
- Use `/media/aicodex-spirit-bird.png` as the avatar.
- Implement a "Thought Bubble" or "Console" style layout for the tutor's explanation.
- Add subtle micro-animations (e.g., pulsing border, floating effect).

#### [MODIFY] [ArtifactView.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/canvas/ArtifactView.tsx)
- **Header**: Refine the header to display the full `filePath` (or `filename.extension`) instead of just the title. Style it to look like a modern IDE tab.
- **Integration**: Mount the `SpiritBird` component at the bottom of the scrollable content area.

---

### [Backend] Agent Skills

#### [MODIFY] [workspace_writer.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/skills/builtin/workspace_writer.py)
- Add `tutor_explanation` parameter to the `workspace_writer` skill.
- Update the `execute` method to include this explanation in the returned data.
- Fix the bug where `canvas_tag` is used but not defined.

### [Backend Agent]

#### [MODIFY] [telemetry.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/utils/telemetry.py)
- Add `gemma4` to `thinking_models` and `structured` support lists.

#### [MODIFY] [space_config.py](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/space_config.py)
- Refine `CODE_LAB_SYSTEM_PROMPT` to emphasize MTP benefits.
- Set `recommended_model` to `gemma4:31b` for the `code-lab` space.

## Verification Plan

### Automated Tests
- Run `ollama list` and `ollama pull gemma4:31b` to ensure model availability.
- Verify backend API returns correct capabilities for Gemma 4 via `/api/v1/telemetry/capabilities`.
- I will use the browser tool to verify the new UI layout.
- I will simulate an agent response containing the new `[TUTOR]` tag to ensure the parser correctly extracts and displays the Spirit Bird explanation.

### Manual Verification
- Deploy and verify Spirit Bird component in the Agent Canvas.
- Switch to Code Lab space and verify that the system prompt and recommended model align with Gemma 4 specs.
- Check the responsive behavior of the new Agent Canvas on different screen sizes.
- Verify that the filename and extension are correctly derived and displayed in the header.
