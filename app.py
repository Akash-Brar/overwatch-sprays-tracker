import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

SPRAYS_FILE = "sprays.json"
USER_FIELDS = {"involvedHeroes"}   # whitelist of editable custom fields

app = FastAPI()

# allows local frontend (e.g. http://localhost:5173) to call this
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_sprays():
    if not os.path.exists(SPRAYS_FILE):
        return []
    with open(SPRAYS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_sprays(sprays):
    with open(SPRAYS_FILE, "w", encoding="utf-8") as f:
        json.dump(sprays, f, ensure_ascii=False, indent=2)


class SprayPatch(BaseModel):
    involvedHeroes: list[str] | None = None
    # add more user-editable fields here as needed


@app.get("/api/sprays")
def get_sprays():
    return load_sprays()


@app.patch("/api/sprays/{guid}")
def patch_spray(guid: str, patch: SprayPatch):
    sprays = load_sprays()
    for spray in sprays:
        if spray.get("guid") == guid:
            for field, value in patch.dict(exclude_unset=True).items():
                if field in USER_FIELDS:
                    spray[field] = value
            save_sprays(sprays)
            return spray
    raise HTTPException(status_code=404, detail=f"No spray with guid {guid}")