"""
RAG System Core Module - Retrieval and Generation Pipeline
This module handles all RAG operations including embeddings, retrieval, and text generation
"""
import os
import json
import pickle
import logging
from typing import List, Dict, Tuple, Optional, Any
from pathlib import Path
import numpy as np

import torch
from sentence_transformers import SentenceTransformer
from transformers import GPT2Tokenizer, GPT2LMHeadModel, pipeline
import faiss

logger = logging.getLogger(__name__)


class DocumentStore:
    """Manages the document database and FAISS index"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", data_dir: str = "./data"):
        """
        Initialize document store with embedding model
        
        Args:
            model_name: Sentence transformer model to use
            data_dir: Directory to store embeddings and documents
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        # Initialize embedding model
        logger.info(f"Loading embedding model: {model_name}")
        self.embedding_model = SentenceTransformer(model_name)
        self.embedding_dim = self.embedding_model.get_sentence_embedding_dimension()
        
        # Paths for persistence
        self.index_path = self.data_dir / "faiss_index.bin"
        self.docs_path = self.data_dir / "documents.json"
        self.metadata_path = self.data_dir / "metadata.json"
        
        # Initialize FAISS index
        self.index: Optional[faiss.IndexFlatL2] = None
        self.documents: List[Dict[str, Any]] = []
        self.metadata: Dict[str, Any] = {"total_docs": 0, "model": model_name}
        
        # Load existing index if available
        self.load()
    
    def add_documents(self, documents: List[Dict[str, Any]]) -> None:
        """
        Add documents to the store and update FAISS index
        
        Args:
            documents: List of documents with 'id', 'text', 'source', and optional 'metadata'
        """
        logger.info(f"Adding {len(documents)} documents to store")
        
        # Extract texts for embedding
        texts = [doc.get("text", "") for doc in documents]
        
        # Generate embeddings
        logger.info("Generating embeddings...")
        embeddings = self.embedding_model.encode(texts, show_progress_bar=True)
        embeddings = embeddings.astype(np.float32)
        
        # Create or update FAISS index
        if self.index is None:
            self.index = faiss.IndexFlatL2(self.embedding_dim)
        
        # Add embeddings to index
        self.index.add(embeddings)
        
        # Store documents
        self.documents.extend(documents)
        self.metadata["total_docs"] = len(self.documents)
        
        logger.info(f"Total documents in store: {len(self.documents)}")
    
    def retrieve(self, query: str, top_k: int = 3) -> List[Tuple[float, Dict[str, Any]]]:
        """
        Retrieve top-k most relevant documents for a query
        
        Args:
            query: Query text
            top_k: Number of documents to retrieve
            
        Returns:
            List of (score, document) tuples
        """
        if self.index is None or len(self.documents) == 0:
            logger.warning("Document store is empty")
            return []
        
        # Generate query embedding
        query_embedding = self.embedding_model.encode([query], convert_to_numpy=True).astype(np.float32)
        
        # Search in FAISS index
        distances, indices = self.index.search(query_embedding, min(top_k, len(self.documents)))
        
        # Convert distances to similarity scores (lower distance = higher similarity)
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < len(self.documents):
                score = 1.0 / (1.0 + dist)  # Convert distance to similarity
                results.append((score, self.documents[idx]))
        
        return results
    
    def save(self) -> None:
        """Save index and documents to disk"""
        logger.info(f"Saving RAG data to {self.data_dir}")
        
        # Save FAISS index
        if self.index is not None:
            faiss.write_index(self.index, str(self.index_path))
        
        # Save documents
        with open(self.docs_path, 'w', encoding='utf-8') as f:
            json.dump(self.documents, f, indent=2, ensure_ascii=False)
        
        # Save metadata
        with open(self.metadata_path, 'w', encoding='utf-8') as f:
            json.dump(self.metadata, f, indent=2)
        
        logger.info("RAG data saved successfully")
    
    def load(self) -> bool:
        """Load index and documents from disk"""
        if not self.index_path.exists() or not self.docs_path.exists():
            logger.info("No existing RAG data found")
            return False
        
        try:
            logger.info(f"Loading RAG data from {self.data_dir}")
            
            # Load FAISS index
            self.index = faiss.read_index(str(self.index_path))
            
            # Load documents
            with open(self.docs_path, 'r', encoding='utf-8') as f:
                self.documents = json.load(f)
            
            # Load metadata
            if self.metadata_path.exists():
                with open(self.metadata_path, 'r', encoding='utf-8') as f:
                    self.metadata = json.load(f)
            
            logger.info(f"Loaded {len(self.documents)} documents from disk")
            return True
        except Exception as e:
            logger.error(f"Error loading RAG data: {e}")
            return False


