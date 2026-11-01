"""Generate the frontend runtime configuration during a Netlify build."""

import json
import os
from pathlib import Path

backend_url = os.environ.get("BACKEND_URL", "").strip().rstrip("/")
config = {"backendUrl": backend_url}
Path("static/config.js").write_text(
    f"window.EGO1_CONFIG = {json.dumps(config)};\n",
    encoding="utf-8",
)
