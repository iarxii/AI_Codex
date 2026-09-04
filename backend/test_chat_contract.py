import pytest

from backend.api.chat import (
    RATE_LIMIT_SECONDS,
    build_rate_limit_error,
    classify_execution_error,
)


def test_rate_limit_error_is_structured():
    payload = build_rate_limit_error(0.87321)

    assert payload["type"] == "error"
    assert payload["category"] == "rate_limit"
    assert payload["status_code"] == 429
    assert payload["retry_after"] == 0.873
    assert str(RATE_LIMIT_SECONDS) in payload["message"]


@pytest.mark.parametrize(
    ("error_text", "category", "status_code"),
    [
        ("401 unauthorized: rate limit text should not win", "provider_auth", 401),
        ('402 model requires a subscription', "execution", None),
        ("429 too many requests", "provider_rate_limit", 429),
        ('404 model "missing" not found', "model_not_found", 404),
        ("Cannot reach LLM server", "provider_unavailable", None),
        ("request timeout", "timeout", 408),
    ],
)
def test_execution_error_classification(error_text, category, status_code):
    actual_category, actual_status, message = classify_execution_error(Exception(error_text))

    assert actual_category == category
    assert actual_status == status_code
    assert message


def test_execution_error_preserves_unknown_message():
    category, status_code, message = classify_execution_error(Exception("provider exploded"))

    assert category == "execution"
    assert status_code is None
    assert message == "provider exploded"
