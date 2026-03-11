"""
MatrixReview V2 — FileWalker

Step 1 of the deterministic scanner pipeline.

PURPOSE:
  Traverse a repository directory tree and produce a structured inventory
  of every file with metadata. This is the foundation everything else
  builds on. If the walker misses a file, every downstream module is blind
  to it. If it misclassifies a file role, the risk classifier wastes time
  on generated code or misses critical source files.

PATTERN: SGI Cell (Init, Process, Certify, Report)
  INIT:    Load config (extensions, ignore patterns, role heuristics)
  PROCESS: Walk directory tree, classify every file
  CERTIFY: Validate completeness (every file accounted for: included or skipped with reason)
  REPORT:  Return structured file inventory

DESIGN PRINCIPLES:
  - Deterministic. Same input directory always produces same output.
  - Complete. Every file is either included or explicitly skipped with a reason.
  - Fast. No file reads for classification. Metadata only (path, name, size, extension).
  - Extensible. Language detection and role classification are pluggable.
"""

import os
import time
import json
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional
from pathlib import Path


# ═══════════════════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════════════════

class FileRole(str, Enum):
    """Classification of a file's role in the project."""
    SOURCE = "SOURCE"               # Application source code
    TEST = "TEST"                   # Test files
    CONFIG = "CONFIG"               # Configuration files
    MIGRATION = "MIGRATION"         # Database migrations
    GENERATED = "GENERATED"         # Auto-generated code (protobuf, swagger, etc.)
    TYPE_DEFINITION = "TYPE_DEFINITION"  # .pyi stubs, .d.ts, etc.
    DOCUMENTATION = "DOCUMENTATION" # Markdown, rst, txt docs
    SCRIPT = "SCRIPT"               # Build scripts, CI scripts, utilities
    DATA = "DATA"                   # JSON data, CSV, fixtures
    BINARY = "BINARY"               # Images, compiled files, archives
    VENDOR = "VENDOR"               # Third-party vendored code
    LOCK = "LOCK"                   # Lock files (package-lock, poetry.lock, etc.)
    UNKNOWN = "UNKNOWN"             # Could not classify


class SkipReason(str, Enum):
    """Why a file was excluded from the scan."""
    BINARY = "BINARY"
    TOO_LARGE = "TOO_LARGE"
    VENDOR = "VENDOR"
    GENERATED = "GENERATED"
    LOCK_FILE = "LOCK_FILE"
    HIDDEN = "HIDDEN"
    IGNORED_DIR = "IGNORED_DIR"
    IGNORED_EXT = "IGNORED_EXT"
    EMPTY = "EMPTY"


# ═══════════════════════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class FileEntry:
    """Metadata for a single file discovered by the walker."""
    path: str                       # Relative path from project root (forward slashes)
    filename: str                   # Just the filename
    extension: str                  # Lowercase extension including dot, e.g. ".py"
    language: str                   # Detected language, e.g. "python", "javascript"
    size_bytes: int                 # File size in bytes
    role: FileRole                  # Classified role
    included: bool                  # True if included in scan, False if skipped
    skip_reason: Optional[SkipReason] = None  # Why it was skipped (if skipped)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["role"] = self.role.value
        d["skip_reason"] = self.skip_reason.value if self.skip_reason else None
        return d


