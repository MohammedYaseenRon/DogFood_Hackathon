import os


def app_base_url() -> str:
    return (
        os.getenv("APP_BASE_URL")
        or os.getenv("NEXT_PUBLIC_APP_URL")
        or "http://localhost:8080"
    ).rstrip("/")


def demo_logins_enabled() -> bool:
    """Seeded one-click role sessions. Disable in production with DEMO_LOGINS=0."""
    return os.getenv("DEMO_LOGINS", "1").lower() not in {"0", "false", "no", "off"}


def seed_password() -> str:
    """Password given to seeded demo accounts that have none yet."""
    return os.getenv("SEED_PASSWORD", "hackboard-demo")


# Seeded session keys used by the acceptance checker (.dogfood.toml). Signing
# out never deletes these rows, so the checker keeps working after a demo.
TEST_SESSIONS = {
    "organizer": "org_7f2a",
    "judge_a": "jdg_a_91bc",
    "judge_b": "jdg_b_44de",
    "participant": "prt_2e88",
    "admin": "adm_3c91",
}
