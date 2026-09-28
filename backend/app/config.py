import os


def app_base_url() -> str:
    return (
        os.getenv("APP_BASE_URL")
        or os.getenv("NEXT_PUBLIC_APP_URL")
        or "http://localhost:8080"
    ).rstrip("/")
