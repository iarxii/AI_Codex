import os

for root, dirs, files in os.walk("backend"):
    if ".venv" in root or "venv" in root:
        continue
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for idx, line in enumerate(f, 1):
                        if "capabilities" in line or "telemetry" in line:
                            print(f"{path}:{idx}: {line.strip()}")
            except Exception:
                pass
