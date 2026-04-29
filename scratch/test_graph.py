import asyncio
import sys
sys.path.insert(0, ".")

async def test():
    from backend.agent.graph import create_agent_graph
    from langchain_core.messages import HumanMessage
    
    graph = create_agent_graph()
    
    state = {
        "messages": [HumanMessage(content="Hello")],
        "current_tool_calls": [],
        "context_data": {},
        "routing_decision": {},
        "is_complete": False
    }
    
    config = {
        "configurable": {
            "provider": "local",
            "model": "default",
            "api_key": "",
            "base_url": ""
        },
        "recursion_limit": 10
    }
    
    print("Starting astream_events...")
    event_count = 0
    try:
        async for event in graph.astream_events(state, config=config, version="v2"):
            kind = event["event"]
            node = event.get("metadata", {}).get("langgraph_node", "?")
            
            if kind == "on_chain_start" and event.get("name") == node:
                print(f"  [{kind}] Node: {node}")
            elif kind == "on_chat_model_stream":
                content = event["data"]["chunk"].content
                if content:
                    print(f"  [stream] {content}", end="", flush=True)
            elif kind == "on_chat_model_end":
                msg = event["data"]["output"]
                print(f"\n  [model_end] content={str(msg.content)[:80]}, tool_calls={msg.tool_calls}")
            elif kind == "on_error":
                print(f"  [ERROR] {event.get('data')}")
            
            event_count += 1
            if event_count > 100:
                print("\n  [SAFETY] Too many events, breaking")
                break
    except Exception as e:
        print(f"\n  [EXCEPTION] {type(e).__name__}: {e}")
    
    print(f"\nTotal events: {event_count}")

asyncio.run(test())
