"""Student Leadership Management System - FastAPI Backend."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import FastAPI, APIRouter, HTTPException, Response, Depends, Query, Request
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from auth import (
    hash_pin, verify_pin, create_access_token, create_refresh_token,
    get_current_user, require_super_admin, require_admin_or_super, decode_token,
)
from models import (
    User, LoginRequest, AttendanceRecord, LeaveRequest, WeeklyReport, Event,
    Inspection, RewardPenalty, Announcement, Notification, Settings, _uid, _now,
    DutySchedule, Holiday, InspectionReport,
)
from pdf_utils import (
    generate_weekly_report_pdf, generate_id_card_pdf, generate_certificate_pdf,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Student Leadership MS")
api = APIRouter(prefix="/api")


# ============ STARTUP: indexes, seed admin, seed settings ============
@app.on_event("startup")
async def startup():
    await db.users.create_index("leader_id", unique=True)
    await db.users.create_index("qr_token", unique=True, sparse=True)
    await db.attendance.create_index([("leader_id", 1), ("session", 1), ("date", 1)], unique=True)
    await db.leaves.create_index("leader_id")
    await db.reports.create_index([("leader_id", 1), ("week_start", 1)])
    await db.events.create_index("date")
    await db.inspections.create_index("date")
    await db.rewards.create_index("leader_id")
    await db.announcements.create_index("publish_date")
    await db.notifications.create_index("user_leader_id")
    await db.login_attempts.create_index("identifier")
    await db.holidays.create_index("date", unique=True)
    await db.duty_schedules.create_index("week_start", unique=True)
    await db.inspection_reports.create_index("inspection_date")

    # Seed super admin
    admin_id = os.environ.get("ADMIN_LEADER_ID", "admin")
    admin_pin = os.environ.get("ADMIN_PIN", "2012")
    existing = await db.users.find_one({"leader_id": admin_id})
    if not existing:
        u = User(
            leader_id=admin_id,
            pin_hash=hash_pin(admin_pin),
            name="Super Administrator",
            role="super_admin",
            position="Super Administrator",
        )
        await db.users.insert_one(u.model_dump())
        logger.info(f"Seeded super admin: {admin_id}")
    elif not verify_pin(admin_pin, existing.get("pin_hash", "")):
        await db.users.update_one(
            {"leader_id": admin_id},
            {"$set": {"pin_hash": hash_pin(admin_pin), "role": "super_admin"}},
        )
        logger.info(f"Updated super admin PIN: {admin_id}")

    # Seed settings singleton
    if not await db.settings.find_one({"id": "singleton"}):
        s = Settings()
        await db.settings.insert_one(s.model_dump())


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ============ HELPERS ============
def clean(doc: dict) -> dict:
    if doc is None:
        return doc
    doc.pop("_id", None)
    doc.pop("pin_hash", None)
    return doc


def clean_list(docs: list) -> list:
    return [clean(d) for d in docs]


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "singleton"})
    if not s:
        s = Settings().model_dump()
        await db.settings.insert_one(s)
        s.pop("_id", None)
        return s
    s.pop("_id", None)
    # Backfill: merge defaults for any new fields added to the model over time
    defaults = Settings().model_dump()
    merged = {**defaults, **s}
    if merged != s:
        await db.settings.update_one({"id": "singleton"}, {"$set": merged})
    return merged


async def add_notification(user_leader_id: str, ntype: str, title: str, message: str):
    n = Notification(user_leader_id=user_leader_id, type=ntype, title=title, message=message)
    await db.notifications.insert_one(n.model_dump())


# ============ AUTH ROUTES ============
@api.post("/auth/login")
async def login(body: LoginRequest, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    ident = f"{ip}:{body.leader_id}"

    # Brute force check
    now = datetime.now(timezone.utc)
    rec = await db.login_attempts.find_one({"identifier": ident})
    if rec and rec.get("locked_until"):
        try:
            lu = datetime.fromisoformat(rec["locked_until"])
            if lu > now:
                raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
        except Exception:
            pass

    user = await db.users.find_one({"leader_id": body.leader_id})
    if not user or not verify_pin(body.pin, user.get("pin_hash", "")):
        # Increment
        attempts = (rec.get("attempts", 0) if rec else 0) + 1
        upd = {"attempts": attempts, "last_attempt": now.isoformat()}
        if attempts >= 5:
            upd["locked_until"] = (now + timedelta(minutes=15)).isoformat()
            upd["attempts"] = 0
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid Leader ID or PIN")

    await db.login_attempts.delete_one({"identifier": ident})

    access = create_access_token(user["id"], user["leader_id"], user["role"])
    refresh = create_refresh_token(user["id"])
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {
        "token": access,
        "user": {
            "id": user["id"], "leader_id": user["leader_id"], "name": user["name"],
            "role": user["role"], "position": user.get("position"),
            "force_pin_change": user.get("force_pin_change", False),
        },
    }


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


class ChangePinReq(BaseModel):
    old_pin: Optional[str] = None
    new_pin: str


@api.post("/auth/change-pin")
async def change_pin(body: ChangePinReq, user: dict = Depends(get_current_user)):
    if len(body.new_pin) != 4 or not body.new_pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be 4 digits")
    full = await db.users.find_one({"id": user["id"]})
    if not user.get("force_pin_change"):
        if not body.old_pin or not verify_pin(body.old_pin, full["pin_hash"]):
            raise HTTPException(status_code=400, detail="Invalid current PIN")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"pin_hash": hash_pin(body.new_pin), "force_pin_change": False, "updated_at": _now()}},
    )
    return {"ok": True}


# ============ LEADER MANAGEMENT ============
class LeaderCreate(BaseModel):
    leader_id: str
    name: str
    position: Optional[str] = ""
    department: Optional[str] = ""
    class_name: Optional[str] = ""
    section: Optional[str] = ""
    photo_base64: Optional[str] = None
    pin: str
    role: str = "leader"


class LeaderUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    photo_base64: Optional[str] = None
    status: Optional[str] = None
    permissions: Optional[List[str]] = None


@api.get("/leaders")
async def list_leaders(
    q: Optional[str] = None, position: Optional[str] = None, department: Optional[str] = None,
    status: Optional[str] = None, role: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {}
    if role:
        query["role"] = role
    if position:
        query["position"] = position
    if department:
        query["department"] = department
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"leader_id": {"$regex": q, "$options": "i"}},
        ]
    # Leaders can only see themselves in listing? Actually they might need to see co-leaders. Let super admin see all.
    docs = await db.users.find(query).to_list(1000)
    return clean_list(docs)


@api.post("/leaders")
async def create_leader(body: LeaderCreate, user: dict = Depends(require_super_admin)):
    if len(body.pin) != 4 or not body.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be 4 digits")
    if await db.users.find_one({"leader_id": body.leader_id}):
        raise HTTPException(status_code=409, detail="Leader ID already exists")
    u = User(
        leader_id=body.leader_id, name=body.name, position=body.position,
        department=body.department, class_name=body.class_name, section=body.section,
        photo_base64=body.photo_base64, pin_hash=hash_pin(body.pin), role=body.role,
    )
    await db.users.insert_one(u.model_dump())
    return clean(u.model_dump())


@api.get("/leaders/{leader_id}")
async def get_leader(leader_id: str, user: dict = Depends(get_current_user)):
    doc = await db.users.find_one({"leader_id": leader_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Leader not found")
    return clean(doc)


@api.put("/leaders/{leader_id}")
async def update_leader(leader_id: str, body: LeaderUpdate, user: dict = Depends(require_super_admin)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    upd["updated_at"] = _now()
    r = await db.users.update_one({"leader_id": leader_id}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    doc = await db.users.find_one({"leader_id": leader_id})
    return clean(doc)


@api.delete("/leaders/{leader_id}")
async def delete_leader(leader_id: str, user: dict = Depends(require_super_admin)):
    if leader_id == user["leader_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    r = await db.users.delete_one({"leader_id": leader_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    return {"ok": True}


class ResetPinReq(BaseModel):
    new_pin: str
    force_change: bool = True


@api.post("/leaders/{leader_id}/reset-pin")
async def reset_pin(leader_id: str, body: ResetPinReq, user: dict = Depends(require_super_admin)):
    if len(body.new_pin) != 4 or not body.new_pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be 4 digits")
    r = await db.users.update_one(
        {"leader_id": leader_id},
        {"$set": {"pin_hash": hash_pin(body.new_pin), "force_pin_change": body.force_change}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    return {"ok": True}


@api.post("/leaders/{leader_id}/regenerate-qr")
async def regen_qr(leader_id: str, user: dict = Depends(require_super_admin)):
    new_token = _uid()
    r = await db.users.update_one(
        {"leader_id": leader_id}, {"$set": {"qr_token": new_token, "updated_at": _now()}}
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    return {"qr_token": new_token}


# ============ ATTENDANCE ============
class AttendanceMark(BaseModel):
    leader_id: str
    session: str  # break1|break2|assembly
    status: str   # present|late|absent|pending
    date: Optional[str] = None  # YYYY-MM-DD


@api.get("/attendance")
async def get_attendance(
    session: str, date: str,
    user: dict = Depends(get_current_user),
):
    docs = await db.attendance.find({"session": session, "date": date}).to_list(2000)
    return clean_list(docs)


@api.post("/attendance/mark")
async def mark_attendance(body: AttendanceMark, user: dict = Depends(require_super_admin)):
    if body.session not in ("break1", "break2", "assembly"):
        raise HTTPException(status_code=400, detail="Invalid session")
    if body.status not in ("present", "late", "absent", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")
    leader = await db.users.find_one({"leader_id": body.leader_id})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    date = body.date or datetime.now(timezone.utc).date().isoformat()
    rec = AttendanceRecord(
        leader_id=body.leader_id, leader_name=leader["name"], session=body.session,
        status=body.status, date=date, marked_by=user["leader_id"], method="manual",
        scan_time=datetime.now(timezone.utc).isoformat(),
    )
    await db.attendance.update_one(
        {"leader_id": body.leader_id, "session": body.session, "date": date},
        {"$set": rec.model_dump()},
        upsert=True,
    )
    return clean(rec.model_dump())


class QRScanReq(BaseModel):
    qr_token: str
    session: str
    status: str = "present"
    action: str = "start"  # start | end


@api.post("/attendance/qr-scan")
async def qr_scan(body: QRScanReq, user: dict = Depends(require_super_admin)):
    settings = await get_settings()
    if settings.get("attendance_mode") == "manual":
        raise HTTPException(status_code=400, detail="QR attendance is disabled")
    if body.session not in ("break1", "break2", "assembly"):
        raise HTTPException(status_code=400, detail="Invalid session")
    leader = await db.users.find_one({"qr_token": body.qr_token})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found for this QR")
    date = datetime.now(timezone.utc).date().isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Session-independent: existing check is scoped by session+date+leader
    existing = await db.attendance.find_one({
        "leader_id": leader["leader_id"], "session": body.session, "date": date
    })

    # Duty place lookup
    duty_place = None
    is_replacement = False
    replacing = None
    if settings.get("duty_assignment_enabled"):
        # Find current week schedule
        today_date = datetime.now(timezone.utc).date()
        weekday = today_date.weekday()  # 0 = Monday
        schedule = await db.duty_schedules.find_one({
            "week_start": {"$lte": date}, "week_end": {"$gte": date}
        })
        if schedule:
            # First check replacement assignments in schedule (with is_replacement)
            rep = next((a for a in schedule.get("assignments", [])
                        if a.get("leader_id") == leader["leader_id"] and a.get("day") == weekday
                        and a.get("session") == body.session and a.get("is_replacement")), None)
            if rep:
                duty_place = rep.get("duty_place")
                is_replacement = True
                replacing = rep.get("replacing_leader_id")
            else:
                a = next((a for a in schedule.get("assignments", [])
                          if a.get("leader_id") == leader["leader_id"] and a.get("day") == weekday
                          and a.get("session") == body.session), None)
                if a:
                    duty_place = a.get("duty_place")

    # Head Boy / Head Girl auto message
    if not duty_place and (leader.get("position") or "").strip().lower() in ("head boy", "head girl"):
        duty_place = f"{leader.get('position')} - Monitoring Duty"

    if body.action == "end":
        # End duty updates end_time
        if not existing:
            raise HTTPException(status_code=400, detail="Start duty first")
        await db.attendance.update_one(
            {"leader_id": leader["leader_id"], "session": body.session, "date": date},
            {"$set": {"end_time": now_iso, "updated_at": now_iso}},
        )
        rec = await db.attendance.find_one({"leader_id": leader["leader_id"], "session": body.session, "date": date})
        return {"ok": True, "record": clean(rec), "leader": {"name": leader["name"], "leader_id": leader["leader_id"]}, "duty_place": duty_place}

    # start action
    if existing and existing.get("method") == "qr" and existing.get("start_time"):
        raise HTTPException(status_code=409, detail=f"Leader already scanned for this session ({body.session})")

    rec = AttendanceRecord(
        leader_id=leader["leader_id"], leader_name=leader["name"], session=body.session,
        status=body.status, date=date, marked_by=user["leader_id"], method="qr",
        scan_time=now_iso, start_time=now_iso,
        duty_place=duty_place, is_replacement=is_replacement, replacing_leader_id=replacing,
    )
    await db.attendance.update_one(
        {"leader_id": leader["leader_id"], "session": body.session, "date": date},
        {"$set": rec.model_dump()}, upsert=True,
    )

    # Replacement bonus: +10 points once per replacement duty
    if is_replacement:
        rp = RewardPenalty(
            leader_id=leader["leader_id"], leader_name=leader["name"], points=10,
            reason="Replacement Duty Bonus", given_by=user["leader_id"], given_by_name=user["name"],
            date=datetime.now(timezone.utc).date().isoformat(),
            time=datetime.now(timezone.utc).strftime("%H:%M:%S"),
        )
        await db.rewards.insert_one(rp.model_dump())
        await db.users.update_one({"leader_id": leader["leader_id"]}, {"$inc": {"points": 10}})

    return {
        "ok": True,
        "record": clean(rec.model_dump()),
        "leader": {"name": leader["name"], "leader_id": leader["leader_id"], "position": leader.get("position")},
        "duty_place": duty_place,
        "is_replacement": is_replacement,
        "replacing": replacing,
    }


@api.get("/attendance/summary/{leader_id}")
async def attendance_summary(leader_id: str, user: dict = Depends(get_current_user)):
    docs = await db.attendance.find({"leader_id": leader_id}).to_list(5000)
    total = len(docs)
    present = sum(1 for d in docs if d["status"] == "present")
    late = sum(1 for d in docs if d["status"] == "late")
    absent = sum(1 for d in docs if d["status"] == "absent")
    pending = sum(1 for d in docs if d["status"] == "pending")
    return {"total": total, "present": present, "late": late, "absent": absent, "pending": pending}


# ============ LEAVES ============
class LeaveCreate(BaseModel):
    leave_type: str
    reason: str
    start_date: str
    end_date: str
    description: Optional[str] = ""
    attachment_base64: Optional[str] = None
    is_emergency: bool = False


class LeaveReview(BaseModel):
    remarks: Optional[str] = ""


@api.get("/leaves")
async def list_leaves(
    status: Optional[str] = None, leader_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {}
    if status:
        query["status"] = status
    if user["role"] == "leader":
        query["leader_id"] = user["leader_id"]
    elif leader_id:
        query["leader_id"] = leader_id
    docs = await db.leaves.find(query).sort("created_at", -1).to_list(1000)
    return clean_list(docs)


@api.post("/leaves")
async def apply_leave(body: LeaveCreate, user: dict = Depends(get_current_user)):
    lr = LeaveRequest(
        leader_id=user["leader_id"], leader_name=user["name"],
        leave_type=body.leave_type, reason=body.reason,
        start_date=body.start_date, end_date=body.end_date,
        description=body.description, attachment_base64=body.attachment_base64,
        is_emergency=body.is_emergency,
    )
    await db.leaves.insert_one(lr.model_dump())
    # notify super admins
    admins = await db.users.find({"role": {"$in": ["super_admin", "admin"]}}).to_list(100)
    for a in admins:
        await add_notification(a["leader_id"], "leave_request",
                               "New Leave Request", f"{user['name']} applied for leave")
    return clean(lr.model_dump())


@api.post("/leaves/{lid}/approve")
async def approve_leave(lid: str, body: LeaveReview, user: dict = Depends(require_super_admin)):
    r = await db.leaves.update_one(
        {"id": lid},
        {"$set": {"status": "approved", "remarks": body.remarks,
                  "reviewed_by": user["leader_id"], "reviewed_at": _now()}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leave not found")
    leave = await db.leaves.find_one({"id": lid})
    await add_notification(leave["leader_id"], "leave_approved",
                           "Leave Approved", f"Your leave from {leave['start_date']} to {leave['end_date']} was approved")
    return clean(leave)


@api.post("/leaves/{lid}/reject")
async def reject_leave(lid: str, body: LeaveReview, user: dict = Depends(require_super_admin)):
    r = await db.leaves.update_one(
        {"id": lid},
        {"$set": {"status": "rejected", "remarks": body.remarks,
                  "reviewed_by": user["leader_id"], "reviewed_at": _now()}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leave not found")
    leave = await db.leaves.find_one({"id": lid})
    await add_notification(leave["leader_id"], "leave_rejected",
                           "Leave Rejected", f"Your leave from {leave['start_date']} to {leave['end_date']} was rejected")
    return clean(leave)


@api.post("/leaves/{lid}/cancel")
async def cancel_leave(lid: str, user: dict = Depends(get_current_user)):
    leave = await db.leaves.find_one({"id": lid})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave["leader_id"] != user["leader_id"] and user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Not allowed")
    await db.leaves.update_one({"id": lid}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


# ============ WEEKLY REPORTS ============
class ReportCreate(BaseModel):
    week_start: str
    week_end: str
    total_duties_assigned: int
    total_duties_attended: int
    challenges: Optional[str] = ""
    suggestions: Optional[str] = ""
    self_evaluation: int
    remarks: Optional[str] = ""


@api.get("/reports")
async def list_reports(leader_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "leader":
        query["leader_id"] = user["leader_id"]
    elif leader_id:
        query["leader_id"] = leader_id
    docs = await db.reports.find(query).sort("created_at", -1).to_list(1000)
    return clean_list(docs)


@api.post("/reports")
async def create_report(body: ReportCreate, user: dict = Depends(get_current_user)):
    if body.self_evaluation < 1 or body.self_evaluation > 5:
        raise HTTPException(status_code=400, detail="Self evaluation must be 1-5")
    if body.total_duties_attended > body.total_duties_assigned:
        raise HTTPException(status_code=400, detail="Attended cannot exceed assigned")
    missed = body.total_duties_assigned - body.total_duties_attended
    r = WeeklyReport(
        leader_id=user["leader_id"], leader_name=user["name"],
        week_start=body.week_start, week_end=body.week_end,
        total_duties_assigned=body.total_duties_assigned,
        total_duties_attended=body.total_duties_attended,
        total_duties_missed=missed,
        challenges=body.challenges, suggestions=body.suggestions,
        self_evaluation=body.self_evaluation, remarks=body.remarks,
    )
    await db.reports.insert_one(r.model_dump())
    return clean(r.model_dump())


@api.get("/reports/system-attended/{leader_id}")
async def system_attended(leader_id: str, week_start: str, week_end: str,
                          user: dict = Depends(get_current_user)):
    """System-recorded attended count between week_start and week_end (inclusive)."""
    docs = await db.attendance.find({
        "leader_id": leader_id, "date": {"$gte": week_start, "$lte": week_end},
        "status": {"$in": ["present", "late"]},
    }).to_list(2000)
    return {"system_attended": len(docs), "records_count": len(docs)}


@api.get("/reports/{rid}/pdf")
async def report_pdf(rid: str, user: dict = Depends(get_current_user)):
    report = await db.reports.find_one({"id": rid})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    leader = await db.users.find_one({"leader_id": report["leader_id"]})
    settings = await get_settings()
    pdf = generate_weekly_report_pdf(report, leader or {}, settings)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f"inline; filename=report-{rid}.pdf"})


# ============ EVENTS ============
class EventCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    venue: Optional[str] = ""
    date: str
    time: str
    instructions: Optional[str] = ""


@api.get("/events")
async def list_events(user: dict = Depends(get_current_user)):
    docs = await db.events.find().sort("date", 1).to_list(1000)
    return clean_list(docs)


@api.post("/events")
async def create_event(body: EventCreate, user: dict = Depends(require_super_admin)):
    e = Event(**body.model_dump(), created_by=user["leader_id"])
    await db.events.insert_one(e.model_dump())
    # notify all leaders
    leaders = await db.users.find({"role": "leader"}).to_list(1000)
    for l in leaders:
        await add_notification(l["leader_id"], "event_reminder",
                               "New Event", f"{e.name} on {e.date} at {e.time}")
    return clean(e.model_dump())


@api.put("/events/{eid}")
async def update_event(eid: str, body: EventCreate, user: dict = Depends(require_super_admin)):
    r = await db.events.update_one({"id": eid}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    doc = await db.events.find_one({"id": eid})
    return clean(doc)


@api.delete("/events/{eid}")
async def delete_event(eid: str, user: dict = Depends(require_super_admin)):
    r = await db.events.delete_one({"id": eid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True}


# ============ INSPECTIONS ============
class InspectionCreate(BaseModel):
    title: str
    date: str
    time: str
    location: str
    inspection_type: str
    description: Optional[str] = ""
    remarks: Optional[str] = ""
    status: str = "pending"


@api.get("/inspections")
async def list_inspections(user: dict = Depends(require_admin_or_super)):
    docs = await db.inspections.find().sort("date", -1).to_list(1000)
    return clean_list(docs)


@api.post("/inspections")
async def create_inspection(body: InspectionCreate, user: dict = Depends(require_super_admin)):
    i = Inspection(**body.model_dump(), created_by=user["leader_id"])
    await db.inspections.insert_one(i.model_dump())
    return clean(i.model_dump())


@api.put("/inspections/{iid}")
async def update_inspection(iid: str, body: InspectionCreate, user: dict = Depends(require_super_admin)):
    r = await db.inspections.update_one({"id": iid}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return clean(await db.inspections.find_one({"id": iid}))


@api.delete("/inspections/{iid}")
async def delete_inspection(iid: str, user: dict = Depends(require_super_admin)):
    r = await db.inspections.delete_one({"id": iid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return {"ok": True}


# ============ REWARDS & PENALTIES ============
class RewardCreate(BaseModel):
    leader_id: str
    points: int
    reason: str


@api.get("/rewards")
async def list_rewards(leader_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "leader":
        query["leader_id"] = user["leader_id"]
    elif leader_id:
        query["leader_id"] = leader_id
    docs = await db.rewards.find(query).sort("created_at", -1).to_list(2000)
    return clean_list(docs)


@api.post("/rewards")
async def create_reward(body: RewardCreate, user: dict = Depends(require_super_admin)):
    if body.points == 0:
        raise HTTPException(status_code=400, detail="Points cannot be zero")
    leader = await db.users.find_one({"leader_id": body.leader_id})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    now = datetime.now(timezone.utc)
    rp = RewardPenalty(
        leader_id=body.leader_id, leader_name=leader["name"], points=body.points,
        reason=body.reason, given_by=user["leader_id"], given_by_name=user["name"],
        date=now.date().isoformat(), time=now.strftime("%H:%M:%S"),
    )
    await db.rewards.insert_one(rp.model_dump())
    # Update leader points
    await db.users.update_one({"leader_id": body.leader_id}, {"$inc": {"points": body.points}})
    return clean(rp.model_dump())


# ============ ANNOUNCEMENTS ============
class AnnouncementCreate(BaseModel):
    title: str
    message: str
    priority: str = "normal"
    attachment_base64: Optional[str] = None
    publish_date: Optional[str] = None
    expiry_date: Optional[str] = None


@api.get("/announcements")
async def list_announcements(user: dict = Depends(get_current_user)):
    docs = await db.announcements.find().sort("publish_date", -1).to_list(1000)
    result = []
    for d in docs:
        d.pop("_id", None)
        d["is_read"] = any(r.get("leader_id") == user["leader_id"] for r in d.get("read_by", []))
        result.append(d)
    return result


@api.post("/announcements")
async def create_announcement(body: AnnouncementCreate, user: dict = Depends(require_super_admin)):
    a = Announcement(
        title=body.title, message=body.message, priority=body.priority,
        attachment_base64=body.attachment_base64,
        publish_date=body.publish_date or datetime.now(timezone.utc).date().isoformat(),
        expiry_date=body.expiry_date, created_by=user["leader_id"],
    )
    await db.announcements.insert_one(a.model_dump())
    # notify all
    leaders = await db.users.find({"role": "leader"}).to_list(1000)
    for l in leaders:
        await add_notification(l["leader_id"], "announcement_posted",
                               "New Announcement", a.title)
    return clean(a.model_dump())


@api.put("/announcements/{aid}")
async def update_announcement(aid: str, body: AnnouncementCreate, user: dict = Depends(require_super_admin)):
    r = await db.announcements.update_one({"id": aid}, {"$set": body.model_dump(exclude_none=True)})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return clean(await db.announcements.find_one({"id": aid}))


@api.delete("/announcements/{aid}")
async def delete_announcement(aid: str, user: dict = Depends(require_super_admin)):
    r = await db.announcements.delete_one({"id": aid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"ok": True}


@api.post("/announcements/{aid}/read")
async def mark_read(aid: str, user: dict = Depends(get_current_user)):
    ann = await db.announcements.find_one({"id": aid})
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    if any(r.get("leader_id") == user["leader_id"] for r in ann.get("read_by", [])):
        return {"ok": True}
    now = datetime.now(timezone.utc)
    await db.announcements.update_one(
        {"id": aid},
        {"$push": {"read_by": {
            "leader_id": user["leader_id"], "leader_name": user["name"],
            "date": now.date().isoformat(), "time": now.strftime("%H:%M:%S"),
        }}},
    )
    return {"ok": True}


@api.get("/announcements/{aid}/read-status")
async def read_status(aid: str, user: dict = Depends(require_super_admin)):
    ann = await db.announcements.find_one({"id": aid})
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    all_leaders = await db.users.find({"role": "leader"}).to_list(2000)
    read_ids = {r["leader_id"] for r in ann.get("read_by", [])}
    read = [l for l in all_leaders if l["leader_id"] in read_ids]
    unread = [l for l in all_leaders if l["leader_id"] not in read_ids]
    return {
        "total_leaders": len(all_leaders),
        "read_count": len(read),
        "unread_count": len(unread),
        "read_leaders": [{"leader_id": r["leader_id"], "name": r["name"]} for r in read],
        "unread_leaders": [{"leader_id": r["leader_id"], "name": r["name"]} for r in unread],
        "read_by_details": ann.get("read_by", []),
    }


# ============ ID CARDS ============
@api.get("/id-cards/{leader_id}/pdf")
async def id_card_pdf(leader_id: str, user: dict = Depends(require_super_admin)):
    leader = await db.users.find_one({"leader_id": leader_id})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    settings = await get_settings()
    pdf = generate_id_card_pdf(leader, settings)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f"inline; filename=idcard-{leader_id}.pdf"})


# ============ CERTIFICATES ============
class CertificateReq(BaseModel):
    leader_id: str
    cert_type: str
    description: Optional[str] = ""
    date: Optional[str] = None


@api.post("/certificates/generate")
async def gen_certificate(body: CertificateReq, user: dict = Depends(require_super_admin)):
    leader = await db.users.find_one({"leader_id": body.leader_id})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    settings = await get_settings()
    date_str = body.date or datetime.now(timezone.utc).date().isoformat()
    pdf = generate_certificate_pdf(body.cert_type, leader, settings, body.description, date_str)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f"inline; filename=certificate-{body.leader_id}.pdf"})


# ============ NOTIFICATIONS ============
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    docs = await db.notifications.find({"user_leader_id": user["leader_id"]}).sort("created_at", -1).to_list(200)
    return clean_list(docs)


@api.post("/notifications/{nid}/read")
async def mark_notif_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": nid, "user_leader_id": user["leader_id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_leader_id": user["leader_id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ============ SETTINGS ============
@api.get("/settings")
async def get_settings_route(user: dict = Depends(get_current_user)):
    return await get_settings()


@api.put("/settings")
async def update_settings(body: dict, user: dict = Depends(require_super_admin)):
    body["updated_at"] = _now()
    body.pop("id", None)
    await db.settings.update_one({"id": "singleton"}, {"$set": body}, upsert=True)
    return await get_settings()


# ============ DASHBOARD ============
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    total_leaders = await db.users.count_documents({"role": "leader"})
    # today's attendance
    today_records = await db.attendance.find({"date": today}).to_list(3000)
    present_ids = {r["leader_id"] for r in today_records if r["status"] == "present"}
    absent_ids = {r["leader_id"] for r in today_records if r["status"] == "absent"}
    # on leave today
    leaves_today = await db.leaves.find({
        "status": "approved", "start_date": {"$lte": today}, "end_date": {"$gte": today}
    }).to_list(1000)
    on_leave = len({l["leader_id"] for l in leaves_today})

    pending_reports = await db.leaves.count_documents({"status": "pending"})
    # upcoming events
    upcoming = await db.events.count_documents({"date": {"$gte": today}})
    unread_notif = await db.notifications.count_documents({"user_leader_id": user["leader_id"], "read": False})

    return {
        "total_leaders": total_leaders,
        "present_leaders": len(present_ids),
        "absent_leaders": len(absent_ids),
        "on_leave": on_leave,
        "pending_leaves": pending_reports,
        "upcoming_events": upcoming,
        "unread_notifications": unread_notif,
    }


# ============ PROFILE ============
@api.get("/profile/me")
async def profile_me(user: dict = Depends(get_current_user)):
    # Rewards summary
    rewards = await db.rewards.find({"leader_id": user["leader_id"]}).to_list(500)
    total_rewards = sum(r["points"] for r in rewards if r["points"] > 0)
    total_penalties = sum(r["points"] for r in rewards if r["points"] < 0)
    # Leave balance
    settings = await get_settings()
    approved = await db.leaves.count_documents({"leader_id": user["leader_id"], "status": "approved"})
    # Attendance summary
    att = await db.attendance.find({"leader_id": user["leader_id"]}).to_list(3000)
    att_summary = {
        "total": len(att),
        "present": sum(1 for a in att if a["status"] == "present"),
        "late": sum(1 for a in att if a["status"] == "late"),
        "absent": sum(1 for a in att if a["status"] == "absent"),
    }
    reports_count = await db.reports.count_documents({"leader_id": user["leader_id"]})
    return {
        "user": user,
        "points": user.get("points", 0),
        "rewards_total": total_rewards,
        "penalties_total": total_penalties,
        "leave_used": approved,
        "leave_balance": max(0, settings.get("max_leave_limit", 12) - approved),
        "attendance": att_summary,
        "reports_submitted": reports_count,
    }


# ============ RANKINGS ============
@api.get("/rankings")
async def rankings(user: dict = Depends(get_current_user)):
    leaders = await db.users.find({"role": "leader"}).sort("points", -1).to_list(2000)
    ranked = []
    for i, l in enumerate(leaders):
        ranked.append({
            "rank": i + 1,
            "leader_id": l["leader_id"],
            "name": l["name"],
            "position": l.get("position", ""),
            "department": l.get("department", ""),
            "points": l.get("points", 0),
        })
    # My rank & delta to #1
    me = next((r for r in ranked if r["leader_id"] == user["leader_id"]), None)
    top_points = ranked[0]["points"] if ranked else 0
    delta = 0 if not me else max(0, top_points - me["points"])
    return {
        "rankings": ranked,
        "my_rank": me["rank"] if me else None,
        "my_points": me["points"] if me else user.get("points", 0),
        "top_points": top_points,
        "points_to_rank1": delta,
        "is_rank1": bool(me and me["rank"] == 1),
    }


# ============ HOLIDAYS ============
class HolidayReq(BaseModel):
    date: Optional[str] = None
    reason: Optional[str] = ""


@api.get("/holidays")
async def list_holidays(user: dict = Depends(get_current_user)):
    docs = await db.holidays.find().sort("date", -1).to_list(500)
    return clean_list(docs)


@api.get("/holidays/check")
async def check_holiday(date: str, user: dict = Depends(get_current_user)):
    h = await db.holidays.find_one({"date": date})
    if h:
        h.pop("_id", None)
    return {"is_holiday": bool(h), "holiday": h}


@api.post("/holidays")
async def mark_holiday(body: HolidayReq, user: dict = Depends(require_super_admin)):
    date = body.date or datetime.now(timezone.utc).date().isoformat()
    h = Holiday(date=date, reason=body.reason or "", marked_by=user["leader_id"])
    await db.holidays.update_one({"date": date}, {"$set": h.model_dump()}, upsert=True)
    return clean(h.model_dump())


@api.delete("/holidays/{date}")
async def unmark_holiday(date: str, user: dict = Depends(require_super_admin)):
    r = await db.holidays.delete_one({"date": date})
    return {"ok": True, "deleted": r.deleted_count}


# ============ DUTY SCHEDULE ============
class DutyScheduleReq(BaseModel):
    week_start: str
    week_end: str
    assignments: list  # {leader_id, leader_name, day, session, duty_place}


@api.get("/duty-schedule")
async def get_duty_schedule(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    d = date or datetime.now(timezone.utc).date().isoformat()
    s = await db.duty_schedules.find_one({"week_start": {"$lte": d}, "week_end": {"$gte": d}})
    if not s:
        return {"schedule": None}
    return {"schedule": clean(s)}


@api.get("/duty-schedule/today")
async def today_duties(user: dict = Depends(get_current_user)):
    d = datetime.now(timezone.utc).date()
    s = await db.duty_schedules.find_one({"week_start": {"$lte": d.isoformat()}, "week_end": {"$gte": d.isoformat()}})
    if not s:
        return {"duties": []}
    weekday = d.weekday()
    my = [a for a in s.get("assignments", []) if a.get("leader_id") == user["leader_id"] and a.get("day") == weekday]
    return {"duties": my}


@api.post("/duty-schedule")
async def upload_schedule(body: DutyScheduleReq, user: dict = Depends(require_super_admin)):
    sched = DutySchedule(week_start=body.week_start, week_end=body.week_end,
                         assignments=body.assignments, uploaded_by=user["leader_id"])
    await db.duty_schedules.update_one(
        {"week_start": body.week_start}, {"$set": sched.model_dump()}, upsert=True,
    )
    return clean(sched.model_dump())


class ReplacementAssignReq(BaseModel):
    week_start: str
    day: int
    session: str
    original_leader_id: str
    replacement_leader_id: str
    duty_place: Optional[str] = None


@api.post("/duty-schedule/assign-replacement")
async def assign_replacement(body: ReplacementAssignReq, user: dict = Depends(require_super_admin)):
    s = await db.duty_schedules.find_one({"week_start": body.week_start})
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    replacement = await db.users.find_one({"leader_id": body.replacement_leader_id})
    if not replacement:
        raise HTTPException(status_code=404, detail="Replacement leader not found")
    duty_place = body.duty_place
    if not duty_place:
        orig = next((a for a in s.get("assignments", [])
                     if a.get("leader_id") == body.original_leader_id
                     and a.get("day") == body.day and a.get("session") == body.session), None)
        duty_place = (orig or {}).get("duty_place", "")
    new_assn = {
        "leader_id": body.replacement_leader_id, "leader_name": replacement["name"],
        "day": body.day, "session": body.session, "duty_place": duty_place,
        "is_replacement": True, "replacing_leader_id": body.original_leader_id,
    }
    # Remove any prior replacement for same slot
    s["assignments"] = [
        a for a in s.get("assignments", [])
        if not (a.get("is_replacement") and a.get("day") == body.day
                and a.get("session") == body.session
                and a.get("replacing_leader_id") == body.original_leader_id)
    ]
    s["assignments"].append(new_assn)
    await db.duty_schedules.update_one({"week_start": body.week_start}, {"$set": {"assignments": s["assignments"]}})
    return {"ok": True, "assignment": new_assn}


# ============ ATTENDANCE SUMMARY (all leaders) ============
@api.get("/attendance/summary-all")
async def attendance_summary_all(
    date: Optional[str] = None, session: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    d = date or datetime.now(timezone.utc).date().isoformat()
    leaders = await db.users.find({"role": "leader"}).to_list(2000)
    total = len(leaders)
    query = {"date": d}
    if session:
        query["session"] = session
    records = await db.attendance.find(query).to_list(5000)
    # Build per-leader status
    per_leader = {l["leader_id"]: {"present": 0, "late": 0, "absent": 0, "pending": 0} for l in leaders}
    present_set, absent_set = set(), set()
    for r in records:
        lid = r["leader_id"]
        if lid in per_leader:
            per_leader[lid][r["status"]] = per_leader[lid].get(r["status"], 0) + 1
        if r["status"] == "present":
            present_set.add(lid)
        elif r["status"] == "absent":
            absent_set.add(lid)
    # On leave for that date
    leaves = await db.leaves.find({
        "status": "approved", "start_date": {"$lte": d}, "end_date": {"$gte": d}
    }).to_list(500)
    on_leave_set = {l["leader_id"] for l in leaves}
    marked = present_set | absent_set
    unmarked = total - len(marked) - len(on_leave_set - marked)
    pct = round((len(present_set) / total) * 100, 1) if total else 0
    per_leader_list = []
    for l in leaders:
        p = per_leader[l["leader_id"]]
        sessions_present = p["present"]
        pct_leader = round((sessions_present / 3) * 100, 1)  # 3 sessions/day
        per_leader_list.append({
            "leader_id": l["leader_id"], "name": l["name"],
            "position": l.get("position", ""), "present": sessions_present,
            "late": p["late"], "absent": p["absent"], "percentage": pct_leader,
            "on_leave": l["leader_id"] in on_leave_set,
        })
    return {
        "date": d, "total_leaders": total,
        "present": len(present_set), "absent": len(absent_set),
        "on_leave": len(on_leave_set), "unmarked": max(0, unmarked),
        "attendance_percentage": pct,
        "per_leader": per_leader_list,
    }


# ============ APPROVED LEAVES FOR DATE (used before QR) ============
@api.get("/leaves/on-date")
async def leaves_on_date(date: str, user: dict = Depends(require_super_admin)):
    docs = await db.leaves.find({
        "status": "approved", "start_date": {"$lte": date}, "end_date": {"$gte": date}
    }).to_list(500)
    return clean_list(docs)


# ============ ID CARD SHEET (A4 multiple cards) ============
@api.get("/id-cards/sheet-pdf")
async def id_card_sheet(user: dict = Depends(require_super_admin)):
    leaders = await db.users.find({"role": "leader"}).to_list(200)
    settings = await get_settings()
    from pdf_utils import generate_id_card_sheet_pdf
    pdf = generate_id_card_sheet_pdf(leaders, settings)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": "inline; filename=idcards-sheet.pdf"})


# ============ INSPECTION REPORTS ============
class InspectionReportReq(BaseModel):
    inspection_date: str
    area: str
    findings: str
    actions_taken: Optional[str] = ""
    remarks: Optional[str] = ""
    status: str = "draft"  # draft | submitted


ALLOWED_INSPECTION_POSITIONS = {"head boy", "head girl", "cultural head", "discipline head"}


def _can_inspect(user: dict) -> bool:
    if user.get("role") == "super_admin":
        return True
    pos = (user.get("position") or "").strip().lower()
    return any(p in pos for p in ALLOWED_INSPECTION_POSITIONS)


@api.get("/inspection-reports")
async def list_inspection_reports(user: dict = Depends(get_current_user)):
    if not _can_inspect(user):
        raise HTTPException(status_code=403, detail="Not allowed")
    docs = await db.inspection_reports.find().sort("created_at", -1).to_list(500)
    return clean_list(docs)


@api.post("/inspection-reports")
async def create_inspection_report(body: InspectionReportReq, user: dict = Depends(get_current_user)):
    if not _can_inspect(user):
        raise HTTPException(status_code=403, detail="Not allowed")
    # Check inspection date availability
    settings = await get_settings()
    if user.get("role") != "super_admin":
        today = datetime.now(timezone.utc).date().isoformat()
        if settings.get("inspection_mode") == "manual":
            if settings.get("inspection_manual_date") and settings["inspection_manual_date"] != today:
                raise HTTPException(status_code=400, detail="Inspection is only available on the scheduled date")
    r = InspectionReport(
        inspection_date=body.inspection_date, area=body.area, findings=body.findings,
        actions_taken=body.actions_taken, remarks=body.remarks,
        status="submitted" if body.status == "submitted" else "draft",
        created_by=user["leader_id"], created_by_name=user["name"],
    )
    await db.inspection_reports.insert_one(r.model_dump())
    return clean(r.model_dump())


@api.put("/inspection-reports/{rid}")
async def update_inspection_report(rid: str, body: InspectionReportReq, user: dict = Depends(get_current_user)):
    r = await db.inspection_reports.find_one({"id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if r["status"] == "locked" and user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Report is locked")
    if r["created_by"] != user["leader_id"] and user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Not the author")
    upd = body.model_dump()
    await db.inspection_reports.update_one({"id": rid}, {"$set": upd})
    return clean(await db.inspection_reports.find_one({"id": rid}))


@api.post("/inspection-reports/{rid}/lock")
async def lock_inspection_report(rid: str, user: dict = Depends(require_super_admin)):
    await db.inspection_reports.update_one({"id": rid}, {"$set": {"status": "locked"}})
    return {"ok": True}


@api.post("/inspection-reports/{rid}/unlock")
async def unlock_inspection_report(rid: str, user: dict = Depends(require_super_admin)):
    await db.inspection_reports.update_one({"id": rid}, {"$set": {"status": "submitted"}})
    return {"ok": True}


# ============ REGISTER + CORS ============
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
