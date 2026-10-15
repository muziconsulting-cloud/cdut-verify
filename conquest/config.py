"""Configuration: env-driven, with a SAMPLE_MODE offline fallback.

Every sponsor integration is optional at runtime: if SAMPLE_MODE is true (the
default) or a key is missing, the adapter returns a deterministic local result so
the pipeline always runs from a clean setup with no manual steps.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SAMPLE_DIR = DATA_DIR / "sample"
LOG_DIR = ROOT / "logs"
OUT_DIR = ROOT / "output_examples"


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Config:
    sample_mode: bool

    # Sponsor: Zetaris (federated query). Base URL + key from env.
    zetaris_base_url: str
    zetaris_api_key: str

    # Sponsor: Meterless (per-action cost meter).
    meterless_base_url: str
    meterless_api_key: str

    # Sponsor: NVIDIA (NIM inference for the agents).
    nvidia_base_url: str
    nvidia_api_key: str
    nvidia_model: str

    # Agent loop controls (bound the run: no unbounded debates).
    max_revisions: int
    confidence_threshold: float

    # Optional: live SurrealDB target for the gated_intent ledger.
    surreal_url: str
    surreal_ns: str
    surreal_db: str
    surreal_user: str
    surreal_pass: str


def load_config() -> Config:
    return Config(
        sample_mode=_bool(os.getenv("SAMPLE_MODE"), True),
        zetaris_base_url=os.getenv("ZETARIS_BASE_URL", ""),
        zetaris_api_key=os.getenv("ZETARIS_API_KEY", ""),
        meterless_base_url=os.getenv("METERLESS_BASE_URL", ""),
        meterless_api_key=os.getenv("METERLESS_API_KEY", ""),
        nvidia_base_url=os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
        nvidia_api_key=os.getenv("NVIDIA_API_KEY", ""),
        nvidia_model=os.getenv("NVIDIA_MODEL", "nvidia/llama-3.1-nemotron-70b-instruct"),
        max_revisions=int(os.getenv("MAX_REVISIONS", "2")),
        confidence_threshold=float(os.getenv("CONFIDENCE_THRESHOLD", "0.6")),
        surreal_url=os.getenv("SURREAL_URL", ""),
        surreal_ns=os.getenv("SURREAL_NS", "wardbyward"),
        surreal_db=os.getenv("SURREAL_DB", "wardbyward"),
        surreal_user=os.getenv("SURREAL_USER", ""),
        surreal_pass=os.getenv("SURREAL_PASS", ""),
    )
