import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/dev.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    db_path = DATABASE_URL.replace("sqlite:///", "")
    if db_path.startswith("./"):
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    elif db_path.startswith("/"):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

    Base.metadata.create_all(bind=engine)

    from app.migrate import run_migrations

    run_migrations(engine)
