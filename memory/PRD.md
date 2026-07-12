# Student Leadership Management System - PRD

## Original Problem Statement
Full production-ready school Student Leadership Management System with three roles (Super Admin, Admin, Leader). Login is Leader ID + 4-digit PIN. Dark blue enterprise theme.

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB), JWT + bcrypt auth, ReportLab for PDFs, qrcode for QR generation
- **Frontend**: React + React Router + shadcn/ui + Tailwind + sonner + html5-qrcode + qrcode.react
- **DB**: MongoDB (single DB from env `DB_NAME`)

## User Personas
1. **Super Administrator** (`admin` / `2012`) — full control, only role able to manage leaders/settings/QR scan/inspections lock.
2. **Administrator** — configurable permissions granted by Super Admin.
3. **Leader** — limited access: attendance view, leave, weekly report, events, announcements, profile, rankings.

## Core Requirements (Static)
- Independent attendance sessions: Break 1 / Break 2 / Assembly (never interfere).
- Attendance modes: manual, QR, hybrid.
- Leader ID Cards with auto-generated QR (permanent until Super Admin regenerates).
- Rewards (positive) & Penalties (negative) auto-update leader points.
- Announcement read tracking with per-leader read/unread lists.
- Weekly reports with 1–5 self-evaluation, `missed = assigned - attended`.
- Rankings sorted by points desc with "N more points to Rank #1" banner.
- Holiday mode, Duty Assignment schedule upload, Replacement leader +10 bonus.
- Inspection reports restricted to Super Admin + Head Boy/Girl/Cultural/Discipline Heads.
- PDF generation: Weekly report, ID card (single + A4 sheet), Certificates.

## Implemented (Feb 2026)
- Auth with JWT + bcrypt, brute-force lockout (5 attempts → 15 min), force PIN change.
- Full CRUD for Leaders, Events, Inspections, Announcements, Rewards, Leave.
- Attendance manual + QR (session-independent uniqueness enforced by DB index).
- Rankings, Attendance Summary (per date, per leader %), Holiday toggle.
- Duty Schedule upload + replacement leader assignment + auto +10 bonus on QR scan.
- ID Card generator (individual PDF + A4 multi-card sheet) with QR.
- Achievement Certificates (Best Leader of Month, etc.) PDF.
- Settings singleton with School info, Attendance/Leave/Report/Notification/Module toggles, Inspection mode + signatures.
- Notifications system (leave, event, announcement, system).

## Verified
- Backend: 37/37 tests passing (iteration_1).
- Frontend: ~98% Playwright (iteration_2) — all core flows: login, sidebar nav, add leader, attendance tabs, holiday/summary, rankings banner, rewards penalty, ID card sheet, announcements, weekly reports self-eval fix.

## Prioritized Backlog (P0/P1/P2)
- **P1**: Full duty-schedule upload UI (currently backend-ready, minimal UI). CSV/XLSX importer.
- **P1**: Dedicated Inspection Reports page for Head roles (backend endpoints ready).
- **P1**: Force-PIN-change enforcement UI on first login.
- **P2**: Dashboard stat card labels — slightly brighter (contrast polish).
- **P2**: Suppress 401 console noise for `/auth/me` on `/login` route.
- **P2**: httpOnly cookie flow requires listing explicit CORS origin when `allow_credentials=True`.
- **P2**: Split monolithic `server.py` (1200+ lines) into per-module routers.

## Test Credentials
See `/app/memory/test_credentials.md`.

## Next Tasks
1. Ship the full Duty Schedule upload UI (drag-drop or grid editor).
2. Add dedicated Inspection Reports page + role-gated menu item.
3. Wire force-PIN-change flow into Login → redirect to change-PIN screen on first login.
