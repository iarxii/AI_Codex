### **Log Checker Script Generated**
A Python utility script at the root of the AICodex  project called `check_logs.py`. It wraps the `gcloud` CLI to make it super easy for developers to check the production logs at any time.

**How to use it in your terminal:**
```bash
# Check the last 50 lines for the Backend
python check_logs.py backend

# Check the last 50 lines for the Frontend
python check_logs.py frontend

# Check both backend and frontend logs
python check_logs.py all

# Continuously tail (stream) the logs in real-time (Press Ctrl+C to stop)
python check_logs.py backend --tail

# Fetch exactly 200 lines
python check_logs.py frontend --lines 200
```
