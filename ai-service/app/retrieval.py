import os
import json
import pickle
from typing import List, Tuple

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

from . import config

# Simple TF-IDF retrieval module
DATA_DIR = config.DATA_DIR
INDEX_PATH = os.path.join(DATA_DIR, 'tfidf_index.pkl')
DOCS_PATH = os.path.join(DATA_DIR, 'tfidf_docs.json')
META_PATH = os.path.join(DATA_DIR, 'tfidf_index_meta.json')

# Runtime flag
RETRIEVAL_INDEX_LOADED = False


def ensure_data_dir():
    d = os.path.dirname(INDEX_PATH)
    if not os.path.exists(d):
        os.makedirs(d, exist_ok=True)


def load_index():
    """Load vectorizer, tfidf matrix, docs and optional index meta.

    Returns (vectorizer, matrix, docs, meta_dict) or (None, None, None, None)
    if index files are missing.
    """
    if not os.path.exists(INDEX_PATH) or not os.path.exists(DOCS_PATH):
        return None, None, None, None
    with open(INDEX_PATH, 'rb') as f:
        vec, matrix = pickle.load(f)
    with open(DOCS_PATH, 'r', encoding='utf-8') as f:
        docs = json.load(f)
    meta = None
    if os.path.exists(META_PATH):
        try:
            with open(META_PATH, 'r', encoding='utf-8') as f:
                meta = json.load(f)
        except Exception:
            meta = None
    global RETRIEVAL_INDEX_LOADED
    RETRIEVAL_INDEX_LOADED = True
    return vec, matrix, docs, meta


def save_index(vectorizer, tfidf_matrix, docs: List[dict], *, model_name: str = None, tokenizer_version: str = None):
    """Save index and docs, and write metadata about the index.

    This will overwrite existing files.
    """
    ensure_data_dir()
    with open(INDEX_PATH, 'wb') as f:
        pickle.dump((vectorizer, tfidf_matrix), f)
    with open(DOCS_PATH, 'w', encoding='utf-8') as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)
    meta = {"model_name": model_name, "tokenizer_version": tokenizer_version}
    try:
        with open(META_PATH, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
    except Exception:
        # non-fatal
        pass
    global RETRIEVAL_INDEX_LOADED
    RETRIEVAL_INDEX_LOADED = True


def retrieve(query: str, top_k: int = 3) -> List[Tuple[float, dict]]:
    """Return list of (score, doc) tuples."""
    vec, matrix, docs, _meta = load_index()
    if vec is None or matrix is None or docs is None:
        return []

    q_vec = vec.transform([query])
    # cosine similarity via linear_kernel is efficient for TF-IDF
    sim = linear_kernel(q_vec, matrix).flatten()
    idxs = sim.argsort()[::-1][:top_k]
    results = []
    for i in idxs:
        if sim[i] <= 0:
            continue
        results.append((float(sim[i]), docs[i]))
    return results


def build_index_from_texts(texts: List[str], metadata: List[dict], *, model_name: str = None, tokenizer_version: str = None, **kwargs):
    """Build TF-IDF index from a list of texts and corresponding metadata.

    `metadata` is a list of dicts (e.g., {"source": path, "excerpt": text}).
    """
    if len(texts) == 0:
        raise ValueError('No texts provided to build index')

    vectorizer = TfidfVectorizer(stop_words='english', max_df=0.9, min_df=1, **kwargs)
    tfidf = vectorizer.fit_transform(texts)

    docs = []
    for md, txt in zip(metadata, texts):
        entry = dict(md)
        entry.setdefault('text', txt)
        docs.append(entry)

    save_index(vectorizer, tfidf, docs, model_name=model_name, tokenizer_version=tokenizer_version)
    return vectorizer, tfidf, docs


def reload_index():
    """Reloads index into memory by calling load_index and returning meta.

    Returns meta dict or None.
    """
    _, _, _, meta = load_index()
    return meta


def verify_index_matches_model(expected_model_name: str = None, expected_tokenizer_version: str = None) -> bool:
    """Checks the saved index metadata against expected values. If meta is missing,
    returns False.
    """
    if not os.path.exists(META_PATH):
        return False
    try:
        with open(META_PATH, 'r', encoding='utf-8') as f:
            meta = json.load(f)
    except Exception:
        return False
    if expected_model_name and meta.get('model_name') != expected_model_name:
        return False
    if expected_tokenizer_version and meta.get('tokenizer_version') != expected_tokenizer_version:
        return False
    return True
