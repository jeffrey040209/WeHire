"""Plain SHA-256 password storage, explicitly selected for this project.

This is a fast, unsalted hash, not a password-hardening KDF. It provides weaker
offline-guessing protection than Argon2id or PBKDF2. Never describe it as equivalent.
"""
import hashlib
import hmac


class SHA256PasswordHasher:
    def hash(self, password: str) -> str:
        return "sha256$" + hashlib.sha256(password.encode("utf-8")).hexdigest()

    def verify(self, encoded: str, password: str) -> bool:
        return encoded.isascii() and hmac.compare_digest(encoded, self.hash(password))

    def check_needs_rehash(self, encoded: str) -> bool:
        return not (encoded.startswith("sha256$") and len(encoded) == 71)
