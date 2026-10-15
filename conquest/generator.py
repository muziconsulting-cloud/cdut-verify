"""The ONE shared generator seam (Meterless portability rule).

Every agent and engine calls this injected function; the provider is chosen by
configuration (NVIDIA NIM by default, any OpenAI-compatible endpoint). Swapping
providers — rate limit, cost, outage — is a config change, not a code change
inside the agents. SAMPLE_MODE returns the deterministic fallback so the whole
pipeline runs with no keys and no network.
"""
from __future__ import annotations

from typing import Callable

from .config import Config

# Mirrors the Meterless reference shape: generator(prompt, system, fallback).
GeneratorFn = Callable[[str, str, str], "tuple[str, int]"]


def make_generator(cfg: Config) -> GeneratorFn:
    def generate(prompt: str, system: str = "", fallback: str = "") -> tuple[str, int]:
        if cfg.sample_mode or not cfg.nvidia_api_key:
            return fallback, len(fallback.split())
        try:
            import requests

            resp = requests.post(
                f"{cfg.nvidia_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {cfg.nvidia_api_key}"},
                json={
                    "model": cfg.nvidia_model,
                    "messages": (
                        ([{"role": "system", "content": system}] if system else [])
                        + [{"role": "user", "content": prompt}]
                    ),
                    "temperature": 0.2,
                    "max_tokens": 400,
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"]
            used = int(data.get("usage", {}).get("total_tokens", len(text.split())))
            return text, used
        except Exception:
            return fallback, len(fallback.split())

    return generate
