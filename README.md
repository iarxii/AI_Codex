
# GP HealthMedAgentix

**GP HealthMedAgentix** is an AI-powered Health and Oversight Data Analysis and Feedback engine. It supports both OpenAI (gpt-4o) and Google Gemini (2.5 Flash) models. You can select the provider per request.

## Setup

Run the provided setup script to install dependencies and create starter `.env` files in both `client` and `server`:

```sh
./setup.sh
```

Or manually:

1. Install dependencies in both `client` and `server` folders:
	```sh
	cd client && npm install
	cd ../server && npm install
	```
2. Create a `.env` file in the `server` folder with your API keys and config (see `.env.example` if available).

## Running the App

1. Start the server:
	```sh
	cd server
	npm run server
	```
2. Start the client (if applicable):
	```sh
	cd client
	# e.g. use live-server or your preferred static server
	npx live-server
	```

### Features
- Modern OpenAI and Gemini integration
- Provider selection per request
- Designed for health data analysis, oversight, and feedback

---