class TextGenerator:
    """Handles text generation using GPT-2"""
    
    def __init__(self, model_name: str = "gpt2-large", device: str = "auto"):
        """
        Initialize text generator
        
        Args:
            model_name: HuggingFace model identifier
            device: Device to run on ('cpu', 'cuda', or 'auto')
        """
        # Auto-detect device if requested
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        
        self.device = device
        logger.info(f"Using device: {self.device}")
        
        # Load tokenizer
        logger.info(f"Loading tokenizer: {model_name}")
        self.tokenizer = GPT2Tokenizer.from_pretrained(model_name)
        
        # Load model
        logger.info(f"Loading model: {model_name}")
        self.model = GPT2LMHeadModel.from_pretrained(model_name).to(self.device)
        self.model.eval()
        
        # Create pipeline for easier inference
        self.generator = pipeline(
            "text-generation",
            model=self.model,
            tokenizer=self.tokenizer,
            device=0 if self.device == "cuda" else -1
        )
    
    def generate(
        self,
        prompt: str,
        max_length: int = 200,
        temperature: float = 0.7,
        top_k: int = 50,
        top_p: float = 0.95
    ) -> str:
        """
        Generate text given a prompt
        
        Args:
            prompt: Input prompt
            max_length: Maximum length of generated text
            temperature: Sampling temperature
            top_k: Top-k sampling parameter
            top_p: Top-p (nucleus) sampling parameter
            
        Returns:
            Generated text
        """
        try:
            outputs = self.generator(
                prompt,
                max_length=max_length,
                temperature=temperature,
                top_k=top_k,
                top_p=top_p,
                do_sample=True,
                num_return_sequences=1,
                pad_token_id=self.tokenizer.eos_token_id,
            )
            
            # Extract generated text and remove prompt
            generated = outputs[0]["generated_text"]
            if generated.startswith(prompt):
                generated = generated[len(prompt):].strip()
            
            return generated
        except Exception as e:
            logger.error(f"Error generating text: {e}")
            return ""


class RAGSystem:
    """Complete Retrieval-Augmented Generation System"""
    
    def __init__(
        self,
        embedding_model: str = "all-MiniLM-L6-v2",
        generation_model: str = "gpt2-large",
        data_dir: str = "./data",
        device: str = "auto"
    ):
        """
        Initialize RAG system
        
        Args:
            embedding_model: Sentence transformer model
            generation_model: GPT-2 model
            data_dir: Directory for data storage
            device: Device to use
        """
        self.document_store = DocumentStore(embedding_model, data_dir)
        self.generator = TextGenerator(generation_model, device)
    
    def ingest_documents(self, documents: List[Dict[str, Any]]) -> None:
        """
        Ingest documents into the RAG system
        
        Args:
            documents: List of documents to ingest
        """
        self.document_store.add_documents(documents)
        self.document_store.save()
    
    def query(
        self,
        query: str,
        top_k: int = 3,
        max_generation_length: int = 200,
        include_sources: bool = True
    ) -> Dict[str, Any]:
        """
        Query the RAG system and generate answer
        
        Args:
            query: User query
            top_k: Number of documents to retrieve
            max_generation_length: Maximum length of generated answer
            include_sources: Whether to include source information
            
        Returns:
            Dictionary with generated answer and sources
        """
        logger.info(f"Processing query: {query}")
        
        # Step 1: Retrieve relevant documents
        retrieved_docs = self.document_store.retrieve(query, top_k)
        
        if not retrieved_docs:
            logger.warning("No relevant documents found")
            return {
                "answer": "I don't have information to answer this question.",
                "sources": [],
                "context": ""
            }
        
        # Step 2: Prepare context from retrieved documents
        context_parts = []
        sources = []
        
        for score, doc in retrieved_docs:
            context_parts.append(doc.get("text", ""))
            sources.append({
                "source": doc.get("source", "unknown"),
                "title": doc.get("title", ""),
                "score": float(score)
            })
        
        context = "\n\n".join(context_parts)
        
        # Step 3: Create augmented prompt
        prompt = self._create_prompt(query, context)
        
        logger.info(f"Generated prompt (length: {len(prompt)} chars)")
        
        # Step 4: Generate answer
        answer = self.generator.generate(
            prompt,
            max_length=max_generation_length,
            temperature=0.7
        )
        
        result = {
            "answer": answer,
            "context": context,
            "sources": sources if include_sources else []
        }
        
        logger.info("Query processed successfully")
        return result
    
    def _create_prompt(self, query: str, context: str) -> str:
        """
        Create an augmented prompt with context
        
        Args:
            query: User query
            context: Retrieved context
            
        Returns:
            Augmented prompt
        """
        prompt = f"""Based on the following context, answer the question concisely and helpfully.

Context:
{context}

Question: {query}

Answer:"""
        return prompt
    
    def save(self) -> None:
        """Save all RAG components"""
        self.document_store.save()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the RAG system"""
        return {
            "total_documents": len(self.document_store.documents),
            "embedding_model": self.document_store.metadata.get("model", "unknown"),
            "index_dimension": self.document_store.embedding_dim,
            "index_type": "FAISS Flat L2"
        }
