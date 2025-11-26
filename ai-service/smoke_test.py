"""Smoke test for AI service endpoints.

Requires env AI_SERVICE_URL and AI_SERVICE_KEY.
"""
import os
import requests
import sys

URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8000")
KEY = os.environ.get("AI_SERVICE_KEY", "dev-ai-key-123")

def call(path, json=None):
    headers = {"x-api-key": KEY}
    r = requests.post(URL + path, json=json, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()

def main():
    print('health ->', requests.get(URL + '/health').json())
    print('ready ->', requests.get(URL + '/ready').json())

    # test retrieve
    try:
        print('retrieve ->', call('/retrieve', {"query":"How to create a trip?","top_k":2}))
    except Exception as e:
        print('retrieve failed', e)

    # test generate
    try:
        resp = call('/generate', {"prompt":"I cannot login, please create a ticket for me.", "max_tokens":80})
        print('generate ->', resp)
    except Exception as e:
        print('generate failed', e)

if __name__ == '__main__':
    main()
