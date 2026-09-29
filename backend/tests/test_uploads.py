import pytest

from tests.conftest import auth_headers

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture(autouse=True)
def upload_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    return tmp_path


def test_participant_uploads_png_and_it_is_served(client, upload_dir):
    res = client.post(
        "/api/uploads",
        files={"file": ("shot.png", PNG, "image/png")},
        headers=auth_headers("owner_sess"),
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["url"].startswith("http://localhost:8080/api/uploads/")
    served = client.get(f"/api/uploads/{body['name']}")
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/png"
    assert served.headers["x-content-type-options"] == "nosniff"
    assert served.content == PNG


def test_type_comes_from_bytes_not_the_filename(client):
    res = client.post(
        "/api/uploads",
        files={"file": ("evil.png", b"<svg onload=alert(1)>", "image/png")},
        headers=auth_headers("owner_sess"),
    )
    assert res.status_code == 415


def test_oversized_upload_refused(client):
    big = PNG + b"\x00" * (5 * 1024 * 1024)
    res = client.post("/api/uploads", files={"file": ("big.png", big, "image/png")}, headers=auth_headers("owner_sess"))
    assert res.status_code == 413


def test_upload_requires_participant(client):
    assert client.post("/api/uploads", files={"file": ("a.png", PNG, "image/png")}).status_code == 401


@pytest.mark.parametrize("name", ["../dev.db", "abc.png", "0" * 32 + ".svg"])
def test_only_generated_names_are_served(client, name):
    assert client.get(f"/api/uploads/{name}").status_code == 404
