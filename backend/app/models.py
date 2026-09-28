import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
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
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.VISITOR)
    fixture_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sessions: Mapped[list["Session"]] = relationship(back_populates="user")
    team_memberships: Mapped[list["TeamMember"]] = relationship(back_populates="user")
    scores: Mapped[list["Score"]] = relationship(back_populates="judge")
    judge_assignments: Mapped[list["JudgeAssignment"]] = relationship(back_populates="judge")
    registrations: Mapped[list["EventRegistration"]] = relationship(back_populates="user")


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
    slug: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    short_description: Mapped[str | None] = mapped_column(String, nullable=True)
    submissions_close: Mapped[datetime] = mapped_column(DateTime)
    registration_opens: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    registration_closes: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    event_starts: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    event_ends: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    judging_starts: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    judging_ends: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    results_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=True)
    max_team_size: Mapped[int] = mapped_column(default=4)
    created_by: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    tracks: Mapped[list["Track"]] = relationship(
        back_populates="event", order_by="Track.display_order"
    )
    teams: Mapped[list["Team"]] = relationship(back_populates="event")
    rubric: Mapped[list["RubricCriterion"]] = relationship(back_populates="event")
    prizes: Mapped[list["Prize"]] = relationship(back_populates="event")
    registrations: Mapped[list["EventRegistration"]] = relationship(back_populates="event")
    custom_questions: Mapped[list["CustomQuestion"]] = relationship(
        back_populates="event", order_by="CustomQuestion.display_order"
    )


class EventRegistration(Base):
    __tablename__ = "event_registrations"
    __table_args__ = (UniqueConstraint("event_id", "user_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    registered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event: Mapped[Event] = relationship(back_populates="registrations")
    user: Mapped[User] = relationship(back_populates="registrations")


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    fixture_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    display_order: Mapped[int] = mapped_column(default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))

    event: Mapped[Event] = relationship(back_populates="tracks")
    projects: Mapped[list["Project"]] = relationship(back_populates="track")


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    fixture_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
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
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    team: Mapped[Team] = relationship(back_populates="invites")
    creator: Mapped[User] = relationship(foreign_keys=[created_by])


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    fixture_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(String)
    tagline: Mapped[str | None] = mapped_column(String, nullable=True)
    summary: Mapped[str] = mapped_column(String)
    repo_url: Mapped[str] = mapped_column(String)
    demo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    live_url: Mapped[str | None] = mapped_column(String, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String, nullable=True)
    image_urls: Mapped[list | None] = mapped_column(JSON, nullable=True)
    tech_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.SUBMITTED)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True
    )
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    track_id: Mapped[str] = mapped_column(ForeignKey("tracks.id", ondelete="CASCADE"))

    team: Mapped[Team] = relationship(back_populates="projects")
    track: Mapped[Track] = relationship(back_populates="projects")
    scores: Mapped[list["Score"]] = relationship(back_populates="project")
    judge_assignments: Mapped[list["JudgeAssignment"]] = relationship(back_populates="project")
    custom_answers: Mapped[list["ProjectCustomAnswer"]] = relationship(back_populates="project")


class CustomQuestion(Base):
    __tablename__ = "custom_questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String)
    question_type: Mapped[str] = mapped_column(String)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)
    display_order: Mapped[int] = mapped_column(default=0)

    event: Mapped[Event] = relationship(back_populates="custom_questions")
    answers: Mapped[list["ProjectCustomAnswer"]] = relationship(back_populates="question")


class ProjectCustomAnswer(Base):
    __tablename__ = "project_custom_answers"
    __table_args__ = (UniqueConstraint("project_id", "question_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    question_id: Mapped[str] = mapped_column(ForeignKey("custom_questions.id", ondelete="CASCADE"))
    answer: Mapped[str] = mapped_column(String)

    project: Mapped[Project] = relationship(back_populates="custom_answers")
    question: Mapped[CustomQuestion] = relationship(back_populates="answers")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String, index=True)
    resource_type: Mapped[str] = mapped_column(String)
    resource_id: Mapped[str | None] = mapped_column(String, nullable=True)
    metadata_json: Mapped[str] = mapped_column(String, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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
