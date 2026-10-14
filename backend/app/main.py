from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import logging
import math
import random
import re
import statistics
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse

from .assignment_store import (
    create_student_assignment_mongo,
    get_student_auth_record_mongo,
    get_assignment_mode_mongo,
    get_student_by_usn_mongo,
    get_student_assignment_by_usn_mongo,
    init_assignment_store,
    list_students_mongo,
    reset_student_password_to_default_mongo,
    list_student_assignments_mongo,
    seed_students_from_rows_mongo,
    set_student_password_mongo,
    set_student_task_control_mongo,
    set_assignment_mode_mongo,
    upsert_assignment_record_mongo,
    upsert_student_record_mongo,
    update_student_name_mongo,
    update_student_assignment_task_mongo,
    verify_student_password_mongo,
)

from .config import (
    ADMIN_PASSWORD,
    ADMIN_TOKEN_SECRET,
    ADMIN_TOKEN_TTL_HOURS,
    ADMIN_USERNAME,
    CORS_ALLOW_CREDENTIALS,
    CORS_ALLOW_ORIGINS,
    FRONTEND_DIST_DIR,
    GENERATED_DIR,
)
from .dataset_generator import (
    generate_dataset as generate_dataset_bundle,
    get_dataset_template,
    get_projects,
)
from .db import (
    create_analysis_session,
    delete_analysis_session,
    delete_dataset_record,
    get_analysis_session,
    get_dataset_record,
    get_next_dataset_version,
    get_student_assignment_by_usn,
    init_db,
    list_analysis_sessions,
    list_dataset_records,
    list_dataset_versions,
    log_progress_event,
    save_dataset_record,
    save_dataset_version,
    summarize_progress_events,
    update_analysis_session,
    list_student_assignments,
)

from .schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminResetStudentPasswordResponse,
    AdminSessionResponse,
    AssignmentModeResponse,
    AssignmentModeUpdateRequest,
    DatasetGenerateRequest,
    DatasetProfileResponse,
    DatasetRecordResponse,
    DatasetSummaryResponse,
    DatasetVersionResponse,
    NumericStats,
    PaginatedRowsResponse,
    ProgressEventRequest,
    ProgressSummaryResponse,
    StudentAssignRequest,
    StudentAssignResult,
    StudentAssignmentResponse,
    StudentReassignRequest,
    StudentLoginRequest,
    StudentLoginResponse,
    StudentChangePasswordRequest,
    StudentChangePasswordResponse,
    StudentUpdateProfileRequest,
    StudentUpdateProfileResponse,
    StudentTaskControlRequest,
    StudentTaskControlResponse,
    StudentRecoverAssignmentRequest,
    StudentRecoverAssignmentResponse,
    SessionCreateRequest,
    SessionResponse,
    SessionUpdateRequest,
    SeedStudentsResponse,
    StudentRecordResponse,
)

app = FastAPI(title="DataScience Lab API", version="0.1.0")
logger = logging.getLogger("datascience_lab")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

_generate_rate_window_secs = 60
_generate_rate_limit = 30
_ip_call_timestamps: dict[str, list[float]] = {}
_student_task_ids = [f"S{index:02d}" for index in range(1, 22)]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()
    try:
        init_assignment_store()
    except RuntimeError as exc:
        logger.warning(f"Assignment store initialization skipped: {exc}")


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id", uuid4().hex)
    started_at = time.time()
    response = await call_next(request)
    elapsed_ms = round((time.time() - started_at) * 1000, 2)
    response.headers["x-request-id"] = request_id
    logger.info(
        json.dumps(
            {
                "event": "http_request",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "elapsed_ms": elapsed_ms,
            }
        )
    )
    return response


def _enforce_generate_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    history = _ip_call_timestamps.get(client_ip, [])
    cutoff = now - _generate_rate_window_secs
    recent = [stamp for stamp in history if stamp >= cutoff]
    if len(recent) >= _generate_rate_limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded for dataset generation. Try again shortly.")
    recent.append(now)
    _ip_call_timestamps[client_ip] = recent


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/readiness")
def readiness() -> dict[str, str]:
    if not GENERATED_DIR.exists():
        raise HTTPException(status_code=503, detail="Generated directory missing")
    try:
        _ = list_dataset_records(limit=1)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
    return {"status": "ready"}


@app.get("/api/projects")
def projects() -> list[dict[str, str]]:
    return get_projects()


@app.get("/api/datasets", response_model=list[DatasetRecordResponse])
def list_datasets(limit: int = 20) -> list[DatasetRecordResponse]:
    safe_limit = max(1, min(limit, 100))
    rows = list_dataset_records(limit=safe_limit)
    return [
        DatasetRecordResponse(
            dataset_id=row["dataset_id"],
            dataset_name=row["dataset_name"],
            rows_count=row["rows_count"],
            columns_count=row["columns_count"],
            difficulty=row["difficulty"],
            include_missing_values=bool(row["include_missing_values"]),
            include_outliers=bool(row["include_outliers"]),
            created_at=row["created_at"],
        )
        for row in rows
    ]


