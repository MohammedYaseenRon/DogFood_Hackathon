from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _column_names(inspector, table: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table)}


def run_migrations(engine: Engine) -> None:
    """Apply lightweight SQLite-safe schema upgrades for existing databases."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "teams" in tables:
        team_cols = _column_names(inspector, "teams")
        with engine.begin() as conn:
            if "created_by" not in team_cols:
                conn.execute(text("ALTER TABLE teams ADD COLUMN created_by VARCHAR"))
            if "created_at" not in team_cols:
                conn.execute(text("ALTER TABLE teams ADD COLUMN created_at DATETIME"))
                conn.execute(
                    text(
                        "UPDATE teams SET created_at = datetime('now') "
                        "WHERE created_at IS NULL"
                    )
                )
            if "updated_at" not in team_cols:
                conn.execute(text("ALTER TABLE teams ADD COLUMN updated_at DATETIME"))
                conn.execute(
                    text(
                        "UPDATE teams SET updated_at = datetime('now') "
                        "WHERE updated_at IS NULL"
                    )
                )

    if "team_members" in tables:
        member_cols = _column_names(inspector, "team_members")
        with engine.begin() as conn:
            if "role" not in member_cols:
                conn.execute(
                    text("ALTER TABLE team_members ADD COLUMN role VARCHAR DEFAULT 'MEMBER'")
                )
                conn.execute(
                    text(
                        "UPDATE team_members SET role = 'MEMBER' "
                        "WHERE role IS NULL"
                    )
                )
            if "joined_at" not in member_cols:
                conn.execute(text("ALTER TABLE team_members ADD COLUMN joined_at DATETIME"))
                conn.execute(
                    text(
                        "UPDATE team_members SET joined_at = datetime('now') "
                        "WHERE joined_at IS NULL"
                    )
                )
