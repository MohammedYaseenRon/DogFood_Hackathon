from datetime import datetime, timedelta

from app.models import TeamInvite


def _team_id(client) -> str:
    res = client.get("/api/teams/mine", headers={"Cookie": "session=owner_sess"})
    return res.json()["team"]["id"]


def _create_invite(client, team_id: str, **payload):
    return client.post(
        f"/api/teams/{team_id}/invites",
        headers={"Cookie": "session=owner_sess"},
        json=payload or {},
    )


def test_create_team_sets_owner(client):
    outsider_headers = {"Cookie": "session=outsider_sess"}
    res = client.post(
        "/api/teams",
        headers=outsider_headers,
        json={"name": "New Builders"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["team"]["name"] == "New Builders"
    assert body["team"]["myRole"] == "OWNER"

    team_id = body["team"]["id"]
    members = client.get(
        f"/api/teams/{team_id}/members",
        headers=outsider_headers,
    )
    assert members.status_code == 200
    assert len(members.json()["members"]) == 1
    assert members.json()["members"][0]["role"] == "OWNER"


def test_valid_invitation_and_join(client):
    team_id = _team_id(client)
    invite_res = _create_invite(client, team_id, max_uses=5)
    assert invite_res.status_code == 200
    token = invite_res.json()["invite"]["token"]

    preview = client.get(f"/api/invites/{token}")
    assert preview.status_code == 200
    assert preview.json()["team"]["name"] == "Test Team"

    join = client.post(
        f"/api/invites/{token}/join",
        headers={"Cookie": "session=member_sess"},
    )
    assert join.status_code == 200
    assert join.json()["alreadyMember"] is False
    assert join.json()["teamName"] == "Test Team"


def test_invalid_invitation_token(client):
    res = client.get("/api/invites/not-a-real-token")
    assert res.status_code == 404


def test_expired_invitation(client):
    team_id = _team_id(client)
    invite_res = _create_invite(client, team_id, expires_in_hours=1)
    token = invite_res.json()["invite"]["token"]

    db = client.testing_session()
    invite = db.query(TeamInvite).filter(TeamInvite.token == token).first()
    invite.expires_at = datetime.utcnow() - timedelta(hours=1)
    db.commit()
    db.close()

    preview = client.get(f"/api/invites/{token}")
    assert preview.status_code == 410

    join = client.post(
        f"/api/invites/{token}/join",
        headers={"Cookie": "session=outsider_sess"},
    )
    assert join.status_code == 410


def test_revoked_invitation(client):
    team_id = _team_id(client)
    invite_res = _create_invite(client, team_id)
    token = invite_res.json()["invite"]["token"]

    revoke = client.delete(
        f"/api/invites/{token}",
        headers={"Cookie": "session=owner_sess"},
    )
    assert revoke.status_code == 200

    preview = client.get(f"/api/invites/{token}")
    assert preview.status_code == 410


def test_user_already_on_team(client):
    team_id = _team_id(client)
    invite_res = _create_invite(client, team_id)
    token = invite_res.json()["invite"]["token"]

    first = client.post(
        f"/api/invites/{token}/join",
        headers={"Cookie": "session=member_sess"},
    )
    assert first.status_code == 200

    second = client.post(
        f"/api/invites/{token}/join",
        headers={"Cookie": "session=member_sess"},
    )
    assert second.status_code == 200
    assert second.json()["alreadyMember"] is True


def test_invite_max_uses(client):
    team_id = _team_id(client)
    invite_res = _create_invite(client, team_id, max_uses=1)
    token = invite_res.json()["invite"]["token"]

    join = client.post(
        f"/api/invites/{token}/join",
        headers={"Cookie": "session=member_sess"},
    )
    assert join.status_code == 200

    preview = client.get(f"/api/invites/{token}")
    assert preview.status_code == 410


def test_unauthorized_invite_creation(client):
    team_id = _team_id(client)
    res = client.post(
        f"/api/teams/{team_id}/invites",
        headers={"Cookie": "session=member_sess"},
        json={},
    )
    assert res.status_code == 403


def test_unauthenticated_join(client):
    team_id = _team_id(client)
    invite_res = _create_invite(client, team_id)
    token = invite_res.json()["invite"]["token"]

    res = client.post(f"/api/invites/{token}/join")
    assert res.status_code == 401


def test_team_not_found(client):
    res = client.get(
        "/api/teams/does-not-exist",
        headers={"Cookie": "session=owner_sess"},
    )
    assert res.status_code == 404


def test_member_cannot_view_other_team(client):
    team_id = _team_id(client)
    res = client.get(
        f"/api/teams/{team_id}",
        headers={"Cookie": "session=outsider_sess"},
    )
    assert res.status_code == 403
