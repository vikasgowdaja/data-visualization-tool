from typing import Literal

from pydantic import BaseModel, Field


class DatasetGenerateRequest(BaseModel):
    dataset: Literal[
        "student_performance",
        "house_prices",
        "customer_churn",
        "movie_success",
        "retail_sales",
        "environmental_data",
    ] = "student_performance"
    num_records: int = Field(default=500, ge=100, le=5000)
    include_missing_values: bool = True
    include_outliers: bool = True
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"
    missing_value_percentage: float = Field(default=0.0, ge=0.0, le=50.0)
    outlier_percentage: float = Field(default=0.0, ge=0.0, le=30.0)
    noise_level: float = Field(default=1.0, ge=0.5, le=3.0)
    random_seed: int | None = None


class DatasetSummaryResponse(BaseModel):
    dataset_id: str
    dataset_name: str
    rows: int
    columns: int
    target_suggestion: str
    difficulty: str
    column_descriptions: dict[str, str]
    data_types: dict[str, str]
    missing_summary: dict[str, int]
    preview: list[dict]
    suggested_questions: list[str]


class DatasetRecordResponse(BaseModel):
    dataset_id: str
    dataset_name: str
    rows_count: int
    columns_count: int
    difficulty: str
    include_missing_values: bool
    include_outliers: bool
    created_at: str


class PaginatedRowsResponse(BaseModel):
    dataset_id: str
    page: int
    page_size: int
    total_rows: int
    total_pages: int
    rows: list[dict]


class NumericStats(BaseModel):
    count: int
    mean: float
    median: float
    min: float
    max: float
    std_dev: float


class DatasetProfileResponse(BaseModel):
    dataset_id: str
    rows: int
    columns: int
    missing_cells: int
    duplicate_rows: int
    numeric_columns: list[str]
    categorical_columns: list[str]
    outlier_counts: dict[str, int]
    numeric_stats: dict[str, NumericStats]


class DatasetVersionResponse(BaseModel):
    dataset_name: str
    version_number: int
    dataset_id: str
    config_json: str
    metrics_json: str
    created_at: str


class SessionCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    dataset_id: str | None = None
    state_json: str = Field(default="{}")


class SessionUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    dataset_id: str | None = None
    state_json: str = Field(default="{}")


class SessionResponse(BaseModel):
    session_id: str
    name: str
    dataset_id: str | None
    state_json: str
    created_at: str
    updated_at: str


class ProgressEventRequest(BaseModel):
    module: str = Field(min_length=1, max_length=80)
    event_type: str = Field(min_length=1, max_length=80)
    score: float | None = None
    metadata_json: str = Field(default="{}")


class ProgressSummaryResponse(BaseModel):
    total_events: int
    by_module: dict[str, int]


class StudentAssignmentResponse(BaseModel):
    name: str
    usn: str
    task_id: str
    assigned_at: str


class StudentAssignRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    usn: str = Field(min_length=1, max_length=60)


class StudentAssignResult(BaseModel):
    status: Literal["created", "duplicate"]
    assignment: StudentAssignmentResponse


class StudentLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=60)
    cached_task_id: str | None = Field(default=None, max_length=20)


class StudentLoginResponse(BaseModel):
    usn: str
    assignment_found: bool
    assignment: StudentAssignmentResponse | None = None
    recovered_task_id: str | None = None
    must_change_password: bool = False
    profile_name: str | None = None
    message: str


class StudentRecoverAssignmentRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=60)
    task_id: str = Field(min_length=1, max_length=20)
    name: str | None = Field(default=None, max_length=120)
    cached_task_id: str | None = Field(default=None, max_length=20)


class StudentRecoverAssignmentResponse(BaseModel):
    status: Literal["saved", "matched-cache"]
    matched_cached_task: bool
    assignment: StudentAssignmentResponse


class StudentChangePasswordRequest(BaseModel):
    usn: str = Field(min_length=1, max_length=60)
    current_password: str = Field(min_length=1, max_length=120)
    new_password: str = Field(min_length=6, max_length=120)


class StudentChangePasswordResponse(BaseModel):
    usn: str
    password_changed: bool


class StudentUpdateProfileRequest(BaseModel):
    usn: str = Field(min_length=1, max_length=60)
    current_password: str = Field(min_length=1, max_length=120)
    new_name: str | None = Field(default=None, max_length=120)
    new_password: str | None = Field(default=None, max_length=120)


class StudentUpdateProfileResponse(BaseModel):
    usn: str
    name: str
    name_changed: bool
    password_changed: bool


class AdminResetStudentPasswordResponse(BaseModel):
    usn: str
    reset_to_default: bool


class StudentReassignRequest(BaseModel):
    task_id: str = Field(min_length=1, max_length=20)


class AssignmentModeResponse(BaseModel):
    mode: Literal["self-assign", "mentor-only"]


class AssignmentModeUpdateRequest(BaseModel):
    mode: Literal["self-assign", "mentor-only"]


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=120)


class AdminLoginResponse(BaseModel):
    token: str
    expires_at: str


class AdminSessionResponse(BaseModel):
    username: str
    is_admin: bool
    expires_at: str


class StudentRecordResponse(BaseModel):
    name: str
    usn: str
    task_id: str
    assigned_at: str
    updated_at: str
    password_must_change: bool
    task_locked: bool


class StudentTaskControlRequest(BaseModel):
    task_id: str = Field(min_length=1, max_length=20)
    lock_task: bool = False


class StudentTaskControlResponse(BaseModel):
    usn: str
    task_id: str
    task_locked: bool


class SeedStudentsResponse(BaseModel):
    seeded: int
    students_synced: int = 0
    assignments_synced: int = 0
