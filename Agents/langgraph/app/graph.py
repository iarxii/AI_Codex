import os
from typing import Annotated

from dotenv import load_dotenv
from typing_extensions import TypedDict
from langchain_google_genai import ChatGoogleGenerativeAI

from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages

# Load environment variables from .env file
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables. Please set it in your .env file.")


class State(TypedDict):
    """
    Represents the state of our graph.

    Attributes:
        messages: The list of messages that have been exchanged in the conversation.
                  The `add_messages` function is a helper that appends messages
                  to the list.
    """
    messages: Annotated[list, add_messages]


def create_graph():
    """Creates and compiles the LangGraph for the chatbot."""
    # We are using the "gemini-pro" model here
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=GOOGLE_API_KEY,
        convert_system_message_to_human=True # Recommended for Gemini
    )

    def chatbot(state: State):
        """Invokes the LLM with the current state to get a response."""
        return {"messages": [llm.invoke(state["messages"])]}

    graph_builder = StateGraph(State)
    graph_builder.add_node("chatbot", chatbot)
    graph_builder.set_entry_point("chatbot")
    graph_builder.set_finish_point("chatbot")

    # Compile the graph into a runnable object
    return graph_builder.compile()