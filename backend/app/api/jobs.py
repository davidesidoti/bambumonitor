"""Upload-and-send-to-printer flow for .3mf projects."""

from __future__ import annotations

import ftplib
import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.config import get_settings
from app.db.models import Job
from app.services import printer_command, printer_files
from app.services.threemf import (
    ProjectMetadata,
    ThreeMfError,
    build_geometry_zip,
    parse_3mf,
    read_thumbnail,
)
from app.utils.logging import get_logger

router = APIRouter()
log = get_logger(__name__)


class JobSummary(BaseModel):
    id: int
    created_at: datetime
    original_filename: str
    size_bytes: int
    status: str
    plate_count: int
    print_id: int | None = None


class JobDetail(JobSummary):
    metadata: dict[str, Any]


class SendJobBody(BaseModel):
    plate: int = Field(ge=1)
    ams_mapping: list[int]
    use_ams: bool = True
    bed_leveling: bool = True
    flow_cali: bool = False
    vibration_cali: bool = True
    layer_inspect: bool = True
    timelapse: bool = False


class SendJobResult(BaseModel):
    ok: bool
    detail: str
    remote_path: str | None = None


def _jobs_dir() -> Path:
    d = get_settings().jobs_dir
    d.mkdir(parents=True, exist_ok=True)
    return d


def _summary(job: Job) -> JobSummary:
    return JobSummary(
        id=job.id or 0,
        created_at=job.created_at,
        original_filename=job.original_filename,
        size_bytes=job.size_bytes,
        status=job.status,
        plate_count=job.plate_count,
        print_id=job.print_id,
    )


def _detail(job: Job) -> JobDetail:
    try:
        meta = json.loads(job.metadata_json) if job.metadata_json else {}
    except json.JSONDecodeError:
        meta = {}
    return JobDetail(**_summary(job).model_dump(), metadata=meta)


@router.post("/jobs/upload", response_model=JobDetail, tags=["jobs"])
async def upload_job(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> JobDetail:
    settings = get_settings()
    if not (file.filename or "").lower().endswith(".3mf"):
        raise HTTPException(400, "expected a .3mf file")

    jobs_dir = _jobs_dir()
    stored_id = uuid.uuid4().hex
    stored_path = jobs_dir / f"{stored_id}.3mf"

    max_bytes = settings.jobs_max_upload_mb * 1024 * 1024
    written = 0
    try:
        with stored_path.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(
                        413, f"file exceeds {settings.jobs_max_upload_mb} MB limit"
                    )
                out.write(chunk)
    except HTTPException:
        stored_path.unlink(missing_ok=True)
        raise
    except Exception:
        stored_path.unlink(missing_ok=True)
        raise

    try:
        meta: ProjectMetadata = parse_3mf(stored_path)
    except ThreeMfError as exc:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(400, str(exc)) from exc

    job = Job(
        created_at=datetime.now(UTC),
        original_filename=file.filename or "job.3mf",
        stored_path=str(stored_path),
        size_bytes=written,
        status="uploaded",
        plate_count=len(meta.plates),
        metadata_json=json.dumps(meta.to_json()),
    )
    session.add(job)
    await session.flush()
    log.info("jobs.uploaded", id=job.id, size=written, plates=len(meta.plates))
    return _detail(job)


@router.get("/jobs", response_model=list[JobSummary], tags=["jobs"])
async def list_jobs(session: AsyncSession = Depends(get_session)) -> list[JobSummary]:
    rows = (
        await session.execute(
            select(Job).order_by(Job.created_at.desc()).limit(50)
        )
    ).scalars().all()
    return [_summary(j) for j in rows]


@router.get("/jobs/{job_id}", response_model=JobDetail, tags=["jobs"])
async def get_job(
    job_id: int, session: AsyncSession = Depends(get_session)
) -> JobDetail:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    return _detail(job)


@router.get("/jobs/{job_id}/thumbnail/{plate}", tags=["jobs"])
async def get_thumbnail(
    job_id: int,
    plate: int,
    session: AsyncSession = Depends(get_session),
) -> Response:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    data = read_thumbnail(Path(job.stored_path), plate)
    if data is None:
        raise HTTPException(404, "thumbnail not found")
    return Response(content=data, media_type="image/png")


@router.get("/jobs/{job_id}/geometry", tags=["jobs"])
async def get_geometry(
    job_id: int,
    session: AsyncSession = Depends(get_session),
) -> Response:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    payload = build_geometry_zip(Path(job.stored_path))
    return Response(
        content=payload,
        media_type="model/3mf",
        headers={"content-disposition": f'inline; filename="job-{job_id}.3mf"'},
    )


@router.post("/jobs/{job_id}/send", response_model=SendJobResult, tags=["jobs"])
async def send_job(
    job_id: int,
    body: SendJobBody,
    session: AsyncSession = Depends(get_session),
) -> SendJobResult:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "job not found")

    try:
        meta = json.loads(job.metadata_json or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"corrupt job metadata: {exc}") from exc

    plates: list[dict[str, Any]] = meta.get("plates", [])
    plate_entry = next((p for p in plates if p.get("index") == body.plate), None)
    if plate_entry is None:
        raise HTTPException(400, f"plate {body.plate} not found in job")

    project_filaments = meta.get("filaments", [])
    if len(body.ams_mapping) != len(project_filaments):
        raise HTTPException(
            422,
            f"ams_mapping length {len(body.ams_mapping)} does not match "
            f"project filament count {len(project_filaments)}",
        )

    bed_type = (meta.get("settings") or {}).get("bed_type")
    remote_name = Path(job.original_filename).stem + ".3mf"

    try:
        remote_path = printer_files.upload_to_printer(
            Path(job.stored_path), remote_name
        )
    except ftplib.all_errors as exc:
        job.status = "failed"
        await session.flush()
        raise HTTPException(502, f"FTPS upload failed: {exc}") from exc
    except OSError as exc:
        job.status = "failed"
        await session.flush()
        raise HTTPException(502, f"FTPS connection failed: {exc}") from exc

    payload = printer_command.build_project_file_payload(
        plate_index=body.plate,
        subtask_name=Path(job.original_filename).stem,
        remote_path=remote_path,
        bed_type=bed_type,
        use_ams=body.use_ams,
        ams_mapping=body.ams_mapping,
        bed_leveling=body.bed_leveling,
        flow_cali=body.flow_cali,
        vibration_cali=body.vibration_cali,
        layer_inspect=body.layer_inspect,
        timelapse=body.timelapse,
    )

    if not printer_command.send_project_file(payload):
        job.status = "failed"
        await session.flush()
        raise HTTPException(503, "MQTT not connected — file uploaded but print not started")

    job.status = "sent"
    job.last_send_payload_json = json.dumps(payload)
    await session.flush()

    return SendJobResult(ok=True, detail="job sent to printer", remote_path=remote_path)


@router.delete("/jobs/{job_id}", tags=["jobs"])
async def delete_job(
    job_id: int, session: AsyncSession = Depends(get_session)
) -> dict[str, bool]:
    job = await session.get(Job, job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    Path(job.stored_path).unlink(missing_ok=True)
    job.status = "expired"
    await session.flush()
    return {"ok": True}
