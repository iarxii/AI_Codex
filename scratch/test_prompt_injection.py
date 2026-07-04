import sys
import os
from pathlib import Path

# Resolve paths
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root)) # Add root so we can import 'backend'

from backend.agent.profile import build_system_prompt

def test_prompt_injection():
    print("--- AICodex Prompt Injection Test ---")
    
    # 1. Verify mandatory skill is loaded
    prompt_basic = build_system_prompt("test_conversation")
    assert "[MANDATORY SKILLS]" in prompt_basic, "Mandatory skills block should be present"
    assert "ROLE & PHILOSOPHY" in prompt_basic, "Starter defensive skill should be present in basic prompt"
    assert "[SITUATIONAL SKILLS]" not in prompt_basic, "Situational skills block should be empty/absent when not requested"
    print("[OK] Basic prompt with mandatory skills verified.")

    # 2. Setup a dummy situational skill
    situational_dir = root / "skills" / "situational"
    test_skill_path = situational_dir / "test_situational_skill.md"
    
    test_skill_content = """# TEST SITUATIONAL SKILL
This is a test situational skill for verification.
"""
    try:
        test_skill_path.write_text(test_skill_content, encoding="utf-8")
        
        # Test loading when explicitly allowed
        prompt_with_skill = build_system_prompt("test_conversation", allowed_skills=["test_situational_skill"])
        assert "[SITUATIONAL SKILLS]" in prompt_with_skill, "Situational skills block should be present"
        assert "TEST SITUATIONAL SKILL" in prompt_with_skill, "Dummy situational skill should be injected"
        print("[OK] Situational prompt loading verified.")
        
        # Test loading when 'all' is allowed
        prompt_with_all = build_system_prompt("test_conversation", allowed_skills=["all"])
        assert "TEST SITUATIONAL SKILL" in prompt_with_all, "Dummy situational skill should be injected with 'all' flag"
        print("[OK] Situational prompt loading with 'all' flag verified.")
        
        # Test not loading if not allowed
        prompt_without_skill = build_system_prompt("test_conversation", allowed_skills=["some_other_skill"])
        assert "TEST SITUATIONAL SKILL" not in prompt_without_skill, "Dummy situational skill should NOT be injected if not allowed"
        print("[OK] Situational exclusion verified.")
        
    finally:
        if test_skill_path.exists():
            test_skill_path.unlink()
            print("[OK] Cleanup completed.")

if __name__ == "__main__":
    test_prompt_injection()
    print("\nAll prompt injection tests PASSED!")
