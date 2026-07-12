from scripts.ingestion import process_filings
from scripts.sec_client import FilingMetadata


class Result:
    data = [{"status": "processed"}]


class Query:
    def select(self, *_): return self
    def eq(self, *_): return self
    def execute(self): return Result()


class FakeDatabase:
    def table(self, name):
        assert name == "filings"
        return Query()


def test_processed_accession_is_idempotently_skipped(monkeypatch):
    monkeypatch.setenv("SEC_USER_AGENT", "Test test@example.com")
    monkeypatch.setattr("scripts.ingestion.database", lambda: FakeDatabase())
    filing = FilingMetadata("0002045724-25-000001", "13F-HR", "2025-02-14", "2024-12-31", "primary.xml")
    assert process_filings([filing]) == 0
