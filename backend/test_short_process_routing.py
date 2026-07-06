import sys
from pathlib import Path
from langchain_core.messages import HumanMessage, AIMessage

# Add backend directory to Python path
sys.path.append(str(Path(__file__).resolve().parent))

from backend.agent.state import AgentState
from backend.agent.nodes import init_node
from backend.agent.graph import should_continue, END

class MockConfig:
    def __init__(self):
        self.config = {
            "configurable": {
                "provider": "local",
                "model": "default"
            }
        }
    def get(self, key, default=None):
        return self.config.get(key, default)

async def test_short_process_heuristics():
    print("Running short-process heuristic tests...")
    config = MockConfig()
    
    # Case 1: Simple greeting
    state1 = {
        "messages": [HumanMessage(content="Hi")],
        "telemetry": {}
    }
    res1 = await init_node(state1, config)
    assert res1["is_short_process"] is True, "Hi should be classified as short process"
    
    # Case 2: Acknowledgment
    state2 = {
        "messages": [HumanMessage(content="Thanks! That was helpful.")],
        "telemetry": {}
    }
    res2 = await init_node(state2, config)
    assert res2["is_short_process"] is True, "Thanks should be classified as short process"
    
    # Case 3: Technical request
    state3 = {
        "messages": [HumanMessage(content="Implement a recursive function in python")],
        "telemetry": {}
    }
    res3 = await init_node(state3, config)
    assert res3["is_short_process"] is False, "Technical task should be classified as long process"

    # Case 4: Long greeting with action words
    state4 = {
        "messages": [HumanMessage(content="Yo, write a quick script to delete logs please.")],
        "telemetry": {}
    }
    res4 = await init_node(state4, config)
    assert res4["is_short_process"] is False, "Greeting with action/file reference should be classified as long process"

    print("Heuristic tests passed successfully!")

def test_routing_logic():
    print("Running graph routing tests...")
    
    # Case A: Short process, no tool calls -> should route to END
    mock_msg_no_tools = AIMessage(content="Hello there! How can I help you today?")
    state_a = {
        "messages": [mock_msg_no_tools],
        "is_short_process": True,
        "space_config": {}
    }
    route_a = should_continue(state_a)
    assert route_a == END, f"Short process without tools should route to END, got {route_a}"

    # Case B: Short process but has tool calls -> should promote and route to execute_tool
    mock_msg_with_tools = AIMessage(
        content="I will create the file for you.",
        tool_calls=[{"name": "write_file", "args": {"path": "test.txt", "content": "hello"}, "id": "call_1"}]
    )
    state_b = {
        "messages": [mock_msg_with_tools],
        "is_short_process": True,
        "space_config": {}
    }
    route_b = should_continue(state_b)
    assert route_b == "execute_tool", f"Short process with tools should route to execute_tool, got {route_b}"
    assert state_b["is_short_process"] is False, "Short process should be promoted (cleared to False) when tools are generated"

    # Case C: Long process, no tool calls -> should route to evaluate_turn
    state_c = {
        "messages": [mock_msg_no_tools],
        "is_short_process": False,
        "space_config": {}
    }
    route_c = should_continue(state_c)
    assert route_c == "evaluate_turn", f"Long process without tools should route to evaluate_turn, got {route_c}"

    print("Routing tests passed successfully!")

async def main():
    await test_short_process_heuristics()
    test_routing_logic()
    print("All tests completed successfully!")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
