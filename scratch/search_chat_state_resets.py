with open("client/src/pages/Chat.tsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "currentToolCallsRef" in line or "setCurrentToolCalls" in line or "thoughtLogRef" in line:
            print(f"Line {idx}: {line.strip()}")
