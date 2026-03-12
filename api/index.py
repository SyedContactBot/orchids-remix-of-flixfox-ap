"""
Vercel serverless entry point for FastAPI.
Vercel auto-detects this as a Python serverless function.
"""
from app.main import app  # noqa: F401

# Vercel expects a variable named `app` or `handler`
handler = app
