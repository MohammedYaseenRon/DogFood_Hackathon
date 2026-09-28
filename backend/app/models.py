import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def new_id() -> str:
    return uuid.uuid4().hex


class Role(str, enum.Enum):
    VISITOR = "VISITOR"
    PARTICIPANT = "PARTICIPANT"
    JUDGE = "JUDGE"
    ORGANIZER = "ORGANIZER"
    ADMIN = "ADMIN"


class ProjectStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"


class TeamMemberRole(str, enum.Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.VISITOR)
    fixture_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sessions: Mapped[list["Session"]] = relationship(back_populates="user")
    team_memberships: Mapped[list["TeamMember"]] = relationship(back_populates="user")
    scores: Mapped[list["Score"]] = relationship(back_populates="judge")
    judge_assignments: Mapped[list["JudgeAssignment"]] = relationship(back_populates="judge")


class Session(Base):
    __tablename__ = "sessions"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    user: Mapped[User] = relationship(back_populates="sessions")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    fixture_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    submissions_close: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    tracks: Mapped[list["Track"]] = relationship(back_populates="event")
    teams: Mapped[list["Team"]] = relationship(back_populates="event")
    rubric: Mapped[list["RubricCriterion"]] = relationship(back_populates="event")
    prizes: Mapped[list["Prize"]] = relationship(back_populates="event")


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    fixture_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))

    event: Mapped[Event] = relationship(back_populates="tracks")
    projects: Mapped[list["Project"]] = relationship(back_populates="track")


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    fixture_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    invite_token: Mapped[str] = mapped_column(String, unique=True, default=new_id)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    created_by: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    event: Mapped[Event] = relationship(back_populates="teams")
    members: Mapped[list["TeamMember"]] = relationship(back_populates="team")
    projects: Mapped[list["Project"]] = relationship(back_populates="team")
    invites: Mapped[list["TeamInvite"]] = relationship(back_populates="team")
    creator: Mapped["User | None"] = relationship(foreign_keys=[created_by])


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[TeamMemberRole] = mapped_column(
        Enum(TeamMemberRole), default=TeamMemberRole.MEMBER
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team: Mapped[Team] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="team_memberships")


class TeamInvite(Base):
    __tablename__ = "team_invites"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    token: Mapped[str] = mapped_column(String, unique=True, index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    max_uses: Mapped[int] = mapped_column(default=10)
    used_count: Mapped[int] = mapped_column(default=0)
    revoked: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team: Mapped[Team] = relationship(back_populates="invites")
    creator: Mapped[User] = relationship(foreign_keys=[created_by])


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    fixture_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    summary: Mapped[str] = mapped_column(String)
    repo_url: Mapped[str] = mapped_column(String)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.SUBMITTED)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    track_id: Mapped[str] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))

    team: Mapped[Team] = relationship(back_populates="projects")
    track: Mapped[Track] = relationship(back_populates="projects")
    scores: Mapped[list["Score"]] = relationship(back_populates="project")
    judge_assignments: Mapped[list["JudgeAssignment"]] = relationship(back_populates="project")


class Prize(Base):
    __tablename__ = "prizes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    amount: Mapped[str] = mapped_column(String)
    rank: Mapped[int] = mapped_column(default=1)
    track_id: Mapped[str | None] = mapped_column(
        ForeignKey("tracks.id", ondelete="SET NULL"), nullable=True
    )

    event: Mapped[Event] = relationship(back_populates="prizes")
    track: Mapped["Track | None"] = relationship()


class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"
    __table_args__ = (UniqueConstraint("event_id", "name"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))

    event: Mapped[Event] = relationship(back_populates="rubric")


class JudgeAssignment(Base):
    __tablename__ = "judge_assignments"
    __table_args__ = (UniqueConstraint("judge_id", "project_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    judge_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    judge: Mapped[User] = relationship(back_populates="judge_assignments")
    project: Mapped[Project] = relationship(back_populates="judge_assignments")


class Score(Base):
    __tablename__ = "scores"
    __table_args__ = (UniqueConstraint("judge_id", "project_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    judge_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    criteria: Mapped[dict] = mapped_column(JSON)
    comment: Mapped[str] = mapped_column(String, default="")

    judge: Mapped[User] = relationship(back_populates="scores")
    project: Mapped[Project] = relationship(back_populates="scores")
