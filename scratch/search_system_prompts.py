with open("backend/agent/nodes.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "SystemMessage" in line or "system_message" in line or "system_prompt" in line or "system_instruction" in line:
            print(f"Line {idx}: {line.strip()}")
