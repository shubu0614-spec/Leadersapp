"""Pydantic models for the Student Leadership Management System."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime, timezone
import uuid


def _uid() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


AttendanceSession = Literal["break1", "break2", "assembly"]
AttendanceStatus = Literal["present", "late", "absent", "pending"]
UserRole = Literal["super_admin", "admin", "leader"]
AttendanceMode = Literal["manual", "qr", "hybrid"]
LeaveStatus = Literal["pending", "approved", "rejected", "cancelled"]
InspectionStatus = Literal["pending", "completed", "cancelled"]
Priority = Literal["normal", "important", "urgent"]


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    leader_id: str  # unique login ID (e.g., "L-001", "admin")
    pin_hash: Optional[str] = None
    name: str
    role: UserRole = "leader"
    position: Optional[str] = None
    department: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    photo_base64: Optional[str] = None  # data URL
    status: Literal["active", "inactive"] = "active"
    force_pin_change: bool = False
    permissions: List[str] = Field(default_factory=list)
    qr_token: str = Field(default_factory=_uid)  # unique QR content
    points: int = 0
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class LoginRequest(BaseModel):
    leader_id: str
    pin: str


class AttendanceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    leader_id: str
    leader_name: str
    session: AttendanceSession
    status: AttendanceStatus
    date: str  # YYYY-MM-DD
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    scan_time: Optional[str] = None  # kept for compatibility
    marked_by: str  # user leader_id
    method: Literal["manual", "qr"] = "manual"
    duty_place: Optional[str] = None
    is_replacement: bool = False
    replacing_leader_id: Optional[str] = None
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class DutySchedule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    week_start: str  # YYYY-MM-DD (Monday)
    week_end: str
    # assignments: list of {leader_id, leader_name, day (0-6), session, duty_place}
    assignments: list = Field(default_factory=list)
    uploaded_by: str
    created_at: str = Field(default_factory=_now)


class Holiday(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    date: str
    reason: Optional[str] = ""
    marked_by: str
    created_at: str = Field(default_factory=_now)


class InspectionReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    inspection_date: str
    area: str
    findings: str
    actions_taken: Optional[str] = ""
    remarks: Optional[str] = ""
    status: Literal["draft", "submitted", "locked"] = "draft"
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=_now)


class LeaveRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    leader_id: str
    leader_name: str
    leave_type: str
    reason: str
    start_date: str
    end_date: str
    description: Optional[str] = ""
    attachment_base64: Optional[str] = None
    is_emergency: bool = False
    status: LeaveStatus = "pending"
    remarks: Optional[str] = ""
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str = Field(default_factory=_now)


class WeeklyReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    leader_id: str
    leader_name: str
    week_start: str
    week_end: str
    total_duties_assigned: int
    total_duties_attended: int
    total_duties_missed: int
    challenges: Optional[str] = ""
    suggestions: Optional[str] = ""
    self_evaluation: int  # 1-5
    remarks: Optional[str] = ""
    created_at: str = Field(default_factory=_now)


class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    name: str
    description: Optional[str] = ""
    venue: Optional[str] = ""
    date: str
    time: str
    instructions: Optional[str] = ""
    created_by: str
    created_at: str = Field(default_factory=_now)


class Inspection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    title: str
    date: str
    time: str
    location: str
    inspection_type: str
    description: Optional[str] = ""
    remarks: Optional[str] = ""
    status: InspectionStatus = "pending"
    created_by: str
    created_at: str = Field(default_factory=_now)


class RewardPenalty(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    leader_id: str
    leader_name: str
    points: int  # positive = reward, negative = penalty
    reason: str
    given_by: str  # leader_id of super admin
    given_by_name: str
    date: str
    time: str
    created_at: str = Field(default_factory=_now)


class Announcement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    title: str
    message: str
    priority: Priority = "normal"
    attachment_base64: Optional[str] = None
    publish_date: str
    expiry_date: Optional[str] = None
    created_by: str
    created_at: str = Field(default_factory=_now)
    read_by: List[dict] = Field(default_factory=list)
    # read_by items: {leader_id, leader_name, date, time}


class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    user_leader_id: str  # recipient
    type: str
    title: str
    message: str
    read: bool = False
    created_at: str = Field(default_factory=_now)


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "singleton"
    # School
    school_name: str = "My School"
    school_logo_base64: Optional[str] = None
    school_address: str = ""
    principal_name: str = ""
    leadership_coordinator: str = ""
    academic_year: str = ""
    contact_number: str = ""
    email: str = ""
    # Attendance
    attendance_mode: AttendanceMode = "manual"
    # Leave
    max_leave_limit: int = 12
    emergency_leave_enabled: bool = True
    leave_submission_window_days: int = 30
    leave_approval_required: bool = True
    # Weekly Report
    weekly_report_open_day: str = "Monday"
    weekly_report_close_day: str = "Friday"
    weekly_report_deadline_time: str = "23:59"
    weekly_report_late_permission: bool = False
    weekly_report_pdf_logo: bool = True
    # Duty assignment
    duty_assignment_enabled: bool = False
    # Inspection
    inspection_mode: Literal["automatic", "manual"] = "manual"
    inspection_manual_date: Optional[str] = None
    # Signatures
    principal_signature_base64: Optional[str] = None
    coordinator_signature_base64: Optional[str] = None
    # Notifications
    notif_leave: bool = True
    notif_report: bool = True
    notif_event: bool = True
    notif_announcement: bool = True
    notif_system: bool = True
    # Module Controls
    mod_leave: bool = True
    mod_reports: bool = True
    mod_events: bool = True
    mod_inspections: bool = True
    mod_rewards: bool = True
    mod_announcements: bool = True
    mod_id_cards: bool = True
    mod_qr_attendance: bool = True
    mod_notifications: bool = True
    # Appearance
    dashboard_welcome: str = "Welcome to the Leadership Portal"
    school_theme: str = "dark_blue"
    app_theme: str = "dark_blue"
    show_school_logo: bool = True
    updated_at: str = Field(default_factory=_now)
