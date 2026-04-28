Don't worry, SQLite is actually a secret weapon for AI lab projects, especially when you're trying to keep costs at zero.
Since Cloud Run is stateless (it wipes the disk every time the container restarts), you can't just save a .db file inside the container like you do on your local machine. However, you have three professional ways to keep using SQLite without paying for a managed PostgreSQL instance:
## 1. The "LiteFS" Approach (Recommended)
You can use a tool like LiteFS or simply mount a Cloud Storage (GCS) bucket as a file system.

* How it works: Your SQLite file sits in a Cloud Storage bucket. When Cloud Run starts, it "mounts" that bucket like a hard drive.
* Cost: Cloud Storage has a 5GB free tier. You will likely pay R0 for your database.
* Best for: Lab projects where you don't have thousands of simultaneous users writing to the DB at the exact same millisecond.

## 2. The "Startup/Shutdown" Sync
This is the "hacky but effective" way for small lab projects:

* Startup: When your Python app starts, it downloads database.db from a Google Cloud Storage bucket to the /tmp folder.
* Runtime: Your app reads/writes to /tmp/database.db (which is fast, in-memory storage).
* Shutdown: You use a "SIGTERM" handler in Python to upload the updated .db file back to the bucket before the container shuts down.
* Cost: Completely free within the Cloud Storage and Cloud Run free tiers.

## 3. The "Serverless Postgres" Alternative (The Real Winner)
If you really want the power of Postgres but the price of SQLite (R0), look at Neon.tech.

* Why: It is a serverless Postgres provider that scales to zero.
* Connection: You get a standard connection string (just like Cloud SQL), but if no one is using your app, you pay nothing.
* Implementation: You just swap your SQLite connection string for the Neon one in your Python env variables.

## Comparison for your Lab Project

| Database | Monthly Cost (ZAR) | Difficulty | Cloud Run Compatibility |
|---|---|---|---|
| Cloud SQL (Postgres) | ~R 215+ | Easy | Native |
| SQLite + Cloud Storage | R 0 | Medium | Needs mount/sync logic |
| Neon (Serverless Postgres) | R 0 | Easy | Use connection string |

## My Recommendation
If you already have your logic written for SQLite, stick with it! Just add a small script to your Python backend to download/upload the .db file to a Cloud Storage Bucket on startup and shutdown. This keeps your "Zero Cost" goal alive while keeping the code you've already written.
Would you like a Python snippet showing how to sync your SQLite .db file with a Cloud Storage bucket automatically?

