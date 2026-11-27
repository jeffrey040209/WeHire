import pytest
from pydantic import ValidationError

from app.api.routes.admin import PasswordInput, UserInput
from app.api.routes.auth import CandidateRegistrationInput
from app.api.routes.setup import SetupInput


@pytest.mark.parametrize("schema,extra", [
    (CandidateRegistrationInput, {"email": "boundary@example.com"}),
    (SetupInput, {"email": "boundary@example.com", "token": "synthetic-setup-key-at-least-32-characters"}),
    (UserInput, {"email": "boundary@example.com", "role": "hr"}),
    (PasswordInput, {}),
])
@pytest.mark.parametrize("length,accepted", [(0, False), (5, False), (6, True), (128, True), (129, False)])
def test_password_length_boundaries_for_all_creation_and_change_flows(schema, extra, length, accepted):
    values = {**extra, "password": "x" * length}
    if accepted:
        assert schema(**values).password.get_secret_value() == values["password"]
    else:
        with pytest.raises(ValidationError):
            schema(**values)
