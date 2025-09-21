from langchain_core.messages import HumanMessage
from .graph import create_graph

def main():
    """Main function to run the chatbot application."""
    graph = create_graph()

    print("🤖 Chatbot is ready! Type 'exit' to end the conversation.")
    print("-" * 50)

    while True:
        user_input = input("You: ")
        if user_input.lower() in ["exit", "quit"]:
            print("Goodbye! 👋")
            break

        # Use the `stream` method to get real-time output from the graph
        events = graph.stream(
            {"messages": [HumanMessage(content=user_input)]},
            # stream_mode="values" simplifies the output to just the node's return value
            stream_mode="values",
        )

        print("AI: ", end="", flush=True)
        for event in events:
            # Each event is the output of a node. In this case, the 'chatbot' node.
            # The value is {"messages": [AIMessage(...)]}
            event["messages"][-1].pretty_print()

if __name__ == "__main__":
    main()