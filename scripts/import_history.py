from __future__ import annotations

import argparse

from dotenv import load_dotenv

from scripts.ingestion import process_filings, revalidate
from scripts.sec_client import SecClient


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Import all available Situational Awareness LP 13F filings")
    parser.add_argument("--dry-run", action="store_true", help="List matching filings without downloading or writing")
    args = parser.parse_args()
    filings = [item for item in SecClient().all_filings() if item.form_type in {"13F-HR", "13F-HR/A"}]
    processed = process_filings(filings, dry_run=args.dry_run)
    if processed and not args.dry_run:
        revalidate()


if __name__ == "__main__":
    main()

