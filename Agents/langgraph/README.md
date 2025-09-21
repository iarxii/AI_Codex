# LangGraph Gemini Chatbot

This project is a simple, command-line chatbot built using LangChain's `langgraph` library and powered by Google's Gemini model (`gemini-1.5-flash`). It serves as a foundational example for creating stateful, conversational agents with a clear and scalable project structure.

## Features

- **Conversational AI**: Powered by Google's `gemini-1.5-flash` model via the `langchain-google-genai` integration.
- **Stateful Conversations**: Utilizes `langgraph` to manage conversation state, allowing the chatbot to have context.
- **Modular Structure**: The code is organized into separate modules for the graph definition (`graph.py`) and the application logic (`main.py`), making it easy to understand and extend.
- **Secure Configuration**: API keys are managed securely using a `.env` file.

---

## Project Structure

The project is organized to separate concerns, promoting clarity and maintainability.

```
langgraph/
├── app/
│   ├── __init__.py       # Makes 'app' a Python package
│   ├── graph.py          # Defines the LangGraph state, nodes, and graph structure
│   └── main.py           # Main application entry point and user interaction loop
├── .env                  # Stores API keys and other environment variables (not committed)
└── requirements.txt      # Lists all Python dependencies for the project
```

---

## Setup and Installation

Follow these steps to get the chatbot running on your local machine.

### 1. Create a Virtual Environment (Recommended)

It's a best practice to create a virtual environment to manage project dependencies.

```bash
# For macOS/Linux
python3 -m venv venv
source venv/bin/activate

# For Windows
python -m venv venv
.\venv\Scripts\activate
```

### 2. Install Dependencies

Install all the required Python packages from the `requirements.txt` file.

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a file named `.env` in the root of the `langgraph` directory. Add your Google AI API key to this file.

```env
GOOGLE_API_KEY="your-google-api-key-here"
```

---

## How to Run the Chatbot

With the setup complete, run the main application module from the project's root directory (`langgraph/`).

```bash
python -m app.main
```

You will be greeted by the chatbot prompt. You can start the conversation by typing a message and pressing Enter. To end the session, type `exit` or `quit`.