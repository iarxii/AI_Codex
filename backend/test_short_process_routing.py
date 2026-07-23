import sys
from pathlib import Path
from langchain_core.messages import HumanMessage, AIMessage

# Add backend directory to Python path
sys.path.append(str(Path(__file__).resolve().parent))

from backend.agent.state import AgentState
from backend.agent.nodes import init_node
from backend.agent.graph import route_after_init, should_continue, END
from backend.agent.routing import classify_prompt

class MockConfig:
    def __init__(self, client_type="web"):
        self.config = {
            "configurable": {
                "provider": "local",
                "model": "default",
                "client_type": client_type
            }
        }
    def get(self, key, default=None):
        return self.config.get(key, default)

async def test_short_process_heuristics():
    print("Running short-process heuristic tests...")
    
    # --- Web Client Tests ---
    config_web = MockConfig(client_type="web")
    
    state_web_hi = {"messages": [HumanMessage(content="Hi")], "telemetry": {}}
    res1 = await init_node(state_web_hi, config_web)
    assert res1["is_short_process"] is True, "Web 'Hi' should be short process"
    
    state_web_short_q = {"messages": [HumanMessage(content="What is neural network?")], "telemetry": {}}
    res2 = await init_node(state_web_short_q, config_web)
    assert res2["is_short_process"] is False, "Web short question (<45 chars) should NOT be short process"
    
    # --- VSCodex Client Tests ---
    config_vscode = MockConfig(client_type="vscode")
    
    state_vs_hi = {"messages": [HumanMessage(content="Hi")], "telemetry": {}}
    res3 = await init_node(state_vs_hi, config_vscode)
    assert res3["is_short_process"] is True, "VSCodex 'Hi' should be short process"
    
    state_vs_short_q = {"messages": [HumanMessage(content="What is neural network?")], "telemetry": {}}
    res4 = await init_node(state_vs_short_q, config_vscode)
    assert res4["is_short_process"] is True, "VSCodex short question (<45 chars without action) should be short process"
    
    state_vs_action = {"messages": [HumanMessage(content="Create a python script")], "telemetry": {}}
    res5 = await init_node(state_vs_action, config_vscode)
    assert res5["is_short_process"] is False, "VSCodex short question with action word should NOT be short process"

    raw_prompt = "What is neural network?"
    enriched_prompt = raw_prompt + "\n\n[Workspace Context]\n" + ("x" * 5000)
    raw_result = await init_node(
        {"messages": [HumanMessage(content=enriched_prompt)], "raw_prompt": raw_prompt, "telemetry": {}},
        config_vscode,
    )
    assert raw_result["is_short_process"] is True, "Classification must use raw_prompt instead of enriched message"
    assert raw_result["routing_metadata"]["reason"] == "short_client_question"

    assert classify_prompt("Create app.py", "vscode")["process_mode"] == "long"
    assert classify_prompt("Thanks", "web")["reason"] == "acknowledgment"

    print("Heuristic tests passed successfully!")

def test_routing_logic():
    print("Running graph routing tests...")
    
    # Case A: Short process -> should route to END immediately
    mock_msg_no_tools = AIMessage(content="Hello there! How can I help you today?")
    state_a = {
        "messages": [mock_msg_no_tools],
        "is_short_process": True,
        "space_config": {}
    }
    route_a = should_continue(state_a)
    assert route_a == END, f"Short process should route to END, got {route_a}"

    assert route_after_init({"is_short_process": True, "space_config": {}}) == "reason"
    assert route_after_init({"is_short_process": True, "space_config": {"slug": "trading-space"}}) == "reason"

    # Case B: Long process but has tool calls -> should route to execute_tool
    mock_msg_with_tools = AIMessage(
        content="I will create the file for you.",
        tool_calls=[{"name": "write_file", "args": {"path": "test.txt", "content": "hello"}, "id": "call_1"}]
    )
    state_b = {
        "messages": [mock_msg_with_tools],
        "is_short_process": False,
        "space_config": {}
    }
    route_b = should_continue(state_b)
    assert route_b == "execute_tool", f"Long process with tools should route to execute_tool, got {route_b}"

    promoted_state = {
        "messages": [mock_msg_with_tools],
        "is_short_process": True,
        "space_config": {},
        "telemetry": {},
        "routing_metadata": {"process_mode": "short"},
    }
    assert should_continue(promoted_state) == "execute_tool"
    assert promoted_state["is_short_process"] is False
    assert promoted_state["telemetry"]["tool_promotion"] is True
    assert promoted_state["routing_metadata"]["reason"] == "tool_call_promotion"

    # Case C: Long process, no tool calls -> should route to validate
    state_c = {
        "messages": [mock_msg_no_tools],
        "is_short_process": False,
        "space_config": {}
    }
    route_c = should_continue(state_c)
    assert route_c == "validate", f"Long process without tools should route to validate, got {route_c}"

    clean_state = {
        "messages": [mock_msg_no_tools],
        "is_short_process": False,
        "routing_metadata": {"process_mode": "long", "action_indicators": []},
        "space_config": {}
    }
    assert should_continue(clean_state) == END

    action_state = {
        "messages": [mock_msg_no_tools],
        "is_short_process": False,
        "routing_metadata": {"process_mode": "long", "action_indicators": ["action:create"]},
        "space_config": {}
    }
    assert should_continue(action_state) == "validate"

    print("Routing tests passed successfully!")

async def main():
    await test_short_process_heuristics()
    test_routing_logic()
    print("All tests completed successfully!")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
