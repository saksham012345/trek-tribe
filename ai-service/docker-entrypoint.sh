#!/bin/sh
# Entrypoint wrapper for Render deployment
cd /app
exec python /app/entrypoint.py
