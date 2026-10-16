# DataScience Lab Monorepo

This repository is a monorepo with separate frontend and backend applications.

Detailed setup and deployment documentation for the current codebase is available at [docs/APPLICATION_SETUP_AND_DEPLOYMENT.md](docs/APPLICATION_SETUP_AND_DEPLOYMENT.md).

## Structure

- frontend: React + TypeScript + Vite app
- backend: FastAPI app

## Local Development

### Backend

```powershell
cd backend
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Docker Development

Run MongoDB, backend, and frontend together with Docker Compose:

```powershell
docker compose up --build
```

Access:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api
- Backend docs: http://localhost:8000/docs
- MongoDB: mongodb://localhost:27017

Stop containers:

```powershell
docker compose down
```

Rebuild from scratch when dependencies change:

```powershell
docker compose build --no-cache
docker compose up
```

## Kubernetes Deployment

This repo includes Kubernetes manifests under [k8s](k8s).

### 1) Build images for Kubernetes

Build backend image:

```powershell
docker build -t datascience-lab-backend:latest ./backend
```

Build frontend image with API routed through ingress (`/api`):

```powershell
docker build -t datascience-lab-frontend:latest --build-arg VITE_API_BASE_URL=/api ./frontend
```

If you are using a remote cluster, push both images to your registry and update image names in [k8s/backend.yaml](k8s/backend.yaml) and [k8s/frontend.yaml](k8s/frontend.yaml).

### 2) Apply manifests

```powershell
kubectl apply -k k8s
```

Optional: create runtime secrets (recommended for non-local clusters):

```powershell
kubectl apply -f k8s/backend-secrets.example.yaml
```

Then replace placeholder values in your secret with real credentials.

### 3) Access the app

#### Option A: Ingress (recommended)

1. Ensure an NGINX ingress controller is installed in your cluster.
2. Add this hosts entry:

```text
127.0.0.1 datascience-lab.local
```

3. Open:

- http://datascience-lab.local

#### Option B: Port-forward (no ingress required)

```powershell
kubectl -n data-visualization-tool port-forward svc/datascience-lab-backend 8000:8000
kubectl -n data-visualization-tool port-forward svc/datascience-lab-frontend 5173:80
```

Then open http://localhost:5173.

### 4) Troubleshooting

```powershell
kubectl -n data-visualization-tool get pods,svc,ingress
kubectl -n data-visualization-tool logs deploy/datascience-lab-backend
kubectl -n data-visualization-tool logs deploy/datascience-lab-frontend
```

Delete all Kubernetes resources:

```powershell
kubectl delete -k k8s
```

### Local Kubernetes auto rebuild + rollout watcher (no Tilt/Skaffold)

For local development, you can run one PowerShell watcher that:

1. Watches backend/frontend/k8s files.
2. Rebuilds Docker images.
3. Loads images to local cluster when needed (kind/minikube).
4. Applies manifests.
5. Updates deployment images and waits for rollout.

Run once (single deploy):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\k8s-local-watch-deploy.ps1 -Once
```

Run in watch mode:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\k8s-local-watch-deploy.ps1
```

Optional cluster override:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\k8s-local-watch-deploy.ps1 -ClusterType kind
```

Frontend shortcuts (from [frontend/](frontend)):

```powershell
npm run k8s:deploy:once
npm run k8s:watch
```

## GitHub Actions CI/CD (Docker + Kubernetes)

This repository includes a CI/CD workflow at [.github/workflows/ci-cd-k8s.yml](.github/workflows/ci-cd-k8s.yml).

Pipeline stages:

1. Run backend tests (`pytest`) and frontend build.
2. Build and push backend and frontend images to Docker Hub.
3. Apply Kubernetes manifests and roll out deployments with the new image tags.

### Required repository secrets

Create these in GitHub: `Settings -> Secrets and variables -> Actions`.

- `DOCKERHUB_USERNAME`: Docker Hub username.
- `DOCKERHUB_TOKEN`: Docker Hub access token with push permissions.
- `KUBE_CONFIG_B64`: Base64-encoded kubeconfig for the target cluster.

Generate `KUBE_CONFIG_B64`:

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME/.kube/config"))
```

Linux/macOS:

```bash
base64 -w 0 ~/.kube/config
```

### Triggering deployment

- Push to `main`, or
- Run manually from `Actions -> CI-CD Kubernetes -> Run workflow`.

### Important note for Docker Desktop Kubernetes

GitHub-hosted runners (`ubuntu-latest`) cannot directly reach your local Docker Desktop cluster.
For local-cluster deployments, use a self-hosted runner on the same machine, or deploy to a reachable remote cluster (AKS/EKS/GKE) using `KUBE_CONFIG_B64` for that cluster.

## Render Deployment (Monorepo)

Use the root [render.yaml](render.yaml) blueprint to deploy both services from one repository.

## One-Roof Single Service Option

If you want one backend service to host both API and frontend from the same domain:

1. Build frontend first so [frontend/dist](frontend/dist) exists.
2. Start backend from repo root using module path.

```bash
pip install -r requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
```

Notes:

- Root `requirements.txt` forwards to [backend/requirements.txt](backend/requirements.txt).
- Backend serves frontend files automatically when `frontend/dist` exists.

### Backend service

- rootDir: backend
- buildCommand: pip install -r requirements.txt
- startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT

### Frontend service

- rootDir: frontend
- buildCommand: npm ci && npm run build
- staticPublishPath: dist
- env: VITE_API_BASE_URL points to backend /api URL

## Environment Variables

### Backend

- CORS_ALLOW_ORIGINS
- CORS_ALLOW_CREDENTIALS

### Frontend

- VITE_API_BASE_URL
