from __future__ import annotations

from dotenv import load_dotenv

from scripts.ingestion import database, process_filings, revalidate
from scripts.sec_client import SecClient


def main() -> None:
    load_dotenv()
    filings = SecClient().all_filings()
    known_rows = database().table("filings").select("accession_number,status").execute().data
    known = {row["accession_number"]: row["status"] for row in known_rows}
    terminal_states = {"processed", "needs_review", "superseded"}
    pending = [item for item in filings if known.get(item.accession_number) not in terminal_states]
    processed = process_filings(pending)
    if processed:
        revalidate()


if __name__ == "__main__":
    main()
