from pathlib import Path

import pytest

from scripts.parse_13f import FilingParseError, parse_13f_xml


FIXTURE = Path(__file__).parent / "fixtures" / "representative_13f.xml"


def test_parses_representative_filing_and_thousand_dollar_values():
    positions = parse_13f_xml(FIXTURE.read_bytes())
    assert len(positions) == 2
    assert positions[0]["issuer_name"] == "Example Systems Inc"
    assert positions[0]["value_usd"] == "1250000"
    assert positions[1]["put_call"] == "CALL"


@pytest.mark.parametrize("namespace", ["", ' xmlns="urn:test:13f"', ' xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable"'])
def test_namespace_variations(namespace):
    xml = f'''<informationTable{namespace}><infoTable><nameOfIssuer>A</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>111111111</cusip><value unit="USD">25</value><shrsOrPrnAmt><sshPrnamt>5</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable></informationTable>'''
    assert parse_13f_xml(xml)[0]["value_usd"] == "25"


@pytest.mark.parametrize("xml", ["<broken", "<informationTable />", "<informationTable><infoTable><cusip>1</cusip></infoTable></informationTable>"])
def test_malformed_or_incomplete_filing_raises(xml):
    with pytest.raises(FilingParseError):
        parse_13f_xml(xml)

