"""
RAG System Package
Retrieval-Augmented Generation system for Trek Tribe
"""

from .core import RAGSystem, DocumentStore, TextGenerator
from .knowledge_loader import KnowledgeBaseLoader

__version__ = "1.0.0"
__all__ = [
    "RAGSystem",
    "DocumentStore",
    "TextGenerator",
    "KnowledgeBaseLoader"
]
