from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any

import httpx
from defusedxml import ElementTree as ET

CIK = "0002045724"
CIK_UNPADDED = str(int(CIK))
SUBMISSIONS_URL = f"https://data.sec.gov/submissions/CIK{CIK}.json"
ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data"
TRACKED_FORMS = {"13F-HR", "13F-HR/A", "SC 13D", "SC 13D/A", "SC 13G", "SC 13G/A"}


def archive_directory_url(accession_number: str) -> str:
    digits = accession_number.replace("-", "")
    if len(digits) != 18 or not digits.isdigit():
        raise ValueError(f"Invalid accession number: {accession_number}")
    return f"{ARCHIVES_BASE}/{CIK_UNPADDED}/{digits}"


@dataclass(frozen=True)
class FilingMetadata:
    accession_number: str
    form_type: str
    filing_date: str
    report_period: str | None
    primary_document: str | None

    @property
    def directory_url(self) -> str:
        return archive_directory_url(self.accession_number)

    @property
    def sec_url(self) -> str:
        return f"{self.directory_url}/{self.accession_number}-index.html"

    def as_database_json(self, raw_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "cik": CIK,
            "accession_number": self.accession_number,
            "form_type": self.form_type,
            "filing_date": self.filing_date,
            "report_period": self.report_period or "",
            "primary_document": self.primary_document,
            "sec_url": self.sec_url,
            "raw_metadata": raw_metadata or {},
        }


class SecClient:
    def __init__(self, user_agent: str | None = None, min_interval: float = 0.12):
        self.user_agent = user_agent or os.getenv("SEC_USER_AGENT")
        if not self.user_agent:
            raise RuntimeError("SEC_USER_AGENT is required and must identify the requester")
        self.min_interval = min_interval
        self._last_request = 0.0
        self.client = httpx.Client(
            headers={"User-Agent": self.user_agent, "Accept-Encoding": "gzip, deflate"},
            timeout=30.0,
        )

    def get(self, url: str) -> httpx.Response:
        for attempt in range(5):
            wait = self.min_interval - (time.monotonic() - self._last_request)
            if wait > 0:
                time.sleep(wait)
            try:
                response = self.client.get(url)
                self._last_request = time.monotonic()
                if response.status_code in {429, 500, 502, 503, 504}:
                    raise httpx.HTTPStatusError("retryable SEC response", request=response.request, response=response)
                response.raise_for_status()
                return response
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError):
                if attempt == 4:
                    raise
                time.sleep(2**attempt)
        raise AssertionError("unreachable")

    def get_json(self, url: str) -> dict[str, Any]:
        return self.get(url).json()

    def all_filings(self) -> list[FilingMetadata]:
        submission = self.get_json(SUBMISSIONS_URL)
        batches = [submission["filings"]["recent"]]
        for historical in submission["filings"].get("files", []):
            batches.append(self.get_json(f"https://data.sec.gov/submissions/{historical['name']}"))

        filings: dict[str, FilingMetadata] = {}
        for batch in batches:
            count = len(batch.get("accessionNumber", []))
            for index in range(count):
                form = batch["form"][index]
                if form not in TRACKED_FORMS:
                    continue
                accession = batch["accessionNumber"][index]
                filings[accession] = FilingMetadata(
                    accession_number=accession,
                    form_type=form,
                    filing_date=batch["filingDate"][index],
                    report_period=(batch.get("reportDate") or [None] * count)[index] or None,
                    primary_document=(batch.get("primaryDocument") or [None] * count)[index] or None,
                )
        return sorted(filings.values(), key=lambda item: (item.filing_date, item.accession_number))

    def discover_information_table(self, filing: FilingMetadata) -> tuple[str, bytes, dict[str, Any]]:
        index = self.get_json(f"{filing.directory_url}/index.json")
        items = index.get("directory", {}).get("item", [])
        xml_items = [item for item in items if str(item.get("name", "")).lower().endswith(".xml")]
        for item in xml_items:
            name = item["name"]
            content = self.get(f"{filing.directory_url}/{name}").content
            try:
                root = ET.fromstring(content)
            except ET.ParseError:
                continue
            element_names = {element.tag.rsplit("}", 1)[-1].lower() for element in root.iter()}
            if {"infotable", "cusip", "nameofissuer"}.issubset(element_names):
                return name, content, index
        raise ValueError("No 13F information-table XML found in filing directory")
