import asyncio
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

async def test():
    llm = ChatOpenAI(model='default', base_url='http://localhost:11434/v1', api_key='sk-local', temperature=0, streaming=True, max_retries=1)
    
    # Test 1: ainvoke (works)
    print("Test 1: ainvoke")
    r = await llm.ainvoke([HumanMessage(content="Hello")])
    print(f"  Result: {r.content}")
    
    # Test 2: astream (used by astream_events internally)
    print("\nTest 2: astream")
    chunks = []
    async for chunk in llm.astream([HumanMessage(content="Hello")]):
        content = chunk.content
        if content:
            chunks.append(content)
            print(f"  Chunk: {content}", end="", flush=True)
    print(f"\n  Total chunks: {len(chunks)}")
    
    # Test 3: bind_tools then ainvoke
    print("\nTest 3: bind_tools + ainvoke")
    try:
        from langchain_core.tools import tool
        @tool
        def test_tool(query: str) -> str:
            """Search for information."""
            return "result"
        
        llm_with_tools = llm.bind_tools([test_tool])
        r2 = await llm_with_tools.ainvoke([HumanMessage(content="Hello")])
        print(f"  Result: {r2.content}")
        print(f"  Tool calls: {r2.tool_calls}")
    except Exception as e:
        print(f"  Error: {e}")

asyncio.run(test())