@dataclass
class WalkerResult:
    """Complete output of the FileWalker."""
    project_root: str
    scan_time_ms: float
    total_files: int                # Everything found (included + skipped)
    included_files: list[FileEntry] = field(default_factory=list)
    skipped_files: list[FileEntry] = field(default_factory=list)
    language_breakdown: dict = field(default_factory=dict)
    role_breakdown: dict = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)

    @property
    def included_count(self) -> int:
        return len(self.included_files)

    @property
    def skipped_count(self) -> int:
        return len(self.skipped_files)

    @property
    def certified(self) -> bool:
        """Certification check: every file is accounted for."""
        return (self.included_count + self.skipped_count) == self.total_files

    def to_dict(self) -> dict:
        return {
            "project_root": self.project_root,
            "scan_time_ms": self.scan_time_ms,
            "total_files": self.total_files,
            "included_count": self.included_count,
            "skipped_count": self.skipped_count,
            "certified": self.certified,
            "language_breakdown": self.language_breakdown,
            "role_breakdown": self.role_breakdown,
            "errors": self.errors,
            "included_files": [f.to_dict() for f in self.included_files],
            "skipped_files": [f.to_dict() for f in self.skipped_files],
        }

    def print_summary(self):
        cert = "CERTIFIED" if self.certified else "FAILED CERTIFICATION"
        print(f"\n{'='*60}")
        print(f"  FILEWALKER RESULT: {cert}")
        print(f"  Root: {self.project_root}")
        print(f"  Scan time: {self.scan_time_ms:.1f}ms")
        print(f"{'='*60}")
        print(f"  Total files found:  {self.total_files}")
        print(f"  Included:           {self.included_count}")
        print(f"  Skipped:            {self.skipped_count}")
        print(f"  Accounted for:      {self.included_count + self.skipped_count}")
        if not self.certified:
            print(f"  MISSING:            {self.total_files - self.included_count - self.skipped_count}")
        print()
        if self.language_breakdown:
            print("  Languages:")
            for lang, count in sorted(self.language_breakdown.items(), key=lambda x: -x[1]):
                print(f"    {lang}: {count}")
        print()
        if self.role_breakdown:
            print("  Roles:")
            for role, count in sorted(self.role_breakdown.items(), key=lambda x: -x[1]):
                print(f"    {role}: {count}")
        if self.errors:
            print()
            print(f"  Errors ({len(self.errors)}):")
            for e in self.errors[:10]:
                print(f"    {e}")
        print(f"{'='*60}\n")


# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

# Directories to always skip entirely
IGNORED_DIRS = {
    ".git", ".hg", ".svn",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "node_modules", "bower_components",
    ".venv", "venv", "env", ".env",
    ".tox", ".nox",
    "dist", "build", "egg-info",
    ".eggs", "*.egg-info",
    ".idea", ".vscode", ".vs",
    "coverage", "htmlcov", ".coverage",
    ".terraform", ".serverless",
}

# Binary extensions (never scan contents)
BINARY_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
    ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".pptx",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
    ".whl", ".egg",
    ".pyc", ".pyo", ".so", ".dll", ".dylib", ".o", ".a",
    ".exe", ".bin",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".sqlite", ".db",
}

# Lock files (skip, no useful code)
LOCK_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "poetry.lock", "Pipfile.lock", "Gemfile.lock",
    "composer.lock", "Cargo.lock", "go.sum",
}

# Generated file patterns (path substrings that indicate generated code)
GENERATED_PATTERNS = [
    "/generated/", "/auto_generated/", "/autogen/",
    "_pb2.py", "_pb2_grpc.py",           # protobuf
    ".generated.", ".auto.",
    "/migrations/",                        # database migrations are generated-ish
    "swagger_client/", "openapi_client/",  # API client generators
]

# Vendor patterns
VENDOR_PATTERNS = [
    "/vendor/", "/third_party/", "/extern/", "/deps/",
]

# Max file size to include (500KB, anything larger is likely data or generated)
MAX_FILE_SIZE = 500_000

# Extension to language mapping
EXTENSION_LANGUAGE_MAP = {
    # Python
    ".py": "python", ".pyi": "python", ".pyw": "python",
    # JavaScript / TypeScript
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".ts": "typescript", ".tsx": "typescript",
    # Go
    ".go": "go",
    # Java / Kotlin
    ".java": "java", ".kt": "kotlin", ".kts": "kotlin",
    # Rust
    ".rs": "rust",
    # C / C++
    ".c": "c", ".h": "c", ".cpp": "cpp", ".hpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
    # C#
    ".cs": "csharp",
    # Ruby
    ".rb": "ruby", ".rake": "ruby",
    # PHP
    ".php": "php",
    # Swift
    ".swift": "swift",
    # Shell
    ".sh": "shell", ".bash": "shell", ".zsh": "shell",
    ".ps1": "powershell", ".psm1": "powershell",
    # Web
    ".html": "html", ".htm": "html",
    ".css": "css", ".scss": "scss", ".sass": "sass", ".less": "less",
    # Config
    ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
    ".ini": "ini", ".cfg": "ini", ".conf": "ini",
    ".xml": "xml",
    ".env": "dotenv",
    # Documentation
    ".md": "markdown", ".rst": "rst", ".txt": "text",
    # Data
    ".csv": "csv", ".tsv": "tsv",
    # SQL
    ".sql": "sql",
    # Docker
    ".dockerfile": "docker",
    # Misc
    ".graphql": "graphql", ".gql": "graphql",
    ".proto": "protobuf",
    ".r": "r", ".R": "r",
    ".lua": "lua",
    ".dart": "dart",
    ".ex": "elixir", ".exs": "elixir",
    ".erl": "erlang",
    ".hs": "haskell",
    ".scala": "scala",
    ".clj": "clojure",
}

