import hashlib

from app.core.passwords import SHA256PasswordHasher


def test_selected_sha256_format_and_constant_time_verification():
    hasher = SHA256PasswordHasher()
    password = "synthetic-test-password"
    encoded = hasher.hash(password)
    assert encoded == "sha256$" + hashlib.sha256(password.encode()).hexdigest()
    assert hasher.verify(encoded, password)
    assert not hasher.verify(encoded, "wrong")
    assert not hasher.verify("malformed", password)
    assert not hasher.verify("non-ascii-é", password)
    assert not hasher.check_needs_rehash(encoded)
    assert hasher.check_needs_rehash("$argon2id$legacy-hash")
