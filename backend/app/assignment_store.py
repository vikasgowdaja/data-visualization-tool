from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from pymongo import MongoClient, ReturnDocument
from pymongo.collection import Collection
from pymongo.database import Database

from .config import (
    MONGODB_ASSIGNMENTS_COLLECTION,
    MONGODB_DB_NAME,
    MONGODB_SETTINGS_COLLECTION,
    MONGODB_STUDENTS_COLLECTION,
    MONGODB_URI,
    STUDENT_PASSWORD_SECRET,
)


@lru_cache(maxsize=1)
def _get_client() -> MongoClient:
    if not MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not configured")
    return MongoClient(MONGODB_URI)


def _get_db() -> Database:
    return _get_client()[MONGODB_DB_NAME]


def _assignments_collection() -> Collection:
    return _get_db()[MONGODB_ASSIGNMENTS_COLLECTION]


def _settings_collection() -> Collection:
    return _get_db()[MONGODB_SETTINGS_COLLECTION]


def _students_collection() -> Collection:
    return _get_db()[MONGODB_STUDENTS_COLLECTION]


def init_assignment_store() -> None:
    assignments = _assignments_collection()
    settings = _settings_collection()
    students = _students_collection()

    assignments.create_index("usn", unique=True)
    assignments.create_index("task_id")
    students.create_index("usn", unique=True)
    students.create_index("name")
    settings.update_one(
        {"_id": "assignment_mode"},
        {
            "$setOnInsert": {
                "value": "self-assign",
                "updated_at": datetime.now(tz=timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )


def _normalize_row(doc: dict[str, Any]) -> dict[str, str]:
    return {
        "name": str(doc.get("name", "")),
        "usn": str(doc.get("usn", "")),
        "task_id": str(doc.get("task_id", "")),
        "assigned_at": str(doc.get("assigned_at", "")),
    }


def upsert_assignment_record_mongo(name: str, usn: str, task_id: str, assigned_at: str) -> dict[str, str]:
    doc = _assignments_collection().find_one_and_update(
        {"usn": usn},
        {
            "$set": {
                "name": name,
                "task_id": task_id,
                "assigned_at": assigned_at,
            }
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0, "name": 1, "usn": 1, "task_id": 1, "assigned_at": 1},
    )
    if doc is None:
        raise RuntimeError("Failed to upsert assignment record")
    return _normalize_row(doc)


def _normalize_student(doc: dict[str, Any]) -> dict[str, str]:
    return {
        "name": str(doc.get("name", "")),
        "usn": str(doc.get("usn", "")),
        "task_id": str(doc.get("task_id", "")),
        "assigned_at": str(doc.get("assigned_at", "")),
        "updated_at": str(doc.get("updated_at", "")),
        "password_must_change": bool(doc.get("password_must_change", True)),
        "task_locked": bool(doc.get("task_locked", False)),
    }


def _hash_student_password(usn: str, password: str) -> str:
    raw = f"{STUDENT_PASSWORD_SECRET}|{usn.strip().upper()}|{password}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _default_student_password(usn: str) -> str:
    return usn.strip().upper()


def _normalize_student_auth(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": str(doc.get("name", "")),
        "usn": str(doc.get("usn", "")),
        "task_id": str(doc.get("task_id", "")),
        "assigned_at": str(doc.get("assigned_at", "")),
        "password_hash": str(doc.get("password_hash", "")),
        "password_must_change": bool(doc.get("password_must_change", True)),
        "task_locked": bool(doc.get("task_locked", False)),
    }


def upsert_student_record_mongo(name: str, usn: str, task_id: str, assigned_at: str) -> dict[str, str]:
    now = datetime.now(tz=timezone.utc).isoformat()
    normalized_usn = usn.strip().upper()
    doc = _students_collection().find_one_and_update(
        {"usn": normalized_usn},
        {
            "$set": {
                "name": name,
                "task_id": task_id,
                "assigned_at": assigned_at,
                "updated_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
                "password_hash": _hash_student_password(normalized_usn, _default_student_password(normalized_usn)),
                "password_must_change": True,
                "task_locked": False,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0, "name": 1, "usn": 1, "task_id": 1, "assigned_at": 1, "updated_at": 1, "task_locked": 1},
    )
    if doc is None:
        raise RuntimeError("Failed to upsert student record")
    return _normalize_student(doc)


def get_student_auth_record_mongo(usn: str) -> dict[str, Any] | None:
    normalized_usn = usn.strip().upper()
    doc = _students_collection().find_one(
        {"usn": normalized_usn},
        {
            "_id": 0,
            "name": 1,
            "usn": 1,
            "task_id": 1,
            "assigned_at": 1,
            "password_hash": 1,
            "password_must_change": 1,
            "task_locked": 1,
        },
    )
    if doc is None:
        return None
    return _normalize_student_auth(doc)


def verify_student_password_mongo(usn: str, password: str) -> tuple[bool, bool]:
    record = get_student_auth_record_mongo(usn)
    normalized_usn = usn.strip().upper()
    if record is None:
        return (password.strip().upper() == _default_student_password(normalized_usn), True)

    expected_hash = str(record.get("password_hash", ""))
    if not expected_hash:
        expected_hash = _hash_student_password(normalized_usn, _default_student_password(normalized_usn))
    supplied_hash = _hash_student_password(normalized_usn, password)
    is_valid = hmac.compare_digest(expected_hash, supplied_hash)
    must_change = bool(record.get("password_must_change", True))
    return (is_valid, must_change)


def set_student_password_mongo(usn: str, new_password: str, force_must_change: bool = False) -> bool:
    normalized_usn = usn.strip().upper()
    result = _students_collection().update_one(
        {"usn": normalized_usn},
        {
            "$set": {
                "password_hash": _hash_student_password(normalized_usn, new_password),
                "password_must_change": force_must_change,
                "updated_at": datetime.now(tz=timezone.utc).isoformat(),
            }
        },
    )
    return result.matched_count > 0


def reset_student_password_to_default_mongo(usn: str) -> bool:
    normalized_usn = usn.strip().upper()
    return set_student_password_mongo(normalized_usn, _default_student_password(normalized_usn), force_must_change=True)


def update_student_name_mongo(usn: str, new_name: str) -> bool:
    normalized_usn = usn.strip().upper()
    cleaned_name = new_name.strip()
    if not cleaned_name:
        return False

    now = datetime.now(tz=timezone.utc).isoformat()
    student_result = _students_collection().update_one(
        {"usn": normalized_usn},
        {
            "$set": {
                "name": cleaned_name,
                "updated_at": now,
            }
        },
    )
    _assignments_collection().update_one(
        {"usn": normalized_usn},
        {
            "$set": {
                "name": cleaned_name,
            }
        },
    )
    return student_result.matched_count > 0


def list_students_mongo() -> list[dict[str, str]]:
    cursor = _students_collection().find(
        {},
        {
            "_id": 0,
            "name": 1,
            "usn": 1,
            "task_id": 1,
            "assigned_at": 1,
            "updated_at": 1,
            "password_must_change": 1,
            "task_locked": 1,
        },
    ).sort("usn", 1)
    return [_normalize_student(doc) for doc in cursor]


def get_student_by_usn_mongo(usn: str) -> dict[str, str] | None:
    doc = _students_collection().find_one(
        {"usn": usn},
        {
            "_id": 0,
            "name": 1,
            "usn": 1,
            "task_id": 1,
            "assigned_at": 1,
            "updated_at": 1,
            "password_must_change": 1,
            "task_locked": 1,
        },
    )
    if doc is None:
        return None
    return _normalize_student(doc)


def seed_students_from_rows_mongo(rows: list[dict[str, str]]) -> dict[str, int]:
    synced_students = 0
    synced_assignments = 0
    for row in rows:
        upsert_assignment_record_mongo(
            name=row["name"],
            usn=row["usn"],
            task_id=row["task_id"],
            assigned_at=row["assigned_at"],
        )
        synced_assignments += 1

        upsert_student_record_mongo(
            name=row["name"],
            usn=row["usn"],
            task_id=row["task_id"],
            assigned_at=row["assigned_at"],
        )
        synced_students += 1

    return {
        "seeded": synced_students,
        "students_synced": synced_students,
        "assignments_synced": synced_assignments,
    }


def list_student_assignments_mongo() -> list[dict[str, str]]:
    cursor = _assignments_collection().find({}, {"_id": 0, "name": 1, "usn": 1, "task_id": 1, "assigned_at": 1}).sort("usn", 1)
    return [_normalize_row(doc) for doc in cursor]


def get_student_assignment_by_usn_mongo(usn: str) -> dict[str, str] | None:
    doc = _assignments_collection().find_one(
        {"usn": usn},
        {"_id": 0, "name": 1, "usn": 1, "task_id": 1, "assigned_at": 1},
    )
    if doc is None:
        return None
    return _normalize_row(doc)


def create_student_assignment_mongo(name: str, usn: str, task_id: str) -> dict[str, str]:
    assigned_at = datetime.now(tz=timezone.utc).isoformat()
    assignment = upsert_assignment_record_mongo(name=name, usn=usn, task_id=task_id, assigned_at=assigned_at)
    upsert_student_record_mongo(name=name, usn=usn, task_id=task_id, assigned_at=assignment["assigned_at"])
    return assignment


def update_student_assignment_task_mongo(usn: str, task_id: str) -> dict[str, str] | None:
    doc = _assignments_collection().find_one_and_update(
        {"usn": usn},
        {
            "$set": {
                "task_id": task_id,
            }
        },
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0, "name": 1, "usn": 1, "task_id": 1, "assigned_at": 1},
    )
    if doc is None:
        return None
    normalized = _normalize_row(doc)
    upsert_student_record_mongo(
        name=normalized["name"],
        usn=normalized["usn"],
        task_id=normalized["task_id"],
        assigned_at=normalized["assigned_at"],
    )
    return normalized


def set_student_task_control_mongo(usn: str, task_id: str, lock_task: bool) -> dict[str, Any] | None:
    normalized_usn = usn.strip().upper()
    now = datetime.now(tz=timezone.utc).isoformat()

    assignment_doc = _assignments_collection().find_one_and_update(
        {"usn": normalized_usn},
        {
            "$set": {
                "task_id": task_id,
            }
        },
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0, "name": 1, "usn": 1, "task_id": 1, "assigned_at": 1},
    )
    if assignment_doc is None:
        return None

    student_doc = _students_collection().find_one_and_update(
        {"usn": normalized_usn},
        {
            "$set": {
                "task_id": task_id,
                "task_locked": lock_task,
                "updated_at": now,
            }
        },
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0, "usn": 1, "task_id": 1, "task_locked": 1},
    )
    if student_doc is None:
        return None
    return {
        "usn": str(student_doc.get("usn", normalized_usn)),
        "task_id": str(student_doc.get("task_id", task_id)),
        "task_locked": bool(student_doc.get("task_locked", lock_task)),
    }


def get_assignment_mode_mongo() -> str:
    doc = _settings_collection().find_one({"_id": "assignment_mode"}, {"_id": 0, "value": 1})
    if doc is None:
        return "self-assign"
    value = str(doc.get("value", "self-assign"))
    return value if value in {"self-assign", "mentor-only"} else "self-assign"


def set_assignment_mode_mongo(mode: str) -> None:
    _settings_collection().update_one(
        {"_id": "assignment_mode"},
        {
            "$set": {
                "value": mode,
                "updated_at": datetime.now(tz=timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
