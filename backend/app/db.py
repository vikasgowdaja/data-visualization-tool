import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .config import DB_PATH


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = _connect()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS datasets (
                dataset_id TEXT PRIMARY KEY,
                dataset_name TEXT NOT NULL,
                csv_path TEXT NOT NULL,
                rows_count INTEGER NOT NULL,
                columns_count INTEGER NOT NULL,
                difficulty TEXT NOT NULL,
                include_missing_values INTEGER NOT NULL,
                include_outliers INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS dataset_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_name TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                dataset_id TEXT NOT NULL,
                config_json TEXT NOT NULL,
                metrics_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(dataset_name, version_number)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS analysis_sessions (
                session_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                dataset_id TEXT,
                state_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS progress_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module TEXT NOT NULL,
                event_type TEXT NOT NULL,
                score REAL,
                metadata_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at DESC)")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_dataset_versions_name_version ON dataset_versions(dataset_name, version_number DESC)"
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_progress_events_module ON progress_events(module)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS student_assignments (
                usn TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                task_id TEXT NOT NULL,
                assigned_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS assignment_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "INSERT OR IGNORE INTO assignment_settings (key, value, updated_at) VALUES (?, ?, ?)",
            ("assignment_mode", "self-assign", datetime.now(tz=timezone.utc).isoformat()),
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_student_assignments_task_id ON student_assignments(task_id)")
        conn.commit()
    finally:
        conn.close()


def save_dataset_record(
    dataset_id: str,
    dataset_name: str,
    csv_path: Path,
    rows_count: int,
    columns_count: int,
    difficulty: str,
    include_missing_values: bool,
    include_outliers: bool,
) -> None:
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO datasets (
                dataset_id,
                dataset_name,
                csv_path,
                rows_count,
                columns_count,
                difficulty,
                include_missing_values,
                include_outliers,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dataset_id,
                dataset_name,
                str(csv_path),
                rows_count,
                columns_count,
                difficulty,
                int(include_missing_values),
                int(include_outliers),
                datetime.now(tz=timezone.utc).isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_dataset_record(dataset_id: str) -> sqlite3.Row | None:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT * FROM datasets WHERE dataset_id = ?", (dataset_id,)
        ).fetchone()
        return row
    finally:
        conn.close()


def delete_dataset_record(dataset_id: str) -> None:
    conn = _connect()
    try:
        conn.execute("DELETE FROM datasets WHERE dataset_id = ?", (dataset_id,))
        conn.commit()
    finally:
        conn.close()


def list_dataset_records(limit: int = 20) -> list[sqlite3.Row]:
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT *
            FROM datasets
            ORDER BY datetime(created_at) DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return rows
    finally:
        conn.close()


def get_next_dataset_version(dataset_name: str) -> int:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT COALESCE(MAX(version_number), 0) AS max_version FROM dataset_versions WHERE dataset_name = ?",
            (dataset_name,),
        ).fetchone()
        return int(row["max_version"]) + 1
    finally:
        conn.close()


def save_dataset_version(
    dataset_name: str,
    version_number: int,
    dataset_id: str,
    config_json: str,
    metrics_json: str,
) -> None:
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO dataset_versions (
                dataset_name,
                version_number,
                dataset_id,
                config_json,
                metrics_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                dataset_name,
                version_number,
                dataset_id,
                config_json,
                metrics_json,
                datetime.now(tz=timezone.utc).isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def list_dataset_versions(dataset_name: str, limit: int = 20) -> list[sqlite3.Row]:
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT dataset_name, version_number, dataset_id, config_json, metrics_json, created_at
            FROM dataset_versions
            WHERE dataset_name = ?
            ORDER BY version_number DESC
            LIMIT ?
            """,
            (dataset_name, limit),
        ).fetchall()
        return rows
    finally:
        conn.close()


def create_analysis_session(session_id: str, name: str, dataset_id: str | None, state_json: str) -> None:
    now = datetime.now(tz=timezone.utc).isoformat()
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO analysis_sessions (session_id, name, dataset_id, state_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (session_id, name, dataset_id, state_json, now, now),
        )
        conn.commit()
    finally:
        conn.close()


def update_analysis_session(session_id: str, name: str, dataset_id: str | None, state_json: str) -> bool:
    conn = _connect()
    try:
        result = conn.execute(
            """
            UPDATE analysis_sessions
            SET name = ?, dataset_id = ?, state_json = ?, updated_at = ?
            WHERE session_id = ?
            """,
            (name, dataset_id, state_json, datetime.now(tz=timezone.utc).isoformat(), session_id),
        )
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()


def list_analysis_sessions(limit: int = 50) -> list[sqlite3.Row]:
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT session_id, name, dataset_id, state_json, created_at, updated_at
            FROM analysis_sessions
            ORDER BY datetime(updated_at) DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return rows
    finally:
        conn.close()


def get_analysis_session(session_id: str) -> sqlite3.Row | None:
    conn = _connect()
    try:
        row = conn.execute(
            """
            SELECT session_id, name, dataset_id, state_json, created_at, updated_at
            FROM analysis_sessions
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()
        return row
    finally:
        conn.close()


def delete_analysis_session(session_id: str) -> bool:
    conn = _connect()
    try:
        result = conn.execute("DELETE FROM analysis_sessions WHERE session_id = ?", (session_id,))
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()


def log_progress_event(module: str, event_type: str, score: float | None, metadata_json: str) -> None:
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO progress_events (module, event_type, score, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (module, event_type, score, metadata_json, datetime.now(tz=timezone.utc).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()


def summarize_progress_events() -> list[sqlite3.Row]:
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT module, COUNT(*) AS event_count
            FROM progress_events
            GROUP BY module
            ORDER BY event_count DESC
            """
        ).fetchall()
        return rows
    finally:
        conn.close()


def list_student_assignments() -> list[sqlite3.Row]:
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT name, usn, task_id, assigned_at
            FROM student_assignments
            ORDER BY usn ASC
            """
        ).fetchall()
        return rows
    finally:
        conn.close()


def get_student_assignment_by_usn(usn: str) -> sqlite3.Row | None:
    conn = _connect()
    try:
        row = conn.execute(
            """
            SELECT name, usn, task_id, assigned_at
            FROM student_assignments
            WHERE usn = ?
            """,
            (usn,),
        ).fetchone()
        return row
    finally:
        conn.close()


def create_student_assignment(name: str, usn: str, task_id: str) -> sqlite3.Row:
    now = datetime.now(tz=timezone.utc).isoformat()
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO student_assignments (name, usn, task_id, assigned_at)
            VALUES (?, ?, ?, ?)
            """,
            (name, usn, task_id, now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT name, usn, task_id, assigned_at FROM student_assignments WHERE usn = ?",
            (usn,),
        ).fetchone()
        if row is None:
            raise RuntimeError("Failed to load created student assignment")
        return row
    finally:
        conn.close()


def update_student_assignment_task(usn: str, task_id: str) -> sqlite3.Row | None:
    conn = _connect()
    try:
        result = conn.execute(
            "UPDATE student_assignments SET task_id = ? WHERE usn = ?",
            (task_id, usn),
        )
        if result.rowcount <= 0:
            conn.commit()
            return None
        conn.commit()
        row = conn.execute(
            "SELECT name, usn, task_id, assigned_at FROM student_assignments WHERE usn = ?",
            (usn,),
        ).fetchone()
        return row
    finally:
        conn.close()


def get_assignment_mode() -> str:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT value FROM assignment_settings WHERE key = ?",
            ("assignment_mode",),
        ).fetchone()
        if row is None:
            return "self-assign"
        return str(row["value"])
    finally:
        conn.close()


def set_assignment_mode(mode: str) -> None:
    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO assignment_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            ("assignment_mode", mode, datetime.now(tz=timezone.utc).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()
