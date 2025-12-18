import json
from pathlib import Path

from rag_system.config import RAG_CONFIG
from rag_system.knowledge_loader import KnowledgeLoader
from rag_system.embeddings import EmbeddingManager
from rag_system.retriever import FAISSRetriever
from rag_system.generator import TextGenerator


def run():
    loader = KnowledgeLoader(RAG_CONFIG["knowledge_path"])
    docs = loader.load()
    assert docs, "No documents loaded"

    embed = EmbeddingManager(RAG_CONFIG["model_name"], RAG_CONFIG["cache_dir"])
    embs = embed.embed_documents(docs)
    ret = FAISSRetriever(RAG_CONFIG["embedding_dim"])
    ret.build_index(embs, docs)

    # Test queries
    queries = [
        "how to create a trip",
        "talk to a human agent",
        "payment methods",
    ]

    gen = TextGenerator()

    results_summary = {}
    for q in queries:
        q_emb = embed.embed_query(q)
        top = ret.retrieve(q_emb, 3)
        contexts = [
            {"id": d.get("id"), "title": d.get("title"), "content": d.get("content")}
            for d, s in top
        ]
        # Generate short answer (dev model by default)
        answer = gen.generate(q, contexts)
        results_summary[q] = {
            "top_titles": [d.get("title") for d, _ in top],
            "answer_preview": answer[:200],
        }

    print(json.dumps(results_summary, indent=2))


if __name__ == "__main__":
    run()
