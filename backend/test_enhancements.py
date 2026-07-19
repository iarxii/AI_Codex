import unittest
import asyncio
import os
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from backend.agent.nodes import compress_tool_output, planner_node
from backend.agent.tools import read_full_tool_output
from langchain_core.messages import HumanMessage, ToolMessage


class TestAICodexEnhancements(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.log_dir = Path("./logs")
        self.log_file = self.log_dir / "last_tool_output.log"
        if self.log_file.exists():
            self.log_file.unlink()

    def tearDown(self):
        if self.log_file.exists():
            self.log_file.unlink()

    def test_compress_tool_output_short(self):
        short_text = "This is a short log line."
        compressed = compress_tool_output(short_text)
        self.assertEqual(compressed, short_text)

    def test_compress_tool_output_long(self):
        lines = [f"Line {i}: dummy text detail goes here" for i in range(150)]
        long_output = "\n".join(lines)
        self.assertGreater(len(long_output), 4000)

        compressed = compress_tool_output(long_output)
        self.assertLess(len(compressed), len(long_output))
        self.assertIn("Line 0:", compressed)
        self.assertIn("Line 14:", compressed)
        self.assertIn("Line 149:", compressed)
        self.assertIn("OMITTED", compressed)

    def test_compress_tool_output_error_preservation(self):
        lines = [f"Line {i}: normal operation status update" for i in range(100)]
        lines[50] = "Line 50: Exception: compilation failed on file main.cpp"
        long_output = "\n".join(lines)

        compressed = compress_tool_output(long_output)
        self.assertIn("Line 50: Exception: compilation failed on file main.cpp", compressed)
        self.assertIn("Line 48: normal operation status update", compressed)
        self.assertIn("Line 52: normal operation status update", compressed)

    @patch("os.path.exists")
    async def test_read_full_tool_output_missing(self, mock_exists):
        mock_exists.return_value = False
        result = await read_full_tool_output.func()
        self.assertIn("No tool outputs have been captured yet", result)

    async def test_read_full_tool_output_success(self):
        self.log_dir.mkdir(parents=True, exist_ok=True)
        test_content = "Unpruned detailed traceback and logs\nLine 1\nLine 2"
        with open(self.log_file, "w", encoding="utf-8") as f:
            f.write(test_content)

        result = await read_full_tool_output.func()
        self.assertEqual(result, test_content)

    @patch("backend.agent.nodes.get_dynamic_llm")
    async def test_planner_node_generation(self, mock_get_llm):
        mock_llm = AsyncMock()
        mock_response = MagicMock()
        mock_response.content = json.dumps([
            {"text": "Task 1", "done": False, "success_criteria": "Verify 1"},
            {"text": "Task 2", "done": False, "success_criteria": "Verify 2"}
        ])
        mock_llm.ainvoke.return_value = mock_response
        mock_get_llm.return_value = mock_llm

        state = {
            "scratchpad": {},
            "messages": [HumanMessage(content="Initialize the project codebase")],
            "is_short_process": False
        }
        config = {"configurable": {}}

        result = await planner_node(state, config)
        self.assertIn("scratchpad", result)
        task_plan = result["scratchpad"].get("task_plan")
        self.assertIsNotNone(task_plan)
        self.assertEqual(len(task_plan), 2)
        self.assertEqual(task_plan[0]["text"], "Task 1")

    async def test_planner_node_skip_if_already_planned(self):
        state = {
            "scratchpad": {"task_plan": [{"text": "Pre-existing task", "done": False}]},
            "messages": [HumanMessage(content="Query")],
            "is_short_process": False
        }
        config = {}
        result = await planner_node(state, config)
        self.assertEqual(result, {})

    async def test_planner_node_skip_if_short_process(self):
        state = {
            "scratchpad": {},
            "messages": [HumanMessage(content="Query")],
            "is_short_process": True
        }
        config = {}
        result = await planner_node(state, config)
        self.assertEqual(result, {})


if __name__ == "__main__":
    unittest.main()
