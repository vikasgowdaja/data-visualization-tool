import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
GENERATED_DIR = DATA_DIR / "generated"


def _resolve_db_path() -> Path:
	data_uri = os.getenv("DATA_URI", "").strip()
	if data_uri:
		if data_uri.startswith("sqlite:///"):
			return Path(data_uri.removeprefix("sqlite:///"))
		return Path(data_uri)

	return Path(os.getenv("DB_PATH", str(DATA_DIR / "lab.db")))


DB_PATH = _resolve_db_path().resolve()
FRONTEND_DIST_DIR = Path(os.getenv("FRONTEND_DIST_DIR", str(REPO_ROOT / "frontend" / "dist"))).resolve()


def _split_csv_env(name: str, default: list[str]) -> list[str]:
	raw_value = os.getenv(name, "")
	if not raw_value.strip():
		return default
	return [value.strip() for value in raw_value.split(",") if value.strip()]


CORS_ALLOW_ORIGINS = _split_csv_env(
	"CORS_ALLOW_ORIGINS",
	["http://localhost:5173", "http://127.0.0.1:5173"],
)
CORS_ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "false").lower() == "true"

MONGODB_URI = os.getenv("MONGODB_URI", "").strip()
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "datascience_lab").strip() or "datascience_lab"
MONGODB_ASSIGNMENTS_COLLECTION = os.getenv("MONGODB_ASSIGNMENTS_COLLECTION", "student_assignments").strip() or "student_assignments"
MONGODB_SETTINGS_COLLECTION = os.getenv("MONGODB_SETTINGS_COLLECTION", "assignment_settings").strip() or "assignment_settings"
MONGODB_STUDENTS_COLLECTION = os.getenv("MONGODB_STUDENTS_COLLECTION", "students").strip() or "students"

GENERATED_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
