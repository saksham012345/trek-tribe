#!/usr/bin/env python3
"""
Reingest Trek Tribe knowledge base - updates the TF-IDF index with latest documentation.
Run this after updating any knowledge base files in the ai-service/data/ directory.
"""
import os
import sys
import json
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.retrieval import build_index_from_texts
from app import config


def read_markdown_file(file_path: Path) -> str:
    """Read markdown file content."""
    try:
        return file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return ''


def split_into_passages(text: str, source: str, max_chars=1000):
    """Split text into smaller passages for better retrieval."""
    text = text.strip()
    if not text:
        return []
    
    passages = []
    paragraphs = text.split('\n\n')
    
    current_passage = ''
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        # If adding this paragraph exceeds max_chars, save current and start new
        if len(current_passage) + len(para) > max_chars and current_passage:
            passages.append({
                'text': current_passage.strip(),
                'source': source
            })
            current_passage = para
        else:
            current_passage += ('\n\n' if current_passage else '') + para
    
    # Add remaining passage
    if current_passage:
        passages.append({
            'text': current_passage.strip(),
            'source': source
        })
    
    return passages


def main():
    """Main ingestion function."""
    print("🔄 Trek Tribe Knowledge Base Ingestion")
    print("=" * 50)
    
    # Get the ai-service directory
    ai_service_dir = Path(__file__).parent.parent
    data_dir = ai_service_dir / 'data'
    repo_root = ai_service_dir.parent
    
    print(f"📁 AI Service Dir: {ai_service_dir}")
    print(f"📁 Data Dir: {data_dir}")
    print(f"📁 Repo Root: {repo_root}")
    
    texts = []
    metas = []
    
    # 1. Load custom knowledge base files from ai-service/data/
    print("\n📚 Loading custom knowledge base...")
    knowledge_files = [
        data_dir / 'trip_creation_guide.md',
        data_dir / 'platform_guide.md',
    ]
    
    for kb_file in knowledge_files:
        if kb_file.exists():
            print(f"  ✓ Loading: {kb_file.name}")
            content = read_markdown_file(kb_file)
            if content:
                passages = split_into_passages(content, kb_file.name)
                for p in passages:
                    texts.append(p['text'])
                    metas.append({'source': p['source']})
                print(f"    → Added {len(passages)} passages")
        else:
            print(f"  ✗ Not found: {kb_file.name}")
    
    # 2. Load project README and API docs
    print("\n📖 Loading project documentation...")
    project_docs = [
        repo_root / 'README.md',
        repo_root / 'docs' / 'API_DOCUMENTATION.md',
        repo_root / 'docs' / 'DEPLOYMENT.md',
        repo_root / 'docs' / 'ENV.md',
    ]
    
    for doc_file in project_docs:
        if doc_file.exists():
            print(f"  ✓ Loading: {doc_file.relative_to(repo_root)}")
            content = read_markdown_file(doc_file)
            if content:
                passages = split_into_passages(content, str(doc_file.relative_to(repo_root)))
                for p in passages:
                    texts.append(p['text'])
                    metas.append({'source': p['source']})
                print(f"    → Added {len(passages)} passages")
    
    # 3. Load selected React component docs (for UI-related queries)
    print("\n🎨 Loading UI component references...")
    web_src = repo_root / 'web' / 'src'
    important_pages = [
        web_src / 'pages' / 'Home.tsx',
        web_src / 'pages' / 'Trips.tsx',
        web_src / 'pages' / 'CreateTrip.tsx',
        web_src / 'pages' / 'EnhancedProfilePage.tsx',
        web_src / 'components' / 'AIChatWidgetClean.tsx',
    ]
    
    for page_file in important_pages:
        if page_file.exists():
            rel_path = page_file.relative_to(repo_root)
            print(f"  ✓ Loading: {rel_path}")
            content = read_markdown_file(page_file)
            if content:
                # Extract key information (comments, JSX structure)
                passages = split_into_passages(content, str(rel_path), max_chars=800)
                for p in passages[:3]:  # Limit to first 3 passages per file
                    texts.append(p['text'])
                    metas.append({'source': p['source']})
    
    # Validation
    if not texts:
        print("\n❌ No documents found to index!")
        return 1
    
    print(f"\n📊 Total passages to index: {len(texts)}")
    print(f"📊 From {len(set(m['source'] for m in metas))} unique sources")
    
    # Build the index
    print("\n🔨 Building TF-IDF index...")
    try:
        # Ensure data directory exists
        data_dir.mkdir(parents=True, exist_ok=True)
        
        # Build index
        build_index_from_texts(texts, metas)
        
        print(f"\n✅ Index successfully built!")
        print(f"📁 Saved to: {data_dir}")
        print(f"   - {data_dir / 'tfidf_index.pkl'}")
        print(f"   - {data_dir / 'tfidf_docs.json'}")
        
        # Verify files exist
        if (data_dir / 'tfidf_index.pkl').exists() and (data_dir / 'tfidf_docs.json').exists():
            print("\n✅ All index files created successfully!")
            
            # Show file sizes
            index_size = (data_dir / 'tfidf_index.pkl').stat().st_size / 1024 / 1024
            docs_size = (data_dir / 'tfidf_docs.json').stat().st_size / 1024 / 1024
            print(f"   Index size: {index_size:.2f} MB")
            print(f"   Docs size: {docs_size:.2f} MB")
        else:
            print("\n⚠️  Warning: Index files not found after build!")
            return 1
            
        return 0
        
    except Exception as e:
        print(f"\n❌ Error building index: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
