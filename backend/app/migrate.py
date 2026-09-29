from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _column_names(inspector, table: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table)}


def _add_column(conn, table: str, column: str, ddl: str) -> None:
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def run_migrations(engine: Engine) -> None:
    """Apply lightweight SQLite-safe schema upgrades for existing databases."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "users" in tables:
        cols = _column_names(inspector, "users")
        with engine.begin() as conn:
            if "password_hash" not in cols:
                _add_column(conn, "users", "password_hash", "VARCHAR")
            if "suspended" not in cols:
                _add_column(conn, "users", "suspended", "BOOLEAN DEFAULT 0")

    if "events" in tables:
        cols = _column_names(inspector, "events")
        with engine.begin() as conn:
            for col, ddl in [
                ("slug", "VARCHAR"),
                ("description", "VARCHAR"),
                ("short_description", "VARCHAR"),
                ("registration_opens", "DATETIME"),
                ("registration_closes", "DATETIME"),
                ("event_starts", "DATETIME"),
                ("event_ends", "DATETIME"),
                ("judging_starts", "DATETIME"),
                ("judging_ends", "DATETIME"),
                ("results_at", "DATETIME"),
                ("published", "BOOLEAN DEFAULT 1"),
                ("max_team_size", "INTEGER DEFAULT 4"),
                ("created_by", "VARCHAR"),
            ]:
                if col not in cols:
                    _add_column(conn, "events", col, ddl)

    if "tracks" in tables:
        cols = _column_names(inspector, "tracks")
        with engine.begin() as conn:
            for col, ddl in [
                ("description", "VARCHAR"),
                ("display_order", "INTEGER DEFAULT 0"),
                ("active", "BOOLEAN DEFAULT 1"),
            ]:
                if col not in cols:
                    _add_column(conn, "tracks", col, ddl)

    if "teams" in tables:
        team_cols = _column_names(inspector, "teams")
        with engine.begin() as conn:
            if "created_by" not in team_cols:
                _add_column(conn, "teams", "created_by", "VARCHAR")
            if "description" not in team_cols:
                _add_column(conn, "teams", "description", "VARCHAR")
            if "created_at" not in team_cols:
                _add_column(conn, "teams", "created_at", "DATETIME")
                conn.execute(
                    text("UPDATE teams SET created_at = datetime('now') WHERE created_at IS NULL")
                )
            if "updated_at" not in team_cols:
                _add_column(conn, "teams", "updated_at", "DATETIME")
                conn.execute(
                    text("UPDATE teams SET updated_at = datetime('now') WHERE updated_at IS NULL")
                )

    if "team_members" in tables:
        member_cols = _column_names(inspector, "team_members")
        with engine.begin() as conn:
            if "role" not in member_cols:
                _add_column(conn, "team_members", "role", "VARCHAR DEFAULT 'MEMBER'")
                conn.execute(text("UPDATE team_members SET role = 'MEMBER' WHERE role IS NULL"))
            if "joined_at" not in member_cols:
                _add_column(conn, "team_members", "joined_at", "DATETIME")
                conn.execute(
                    text("UPDATE team_members SET joined_at = datetime('now') WHERE joined_at IS NULL")
                )

    if "projects" in tables:
        cols = _column_names(inspector, "projects")
        with engine.begin() as conn:
            for col, ddl in [
                ("tagline", "VARCHAR"),
                ("demo_url", "VARCHAR"),
                ("live_url", "VARCHAR"),
                ("video_url", "VARCHAR"),
                ("thumbnail_url", "VARCHAR"),
                ("tech_tags", "JSON"),
                ("image_urls", "JSON"),
                ("created_at", "DATETIME"),
                ("updated_at", "DATETIME"),
            ]:
                if col not in cols:
                    _add_column(conn, "projects", col, ddl)

    if "rubric_criteria" in tables:
        cols = _column_names(inspector, "rubric_criteria")
        with engine.begin() as conn:
            if "description" not in cols:
                _add_column(conn, "rubric_criteria", "description", "VARCHAR")
            if "display_order" not in cols:
                _add_column(conn, "rubric_criteria", "display_order", "INTEGER DEFAULT 0")

    if "judge_assignments" in tables:
        cols = _column_names(inspector, "judge_assignments")
        with engine.begin() as conn:
            for col, ddl in [("batch", "VARCHAR"), ("assigned_by", "VARCHAR"), ("assigned_at", "DATETIME")]:
                if col not in cols:
                    _add_column(conn, "judge_assignments", col, ddl)

    if "scores" in tables:
        cols = _column_names(inspector, "scores")
        with engine.begin() as conn:
            for col in ("created_at", "updated_at"):
                if col not in cols:
                    _add_column(conn, "scores", col, "DATETIME")

    if "audit_logs" in tables:
        cols = _column_names(inspector, "audit_logs")
        with engine.begin() as conn:
            if "event_id" not in cols:
                _add_column(conn, "audit_logs", "event_id", "VARCHAR")
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_event_id ON audit_logs (event_id)"))