# Special filenames that have known roles regardless of extension
SPECIAL_FILENAMES = {
    "Dockerfile": ("docker", FileRole.CONFIG),
    "docker-compose.yml": ("yaml", FileRole.CONFIG),
    "docker-compose.yaml": ("yaml", FileRole.CONFIG),
    "Makefile": ("make", FileRole.SCRIPT),
    "Procfile": ("text", FileRole.CONFIG),
    "Vagrantfile": ("ruby", FileRole.CONFIG),
    "Rakefile": ("ruby", FileRole.SCRIPT),
    "Jenkinsfile": ("groovy", FileRole.CONFIG),
    ".gitignore": ("text", FileRole.CONFIG),
    ".dockerignore": ("text", FileRole.CONFIG),
    ".editorconfig": ("ini", FileRole.CONFIG),
    ".flake8": ("ini", FileRole.CONFIG),
    ".pylintrc": ("ini", FileRole.CONFIG),
    "setup.py": ("python", FileRole.CONFIG),
    "setup.cfg": ("ini", FileRole.CONFIG),
    "pyproject.toml": ("toml", FileRole.CONFIG),
    "requirements.txt": ("text", FileRole.CONFIG),
    "constraints.txt": ("text", FileRole.CONFIG),
    "tox.ini": ("ini", FileRole.CONFIG),
    "pytest.ini": ("ini", FileRole.CONFIG),
    "mypy.ini": ("ini", FileRole.CONFIG),
    "package.json": ("json", FileRole.CONFIG),
    "tsconfig.json": ("json", FileRole.CONFIG),
    "webpack.config.js": ("javascript", FileRole.CONFIG),
    "babel.config.js": ("javascript", FileRole.CONFIG),
    ".babelrc": ("json", FileRole.CONFIG),
    ".eslintrc": ("json", FileRole.CONFIG),
    ".eslintrc.json": ("json", FileRole.CONFIG),
    ".prettierrc": ("json", FileRole.CONFIG),
    "go.mod": ("go", FileRole.CONFIG),
    "Cargo.toml": ("toml", FileRole.CONFIG),
    "Gemfile": ("ruby", FileRole.CONFIG),
    "composer.json": ("json", FileRole.CONFIG),
    "CONTRIBUTING.md": ("markdown", FileRole.DOCUMENTATION),
    "CHANGELOG.md": ("markdown", FileRole.DOCUMENTATION),
    "LICENSE": ("text", FileRole.DOCUMENTATION),
    "LICENSE.md": ("markdown", FileRole.DOCUMENTATION),
    "LICENSE.txt": ("text", FileRole.DOCUMENTATION),
    "README.md": ("markdown", FileRole.DOCUMENTATION),
    "README.rst": ("rst", FileRole.DOCUMENTATION),
    "README.txt": ("text", FileRole.DOCUMENTATION),
    "README": ("text", FileRole.DOCUMENTATION),
    "SECURITY.md": ("markdown", FileRole.DOCUMENTATION),
    "CODE_OF_CONDUCT.md": ("markdown", FileRole.DOCUMENTATION),
}


# ═══════════════════════════════════════════════════════════════════════════
# CLASSIFICATION LOGIC
# ═══════════════════════════════════════════════════════════════════════════

def detect_language(filename: str, extension: str) -> str:
    """Detect the programming language from filename and extension."""
    # Check special filenames first
    if filename in SPECIAL_FILENAMES:
        return SPECIAL_FILENAMES[filename][0]

    # Extension-based detection
    lang = EXTENSION_LANGUAGE_MAP.get(extension.lower())
    if lang:
        return lang

    # No extension or unrecognized
    return "unknown"


