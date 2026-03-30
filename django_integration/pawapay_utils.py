"""
PawaPay Transaction Utilities
==============================
Generates valid UUID v4 transaction IDs and builds metadata
with a `service` field for callback proxy routing.

PawaPay requires depositId/payoutId to be valid UUID v4 strings.
Routing info goes in the metadata array instead.

Usage:
    from payments.pawapay_utils import generate_deposit_id, build_metadata

    deposit_id = generate_deposit_id()   # "550e8400-e29b-41d4-a716-446655440000"
    metadata = build_metadata(order_id="ORD-123", rider_id="42")
    # [
    #   {"fieldName": "service", "fieldValue": "RIDER"},
    #   {"fieldName": "order_id", "fieldValue": "ORD-123"},
    #   {"fieldName": "rider_id", "fieldValue": "42"},
    # ]

Configuration:
    Set PAWAPAY_SERVICE_PREFIX in your Django settings:
        - Customer app: PAWAPAY_SERVICE_PREFIX = "CUST"
        - Rider app:    PAWAPAY_SERVICE_PREFIX = "RIDER"
"""

import uuid

from django.conf import settings


def _get_service() -> str:
    service = getattr(settings, "PAWAPAY_SERVICE_PREFIX", None)
    if not service:
        raise ValueError(
            "PAWAPAY_SERVICE_PREFIX must be set in Django settings. "
            "Use 'CUST' for the customer app or 'RIDER' for the rider app."
        )
    return service


def generate_deposit_id() -> str:
    """Generate a valid UUID v4 for use as a PawaPay depositId."""
    return str(uuid.uuid4())


def generate_payout_id() -> str:
    """Generate a valid UUID v4 for use as a PawaPay payoutId."""
    return str(uuid.uuid4())


def generate_refund_id() -> str:
    """Generate a valid UUID v4 for use as a PawaPay refundId."""
    return str(uuid.uuid4())


def build_metadata(**extra_fields) -> list[dict]:
    """
    Build the PawaPay metadata array with the service routing field
    and any additional fields you want to include.

    PawaPay metadata format:
        [{"fieldName": "key", "fieldValue": "value"}, ...]

    The `service` field is always included first for proxy routing.

    Usage:
        metadata = build_metadata(order_id="ORD-123", dispatch_id="DSP-456")
    """
    metadata = [
        {"fieldName": "service", "fieldValue": _get_service()},
    ]

    for key, value in extra_fields.items():
        if value is not None:
            metadata.append({
                "fieldName": key,
                "fieldValue": str(value),
            })

    return metadata
