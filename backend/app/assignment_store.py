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


def init_assignment_store() -> None:
    assignments = _assignments_collection()
    settings = _settings_collection()

    assignments.create_index("usn", unique=True)
    assignments.create_index("task_id")
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
    return _normalize_row(doc)


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
