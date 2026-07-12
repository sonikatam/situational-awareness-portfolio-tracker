from __future__ import annotations

import os
from typing import Iterable

import httpx
from supabase import Client, create_client

from scripts.parse_13f import parse_13f_xml
from scripts.sec_client import FilingMetadata, SecClient


def database() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return create_client(url, key)


def process_filings(filings: Iterable[FilingMetadata], dry_run: bool = False) -> int:
    sec = SecClient()
    db = None if dry_run else database()
    processed = 0
    for filing in filings:
        payload = filing.as_database_json()
        if dry_run:
            print(f"DRY RUN {filing.form_type} {filing.accession_number} {filing.filing_date}")
            continue
        assert db is not None
        try:
            existing = db.table("filings").select("status").eq("accession_number", filing.accession_number).execute().data
            if existing and existing[0]["status"] == "processed":
                print(f"SKIP processed {filing.accession_number}")
                continue
            db.rpc("record_filing", {"p_filing": payload, "p_status": "downloading", "p_error": None}).execute()
            if filing.form_type not in {"13F-HR", "13F-HR/A"}:
                db.rpc("record_filing", {"p_filing": payload, "p_status": "needs_review", "p_error": None}).execute()
                print(f"TIMELINE {filing.form_type} {filing.accession_number}")
                continue
            xml_name, xml_content, index = sec.discover_information_table(filing)
            positions = parse_13f_xml(xml_content)
            payload["raw_metadata"] = {"index": index, "information_table": xml_name}
            db.rpc("process_13f_filing", {"p_filing": payload, "p_positions": positions}).execute()
            processed += 1
            print(f"PROCESSED {filing.accession_number} ({len(positions)} positions)")
        except Exception as exc:
            message = f"{type(exc).__name__}: {exc}"[:2000]
            db.rpc("record_filing", {"p_filing": payload, "p_status": "failed", "p_error": message}).execute()
            print(f"FAILED {filing.accession_number}: {message}")
    return processed


def revalidate() -> None:
    url = os.getenv("REVALIDATION_URL")
    secret = os.getenv("REVALIDATION_SECRET")
    if not url or not secret:
        print("Revalidation skipped: endpoint or secret not configured")
        return
    response = httpx.post(url, headers={"Authorization": f"Bearer {secret}"}, timeout=20)
    response.raise_for_status()