@app.get("/api/datasets/{dataset_name}/versions", response_model=list[DatasetVersionResponse])
def versions(dataset_name: str, limit: int = 20) -> list[DatasetVersionResponse]:
    safe_limit = max(1, min(limit, 100))
    rows = list_dataset_versions(dataset_name=dataset_name, limit=safe_limit)
    return [
        DatasetVersionResponse(
            dataset_name=row["dataset_name"],
            version_number=row["version_number"],
            dataset_id=row["dataset_id"],
            config_json=row["config_json"],
            metrics_json=row["metrics_json"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


@app.get("/api/sessions", response_model=list[SessionResponse])
def list_sessions(limit: int = 50) -> list[SessionResponse]:
    safe_limit = max(1, min(limit, 200))
    rows = list_analysis_sessions(limit=safe_limit)
    return [
        SessionResponse(
            session_id=row["session_id"],
            name=row["name"],
            dataset_id=row["dataset_id"],
            state_json=row["state_json"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]


@app.post("/api/sessions", response_model=SessionResponse)
def create_session(payload: SessionCreateRequest) -> SessionResponse:
    session_id = uuid4().hex
    create_analysis_session(
        session_id=session_id,
        name=payload.name,
        dataset_id=payload.dataset_id,
        state_json=payload.state_json,
    )
    row = get_analysis_session(session_id)
    if row is None:
        raise HTTPException(status_code=500, detail="Session creation failed")
    return SessionResponse(
        session_id=row["session_id"],
        name=row["name"],
        dataset_id=row["dataset_id"],
        state_json=row["state_json"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.get("/api/sessions/{session_id}", response_model=SessionResponse)
def get_session(session_id: str) -> SessionResponse:
    row = get_analysis_session(session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(
        session_id=row["session_id"],
        name=row["name"],
        dataset_id=row["dataset_id"],
        state_json=row["state_json"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.put("/api/sessions/{session_id}", response_model=SessionResponse)
def update_session(session_id: str, payload: SessionUpdateRequest) -> SessionResponse:
    updated = update_analysis_session(
        session_id=session_id,
        name=payload.name,
        dataset_id=payload.dataset_id,
        state_json=payload.state_json,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    row = get_analysis_session(session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(
        session_id=row["session_id"],
        name=row["name"],
        dataset_id=row["dataset_id"],
        state_json=row["state_json"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.post("/api/sessions/{session_id}/duplicate", response_model=SessionResponse)
def duplicate_session(session_id: str) -> SessionResponse:
    row = get_analysis_session(session_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    new_session_id = uuid4().hex
    create_analysis_session(
        session_id=new_session_id,
        name=f"{row['name']} (Copy)",
        dataset_id=row["dataset_id"],
        state_json=row["state_json"],
    )
    copy_row = get_analysis_session(new_session_id)
    if copy_row is None:
        raise HTTPException(status_code=500, detail="Session duplication failed")
    return SessionResponse(
        session_id=copy_row["session_id"],
        name=copy_row["name"],
        dataset_id=copy_row["dataset_id"],
        state_json=copy_row["state_json"],
        created_at=copy_row["created_at"],
        updated_at=copy_row["updated_at"],
    )


@app.delete("/api/sessions/{session_id}")
def remove_session(session_id: str) -> dict[str, str]:
    deleted = delete_analysis_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


@app.post("/api/progress/events")
def create_progress_event(payload: ProgressEventRequest) -> dict[str, str]:
    log_progress_event(
        module=payload.module,
        event_type=payload.event_type,
        score=payload.score,
        metadata_json=payload.metadata_json,
    )
    return {"status": "logged"}


@app.get("/api/progress/summary", response_model=ProgressSummaryResponse)
def progress_summary() -> ProgressSummaryResponse:
    rows = summarize_progress_events()
    by_module = {row["module"]: int(row["event_count"]) for row in rows}
    return ProgressSummaryResponse(
        total_events=sum(by_module.values()),
        by_module=by_module,
    )


def _normalize_usn(usn: str) -> str:
    return usn.strip().upper()


def _to_student_assignment_response(row) -> StudentAssignmentResponse:
    return StudentAssignmentResponse(
        name=row["name"],
        usn=row["usn"],
        task_id=row["task_id"],
        assigned_at=row["assigned_at"],
    )


def _raise_assignment_backend_unavailable(exc: Exception) -> None:
    raise HTTPException(status_code=503, detail=f"Assignment backend unavailable: {exc}") from exc


def _encode_admin_token(username: str, expires_at: datetime) -> str:
    payload = f"{username}|{int(expires_at.timestamp())}"
    digest = hmac.new(ADMIN_TOKEN_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    token_text = f"{payload}|{digest}"
    return urlsafe_b64encode(token_text.encode("utf-8")).decode("utf-8")


def _decode_admin_token(token: str) -> tuple[str, datetime]:
    try:
        raw = urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token") from exc

    parts = raw.split("|")
    if len(parts) != 3:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")

    username, expires_at_raw, signature = parts
    payload = f"{username}|{expires_at_raw}"
    expected_signature = hmac.new(
        ADMIN_TOKEN_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")

    try:
        expires_at_timestamp = int(expires_at_raw)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token") from exc

    expires_at = datetime.fromtimestamp(expires_at_timestamp, tz=timezone.utc)
    if datetime.now(tz=timezone.utc) >= expires_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin token expired")

    if username != ADMIN_USERNAME:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")

    return username, expires_at


def require_admin_user(authorization: str | None = Header(default=None)) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing admin authorization")
    token_prefix = "Bearer "
    if not authorization.startswith(token_prefix):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization scheme")
    token = authorization[len(token_prefix) :].strip()
    username, _ = _decode_admin_token(token)
    return username


@app.post("/api/admin/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest) -> AdminLoginResponse:
    if payload.username.strip() != ADMIN_USERNAME or payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

    expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=ADMIN_TOKEN_TTL_HOURS)
    token = _encode_admin_token(ADMIN_USERNAME, expires_at)
    return AdminLoginResponse(token=token, expires_at=expires_at.isoformat())


@app.get("/api/admin/me", response_model=AdminSessionResponse)
def admin_me(authorization: str | None = Header(default=None)) -> AdminSessionResponse:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing admin authorization")
    token = authorization[len("Bearer ") :].strip()
    username, expires_at = _decode_admin_token(token)
    return AdminSessionResponse(username=username, is_admin=True, expires_at=expires_at.isoformat())


def _to_student_record_response(row) -> StudentRecordResponse:
    return StudentRecordResponse(
        name=row["name"],
        usn=row["usn"],
        task_id=row["task_id"],
        assigned_at=row["assigned_at"],
        updated_at=row["updated_at"],
        password_must_change=bool(row.get("password_must_change", True)),
        task_locked=bool(row.get("task_locked", False)),
    )


def _to_student_assignment_from_student_record(row) -> StudentAssignmentResponse:
    return StudentAssignmentResponse(
        name=row["name"],
        usn=row["usn"],
        task_id=row["task_id"],
        assigned_at=row["assigned_at"],
    )


@app.get("/api/assignments", response_model=list[StudentAssignmentResponse])
def list_assignments() -> list[StudentAssignmentResponse]:
    try:
        rows = list_student_assignments_mongo()
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)
    return [_to_student_assignment_response(row) for row in rows]


@app.get("/api/assignments/mode", response_model=AssignmentModeResponse)
def get_assignments_mode() -> AssignmentModeResponse:
    try:
        mode = get_assignment_mode_mongo()
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)
    if mode not in {"self-assign", "mentor-only"}:
        mode = "self-assign"
    return AssignmentModeResponse(mode=mode)


@app.put("/api/assignments/mode", response_model=AssignmentModeResponse)
def update_assignments_mode(payload: AssignmentModeUpdateRequest, _admin: str = Depends(require_admin_user)) -> AssignmentModeResponse:
    try:
        set_assignment_mode_mongo(payload.mode)
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)
    return AssignmentModeResponse(mode=payload.mode)


@app.post("/api/assignments/assign-random", response_model=StudentAssignResult)
def create_random_assignment(payload: StudentAssignRequest) -> StudentAssignResult:
    normalized_usn = _normalize_usn(payload.usn)
    try:
        existing = get_student_assignment_by_usn_mongo(normalized_usn)
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)
    if existing is not None:
        return StudentAssignResult(status="duplicate", assignment=_to_student_assignment_response(existing))

    rows = list_student_assignments_mongo()
    assigned_ids = {str(row["task_id"]) for row in rows}
    unassigned_ids = [task_id for task_id in _student_task_ids if task_id not in assigned_ids]
    pool = unassigned_ids if len(unassigned_ids) > 0 else _student_task_ids
    random_task_id = pool[random.randrange(len(pool))]

    row = create_student_assignment_mongo(name=payload.name.strip(), usn=normalized_usn, task_id=random_task_id)
    return StudentAssignResult(status="created", assignment=_to_student_assignment_response(row))


@app.post("/api/students/login", response_model=StudentLoginResponse)
def student_login(payload: StudentLoginRequest) -> StudentLoginResponse:
    normalized_username = _normalize_usn(payload.username)
    is_valid_password, must_change_password = verify_student_password_mongo(normalized_username, payload.password)
    if not is_valid_password:
        raise HTTPException(status_code=401, detail="Invalid student credentials")

    recovered_task_id = payload.cached_task_id.strip().upper() if payload.cached_task_id else None
    usn = normalized_username

    try:
        student_row = get_student_by_usn_mongo(usn)
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)

    if student_row is None:
        try:
            assignment_row = get_student_assignment_by_usn_mongo(usn)
        except RuntimeError as exc:
            _raise_assignment_backend_unavailable(exc)
        if assignment_row is not None:
            try:
                student_row = upsert_student_record_mongo(
                    name=assignment_row["name"],
                    usn=assignment_row["usn"],
                    task_id=assignment_row["task_id"],
                    assigned_at=assignment_row["assigned_at"],
                )
            except RuntimeError as exc:
                _raise_assignment_backend_unavailable(exc)

    auth_record = get_student_auth_record_mongo(usn)
    if auth_record is not None:
        must_change_password = bool(auth_record.get("password_must_change", must_change_password))

    if student_row is None:
        sqlite_row = get_student_assignment_by_usn(usn)
        if sqlite_row is not None:
            assigned_at = str(sqlite_row["assigned_at"])
            try:
                assignment_row = upsert_assignment_record_mongo(
                    name=str(sqlite_row["name"]),
                    usn=str(sqlite_row["usn"]),
                    task_id=str(sqlite_row["task_id"]),
                    assigned_at=assigned_at,
                )
                student_row = upsert_student_record_mongo(
                    name=assignment_row["name"],
                    usn=assignment_row["usn"],
                    task_id=assignment_row["task_id"],
                    assigned_at=assignment_row["assigned_at"],
                )
            except RuntimeError as exc:
                _raise_assignment_backend_unavailable(exc)

    if student_row is None:
        return StudentLoginResponse(
            usn=usn,
            assignment_found=False,
            assignment=None,
            recovered_task_id=recovered_task_id,
            must_change_password=must_change_password,
            profile_name=None,
            message="No assignment found in database. Select your previously assigned task to recover your record.",
        )

    return StudentLoginResponse(
        usn=usn,
        assignment_found=True,
        assignment=_to_student_assignment_from_student_record(student_row),
        recovered_task_id=recovered_task_id,
        must_change_password=must_change_password,
        profile_name=student_row["name"],
        message="Assignment loaded successfully.",
    )


@app.post("/api/students/recover-assignment", response_model=StudentRecoverAssignmentResponse)
def recover_student_assignment(payload: StudentRecoverAssignmentRequest) -> StudentRecoverAssignmentResponse:
    normalized_username = _normalize_usn(payload.username)
    is_valid_password, _ = verify_student_password_mongo(normalized_username, payload.password)
    if not is_valid_password:
        raise HTTPException(status_code=401, detail="Invalid student credentials")

    task_id = payload.task_id.strip().upper()
    if task_id not in _student_task_ids:
        raise HTTPException(status_code=422, detail="Invalid task id")

    usn = normalized_username
    try:
        current_student_row = get_student_by_usn_mongo(usn)
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)
    if current_student_row is not None and bool(current_student_row.get("task_locked", False)):
        current_task_id = str(current_student_row.get("task_id", "")).upper()
        if current_task_id and current_task_id != task_id:
            raise HTTPException(status_code=403, detail="Task is locked by admin and cannot be changed")

    name = payload.name.strip() if payload.name and payload.name.strip() else f"Student {usn}"
    assigned_at = datetime.now(tz=timezone.utc).isoformat()

    try:
        assignment_row = upsert_assignment_record_mongo(name=name, usn=usn, task_id=task_id, assigned_at=assigned_at)
        upsert_student_record_mongo(
            name=assignment_row["name"],
            usn=assignment_row["usn"],
            task_id=assignment_row["task_id"],
            assigned_at=assignment_row["assigned_at"],
        )
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)

    cached_task_id = payload.cached_task_id.strip().upper() if payload.cached_task_id else None
    matched_cached_task = bool(cached_task_id and cached_task_id == task_id)

    return StudentRecoverAssignmentResponse(
        status="matched-cache" if matched_cached_task else "saved",
        matched_cached_task=matched_cached_task,
        assignment=_to_student_assignment_response(assignment_row),
    )


@app.post("/api/students/change-password", response_model=StudentChangePasswordResponse)
def student_change_password(payload: StudentChangePasswordRequest) -> StudentChangePasswordResponse:
    usn = _normalize_usn(payload.usn)
    is_valid_password, _ = verify_student_password_mongo(usn, payload.current_password)
    if not is_valid_password:
        raise HTTPException(status_code=401, detail="Current password is invalid")

    new_password = payload.new_password.strip()
    if len(new_password) < 6:
        raise HTTPException(status_code=422, detail="New password must be at least 6 characters")

    changed = set_student_password_mongo(usn, new_password, force_must_change=False)
    if not changed:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return StudentChangePasswordResponse(usn=usn, password_changed=True)


@app.post("/api/students/update-profile", response_model=StudentUpdateProfileResponse)
def student_update_profile(payload: StudentUpdateProfileRequest) -> StudentUpdateProfileResponse:
    usn = _normalize_usn(payload.usn)
    is_valid_password, _ = verify_student_password_mongo(usn, payload.current_password)
    if not is_valid_password:
        raise HTTPException(status_code=401, detail="Current password is invalid")

    name_changed = False
    password_changed = False

    if payload.new_name and payload.new_name.strip():
        name_changed = update_student_name_mongo(usn, payload.new_name)
        if not name_changed:
            raise HTTPException(status_code=404, detail="Student profile not found")

    if payload.new_password and payload.new_password.strip():
        new_password = payload.new_password.strip()
        if len(new_password) < 6:
            raise HTTPException(status_code=422, detail="New password must be at least 6 characters")
        password_changed = set_student_password_mongo(usn, new_password, force_must_change=False)
        if not password_changed:
            raise HTTPException(status_code=404, detail="Student profile not found")

    if not name_changed and not password_changed:
        raise HTTPException(status_code=422, detail="Provide at least one change: name or password")

    record = get_student_auth_record_mongo(usn)
    if record is None:
        raise HTTPException(status_code=404, detail="Student profile not found")

    return StudentUpdateProfileResponse(
        usn=usn,
        name=record["name"],
        name_changed=name_changed,
        password_changed=password_changed,
    )


@app.post("/api/students/{usn}/reset-password", response_model=AdminResetStudentPasswordResponse)
def admin_reset_student_password(usn: str, _admin: str = Depends(require_admin_user)) -> AdminResetStudentPasswordResponse:
    normalized_usn = _normalize_usn(usn)
    reset = reset_student_password_to_default_mongo(normalized_usn)
    if not reset:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return AdminResetStudentPasswordResponse(usn=normalized_usn, reset_to_default=True)


@app.put("/api/students/{usn}/task-control", response_model=StudentTaskControlResponse)
def admin_set_student_task_control(
    usn: str, payload: StudentTaskControlRequest, _admin: str = Depends(require_admin_user)
) -> StudentTaskControlResponse:
    normalized_usn = _normalize_usn(usn)
    task_id = payload.task_id.strip().upper()
    if task_id not in _student_task_ids:
        raise HTTPException(status_code=422, detail="Invalid task id")

    try:
        row = set_student_task_control_mongo(normalized_usn, task_id, payload.lock_task)
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)

    if row is None:
        raise HTTPException(status_code=404, detail="Student assignment not found")

    return StudentTaskControlResponse(
        usn=row["usn"],
        task_id=row["task_id"],
        task_locked=bool(row.get("task_locked", False)),
    )


@app.put("/api/assignments/{usn}/task", response_model=StudentAssignmentResponse)
def reassign_student_task(
    usn: str, payload: StudentReassignRequest, _admin: str = Depends(require_admin_user)
) -> StudentAssignmentResponse:
    normalized_usn = _normalize_usn(usn)
    task_id = payload.task_id.strip().upper()
    if task_id not in _student_task_ids:
        raise HTTPException(status_code=422, detail="Invalid task id")

    try:
        row = update_student_assignment_task_mongo(normalized_usn, task_id)
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)
    if row is None:
        raise HTTPException(status_code=404, detail="Student assignment not found")
    return _to_student_assignment_response(row)


@app.get("/api/students", response_model=list[StudentRecordResponse])
def list_students() -> list[StudentRecordResponse]:
    try:
        rows = list_students_mongo()
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)
    return [_to_student_record_response(row) for row in rows]


@app.get("/api/students/{usn}", response_model=StudentRecordResponse)
def get_student(usn: str) -> StudentRecordResponse:
    normalized_usn = _normalize_usn(usn)
    try:
        row = get_student_by_usn_mongo(normalized_usn)
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)
    if row is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return _to_student_record_response(row)


@app.post("/api/students/seed-from-sqlite", response_model=SeedStudentsResponse)
def seed_students_from_sqlite(_admin: str = Depends(require_admin_user)) -> SeedStudentsResponse:
    sqlite_rows = list_student_assignments()
    rows = [
        {
            "name": str(row["name"]),
            "usn": str(row["usn"]).strip().upper(),
            "task_id": str(row["task_id"]),
            "assigned_at": str(row["assigned_at"]),
        }
        for row in sqlite_rows
    ]
    try:
        result = seed_students_from_rows_mongo(rows)
    except RuntimeError as exc:
        _raise_assignment_backend_unavailable(exc)
    return SeedStudentsResponse(
        seeded=result["seeded"],
        students_synced=result.get("students_synced", result["seeded"]),
        assignments_synced=result.get("assignments_synced", result["seeded"]),
    )


def _try_cast(value: str) -> object | None:
    if value == "":
        return None
    if value.isdigit():
        return int(value)
    try:
        return float(value)
    except ValueError:
        return value


def _infer_dtype(values: list[object | None]) -> str:
    non_null = [value for value in values if value is not None]
    if not non_null:
        return "unknown"
    if all(isinstance(value, int) for value in non_null):
        return "int"
    if all(isinstance(value, (int, float)) for value in non_null):
        return "float"
    return "str"


def _load_rows(csv_path: Path) -> tuple[list[str], list[dict[str, object | None]]]:
    with csv_path.open("r", newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames is None:
            raise HTTPException(status_code=500, detail="Dataset has no headers")
        rows: list[dict[str, object | None]] = []
        for row in reader:
            parsed: dict[str, object | None] = {}
            for key in reader.fieldnames:
                parsed[key] = _try_cast(row.get(key, ""))
            rows.append(parsed)
        return reader.fieldnames, rows


def _build_summary(
    dataset_id: str,
    dataset_name: str,
    difficulty: str,
    fieldnames: list[str],
    rows: list[dict[str, object | None]],
) -> DatasetSummaryResponse:
    try:
        template = get_dataset_template(dataset_name)
    except ValueError:
        template = None
    cols_by_name: dict[str, list[object | None]] = {column: [] for column in fieldnames}
    for row in rows:
        for column in fieldnames:
            cols_by_name[column].append(row.get(column))

    if template is not None:
        target_suggestion = template.target_suggestion
        column_descriptions = template.column_descriptions
        suggested_questions = template.suggested_questions
    else:
        numeric_columns = [column for column, values in cols_by_name.items() if _infer_dtype(values) in {"int", "float"}]
        target_suggestion = numeric_columns[-1] if numeric_columns else (fieldnames[-1] if fieldnames else "")
        column_descriptions = {column: "Column from uploaded dataset." for column in fieldnames}
        suggested_questions = [
            "Which columns have the most missing values?",
            "Which variables show unusual values or outliers?",
            "What relationships are visible between key numeric columns?",
            "Which chart best explains the main pattern in this dataset?",
            "What decision can be supported by this analysis?",
        ]

    return DatasetSummaryResponse(
        dataset_id=dataset_id,
        dataset_name=dataset_name,
        rows=len(rows),
        columns=len(fieldnames),
        target_suggestion=target_suggestion,
        difficulty=difficulty,
        column_descriptions=column_descriptions,
        data_types={column: _infer_dtype(values) for column, values in cols_by_name.items()},
        missing_summary={
            column: sum(1 for value in values if value is None)
            for column, values in cols_by_name.items()
        },
        preview=rows[:20],
        suggested_questions=suggested_questions,
    )


def _search_match(row: dict[str, object | None], query: str) -> bool:
    if not query.strip():
        return True
    q = query.strip().lower()
    return any(q in str(value).lower() for value in row.values() if value is not None)


def _missing_match(value: object | None, only_missing: bool) -> bool:
    if not only_missing:
        return True
    return value is None


def _typed_number(value: object | None) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except ValueError:
        return None


def _to_hashable_row(row: dict[str, object | None], fieldnames: list[str]) -> tuple[object | None, ...]:
    return tuple(row.get(field) for field in fieldnames)


def _count_outliers(values: list[float]) -> int:
    if len(values) < 4:
        return 0
    sorted_values = sorted(values)
    q1 = sorted_values[int(len(sorted_values) * 0.25)]
    q3 = sorted_values[int(len(sorted_values) * 0.75)]
    iqr = q3 - q1
    low = q1 - 1.5 * iqr
    high = q3 + 1.5 * iqr
    return sum(1 for value in sorted_values if value < low or value > high)


def _apply_advanced_missing(
    rows: list[dict[str, object | None]],
    fieldnames: list[str],
    missing_percentage: float,
    rng: random.Random,
) -> None:
    if missing_percentage <= 0:
        return
    editable_columns = [col for col in fieldnames if not col.endswith("_id") and col != "record_id"]
    if not editable_columns:
        return
    total_cells = len(rows) * len(editable_columns)
    cells_to_null = int(total_cells * (missing_percentage / 100.0))
    for _ in range(cells_to_null):
        row = rows[rng.randrange(len(rows))]
        col = editable_columns[rng.randrange(len(editable_columns))]
        row[col] = None


def _apply_advanced_outliers(
    rows: list[dict[str, object | None]],
    fieldnames: list[str],
    outlier_percentage: float,
    noise_level: float,
    rng: random.Random,
) -> None:
    if outlier_percentage <= 0:
        return
    numeric_columns: list[str] = []
    for col in fieldnames:
        values = [_typed_number(row.get(col)) for row in rows]
        if any(value is not None for value in values):
            numeric_columns.append(col)
    if not numeric_columns:
        return

    outlier_rows_count = max(1, int(len(rows) * (outlier_percentage / 100.0)))
    chosen_indices = rng.sample(range(len(rows)), min(outlier_rows_count, len(rows)))
    for idx in chosen_indices:
        row = rows[idx]
        col = numeric_columns[rng.randrange(len(numeric_columns))]
        value = _typed_number(row.get(col))
        if value is None:
            continue
        perturbation = rng.gauss(0, max(1.5, abs(value) * 0.12 * noise_level))
        row[col] = round(value + perturbation, 3)


def _apply_noise(rows: list[dict[str, object | None]], fieldnames: list[str], noise_level: float, rng: random.Random) -> None:
    if abs(noise_level - 1.0) < 1e-9:
        return
    for row in rows:
        for col in fieldnames:
            value = _typed_number(row.get(col))
            if value is None or col.endswith("_id") or col == "record_id":
                continue
            jitter = rng.gauss(0, max(0.05, abs(value) * 0.01 * noise_level))
            row[col] = round(value + jitter, 3)


def _sanitize_dataset_name(raw_name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_\- ]+", "", raw_name).strip().replace(" ", "_")
    return cleaned[:80] if cleaned else "uploaded_dataset"


def _decode_upload_bytes(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=422, detail="Unable to decode uploaded CSV file")


def _parse_uploaded_csv(content: bytes) -> tuple[list[str], list[dict[str, object | None]]]:
    text = _decode_upload_bytes(content)
    sample = text[:4096]
    delimiter = ","
    try:
        delimiter = csv.Sniffer().sniff(sample, delimiters=",;\t|").delimiter
    except Exception:
        delimiter = ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if reader.fieldnames is None:
        raise HTTPException(status_code=422, detail="Uploaded CSV must include a header row")

    rows: list[dict[str, object | None]] = []
    for row in reader:
        parsed: dict[str, object | None] = {}
        for key in reader.fieldnames:
            parsed[key] = _try_cast(row.get(key, ""))
        rows.append(parsed)

    return reader.fieldnames, rows


@app.post("/api/datasets/generate", response_model=DatasetSummaryResponse)
def generate_dataset(request: Request, payload: DatasetGenerateRequest) -> DatasetSummaryResponse:
    _enforce_generate_rate_limit(request)
    rng = random.Random(payload.random_seed)
    bundle = generate_dataset_bundle(
        dataset=payload.dataset,
        n=payload.num_records,
        include_missing_values=payload.include_missing_values,
        include_outliers=payload.include_outliers,
        difficulty=payload.difficulty,
        seed=payload.random_seed,
    )
    if payload.include_missing_values and payload.missing_value_percentage > 0:
        _apply_advanced_missing(bundle.rows, bundle.fieldnames, payload.missing_value_percentage, rng)

    if payload.include_outliers and payload.outlier_percentage > 0:
        _apply_advanced_outliers(bundle.rows, bundle.fieldnames, payload.outlier_percentage, payload.noise_level, rng)

    _apply_noise(bundle.rows, bundle.fieldnames, payload.noise_level, rng)

    dataset_id = uuid4().hex
    csv_path = GENERATED_DIR / f"{dataset_id}.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=bundle.fieldnames)
        writer.writeheader()
        writer.writerows(bundle.rows)

    save_dataset_record(
        dataset_id=dataset_id,
        dataset_name=payload.dataset,
        csv_path=csv_path,
        rows_count=len(bundle.rows),
        columns_count=len(bundle.fieldnames),
        difficulty=payload.difficulty,
        include_missing_values=payload.include_missing_values,
        include_outliers=payload.include_outliers,
    )

    version_number = get_next_dataset_version(payload.dataset)
    save_dataset_version(
        dataset_name=payload.dataset,
        version_number=version_number,
        dataset_id=dataset_id,
        config_json=json.dumps(payload.model_dump()),
        metrics_json=json.dumps(
            {
                "rows": len(bundle.rows),
                "columns": len(bundle.fieldnames),
            }
        ),
    )

    return _build_summary(
        dataset_id,
        payload.dataset,
        payload.difficulty,
        bundle.fieldnames,
        bundle.rows,
    )


@app.post("/api/datasets/upload", response_model=DatasetSummaryResponse)
def upload_dataset(
    request: Request,
    file: UploadFile = File(...),
    dataset_name: str | None = Form(default=None),
) -> DatasetSummaryResponse:
    _enforce_generate_rate_limit(request)

    filename = file.filename or "uploaded_dataset.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=422, detail="Only CSV files are supported right now")

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Uploaded file is too large (max 15 MB)")

    fieldnames, rows = _parse_uploaded_csv(content)
    if not fieldnames:
        raise HTTPException(status_code=422, detail="CSV has no usable columns")

    safe_name = _sanitize_dataset_name(dataset_name or Path(filename).stem)
    dataset_id = uuid4().hex
    csv_path = GENERATED_DIR / f"{dataset_id}.csv"

    with csv_path.open("w", newline="", encoding="utf-8") as out_file:
        writer = csv.DictWriter(out_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    save_dataset_record(
        dataset_id=dataset_id,
        dataset_name=safe_name,
        csv_path=csv_path,
        rows_count=len(rows),
        columns_count=len(fieldnames),
        difficulty="uploaded",
        include_missing_values=False,
        include_outliers=False,
    )

    version_number = get_next_dataset_version(safe_name)
    save_dataset_version(
        dataset_name=safe_name,
        version_number=version_number,
        dataset_id=dataset_id,
        config_json=json.dumps({"source": "upload", "filename": filename}),
        metrics_json=json.dumps({"rows": len(rows), "columns": len(fieldnames)}),
    )

    return _build_summary(
        dataset_id=dataset_id,
        dataset_name=safe_name,
        difficulty="uploaded",
        fieldnames=fieldnames,
        rows=rows,
    )


@app.get("/api/datasets/{dataset_id}", response_model=DatasetSummaryResponse)
def get_dataset_summary(dataset_id: str) -> DatasetSummaryResponse:
    row = get_dataset_record(dataset_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    csv_path = Path(row["csv_path"])
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Dataset file missing")

    fieldnames, rows = _load_rows(csv_path)
    return _build_summary(dataset_id, row["dataset_name"], row["difficulty"], fieldnames, rows)


@app.get("/api/datasets/{dataset_id}/rows")
def get_dataset_rows(dataset_id: str) -> dict[str, object]:
    row = get_dataset_record(dataset_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    csv_path = Path(row["csv_path"])
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Dataset file missing")

    _, rows = _load_rows(csv_path)
    return {"dataset_id": dataset_id, "rows": rows}


@app.get("/api/datasets/{dataset_id}/rows/paginated", response_model=PaginatedRowsResponse)
def get_dataset_rows_paginated(
    dataset_id: str,
    page: int = 1,
    page_size: int = 50,
    search: str = "",
    sort_by: str = "",
    sort_dir: str = "asc",
    filter_column: str = "",
    filter_value: str = "",
    numeric_min: float | None = None,
    numeric_max: float | None = None,
    missing_only: bool = False,
) -> PaginatedRowsResponse:
    if page < 1:
        raise HTTPException(status_code=422, detail="page must be >= 1")
    if page_size < 1 or page_size > 200:
        raise HTTPException(status_code=422, detail="page_size must be between 1 and 200")
    if sort_dir not in {"asc", "desc"}:
        raise HTTPException(status_code=422, detail="sort_dir must be asc or desc")

    row = get_dataset_record(dataset_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    csv_path = Path(row["csv_path"])
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Dataset file missing")

    fieldnames, rows = _load_rows(csv_path)
    filtered: list[dict[str, object | None]] = []
    for item in rows:
        if not _search_match(item, search):
            continue
        if filter_column:
            if filter_column not in fieldnames:
                raise HTTPException(status_code=422, detail=f"Unknown filter_column: {filter_column}")
            target = item.get(filter_column)
            if not _missing_match(target, missing_only):
                continue
            if filter_value and target is not None and filter_value.lower() not in str(target).lower():
                continue
            if numeric_min is not None or numeric_max is not None:
                num = _typed_number(target)
                if num is None:
                    continue
                if numeric_min is not None and num < numeric_min:
                    continue
                if numeric_max is not None and num > numeric_max:
                    continue
        filtered.append(item)

    if sort_by:
        if sort_by not in fieldnames:
            raise HTTPException(status_code=422, detail=f"Unknown sort_by column: {sort_by}")

        def sort_key(item: dict[str, object | None]) -> tuple[int, object]:
            value = item.get(sort_by)
            if value is None:
                return (1, "")
            numeric_value = _typed_number(value)
            if numeric_value is not None:
                return (0, numeric_value)
            return (0, str(value).lower())

        filtered.sort(key=sort_key, reverse=(sort_dir == "desc"))

    total_rows = len(filtered)
    total_pages = max(1, math.ceil(total_rows / page_size))
    start = (page - 1) * page_size
    end = start + page_size
    page_rows = filtered[start:end]

    return PaginatedRowsResponse(
        dataset_id=dataset_id,
        page=page,
        page_size=page_size,
        total_rows=total_rows,
        total_pages=total_pages,
        rows=page_rows,
    )


@app.get("/api/datasets/{dataset_id}/profile", response_model=DatasetProfileResponse)
def get_dataset_profile(dataset_id: str) -> DatasetProfileResponse:
    row = get_dataset_record(dataset_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    csv_path = Path(row["csv_path"])
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Dataset file missing")

    fieldnames, rows = _load_rows(csv_path)
    columns_map: dict[str, list[object | None]] = {name: [] for name in fieldnames}
    row_seen: set[tuple[object | None, ...]] = set()
    duplicate_rows = 0
    missing_cells = 0

    for item in rows:
        row_tuple = _to_hashable_row(item, fieldnames)
        if row_tuple in row_seen:
            duplicate_rows += 1
        else:
            row_seen.add(row_tuple)

        for col in fieldnames:
            value = item.get(col)
            columns_map[col].append(value)
            if value is None:
                missing_cells += 1

    numeric_columns: list[str] = []
    categorical_columns: list[str] = []
    outlier_counts: dict[str, int] = {}
    numeric_stats: dict[str, NumericStats] = {}

    for col, values in columns_map.items():
        nums = [_typed_number(v) for v in values]
        numeric_values = [v for v in nums if v is not None]
        if len(numeric_values) == 0:
            categorical_columns.append(col)
            continue

        numeric_columns.append(col)
        outlier_counts[col] = _count_outliers(numeric_values)
        if len(numeric_values) == 1:
            std_dev = 0.0
        else:
            std_dev = float(statistics.stdev(numeric_values))
        numeric_stats[col] = NumericStats(
            count=len(numeric_values),
            mean=round(float(statistics.mean(numeric_values)), 4),
            median=round(float(statistics.median(numeric_values)), 4),
            min=round(float(min(numeric_values)), 4),
            max=round(float(max(numeric_values)), 4),
            std_dev=round(std_dev, 4),
        )

    return DatasetProfileResponse(
        dataset_id=dataset_id,
        rows=len(rows),
        columns=len(fieldnames),
        missing_cells=missing_cells,
        duplicate_rows=duplicate_rows,
        numeric_columns=numeric_columns,
        categorical_columns=categorical_columns,
        outlier_counts=outlier_counts,
        numeric_stats=numeric_stats,
    )


@app.get("/api/datasets/{dataset_id}/download")
def download_dataset(dataset_id: str) -> FileResponse:
    row = get_dataset_record(dataset_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    csv_path = Path(row["csv_path"])
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Dataset file missing")

    return FileResponse(path=csv_path, media_type="text/csv", filename=f"{row['dataset_name']}_{dataset_id}.csv")


@app.delete("/api/datasets/{dataset_id}")
def reset_dataset(dataset_id: str) -> dict[str, str]:
    row = get_dataset_record(dataset_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    csv_path = Path(row["csv_path"])
    if csv_path.exists():
        csv_path.unlink()

    delete_dataset_record(dataset_id)
    return {"status": "deleted"}


@app.get("/", include_in_schema=False, response_model=None)
def serve_root() -> FileResponse | JSONResponse:
    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return JSONResponse(
        status_code=200,
        content={
            "message": "DataScience Lab API is running.",
            "hint": "Build frontend/dist to serve UI from this backend root.",
        },
    )


@app.get("/{full_path:path}", include_in_schema=False, response_model=None)
def serve_spa_files(full_path: str) -> FileResponse | JSONResponse:
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    dist_root = FRONTEND_DIST_DIR.resolve()
    candidate_path = (dist_root / full_path).resolve()
    if candidate_path.exists() and candidate_path.is_file() and candidate_path.is_relative_to(dist_root):
        return FileResponse(candidate_path)

    index_file = dist_root / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    return JSONResponse(
        status_code=404,
        content={
            "detail": "Frontend build artifacts not found. Build frontend first.",
        },
    )
