# Google Cloud Run Showcase Hosting Plan

Gemini:
Yes, it is entirely possible to run your AI lab project cost-free, especially during the initial development and showcase phase. You can combine Google’s standard free tier with the $300 welcome credit and other third-party "free forever" API options. [1, 2, 3] 
## 1. The Google Cloud "New Account" Credit
If you sign up with a new Google Cloud account, you get $300 (approx. R5,000) in free credits valid for 90 days. [4, 5] 

* What it covers: This credit can be used toward the GPU-enabled Cloud Run instances we discussed.
* Showcase Value: Based on the earlier estimate of ~R47.20/hour for two instances, this credit alone would give you over 100 hours of active demo time without spending a cent. [6] 

## 2. The Cloud Run "Always Free" Tier [7] 
Even after your $300 credit expires, Cloud Run has a permanent monthly free tier for non-GPU resources: [4, 8] 

* 2 million requests per month.
* 180,000 vCPU-seconds and 360,000 GiB-seconds per month.
* Strategy: You can host your React frontend and your Python API logic (minus the Llama model) entirely within this free tier indefinitely, as long as you aren't using a GPU in that specific container. [2, 9, 10] 

## 3. "Free Forever" Model Hosting (The Secret Hack)
To keep the project running for 6 months without any cost at all, you can swap your self-hosted Llama 3.5 on Cloud Run for a Free Inference API. This removes the need for a costly GPU on your side.

* Groq Cloud: Offers a high-speed free tier for Llama 3 models. You just call their API from your Python backend.
* OpenRouter: Provides access to several "free-forever" models (including Llama 3 variants) with no monthly fees.
* Benefit: Your Cloud Run container will use almost zero resources because it's just "passing messages" rather than doing the heavy AI math itself. This keeps you safely inside the Always Free tier limits. [1, 11, 12, 13] 

## 4. For Students & Startups

* Google for Startups: If your "lab project" is actually a startup, you can apply for the Start Tier, which gives $2,000 (approx. R33,000) in credits for one year.
* GitHub Student Developer Pack: Often includes additional Google Cloud credits or access to other free AI tools. [14, 15] 

## Summary Comparison: Self-Hosted vs. API

| Feature [1, 4, 16, 17] | Self-Hosted (Cloud Run + GPU) | AI API (Groq/OpenRouter) |
|---|---|---|
| Cost | Free for ~100 demo hours (via $300 credit) | Permanently Free (within rate limits) |
| Setup | Complex (Docker, Drivers, Ollama) | Simple (Python requests or groq library) |
| Privacy | High (Your container, your data) | Medium (Data sent to API provider) |

Would you like a Python code snippet showing how to connect your React app to one of these free Llama APIs?

