"""Rebuild the upload archive from the current project source."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
files = ["index.html", "package.json", "package-lock.json", "vite.config.js", "README.md", ".gitignore"]
folders = ["src", "public", ".codesandbox", "scripts"]
archive = root / "时间长河-CodeSandbox.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as output:
    for name in files:
        path = root / name
        output.write(path, name)
    for name in folders:
        for path in sorted((root / name).rglob("*")):
            if path.is_file():
                output.write(path, path.relative_to(root))
print(archive)