def classify_role(path: str, filename: str, extension: str, language: str) -> FileRole:
    """
    Classify the file's role in the project.
    
    Order matters. More specific checks first, general checks last.
    """
    path_lower = path.lower().replace("\\", "/")
    filename_lower = filename.lower()

    # Special filenames have predetermined roles
    if filename in SPECIAL_FILENAMES:
        return SPECIAL_FILENAMES[filename][1]

    # Lock files
    if filename in LOCK_FILES:
        return FileRole.LOCK

    # Binary files
    if extension.lower() in BINARY_EXTS:
        return FileRole.BINARY

    # Generated code (check path patterns)
    for pattern in GENERATED_PATTERNS:
        if pattern in path_lower:
            return FileRole.GENERATED

    # Vendor code
    for pattern in VENDOR_PATTERNS:
        if pattern in path_lower:
            return FileRole.VENDOR

    # Migrations (more specific check)
    if "/migrations/" in path_lower or "/migrate/" in path_lower:
        if extension.lower() in (".py", ".sql", ".rb", ".ts", ".js"):
            return FileRole.MIGRATION

    # Test files
    if _is_test_file(path_lower, filename_lower):
        return FileRole.TEST

    # Type definitions
    if extension.lower() in (".pyi", ".d.ts"):
        return FileRole.TYPE_DEFINITION

    # Documentation
    if language in ("markdown", "rst", "text") or extension.lower() in (".md", ".rst"):
        return FileRole.DOCUMENTATION
    if "/docs/" in path_lower or "/documentation/" in path_lower:
        return FileRole.DOCUMENTATION

    # Config files
    if language in ("json", "yaml", "toml", "ini", "dotenv", "xml"):
        return FileRole.CONFIG
    if filename_lower.startswith(".") and extension.lower() in (".json", ".yaml", ".yml", ".toml"):
        return FileRole.CONFIG

    # Scripts (build, CI, utilities)
    if language in ("shell", "powershell", "make"):
        return FileRole.SCRIPT
    if "/scripts/" in path_lower or "/bin/" in path_lower or "/tools/" in path_lower:
        return FileRole.SCRIPT
    if "ci" in path_lower and ("/" in path_lower):
        return FileRole.SCRIPT

    # Data files
    if language in ("csv", "tsv"):
        return FileRole.DATA
    if "/data/" in path_lower or "/fixtures/" in path_lower or "/seeds/" in path_lower:
        return FileRole.DATA

    # If it's a recognized programming language, it's source code
    if language not in ("unknown", "text"):
        return FileRole.SOURCE

    return FileRole.UNKNOWN


def _is_test_file(path_lower: str, filename_lower: str) -> bool:
    """Determine if a file is a test file."""
    # Test directories
    test_dirs = ["/tests/", "/test/", "/__tests__/", "/spec/", "/specs/"]
    if any(d in path_lower for d in test_dirs):
        return True

    # Test file naming conventions
    if filename_lower.startswith("test_") or filename_lower.startswith("tests_"):
        return True
    if filename_lower.endswith("_test.py") or filename_lower.endswith("_tests.py"):
        return True
    if filename_lower.endswith(".test.js") or filename_lower.endswith(".test.ts"):
        return True
    if filename_lower.endswith(".test.jsx") or filename_lower.endswith(".test.tsx"):
        return True
    if filename_lower.endswith(".spec.js") or filename_lower.endswith(".spec.ts"):
        return True
    if filename_lower.endswith("_spec.rb"):
        return True
    if filename_lower == "conftest.py":
        return True

    return False


def should_skip(path: str, filename: str, extension: str, size_bytes: int, role: FileRole) -> Optional[SkipReason]:
    """
    Determine if a file should be skipped from the scan.
    Returns the skip reason, or None if the file should be included.
    """
    # Binary files
    if role == FileRole.BINARY or extension.lower() in BINARY_EXTS:
        return SkipReason.BINARY

    # Lock files
    if filename in LOCK_FILES:
        return SkipReason.LOCK_FILE

    # Too large
    if size_bytes > MAX_FILE_SIZE:
        return SkipReason.TOO_LARGE

    # Empty files
    if size_bytes == 0:
        return SkipReason.EMPTY

    # Vendor code
    if role == FileRole.VENDOR:
        return SkipReason.VENDOR

    # Generated code (still include migrations, they can have issues)
    if role == FileRole.GENERATED:
        return SkipReason.GENERATED

    return None


