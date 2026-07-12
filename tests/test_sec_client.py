import pytest

from scripts.sec_client import FilingMetadata, SecClient, archive_directory_url


def test_archive_path_construction():
    assert archive_directory_url("0002045724-25-000001") == "https://www.sec.gov/Archives/edgar/data/2045724/000204572425000001"


def test_archive_path_rejects_invalid_accession():
    with pytest.raises(ValueError):
        archive_directory_url("not-an-accession")


def test_information_table_is_discovered_structurally(monkeypatch):
    client = SecClient("Test test@example.com", min_interval=0)
    filing = FilingMetadata("0002045724-25-000001", "13F-HR", "2025-02-14", "2024-12-31", "primary.xml")
    index = {"directory": {"item": [{"name": "primary.xml"}, {"name": "holdings.xml"}]}}
    documents = {
        f"{filing.directory_url}/primary.xml": b"<submission><description>information table</description></submission>",
        f"{filing.directory_url}/holdings.xml": b"<informationTable><infoTable><nameOfIssuer>A</nameOfIssuer><cusip>1</cusip></infoTable></informationTable>",
    }

    class Response:
        def __init__(self, content): self.content = content

    monkeypatch.setattr(client, "get_json", lambda _url: index)
    monkeypatch.setattr(client, "get", lambda url: Response(documents[url]))
    name, content, stored_index = client.discover_information_table(filing)
    assert name == "holdings.xml"
    assert b"<infoTable>" in content
    assert stored_index == index
