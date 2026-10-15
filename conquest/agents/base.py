"""Shared agent base: injected generator, metering, and structured tracing."""
from __future__ import annotations

from ..config import Config
from ..generator import GeneratorFn
from ..log import Tracer
from ..sponsors.meterless import MeterlessClient


class Agent:
    name = "agent"

    def __init__(self, cfg: Config, tracer: Tracer, generate: GeneratorFn, meter: MeterlessClient):
        self.cfg = cfg
        self.tracer = tracer
        self.generate = generate
        self.meter = meter

    def think(self, action: str, system: str, prompt: str, fallback: str) -> str:
        text, tokens = self.generate(prompt, system, fallback)
        self.meter.record(self.name, action, tokens, len(prompt) + len(text))
        return text

    def trace(self, action: str, **fields: object) -> None:
        self.tracer.event(self.name, action, **fields)
