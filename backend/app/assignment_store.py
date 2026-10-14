from __future__ import annotations

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


def _normalize_student(doc: dict[str, Any]) -> dict[str, str]:
    return {
        "name": str(doc.get("name", "")),
        "usn": str(doc.get("usn", "")),
        "task_id": str(doc.get("task_id", "")),
        "assigned_at": str(doc.get("assigned_at", "")),
        "updated_at": str(doc.get("updated_at", "")),
    }


def upsert_student_record_mongo(name: str, usn: str, task_id: str, assigned_at: str) -> dict[str, str]:
    now = datetime.now(tz=timezone.utc).isoformat()
    doc = _students_collection().find_one_and_update(
        {"usn": usn},
        {
            "$set": {
                "name": name,
                "task_id": task_id,
                "assigned_at": assigned_at,
                "updated_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0, "name": 1, "usn": 1, "task_id": 1, "assigned_at": 1, "updated_at": 1},
    )
    if doc is None:
        raise RuntimeError("Failed to upsert student record")
    return _normalize_student(doc)


def list_students_mongo() -> list[dict[str, str]]:
    cursor = _students_collection().find(
        {},
        {"_id": 0, "name": 1, "usn": 1, "task_id": 1, "assigned_at": 1, "updated_at": 1},
    ).sort("usn", 1)
    return [_normalize_student(doc) for doc in cursor]


def get_student_by_usn_mongo(usn: str) -> dict[str, str] | None:
    doc = _students_collection().find_one(
        {"usn": usn},
        {"_id": 0, "name": 1, "usn": 1, "task_id": 1, "assigned_at": 1, "updated_at": 1},
    )
    if doc is None:
        return None
    return _normalize_student(doc)


def seed_students_from_rows_mongo(rows: list[dict[str, str]]) -> dict[str, int]:
    inserted_or_updated = 0
    for row in rows:
        upsert_student_record_mongo(
            name=row["name"],
            usn=row["usn"],
            task_id=row["task_id"],
            assigned_at=row["assigned_at"],
        )
        inserted_or_updated += 1
    return {"seeded": inserted_or_updated}


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
    payload = {
        "name": name,
        "usn": usn,
        "task_id": task_id,
        "assigned_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    _assignments_collection().insert_one(payload)
    upsert_student_record_mongo(name=name, usn=usn, task_id=task_id, assigned_at=payload["assigned_at"])
    return _normalize_row(payload)


def update_student_assignment_task_mongo(usn: str, task_id: str) -> dict[str, str] | None:
    doc = _assignments_collection().find_one_and_update(
        {"usn": usn},
        {"$set": {"task_id": task_id}},
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
