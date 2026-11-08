"""Native daily-session storage. Secret payloads use memory/stdin, never argv.

No file, environment-selected fake, or alternate storage fallback is provided.
Tests inject a store implementing get/set/delete; native operations are not
performed by the offline suite.
"""
import ctypes
from ctypes import wintypes
import os
import re
import shutil
import subprocess
import sys
from typing import Protocol


class KeychainError(Exception):
    """A safe diagnostic containing no keychain output or secret payload."""


class Keychain(Protocol):
    def get(self, key: str) -> str | None: ...
    def set(self, key: str, payload: str) -> None: ...
    def delete(self, key: str) -> None: ...


def valid_key(key):
    if not re.fullmatch(r"vault-secrets-session-[a-f0-9]{64}", key):
        raise KeychainError("invalid daily-session keychain identifier")


def valid_payload(payload):
    # Base64 of a JSON session record; the Mac command is strictly one line.
    if not payload or len(payload) > 2560 or not re.fullmatch(r"[A-Za-z0-9+/=]+", payload):
        raise KeychainError("daily-session record cannot be safely stored by the native backend")


class WindowsKeychain:
    """CRED_TYPE_GENERIC, current Windows logon session only; no roaming."""
    def __init__(self):
        if os.name != "nt":
            raise KeychainError("Windows Credential Manager is unavailable on this platform")
        self.dll = ctypes.WinDLL("advapi32", use_last_error=True)

        class Credential(ctypes.Structure):
            _fields_ = [("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
                        ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
                        ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
                        ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
                        ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD),
                        ("Attributes", ctypes.c_void_p), ("TargetAlias", wintypes.LPWSTR),
                        ("UserName", wintypes.LPWSTR)]
        self.Credential = Credential
        pointer = ctypes.POINTER(Credential)
        self.dll.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(pointer)]
        self.dll.CredReadW.restype = wintypes.BOOL
        self.dll.CredWriteW.argtypes = [pointer, wintypes.DWORD]
        self.dll.CredWriteW.restype = wintypes.BOOL
        self.dll.CredDeleteW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD]
        self.dll.CredDeleteW.restype = wintypes.BOOL
        self.dll.CredFree.argtypes = [ctypes.c_void_p]
        self.dll.CredFree.restype = None

    def get(self, key):
        valid_key(key)
        out = ctypes.POINTER(self.Credential)()
        if not self.dll.CredReadW(key, 1, 0, ctypes.byref(out)):
            if ctypes.get_last_error() == 1168:  # ERROR_NOT_FOUND
                return None
            raise KeychainError("Windows Credential Manager could not read the daily session")
        try:
            return ctypes.string_at(out.contents.CredentialBlob, out.contents.CredentialBlobSize).decode("ascii")
        except (ValueError, UnicodeError):
            raise KeychainError("Windows Credential Manager returned an invalid daily-session record") from None
        finally:
            self.dll.CredFree(out)

    def set(self, key, payload):
        valid_key(key)
        valid_payload(payload)
        raw = payload.encode("ascii")
        blob = (ctypes.c_ubyte * len(raw)).from_buffer_copy(raw)
        cred = self.Credential(Type=1, TargetName=key, UserName="vault-secrets", Persist=1,
                               CredentialBlobSize=len(raw), CredentialBlob=blob)
        try:
            if not self.dll.CredWriteW(ctypes.byref(cred), 0):
                raise KeychainError("Windows Credential Manager could not store the daily session")
        finally:
            ctypes.memset(blob, 0, len(raw))

    def delete(self, key):
        valid_key(key)
        if not self.dll.CredDeleteW(key, 1, 0) and ctypes.get_last_error() != 1168:
            raise KeychainError("Windows Credential Manager could not remove the daily session")


class CommandKeychain:
    def run(self, argv, payload=None):
        try:
            return subprocess.run(argv, input=payload, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                  **({"stdin": subprocess.DEVNULL} if payload is None else {}), timeout=15)
        except (OSError, subprocess.TimeoutExpired):
            # Never render a CompletedProcess, exception argv, stderr or stdin.
            raise KeychainError("native keychain command unavailable or timed out; no file fallback") from None


class MacOSKeychain(CommandKeychain):
    executable = "/usr/bin/security"

    def get(self, key):
        valid_key(key)
        result = self.run([self.executable, "find-generic-password", "-a", "vault-secrets", "-s", key, "-w"])
        if result.returncode == 44:  # errSecItemNotFound
            return None
        if result.returncode:
            raise KeychainError("macOS Keychain could not read the daily session")
        try:
            return result.stdout.rstrip(b"\r\n").decode("ascii")
        except UnicodeError:
            raise KeychainError("macOS Keychain returned an invalid daily-session record") from None

    def set(self, key, payload):
        valid_key(key)
        valid_payload(payload)
        # Apple's security.c reads one line from stdin in -i mode (no shell,
        # no history); -q disables command diagnostics. No -v. Its 4096-byte
        # line limit is checked before the command is started.
        command = f"add-generic-password -U -a vault-secrets -s {key} -w {payload}\n".encode("ascii")
        if len(command) >= 4096:
            raise KeychainError("daily session exceeds macOS Keychain's safe stdin limit")
        result = self.run([self.executable, "-i", "-q"], command)
        if result.returncode:
            raise KeychainError("macOS Keychain could not store the daily session")

    def delete(self, key):
        valid_key(key)
        result = self.run([self.executable, "delete-generic-password", "-a", "vault-secrets", "-s", key])
        if result.returncode not in (0, 44):
            raise KeychainError("macOS Keychain could not remove the daily session")


class SecretServiceKeychain(CommandKeychain):
    def executable(self):
        path = shutil.which("secret-tool")
        if not path:
            raise KeychainError("Secret Service needs secret-tool and an unlocked session keyring; no file fallback")
        return path

    def get(self, key):
        valid_key(key)
        result = self.run([self.executable(), "lookup", "application", "vault-secrets", "session", key])
        if result.returncode == 1 and not result.stderr:
            return None
        if result.returncode:
            raise KeychainError("Secret Service could not read the daily session")
        try:
            return result.stdout.rstrip(b"\r\n").decode("ascii")
        except UnicodeError:
            raise KeychainError("Secret Service returned an invalid daily-session record") from None

    def set(self, key, payload):
        valid_key(key)
        valid_payload(payload)
        # secret-tool stores all stdin bytes through EOF, without a newline.
        result = self.run([self.executable(), "store", "--label=Vault daily session", "application", "vault-secrets", "session", key],
                          payload.encode("ascii"))
        if result.returncode:
            raise KeychainError("Secret Service could not store the daily session")

    def delete(self, key):
        valid_key(key)
        result = self.run([self.executable(), "clear", "application", "vault-secrets", "session", key])
        if result.returncode:
            raise KeychainError("Secret Service could not remove the daily session")


def create_backend():
    if os.name == "nt":
        return WindowsKeychain()
    if sys.platform == "darwin":
        return MacOSKeychain()
    if sys.platform.startswith("linux"):
        return SecretServiceKeychain()
    raise KeychainError("no supported native OS keychain on this platform; no file fallback")
