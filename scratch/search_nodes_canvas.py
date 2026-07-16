with open("backend/agent/nodes.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "canvas_marker" in line or "data" in line and "output" in line:
            print(f"Line {idx}: {line.strip()}")
