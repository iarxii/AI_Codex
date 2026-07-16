with open("backend/agent/nodes.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "final_report_node" in line or "add_node" in line or "add_edge" in line or "Workflow" in line:
            print(f"Line {idx}: {line.strip()}")
