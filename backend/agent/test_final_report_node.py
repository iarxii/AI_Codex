"""
Unit tests for the final_report_node function.
"""
import pytest
from unittest.mock import AsyncMock, patch
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from backend.agent.nodes import final_report_node
from backend.agent.state import AgentState


@pytest.mark.asyncio
async def test_final_report_node_with_tutor():
    """Test final_report_node includes tutor block when include_tutor=True"""
    # Setup state
    state: AgentState = {
        "messages": [
            HumanMessage(content="Create a Python function to add two numbers"),
            AIMessage(content="I'll create a simple addition function."),
            ToolMessage(
                name="file_edit",
                content="Created calculator.py with add function",
                tool_call_id="test-file-edit",
            )
        ],
        "task_goal": "Create a Python function to add two numbers",
        "include_tutor": True,
        # Required fields with dummy values
        "current_tool_calls": [],
        "context_data": {},
        "routing_decision": {},
        "is_complete": False,
        "error": None,
        "telemetry": {},
        "space_config": {},
        "trading_context": None,
        "scratchpad": None,
        "execution_artifacts": {},
        "evaluation_report": {},
        "recent_actions_fingerprint": [],
        "token_metrics": None,
        "quality_history": [],
        "consideration_vector": {},
        "raw_prompt": None,
        "client_type": None,
        "context": None
    }
    
    # Mock the LLM response
    mock_response = """Hello! I've successfully created a Python function to add two numbers.

### 📋 Execution Summary
* Created a calculator.py file with an add function that takes two parameters and returns their sum
* Used the file_edit tool to create the file with proper Python syntax

### 🚀 Recommended Next Steps
* Write unit tests to verify the function works correctly with various inputs
* Consider adding type hints for better code clarity
* Integrate this function into a larger calculator module if needed

[TUTOR]
**Educational Explanation: Function Creation Best Practices**
When creating functions, it's important to follow principles like single responsibility, clear naming, and proper documentation. The add function we created follows these principles by having a clear purpose (adding two numbers), descriptive parameter names, and a simple return statement.
[/TUTOR]"""
    
    with patch('backend.agent.nodes.get_dynamic_llm') as mock_get_llm:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(content=mock_response)
        mock_get_llm.return_value = mock_llm
        
        # Call the function
        result = await final_report_node(state, {})
        
        # Assertions
        assert "messages" in result
        assert len(result["messages"]) == 1
        assert isinstance(result["messages"][0], AIMessage)
        content = result["messages"][0].content
        
        # Check that the response contains expected sections
        assert "Hello! I've successfully created" in content
        assert "### 📋 Execution Summary" in content
        assert "### 🚀 Recommended Next Steps" in content
        assert "[TUTOR]" in content
        assert "[/TUTOR]" in content
        assert "Educational Explanation: Function Creation Best Practices" in content


@pytest.mark.asyncio
async def test_final_report_node_without_tutor():
    """Test final_report_node excludes tutor block when include_tutor=False"""
    # Setup state
    state: AgentState = {
        "messages": [
            HumanMessage(content="Hello, how are you?"),
            AIMessage(content="I'm doing well, thank you! How can I assist you today?")
        ],
        "task_goal": "Have a friendly conversation",
        "include_tutor": False,
        # Required fields with dummy values
        "current_tool_calls": [],
        "context_data": {},
        "routing_decision": {},
        "is_complete": False,
        "error": None,
        "telemetry": {},
        "space_config": {},
        "trading_context": None,
        "scratchpad": None,
        "execution_artifacts": {},
        "evaluation_report": {},
        "recent_actions_fingerprint": [],
        "token_metrics": None,
        "quality_history": [],
        "consideration_vector": {},
        "raw_prompt": None,
        "client_type": None,
        "context": None
    }
    
    # Mock the LLM response
    mock_response = """Hello! I'm doing well and ready to help you with any questions or tasks you have.

### 📋 Execution Summary
* Engaged in a friendly conversation with the user
* Provided a polite and helpful response

### 🚀 Recommended Next Steps
* Let the user know I'm here to help with any specific tasks or questions they might have
* Offer assistance with coding, debugging, or explaining concepts if needed"""
    
    with patch('backend.agent.nodes.get_dynamic_llm') as mock_get_llm:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(content=mock_response)
        mock_get_llm.return_value = mock_llm
        
        # Call the function
        result = await final_report_node(state, {})
        
        # Assertions
        assert "messages" in result
        assert len(result["messages"]) == 1
        assert isinstance(result["messages"][0], AIMessage)
        content = result["messages"][0].content
        
        # Check that the response contains expected sections but NO tutor block
        assert "Hello! I'm doing well" in content
        assert "### 📋 Execution Summary" in content
        assert "### 🚀 Recommended Next Steps" in content
        assert "[TUTOR]" not in content
        assert "[/TUTOR]" not in content
        # Should not contain educational explanation since tutor is disabled
        assert "Educational Explanation" not in content


@pytest.mark.asyncio
async def test_final_report_node_increased_context_window():
    """Test that the function uses increased context window for message truncation"""
    # Setup state with long messages
    long_agent_message = "A" * 600  # Longer than 500 chars
    long_tool_message = "B" * 300   # Longer than 250 chars
    
    state: AgentState = {
        "messages": [
            HumanMessage(content="Do something complex"),
            AIMessage(content=long_agent_message),
            ToolMessage(
                name="complex_tool",
                content=long_tool_message,
                tool_call_id="test-complex-tool",
            )
        ],
        "task_goal": "Do something complex",
        "include_tutor": True,
        # Required fields with dummy values
        "current_tool_calls": [],
        "context_data": {},
        "routing_decision": {},
        "is_complete": False,
        "error": None,
        "telemetry": {},
        "space_config": {},
        "trading_context": None,
        "scratchpad": None,
        "execution_artifacts": {},
        "evaluation_report": {},
        "recent_actions_fingerprint": [],
        "token_metrics": None,
        "quality_history": [],
        "consideration_vector": {},
        "raw_prompt": None,
        "client_type": None,
        "context": None
    }
    
    # Mock the LLM response
    mock_response = "Test response"
    
    with patch('backend.agent.nodes.get_dynamic_llm') as mock_get_llm:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(content=mock_response)
        mock_get_llm.return_value = mock_llm
        
        # Call the function
        result = await final_report_node(state, {})
        
        # Verify that the LLM was called with a prompt containing truncated messages
        # The agent message should be truncated to 500 chars (not 200)
        # The tool message should be truncated to 250 chars (not 100)
        mock_get_llm.assert_called_once()
        call_args = mock_llm.ainvoke.call_args
        prompt_messages = call_args[0][0]  # First argument to ainvoke
        
        # Check that the prompt contains our truncated content
        prompt_content = prompt_messages[0].content
        assert "A" * 500 in prompt_content  # First 500 chars of agent message
        assert "B" * 250 in prompt_content  # First 250 chars of tool message
        # The full original messages should NOT be in the prompt (they should be truncated)
        assert "A" * 600 not in prompt_content or prompt_content.count("A" * 600) == 0
        assert "B" * 300 not in prompt_content or prompt_content.count("B" * 300) == 0