def should_skip_dir(dirname: str) -> bool:
    """Check if an entire directory should be skipped."""
    if dirname.startswith("."):
        return True
    if dirname in IGNORED_DIRS:
        return True
    if dirname.endswith(".egg-info"):
        return True
    return False


# ═══════════════════════════════════════════════════════════════════════════
# FILEWALKER CORE
# ═══════════════════════════════════════════════════════════════════════════

class FileWalker:
    """
    Traverses a project directory and produces a complete file inventory.
    
    Usage:
        walker = FileWalker(project_root="C:/MyProject")
        result = walker.scan()
        result.print_summary()
    """

    def __init__(self, project_root: str, max_file_size: int = MAX_FILE_SIZE):
        self.project_root = os.path.abspath(project_root)
        self.max_file_size = max_file_size

        if not os.path.isdir(self.project_root):
            raise ValueError(f"Project root is not a directory: {self.project_root}")

    def scan(self) -> WalkerResult:
        """
        INIT + PROCESS + CERTIFY + REPORT in one call.
        
        Walk the directory tree. Classify every file. Skip what should be
        skipped. Return a certified result where every file is accounted for.
        """
        start_time = time.perf_counter()

        included = []
        skipped = []
        total_files = 0
        errors = []
        lang_counts = {}
        role_counts = {}

        for dirpath, dirnames, filenames in os.walk(self.project_root):
            # Filter out ignored directories IN PLACE (prevents os.walk from descending)
            dirnames[:] = [
                d for d in dirnames
                if not should_skip_dir(d)
            ]

            for filename in filenames:
                total_files += 1

                try:
                    full_path = os.path.join(dirpath, filename)
                    rel_path = os.path.relpath(full_path, self.project_root).replace("\\", "/")
                    extension = os.path.splitext(filename)[1].lower()

                    # Get file size (handle permission errors gracefully)
                    try:
                        size_bytes = os.path.getsize(full_path)
                    except OSError as e:
                        errors.append(f"Cannot stat {rel_path}: {e}")
                        size_bytes = 0

                    # Detect language and classify role
                    language = detect_language(filename, extension)
                    role = classify_role(rel_path, filename, extension, language)

                    # Check if file should be skipped
                    skip_reason = should_skip(rel_path, filename, extension, size_bytes, role)

                    entry = FileEntry(
                        path=rel_path,
                        filename=filename,
                        extension=extension,
                        language=language,
                        size_bytes=size_bytes,
                        role=role,
                        included=skip_reason is None,
                        skip_reason=skip_reason,
                    )

                    if skip_reason:
                        skipped.append(entry)
                    else:
                        included.append(entry)
                        # Count languages and roles for included files only
                        lang_counts[language] = lang_counts.get(language, 0) + 1
                        role_counts[role.value] = role_counts.get(role.value, 0) + 1

                except Exception as e:
                    errors.append(f"Error processing {filename}: {e}")

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        result = WalkerResult(
            project_root=self.project_root,
            scan_time_ms=round(elapsed_ms, 2),
            total_files=total_files,
            included_files=sorted(included, key=lambda f: f.path),
            skipped_files=sorted(skipped, key=lambda f: f.path),
            language_breakdown=lang_counts,
            role_breakdown=role_counts,
            errors=errors,
        )

        # ── CERTIFY ──
        if not result.certified:
            missing = total_files - result.included_count - result.skipped_count
            errors.append(
                f"CERTIFICATION FAILED: {missing} files unaccounted for "
                f"(total={total_files}, included={result.included_count}, "
                f"skipped={result.skipped_count})"
            )

        return result

    def scan_to_json(self, output_path: str) -> WalkerResult:
        """Scan and write results to a JSON file."""
        result = self.scan()
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result.to_dict(), f, indent=2, ensure_ascii=False)
        print(f"[FileWalker] Wrote {output_path}")
        return result


# ═══════════════════════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python file_walker.py <project_root> [output.json]")
        print("  project_root: Path to the project directory to scan")
        print("  output.json:  Optional path to write JSON results")
        sys.exit(1)

    project_root = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    walker = FileWalker(project_root)

    if output_path:
        result = walker.scan_to_json(output_path)
    else:
        result = walker.scan()

    result.print_summary()
