from __future__ import annotations

import argparse
import json
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from defusedxml import ElementTree as ET


class FilingParseError(ValueError):
    pass


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def child_text(element: ET.Element, name: str, required: bool = False) -> str | None:
    target = name.lower()
    for child in element.iter():
        if local_name(child.tag) == target and child.text and child.text.strip():
            return child.text.strip()
    if required:
        raise FilingParseError(f"Missing required 13F field: {name}")
    return None


def decimal_value(raw: str | None, field: str, required: bool = True) -> Decimal | None:
    if raw is None:
        if required:
            raise FilingParseError(f"Missing required numeric field: {field}")
        return None
    try:
        return Decimal(raw.replace(",", ""))
    except InvalidOperation as exc:
        raise FilingParseError(f"Invalid numeric value for {field}: {raw}") from exc


def value_multiplier(value_element: ET.Element | None, root: ET.Element) -> Decimal:
    # The SEC 13F XML information-table specification reports `value` in
    # thousands of dollars. Honor explicit unit/scale metadata when present.
    attrs: dict[str, str] = {}
    for element in (root, value_element):
        if element is not None:
            attrs.update({local_name(key): value for key, value in element.attrib.items()})
    unit = attrs.get("unit", attrs.get("units", "")).lower()
    if unit in {"usd", "dollars", "dollar"}:
        return Decimal(1)
    if unit in {"thousands", "thousand", "usdthousands", "usd_thousands"}:
        return Decimal(1000)
    if "scale" in attrs:
        try:
            return Decimal(10) ** Decimal(attrs["scale"])
        except InvalidOperation as exc:
            raise FilingParseError(f"Invalid value scale: {attrs['scale']}") from exc
    return Decimal(1000)


def parse_13f_xml(xml_content: bytes | str) -> list[dict[str, Any]]:
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as exc:
        raise FilingParseError(f"Malformed 13F XML: {exc}") from exc

    tables = [element for element in root.iter() if local_name(element.tag) == "infotable"]
    if not tables:
        raise FilingParseError("No infoTable records found")

    positions: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()
    for table in tables:
        value_element = next((e for e in table.iter() if local_name(e.tag) == "value"), None)
        raw_value = decimal_value(child_text(table, "value", required=True), "value")
        quantity = decimal_value(child_text(table, "sshPrnamt", required=True), "sshPrnamt")
        cusip = re.sub(r"\s+", "", child_text(table, "cusip", required=True) or "").upper()
        title = child_text(table, "titleOfClass", required=True) or ""
        put_call = (child_text(table, "putCall") or "").upper()
        quantity_type = (child_text(table, "sshPrnamtType", required=True) or "").upper()
        key = (cusip, title, put_call, quantity_type)
        if key in seen:
            raise FilingParseError(f"Duplicate comparison key in information table: {key}")
        seen.add(key)
        raw = {local_name(child.tag): (child.text or "").strip() for child in table.iter() if child is not table}
        positions.append(
            {
                "issuer_name": child_text(table, "nameOfIssuer", required=True),
                "title_of_class": title,
                "cusip": cusip,
                "value_usd": str(raw_value * value_multiplier(value_element, root)),
                "quantity": str(quantity),
                "share_principal_type": quantity_type,
                "put_call": put_call,
                "investment_discretion": child_text(table, "investmentDiscretion"),
                "voting_sole": str(decimal_value(child_text(table, "Sole"), "Sole", False) or 0),
                "voting_shared": str(decimal_value(child_text(table, "Shared"), "Shared", False) or 0),
                "voting_none": str(decimal_value(child_text(table, "None"), "None", False) or 0),
                "raw_data": raw,
            }
        )
    return positions


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse an SEC 13F information-table XML file")
    parser.add_argument("xml_file", type=Path)
    args = parser.parse_args()
    print(json.dumps(parse_13f_xml(args.xml_file.read_bytes()), indent=2))


if __name__ == "__main__":
    main()

