from pathlib import Path

from app.core.config import Settings


def test_default_env_file_is_repository_root() -> None:
    assert Settings.model_config["env_file"] == Path(__file__).resolve().parents[2] / ".env"


def test_shared_env_loads_backend_settings_and_allows_process_overrides(tmp_path, monkeypatch) -> None:
    monkeypatch.delenv("APP_NAME", raising=False)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(
        'APP_NAME="Shared WeHire"\n'
        'CORS_ORIGINS=["http://localhost:3012"]\n'
        'POSTGRES_PASSWORD=shared-test-secret\n'
        'NEXT_PUBLIC_API_URL=http://localhost:8012\n'
    )
    settings = Settings(_env_file=env_file)
    assert settings.app_name == "Shared WeHire"
    assert settings.cors_origins == ["http://localhost:3012"]
    assert "shared-test-secret" not in repr(settings)

    monkeypatch.setenv("APP_NAME", "Process override")
    assert Settings(_env_file=env_file).app_name == "Process override"



def test_container_network_override_preserves_encoded_credentials(monkeypatch) -> None:
    from app.db import session as database
    settings = Settings(_env_file=None,
        database_url="postgresql+psycopg://wehire:unit%40%25%3A%24%23@127.0.0.1:54312/wehire_dev?sslmode=prefer",
        database_host="postgres", database_port=5432)
    monkeypatch.setattr(database, "get_settings", lambda: settings)
    url = database.get_database_url()
    assert url.host == "postgres" and url.port == 5432
    assert url.username == "wehire" and url.password == "unit@%:$#"
    assert url.database == "wehire_dev" and url.query["sslmode"] == "prefer"
    assert "unit@%:$#" not in repr(settings)
    assert "unit%40" not in settings.model_dump_json()


def test_host_database_url_works_without_container_overrides(monkeypatch) -> None:
    from app.db import session as database
    settings = Settings(_env_file=None,
        database_url="postgresql+psycopg://wehire:unused@127.0.0.1:54312/wehire_dev",
        database_host=None, database_port=None)
    monkeypatch.setattr(database, "get_settings", lambda: settings)
    url = database.get_database_url()
    assert url.host == "127.0.0.1" and url.port == 54312
