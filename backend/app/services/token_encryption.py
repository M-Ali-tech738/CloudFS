"""
Token encryption service — AES-256-GCM for Google refresh tokens stored
in PostgreSQL (spec §5). Key is held in environment, never in DB.
"""
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings

settings = get_settings()


def _get_key() -> bytes:
    """Derive 32-byte AES key from the hex-encoded environment variable."""
    raw = settings.token_encryption_key
    return bytes.fromhex(raw)


def encrypt_token(plaintext: str) -> tuple[bytes, bytes]:
    """
    Encrypt a refresh token.
    Returns (ciphertext, iv) — both stored in DB, IV is not secret.
    """
    key = _get_key()
    iv = os.urandom(12)  # 96-bit nonce for GCM
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode(), None)
    return ciphertext, iv


def decrypt_token(ciphertext: bytes, iv: bytes) -> str:
    """Decrypt a stored refresh token."""
    key = _get_key()
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    return plaintext.decode()
