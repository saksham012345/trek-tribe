"""
FastAPI Service for RAG System
Exposes RAG endpoints for website integration
"""
import os
import logging
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .core import RAGSystem
from .knowledge_loader import KnowledgeBaseLoader

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# RAG System instance (will be initialized on startup)
rag_system: Optional[RAGSystem] = None


# Request/Response Models
class QueryRequest(BaseModel):
    """Request model for RAG query endpoint"""
    query: str
    top_k: int = 3
    include_sources: bool = True
    max_generation_length: int = 200


class DocumentRequest(BaseModel):
    """Request model for document ingestion"""
    documents: List[Dict[str, Any]]


class QueryResponse(BaseModel):
    """Response model for RAG query"""
    answer: str
    context: str
    sources: List[Dict[str, Any]]
    query: str


class StatsResponse(BaseModel):
    """Response model for system statistics"""
    total_documents: int
    embedding_model: str
    index_dimension: int
    index_type: str
    status: str


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    rag_system_ready: bool
    documents_loaded: int


# Startup/Shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage RAG system lifecycle
    Startup: Initialize RAG system and load knowledge base
    Shutdown: Save RAG system state
    """
    # Startup
    logger.info("🚀 Starting RAG System...")
    try:
        global rag_system
        
        # Get configuration from environment
        embedding_model = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        generation_model = os.getenv("GENERATION_MODEL", "gpt2-large")
        data_dir = os.getenv("RAG_DATA_DIR", "./rag_data")
        device = os.getenv("DEVICE", "auto")
        
        logger.info(f"Initializing RAG System with:")
        logger.info(f"  - Embedding Model: {embedding_model}")
        logger.info(f"  - Generation Model: {generation_model}")
        logger.info(f"  - Data Dir: {data_dir}")
        logger.info(f"  - Device: {device}")
        
        # Initialize RAG system
        rag_system = RAGSystem(
            embedding_model=embedding_model,
            generation_model=generation_model,
            data_dir=data_dir,
            device=device
        )
        
        # Load knowledge base
        logger.info("📚 Loading knowledge base...")
        documents = KnowledgeBaseLoader.load_all_knowledge()
        rag_system.ingest_documents(documents)
        
        logger.info(f"✅ RAG System initialized with {len(documents)} documents")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize RAG system: {e}", exc_info=True)
        raise
    
    yield
    
    # Shutdown
    logger.info("💾 Saving RAG System state...")
    try:
        if rag_system:
            rag_system.save()
            logger.info("✅ RAG System saved successfully")
    except Exception as e:
        logger.error(f"❌ Error saving RAG system: {e}")


# Create FastAPI app
app = FastAPI(
    title="Trek Tribe RAG System API",
    description="Retrieval-Augmented Generation system for Trek Tribe website knowledge",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware for website integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health Check Endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns status of RAG system
    """
    if rag_system is None:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    return HealthResponse(
        status="healthy",
        rag_system_ready=True,
        documents_loaded=len(rag_system.document_store.documents)
    )


@app.get("/ready")
async def readiness_check():
    """
    Kubernetes readiness check
    Returns 200 if system is ready to accept requests
    """
    if rag_system is None or len(rag_system.document_store.documents) == 0:
        raise HTTPException(status_code=503, detail="RAG system not ready")
    
    return {"ready": True}


# Main RAG Query Endpoint
@app.post("/query", response_model=QueryResponse)
async def query_rag(
    request: QueryRequest,
    api_key: Optional[str] = Header(None, alias="X-API-Key")
):
    """
    Execute a RAG query
    
    Args:
        request: Query request with text and parameters
        api_key: Optional API key for authentication (from environment: RAG_API_KEY)
        
    Returns:
        RAG query response with answer, context, and sources
    """
    # Optional API key validation
    required_key = os.getenv("RAG_API_KEY")
    if required_key and api_key != required_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    
    if rag_system is None:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    try:
        logger.info(f"Processing query: {request.query[:100]}...")
        
        # Execute RAG query
        result = rag_system.query(
            query=request.query,
            top_k=request.top_k,
            max_generation_length=request.max_generation_length,
            include_sources=request.include_sources
        )
        
        return QueryResponse(
            answer=result["answer"],
            context=result["context"],
            sources=result["sources"],
            query=request.query
        )
    
    except Exception as e:
        logger.error(f"Error processing query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


# Retrieve Endpoint (for testing/debugging)
@app.post("/retrieve")
async def retrieve_documents(
    query: str = Query(..., min_length=1),
    top_k: int = Query(3, ge=1, le=10),
    api_key: Optional[str] = Header(None, alias="X-API-Key")
):
    """
    Retrieve relevant documents for a query (without generation)
    
    Args:
        query: Search query
        top_k: Number of documents to retrieve
        api_key: Optional API key
        
    Returns:
        List of retrieved documents with similarity scores
    """
    required_key = os.getenv("RAG_API_KEY")
    if required_key and api_key != required_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    
    if rag_system is None:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    try:
        results = rag_system.document_store.retrieve(query, top_k)
        
        return {
            "query": query,
            "results": [
                {
                    "score": float(score),
                    "source": doc.get("source", "unknown"),
                    "title": doc.get("title", ""),
                    "text": doc.get("text", "")[:500],  # Return truncated text
                    "category": doc.get("category", "")
                }
                for score, doc in results
            ]
        }
    except Exception as e:
        logger.error(f"Error retrieving documents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error retrieving documents")


# Ingest Documents Endpoint (for admin use)
@app.post("/admin/ingest")
async def ingest_documents(
    request: DocumentRequest,
    api_key: Optional[str] = Header(None, alias="X-API-Key")
):
    """
    Ingest new documents into RAG system (Admin endpoint)
    
    Args:
        request: Documents to ingest
        api_key: Must match RAG_ADMIN_KEY environment variable
        
    Returns:
        Confirmation with document count
    """
    admin_key = os.getenv("RAG_ADMIN_KEY")
    if not admin_key or api_key != admin_key:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid admin key")
    
    if rag_system is None:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    try:
        logger.info(f"Ingesting {len(request.documents)} documents...")
        rag_system.ingest_documents(request.documents)
        
        return {
            "status": "success",
            "documents_ingested": len(request.documents),
            "total_documents": len(rag_system.document_store.documents)
        }
    except Exception as e:
        logger.error(f"Error ingesting documents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error ingesting documents")


# Stats Endpoint
@app.get("/stats", response_model=StatsResponse)
async def get_stats(
    api_key: Optional[str] = Header(None, alias="X-API-Key")
):
    """
    Get RAG system statistics
    
    Args:
        api_key: Optional API key
        
    Returns:
        System statistics
    """
    required_key = os.getenv("RAG_API_KEY")
    if required_key and api_key != required_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    
    if rag_system is None:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    stats = rag_system.get_stats()
    
    return StatsResponse(
        total_documents=stats["total_documents"],
        embedding_model=stats["embedding_model"],
        index_dimension=stats["index_dimension"],
        index_type=stats["index_type"],
        status="healthy"
    )


# Root endpoint
@app.get("/")
async def root():
    """Welcome endpoint"""
    return {
        "name": "Trek Tribe RAG System API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "ready": "/ready",
            "query": "POST /query",
            "retrieve": "POST /retrieve",
            "stats": "/stats",
            "docs": "/docs"
        }
    }


# Error handlers
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    workers = int(os.getenv("WORKERS", 1))
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        workers=workers,
        log_level="info"
    )
