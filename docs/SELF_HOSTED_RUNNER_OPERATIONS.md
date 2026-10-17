# Self-Hosted Runner Operations (Windows)

This guide explains how to run and maintain the GitHub self-hosted runner used by [ci-cd-k8s.yml](../.github/workflows/ci-cd-k8s.yml).

## 1) Runner labels used by workflow

The deploy job targets:

- `self-hosted`
- `Windows`
- `X64`

If your runner has these labels in GitHub (`Settings -> Actions -> Runners`), it can pick the deploy job.

## 2) Runner location

This project currently uses runner files in:

- `C:\Users\vikas\actions-runner`

Common files in that folder:

- `config.cmd`
- `run.cmd`
- `bin\` and `externals\`

## 3) Start runner (interactive mode)

Use this when testing quickly:

```powershell
cd C:\Users\vikas\actions-runner
.\run.cmd
```

Keep this terminal open. You should see: `Listening for Jobs`.

## 4) Service mode (auto-start)

If `svc.cmd` exists in your runner folder:

```powershell
cd C:\Users\vikas\actions-runner
.\svc.cmd install
.\svc.cmd start
.\svc.cmd status
```

If `svc.cmd` does not exist, continue with `run.cmd` mode or reconfigure the runner from GitHub’s current setup instructions.

## 5) Trigger workflow manually

### Option A: GitHub UI

1. Open `Actions`.
2. Select `CI-CD Kubernetes`.
3. Click `Run workflow`.

### Option B: GitHub CLI

```powershell
gh workflow run "CI-CD Kubernetes" --ref main
gh run list --workflow "CI-CD Kubernetes"
gh run watch
```

If `gh` is not recognized after install, open a new terminal or run:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" --version
```

## 6) Required secrets/variables

For deploy job execution, repository configuration must include:

- `DOCKERHUB_TOKEN` (secret)
- `DOCKERHUB_USERNAME` (secret or variable)
- `KUBE_CONFIG_B64` (secret)

Generate `KUBE_CONFIG_B64` on the runner machine:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\.kube\config"))
```

## 7) Preflight checks on runner machine

Run before troubleshooting workflow deploy failures:

```powershell
kubectl get nodes
kubectl config current-context
docker --version
docker ps
```

## 8) Expected workflow behavior

In [ci-cd-k8s.yml](../.github/workflows/ci-cd-k8s.yml):

1. `test-and-build-app` runs on `ubuntu-latest`.
2. `build-and-push-images` runs on `ubuntu-latest`.
3. `deploy-to-kubernetes` runs on self-hosted Windows runner.

So the self-hosted runner receives a job only after jobs (1) and (2) succeed.

## 9) Common issues and fixes

### A) `.\run.cmd` not found

You are in the wrong directory. Use:

```powershell
cd C:\Users\vikas\actions-runner
```

### B) `.\svc` not found

Use:

```powershell
.\svc.cmd
```

and only if that file exists.

### C) Deploy job is skipped

Check workflow condition gates:

- image push enabled (`can_push == true`)
- kubeconfig secret present (`has_kubeconfig == true`)

### D) Runner shows online but no active job

Usually normal while earlier jobs are still running, or the deploy job was skipped.

### E) Manual pod deletion concerns

Deployments self-heal. If a pod is deleted manually, Kubernetes recreates it based on `replicas`.
HPA minimum replicas in [hpa.yaml](../k8s/hpa.yaml) helps keep minimum pod count for scaling scenarios.

## 10) Daily operations checklist

1. Start runner (`run.cmd`) or ensure runner service is running.
2. Confirm `kubectl get nodes` works.
3. Trigger workflow.
4. Watch with `gh run watch` or GitHub UI.
5. Verify deployment:

```powershell
kubectl -n data-visualization-tool get deploy,pods,svc,ingress,hpa
```
