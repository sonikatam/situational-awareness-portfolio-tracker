from __future__ import annotations

from decimal import Decimal
from typing import Any


def position_key(position: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        position["cusip"],
        position["title_of_class"],
        position.get("put_call") or "",
        position["share_principal_type"],
    )


def compute_changes(current: list[dict[str, Any]], previous: list[dict[str, Any]]) -> list[dict[str, Any]]:
    current_by_key = {position_key(item): item for item in current}
    previous_by_key = {position_key(item): item for item in previous}
    changes = []
    for key in sorted(current_by_key.keys() | previous_by_key.keys()):
        current_position = current_by_key.get(key)
        previous_position = previous_by_key.get(key)
        current_quantity = Decimal(str(current_position["quantity"])) if current_position else Decimal(0)
        previous_quantity = Decimal(str(previous_position["quantity"])) if previous_position else Decimal(0)
        if previous_position is None:
            classification = "NEW"
        elif current_position is None:
            classification = "EXITED"
        elif current_quantity > previous_quantity:
            classification = "INCREASED"
        elif current_quantity < previous_quantity:
            classification = "REDUCED"
        else:
            classification = "UNCHANGED"
        changes.append(
            {
                "key": key,
                "issuer_name": (current_position or previous_position)["issuer_name"],
                "current_quantity": current_quantity,
                "previous_quantity": previous_quantity,
                "quantity_change": current_quantity - previous_quantity,
                "classification": classification,
            }
        )
    return changes

