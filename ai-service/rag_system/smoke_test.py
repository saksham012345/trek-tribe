"""
Smoke test for RAG system - Tests /query endpoint with sample questions
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8001"

def test_health():
    """Test health endpoint"""
    print("Testing /health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"✓ Health check: {response.status_code} - {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False

def test_query(question: str):
    """Test query endpoint"""
    print(f"\nTesting query: '{question}'")
    try:
        response = requests.post(
            f"{BASE_URL}/query",
            json={"query": question, "top_k": 3},
            headers={"X-API-Key": "trek-tribe-rag-secret-key-2024"},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Query successful!")
            print(f"  Answer: {result.get('answer', 'N/A')[:200]}...")
            print(f"  Sources: {len(result.get('sources', []))} documents retrieved")
            return True
        else:
            print(f"✗ Query failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Query failed: {e}")
        return False

def main():
    print("=" * 60)
    print("RAG System Smoke Test")
    print("=" * 60)
    
    # Test health
    if not test_health():
        print("\n❌ Service not running. Start with:")
        print("cd ai-service/rag_system")
        print("uvicorn app:app --reload --port 8001")
        sys.exit(1)
    
    # Test sample queries
    test_queries = [
        "How do I create a new trip?",
        "What are the requirements for trip creation?",
        "How does the booking process work?",
        "Tell me about the CRM dashboard features"
    ]
    
    passed = 0
    for query in test_queries:
        if test_query(query):
            passed += 1
    
    print("\n" + "=" * 60)
    print(f"Test Results: {passed}/{len(test_queries)} queries successful")
    print("=" * 60)
    
    if passed == len(test_queries):
        print("✓ All tests passed! RAG system is working correctly.")
        sys.exit(0)
    else:
        print("⚠ Some tests failed. Check the service logs.")
        sys.exit(1)

if __name__ == "__main__":
    main()
