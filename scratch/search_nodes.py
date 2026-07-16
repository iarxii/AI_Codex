with open("backend/agent/nodes.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "get_agent_tools" in line:
            print(f"Line {idx}: {line.strip()}")
