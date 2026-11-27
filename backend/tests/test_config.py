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