[1] [https://www.youtube.com](https://www.youtube.com/watch?v=GRUjApPqCoE)
[2] [https://cloud.google.com](https://cloud.google.com/free)
[3] [https://cloud.google.com](https://cloud.google.com/signup-faqs)
[4] [https://cloud.google.com](https://cloud.google.com/free)
[5] [https://docs.cloud.google.com](https://docs.cloud.google.com/free/docs/free-cloud-features)
[6] [https://www.gmicloud.ai](https://www.gmicloud.ai/blog/where-can-i-get-free-gpu-cloud-trials-in-2026-a-complete-guide)
[7] [https://www.youtube.com](https://www.youtube.com/watch?v=o8DlAIzujWI)
[8] [https://www.cliffsnotes.com](https://www.cliffsnotes.com/cliffs-questions/7777231)
[9] [https://cloud.google.com](https://cloud.google.com/run/pricing#:~:text=Jobs%20*%20CPU%20%2D%20First%20240%2C000%20vCPU%2Dseconds,%2D%20First%20450%2C000%20GiB%2Dseconds%20free%20per%20month.)
[10] [https://cloud.google.com](https://cloud.google.com/functions/pricing-1stgen)
[11] [https://www.youtube.com](https://www.youtube.com/watch?v=VmNhDUKMHd4&t=10)
[12] [https://www.youtube.com](https://www.youtube.com/watch?v=ZQoPOuSbmZs&t=23)
[13] [https://openrouter.ai](https://openrouter.ai/meta-llama/llama-3.2-3b-instruct:free)
[14] [https://startup.google.com](https://startup.google.com/cloud/)
[15] [https://goabego.medium.com](https://goabego.medium.com/the-2026-ultimate-guide-to-google-for-startups-4117c0c34416)
[16] [https://cloud.google.com](https://cloud.google.com/startup/ai)
[17] [https://cloud.google.com](https://cloud.google.com/blog/products/serverless/cloud-run-gpus-are-now-generally-available)


Me: okay great, can I offer users to use their own provider keys?

Gemini:
That is a brilliant move—it is a standard practice in "AI Lab" or "BYOK" (Bring Your Own Key) tools. By letting users provide their own keys, you offload 100% of the inference costs to them, meaning your Cloud Run service can run on the Free Tier indefinitely.
Here is how you can implement this architecture:
## 1. The Workflow

   1. React Frontend: You add a "Settings" or "API Configuration" modal where the user enters their key (e.g., from Groq, OpenAI, or OpenRouter).
   2. Local Storage: Save that key in the user's browser localStorage. Never store their personal keys in your database; it’s a security risk and a privacy nightmare.
   3. Request Header: When the user sends a prompt, the React app sends the key in the request header (e.g., X-API-Key) to your Python backend.
   4. Python Backend: Your Cloud Run service grabs the key from the header and uses it to authenticate the request to Llama 3.5.

## 2. Frontend Implementation (React)
You can create a simple state to manage the key and pass it to your API calls:

// A simple function to call your Cloud Run backendconst sendMessage = async (prompt) => {
  const userKey = localStorage.getItem('provider_api_key');

  const response = await fetch('https://run.app', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Provider-Key': userKey // Send the user's key here
    },
    body: JSON.stringify({ message: prompt })
  });
  return response.json();
};

## 3. Backend Implementation (Python/FastAPI)
Your backend becomes a "proxy." Since it’s no longer running the model itself, you don’t need a GPU. You can run this on the smallest Cloud Run instance (0.5 vCPU), which is almost always free.

from fastapi import FastAPI, Header, Requestimport httpx
app = FastAPI()

@app.post("/chat")async def chat_proxy(request: Request, x_provider_key: str = Header(None)):
    if not x_provider_key:
        return {"error": "Please provide your own API key in settings."}

    data = await request.json()
    
    # Forward the request to a provider like Groq or OpenRouter
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://groq.com",
            headers={"Authorization": f"Bearer {x_provider_key}"},
            json={
                "model": "llama3-8b-8192", # Or llama3.5:3b if available
                "messages": [{"role": "user", "content": data['message']}]
            }
        )
    return response.json()

## 4. Benefits of this "BYOK" Approach

* Zero Server Costs: Your Cloud Run service will only process text, not heavy AI weights. You will stay well within the 2 million free requests per month.
* No Credit Card Stress: Since you aren't using GPUs, you won't suddenly wake up to a massive bill in ZAR.
* Scale: You could have 1,000 users at once, and it wouldn't cost you a cent more, as each user pays for their own compute via their key.

## 5. A Note on Llama 3.5:3B
Since you specifically mentioned Llama 3.5:3B, you should suggest that users get an API key from Groq or Together AI. They are currently the fastest and often have free or very cheap tiers for those smaller "Edge" models.
Would you like me to help you design a simple "Settings" modal for your React frontend to handle these keys securely?



Me: great, please create a comprehensive implementation plan md based on our conversation. I installed the cloudrun mcp server on my machine

Gemini:
This is a solid architectural pivot. By moving to a BYOK (Bring Your Own Key) model and leveraging the Cloud Run MCP server, you’ve eliminated the financial risk of GPUs while maintaining a professional deployment.
Below is your comprehensive implementation plan.
------------------------------
## 1. Project Implementation Plan: AI Lab (BYOK Edition)## Phase 1: Local Development & MCP Setup
Since you have the Cloud Run MCP server installed, you can manage your deployment directly through your AI-integrated IDE (like Cursor or VS Code).

* Initialize Structure:
* /frontend: React (Vite) app.
   * /backend: Python (FastAPI) app.
   * docker-compose.yml: For local testing of both services.
* MCP Configuration: Ensure your MCP server is authenticated:

gcloud auth login
gcloud config set project [YOUR_PROJECT_ID]


## Phase 2: Backend Development (Python Proxy)
Your backend acts as a secure bridge. It receives the user's prompt and their API key, then forwards them to the LLM provider.

* Key Tasks:
* Implement a /chat endpoint that expects a X-Provider-Key header.
   * Use httpx for asynchronous requests to external providers (Groq/OpenRouter).
   * Add basic error handling (e.g., catching 401 Unauthorized if the user's key is invalid).
* Resources: Use the standard Cloud Run environment (No GPU needed).

## Phase 3: Frontend Development (React BYOK)
This is where the user manages their "financial" contribution to the app.

* Key Tasks:
* Settings Drawer: Create a UI component to input and save the API Key.
   * Security: Store the key in window.localStorage.
   * Context API: Create an APIProvider context to wrap the app so the key is globally available for requests.
* Logic:

// Example: Attaching the key from storage to the requestconst headers = {
  'Content-Type': 'application/json',
  'X-Provider-Key': localStorage.getItem('user_api_key')
};


## Phase 4: Containerization & Deployment
You will deploy two separate services to Cloud Run to keep the frontend and backend decoupled.

* Build Images:
* Backend: Standard Python 3.11 slim image.
   * Frontend: Build the React app and serve via Nginx or host via Firebase Hosting (free).
* Deployment via MCP/CLI:

# Deploy Backend (Estimated Cost: R0 due to Free Tier)
gcloud run deploy lab-backend \
  --source ./backend \
  --allow-unauthenticated \
  --max-instances 2 \
  --region us-central1


## Phase 5: Financial Guardrails (The Safety Net)
Even without GPUs, you must set these to protect your Google account:

* Max Instances: Set to 2 for both services.
* Budget Alert: Set a Google Cloud Budget Alert at R100 just in case of unexpected networking costs.
* Concurrency: Set to 80 (Standard) to ensure one container handles many users efficiently.

------------------------------
## 2. Tech Stack Summary

| Component | Technology | Cost (ZAR) |
|---|---|---|
| Frontend | React + Vite | R0 (Cloud Run Free Tier) |
| Backend | FastAPI (Python) | R0 (Cloud Run Free Tier) |
| Inference | Llama 3.5 via User Key | R0 (Paid by user) |
| Deployment | Cloud Run MCP | Free |

------------------------------
## 3. Next Steps for You

   1. Select a Provider: Decide if you want to default to Groq (best for speed) or OpenRouter (best for model variety).
   2. Mock the Header: Test your backend using Postman by manually passing a X-Provider-Key before you build the React UI.
   3. Deploy the "Skeleton": Use your MCP server to deploy a "Hello World" to Cloud Run today to ensure your permissions are correct.

Would you like the specific Dockerfile configurations for the Python backend and React frontend to get started?



Me: its not necessarily a pivot, its a prod hosting specification/feature. The backend for the local llm is fantastic so far

Gemini:
Understood—calling it a "feature" is exactly the right mindset. You’re building a hybrid-capable platform: it has the high-performance local backend you've already built, with the option for users to bring their own keys for external providers.
Since your backend for the local LLM is already running smoothly, here is the updated Production Implementation Plan that integrates both your local power and the "BYOK" feature.
------------------------------
## Implementation Plan: AI Lab (Hybrid Production)## 1. Unified Backend Architecture (Python)
Instead of replacing your local LLM logic, you will implement a Router pattern. Your backend decides where to send the request based on the presence of a user key.

* Logic Flow:
* If X-Provider-Key is present $\rightarrow$ Forward to Groq/OpenRouter (Cloud Run Free Tier).
   * If X-Provider-Key is absent $\rightarrow$ Use the internal Llama 3.5:3B (Cloud Run GPU Tier).
* Implementation: Use a standard environment variable (e.g., ALLOW_LOCAL_LLM=true) to toggle whether your "Internal" GPU mode is even active, allowing you to control your own costs.

## 2. Frontend "Provider Toggle" (React)
Give the user the choice between "Lab Inference" (Your GPU) and "Personal Key" (Their API).

* UI Component: A simple toggle switch in the chat bar.
* State Management:
* Store selectedProvider (Local vs. Remote) in React state.
   * If "Remote" is selected but no key is found in localStorage, prompt the user to enter one.

## 3. Production Deployment Strategy
Using your Cloud Run MCP server, you will manage two different "Profiles" for the same code.

| Profile | Deployment Target | Resources | Use Case |
|---|---|---|---|
| Development | lab-dev | No GPU | Testing UI, BYOK logic, and API routing. |
| Showcase | lab-prod | NVIDIA L4 GPU | High-performance demos using your internal Llama 3.5. |

## 4. Financial & Scaling Specifications
Since you are keeping the "fantastic" local backend, your budget management is now tiered:

* The "Private" Mode (Your Cost):
* Set max-instances: 1 for the GPU service to keep costs strictly linear.
   * Max Budget: R2,830 for 3 months (as calculated before) for light demoing.
* The "Public" Mode (User Cost):
* The container handles the request via CPU only.
   * Cost: Effectively R0.

## 5. Deployment via MCP Server
To deploy your current backend with the new routing logic, use your MCP server to execute:

# Deploying the production version with GPU support
gcloud beta run deploy ai-lab-prod \
  --source . \
  --gpu 1 --gpu-type nvidia-l4 \
  --no-cpu-throttling \
  --max-instances 1 \
  --set-env-vars="ENABLE_BYOK=true,MODEL_NAME=llama3.5:3b"

------------------------------
## Action Items for your AI Lab:

   1. Backend Update: Wrap your existing Llama 3.5 inference logic in a conditional if statement that checks for the X-Provider-Key header.
   2. Safety First: In your gcloud console, set a hard limit on the GPU service to ensure it only stays "Warm" while you are actively demoing it.
   3. Local Test: Verify that your React app can successfully pass a "dummy" key to the backend and that the backend recognizes it.

Since the local backend is working well, do you want to see how to structure the Python "Router" logic to switch between your local Llama model and the external API?

