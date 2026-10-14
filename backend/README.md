# DataScience Lab Backend

FastAPI backend for DataScience Lab.

## Environment Variables

Set these at deployment level (for example, in Render service environment settings):

- `CORS_ALLOW_ORIGINS`: comma-separated allowed frontend origins
- `CORS_ALLOW_CREDENTIALS`: `true` or `false`
- `MONGODB_URI`: MongoDB connection URI for centralized assignment storage
- `MONGODB_DB_NAME`: MongoDB database name for assignment collections
- `MONGODB_ASSIGNMENTS_COLLECTION`: assignment collection name
- `MONGODB_SETTINGS_COLLECTION`: settings collection name
- `DATA_URI`: centralized database URI (recommended: `sqlite:///...`)
- `DB_PATH`: legacy path-based database setting (used when `DATA_URI` is not set)

Example:

```env
CORS_ALLOW_ORIGINS=https://your-frontend.onrender.com,http://localhost:5173
CORS_ALLOW_CREDENTIALS=false
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_DB_NAME=datascience_lab
MONGODB_ASSIGNMENTS_COLLECTION=student_assignments
MONGODB_SETTINGS_COLLECTION=assignment_settings
DATA_URI=sqlite:///var/data/lab.db
```

## Centralized Assignment Storage

Student task assignments are now stored centrally in MongoDB, not browser local storage.
This allows admin dashboard and student views to share the same assignment records across devices and sessions.

## Run

```powershell
C:/Python314/python.exe -m pip install -r requirements.txt
C:/Python314/python.exe -m uvicorn app.main:app --reload --port 8000
```

## Slice 1 Features

- Student Performance dataset generator
- Dataset metadata + preview API
- Missing value summary and data types
- CSV download and dataset reset
- SQLite dataset registry

## Render Start Command

Use this start command so Render injects its dynamic port:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
