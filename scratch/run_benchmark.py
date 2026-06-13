import os
import sys
import asyncio
from pathlib import Path
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

# Add project root to python path
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

from backend.agent.graph import create_agent_graph
from codex_spaces.backend.agent.space_config import get_space_config

async def main():
    print("Initializing Agent Graph...")
    graph = create_agent_graph()
    
    prompt = """Please execute the Spirit Bird Agent Performance Benchmark: use vscode-extension/docs/testing/agent_benchmark_protocol as the root directory.

Create a new folder named test_1 inside the workspace.
Inside test_1, write a lightweight Python script named ascii_nn.py that implements a 2-layer Feedforward Neural Network (MLP) from scratch using only Python's standard library (math and random allowed, no external libraries like numpy or pytorch).
The network must have 2 input nodes, 3 hidden nodes (sigmoid activation), and 1 output node (sigmoid).
Train the network to solve the XOR problem (inputs: [0,0]->0, [0,1]->1, [1,0]->1, [1,1]->0) until loss is below 0.05.
Once trained, output a 15x15 visual ASCII decision boundary representation of inputs from 0.0 to 1.0. Save this visualization to test_1/decision_boundary.txt.
Measure training time, epochs, accuracy, and file size, and write this data as a JSON payload to test_1/metrics_report.json.
Use your terminal execution tool to run ascii_nn.py and confirm that it passes successfully."""

    s_config = get_space_config("code-lab")
    
    # We want a model that definitely supports tool calling on OpenRouter.
    # E.g. "google/gemini-2.5-flash"
    model_name = "google/gemini-2.5-flash"
    
    initial_state = {
        "messages": [HumanMessage(content=prompt)],
        "current_tool_calls": [],
        "context_data": {},
        "routing_decision": {},
        "is_complete": False,
        "telemetry": {
            "request_id": "benchmark_test",
            "ttft": 0,
            "total_tokens": 0,
            "usage": {"input": 0, "output": 0},
            "latencies": {},
            "capabilities": ["Tools"],
            "provider": "openrouter",
            "model": model_name
        },
        "space_config": s_config
    }
    
    config = {
        "configurable": {
            "provider": "openrouter",
            "model": model_name,
            "api_key": "sk-or-v1-placeholder-scrubbed",
            "conversation_id": "benchmark_conv_1",
            "agent_mode": True,
            "space_slug": "code-lab",
            "model_config": {
                "max_tokens": 4096,
                "temperature": 0.0
            }
        },
        "recursion_limit": 25
    }
    
    print("Running Agent Stream...")
    async for event in graph.astream_events(initial_state, config=config, version="v2"):
        kind = event["event"]
        name = event.get("name", "")
        node_name = event.get("metadata", {}).get("langgraph_node", "")
        
        if kind == "on_chain_start" and node_name:
            print(f"\n--- [Node Start: {node_name}] ---")
        elif kind == "on_chain_end" and node_name:
            print(f"\n--- [Node End: {node_name}] ---")
            output_data = event.get("data", {}).get("output", {})
            if isinstance(output_data, dict):
                # Print only first/last parts of messages to save space
                msgs = output_data.get("messages", [])
                if msgs:
                    msg_str = str(msgs[-1])
                    safe_msg = msg_str.encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')
                    print(f"Last Message: {safe_msg}")
        elif kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                sys.stdout.write(content)
                sys.stdout.flush()
        elif kind == "on_chat_model_end":
            print(f"\n[Model Response End] Output: {event.get('data', {}).get('output')}")
        elif kind == "on_tool_start":
            print(f"\n[Tool Start: {name}] inputs: {event.get('data', {}).get('input')}")
        elif kind == "on_tool_end":
            print(f"\n[Tool End: {name}] output: {event.get('data', {}).get('output')}")

if __name__ == "__main__":
    asyncio.run(main())
