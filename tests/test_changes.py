from scripts.compute_changes import compute_changes


def position(cusip, quantity, put_call=""):
    return {"cusip": cusip, "title_of_class": "COM", "put_call": put_call, "share_principal_type": "SH", "issuer_name": cusip, "quantity": quantity}


def test_classifies_quantity_changes_not_value_changes():
    changes = compute_changes([position("A", 12), position("B", 8), position("C", 5)], [position("A", 10), position("B", 10), position("C", 5)])
    assert [item["classification"] for item in changes] == ["INCREASED", "REDUCED", "UNCHANGED"]


def test_new_and_exited_and_distinct_options():
    changes = compute_changes([position("NEW", 4), position("SAME", 2, "CALL")], [position("OLD", 9), position("SAME", 2, "PUT")])
    classes = {(item["key"][0], item["key"][2]): item["classification"] for item in changes}
    assert classes[("NEW", "")] == "NEW"
    assert classes[("OLD", "")] == "EXITED"
    assert classes[("SAME", "CALL")] == "NEW"
    assert classes[("SAME", "PUT")] == "EXITED"

