"""Public Anthropic API prices (USD per million tokens). Source: claude-api skill cache dated 2026-11-03.
Costs computed from these are ESTIMATES (your invoice is the only real measure). Verify on the pricing page."""
PRICES_AS_OF = "2026-11-03"

# model: (input, output, cache_read, cache_write_5m)
PRICES: dict[str, tuple[float, float, float, float]] = {
    "claude-haiku-5-5": (0.10, 0.50, 0.01, 0.125),
    "claude-sonnet-5-5": (2.00, 10.00, 0.10, 2.50),
    "claude-opus-5-5": (4.00, 20.00, 0.20, 5.00),
}
EFFORT = {"simple": "low", "standard": "medium", "complex": "high"}
CHARS_PER_TOKEN = 3.5  # rough heuristic for FR/EN text; used only for estimates


def estimate_tokens(text: str) -> int:
    return max(1, int(len(text) / CHARS_PER_TOKEN))


def cost(model: str, input_t: int, output_t: int, cache_read_t: int = 0, cache_write_t: int = 0) -> float:
    p = PRICES.get(model)
    if not p:
        return 0.0
    return round((input_t * p[0] + output_t * p[1] + cache_read_t * p[2] + cache_write_t * p[3]) / 1_000_000, 6)
