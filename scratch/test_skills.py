import sys
import os
from pathlib import Path
import asyncio

# Resolve paths
root = Path("c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex")
backend_path = root / "backend"
sys.path.insert(0, str(root)) # Add root so we can import 'backend'

from backend.skills.registry import registry
from backend.agent.tools import get_agent_tools

async def main():
    print("--- AICodex Skill System Test ---")
    
    print("\n1. Discovering skills...")
    registry.discover_builtin_skills()
    skills = registry.get_all_skills()
    print(f"Found {len(skills)} skills: {[s.name for s in skills]}")
    
    print("\n2. Converting to LangChain tools...")
    tools = get_agent_tools()
    print(f"Created {len(tools)} tools.")
    for t in tools:
        print(f"- {t.name}: {t.description}")

    print("\n3. Testing workspace_reader (list current directory)...")
    ws_skill = registry.get_skill("workspace_reader")
    if ws_skill:
        result = await ws_skill.execute(action="list", path=".")
        print(f"Success: {result.success}")
        if result.success:
            print(f"Output (truncated):\n{result.output[:500]}...")
        else:
            print(f"Error: {result.error}")

    print("\n4. Testing shell_exec (git status)...")
    shell_skill = registry.get_skill("shell_exec")
    if shell_skill:
        # Note: might fail if git is not in allowlist or not installed, 
        # but 'dir' should work on Windows if shell=True
        result = await shell_skill.execute(command="dir")
        print(f"Success: {result.success}")
        if result.success:
            print(f"Output (truncated):\n{result.output[:500]}...")
        else:
            print(f"Error: {result.error}")

if __name__ == "__main__":
    asyncio.run(main())
