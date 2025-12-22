import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from app.scraper import scrape_naukri, search_and_download_resumes

load_dotenv()

app = FastAPI(title="Naukri Resdex Scraper API")


class ScrapeRequest(BaseModel):
    keywords: str = Field(..., example="python developer")
    location: str = Field(..., example="Bangalore")


@app.get("/")
def root_read():
    return {"message", "Hello from FastAPI"}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/scrape")
def scrape(req: ScrapeRequest):
    email = os.getenv("NAUKRI_EMAIL")
    password = os.getenv("NAUKRI_PASSWORD")

    if not email or not password:
        raise HTTPException(status_code=500, detail="Missing NAUKRI_EMAIL / NAUKRI_PASSWORD in .env")

    headless_env = (os.getenv("HEADLESS", "true") or "true").strip().lower()
    headless = headless_env in ("1", "true", "yes", "y")

    try:
        data = scrape_naukri(
            keywords=req.keywords,
            location=req.location,
            email=email,
            password=password,
            headless=headless,
        )
        return {"count": len(data), "candidates": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DownloadRequest(BaseModel):
    keywords: str = Field(..., example="python developer")
    location: str = Field(..., example="Bangalore")
    max_resumes: int = Field(default=20, ge=1, le=50, example=20)


@app.post("/search-download")
def search_download(req: DownloadRequest):
    """
    Search for candidates and download their resumes.

    - **keywords**: Search keywords (e.g., "python developer", "java backend")
    - **location**: Location filter (e.g., "Bangalore", "Mumbai")
    - **max_resumes**: Maximum number of resumes to download (1-50, default: 20)

    Returns list of downloaded file paths and candidate details.
    """
    email = os.getenv("NAUKRI_EMAIL")
    password = os.getenv("NAUKRI_PASSWORD")

    if not email or not password:
        raise HTTPException(status_code=500, detail="Missing NAUKRI_EMAIL / NAUKRI_PASSWORD in .env")

    headless_env = (os.getenv("HEADLESS", "true") or "true").strip().lower()
    headless = headless_env in ("1", "true", "yes", "y")

    try:
        result = search_and_download_resumes(
            keywords=req.keywords,
            location=req.location,
            email=email,
            password=password,
            headless=headless,
            max_resumes=req.max_resumes,
        )
        return {
            "success": True,
            "downloaded_count": len(result.get("downloaded_files", [])),
            "downloaded_files": result.get("downloaded_files", []),
            "candidates": result.get("candidates", []),
            "errors": result.get("errors"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
