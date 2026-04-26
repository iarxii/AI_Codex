import asyncio
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv

load_dotenv()

async def test_gemini():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("GOOGLE_API_KEY not found in .env")
        return
    
    print(f"Using API Key: {api_key[:10]}...")
    
    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            api_key=api_key,
            temperature=0,
            streaming=True
        )
        
        print("Invoking Gemini...")
        # Use a simple prompt
        messages = [HumanMessage(content="Hello, say 'test success'")]
        
        # Test streaming first
        print("Testing streaming:")
        async for chunk in llm.astream(messages):
            print(chunk.content, end="", flush=True)
        print("\nStreaming done.")
        
        # Test ainvoke
        print("Testing ainvoke:")
        resp = await llm.ainvoke(messages)
        print(f"Response: {resp.content}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_gemini())
