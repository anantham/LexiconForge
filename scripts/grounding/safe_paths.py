"""Filename and filesystem boundary for imported grounding unit identifiers.

Grounding IDs are data, never paths. Open single files relative to a pinned
directory descriptor so a symlink cannot redirect a read or overwrite.
"""
import os
from pathlib import Path
import re
import stat

_STABLE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", re.ASCII)
_FILENAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,159}", re.ASCII)


def validate_stable_id(value):
    if not isinstance(value, str) or not _STABLE_ID.fullmatch(value):
        raise ValueError("stableId must contain 1-128 ASCII letters, digits, underscores or hyphens, starting with a letter or digit")
    return value


def validate_chapter_ids(chapters):
    seen = set()
    for chapter in chapters:
        uid = validate_stable_id(chapter.get("stableId"))
        if uid in seen:
            raise ValueError("Duplicate grounding stableId")
        seen.add(uid)


def contained_path(root, filename):
    if not isinstance(filename, str) or not _FILENAME.fullmatch(filename):
        raise ValueError("Grounding filename must be a single safe basename")
    base = Path(root).resolve(strict=True)
    target = base / filename
    if target.is_symlink() or target.resolve(strict=False).parent != base:
        raise ValueError("Grounding file must remain inside its directory without symlinks")
    return target


def grounded_path(root, uid):
    return contained_path(root, validate_stable_id(uid) + ".grounded.json")


def open_contained(root, filename, mode="r"):
    target = contained_path(root, filename)
    if mode not in ("r", "w"):
        raise ValueError("Only text reads and writes are supported")
    # Fail closed on runtimes without descriptor-relative, no-follow opens.
    if not hasattr(os, "O_NOFOLLOW") or os.open not in os.supports_dir_fd:
        raise RuntimeError("Safe grounding I/O requires no-follow directory-relative opens")
    directory = os.open(target.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        flags = os.O_RDONLY if mode == "r" else os.O_WRONLY | os.O_CREAT
        descriptor = os.open(target.name, flags | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600, dir_fd=directory)
    finally:
        os.close(directory)
    try:
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise ValueError("Grounding input/output must be a regular file")
        if mode == "w":
            os.ftruncate(descriptor, 0)
        return os.fdopen(descriptor, mode, encoding="utf-8")
    except BaseException:
        os.close(descriptor)
        raise


def open_grounded(root, uid, mode="r"):
    return open_contained(root, validate_stable_id(uid) + ".grounded.json", mode)
