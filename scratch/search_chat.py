with open("client/src/pages/Chat.tsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "artifacts" in line or "parseArtifacts" in line or "currentToolCalls" in line or "done" in line:
            print(f"Line {idx}: {line.strip()}")
