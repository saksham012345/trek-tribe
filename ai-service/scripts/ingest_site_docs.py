import os
import sys
import json
from pathlib import Path
from app.retrieval import build_index_from_texts


def gather_text_files(root: Path, patterns=None):
    patterns = patterns or ['**/*.md', '**/*.txt', '**/*.mdx', '**/*.html', '**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js']
    files = []
    for p in patterns:
        #!/usr/bin/env python3
        """Ingest site docs and build TF-IDF index into configured DATA_DIR.

        This script is intended to be run at Docker build time to bake the retrieval
        index into the image so runtime retrieval works offline.
        """
        import os
        import sys
        from pathlib import Path
        from app.retrieval import build_index_from_texts
        from app import config


        def gather_text_files(root: Path, patterns=None):
            patterns = patterns or ['**/*.md', '**/*.txt', '**/*.mdx', '**/*.html', '**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js']
            files = []
            for p in patterns:
                files.extend(list(root.glob(p)))
            files = [f for f in sorted(set(files)) if f.is_file()]
            return files


        def read_text(path: Path) -> str:
            try:
                return path.read_text(encoding='utf-8')
            except Exception:
                try:
                    return path.read_text(encoding='latin-1')
                except Exception:
                    return ''


        def split_into_passages(text: str, max_chars=1000):
            text = text.strip()
            if not text:
                return []
            passages = []
            i = 0
            while i < len(text):
                chunk = text[i:i+max_chars]
                passages.append(chunk.strip())
                i += max_chars
            return passages


        def main(repo_root: str = '.'):
            root = Path(repo_root)
            texts = []
            metas = []

            # Directories to include
            targets = [root / 'docs', root / 'web' / 'src' / 'pages']
            top_files = [root / 'README.md', root / 'API_DOCUMENTATION.md']

            for tf in top_files:
                if tf.exists():
                    for p in split_into_passages(read_text(tf)):
                        texts.append(p)
                        metas.append({'source': str(tf.relative_to(root))})

            for target in targets:
                if not target.exists():
                    continue
                files = gather_text_files(target)
                for f in files:
                    t = read_text(f)
                    if not t.strip():
                        continue
                    for p in split_into_passages(t):
                        texts.append(p)
                        metas.append({'source': str(f.relative_to(root))})

            if not texts:
                print('No documents found to index. Checked:', targets, top_files)
                return 1

            print(f'Indexing {len(texts)} passages from site docs...')
            # Ensure the retrieval module writes into config.DATA_DIR
            os.environ.setdefault('AI_DATA_DIR', config.DATA_DIR)
            build_index_from_texts(texts, metas)
            print(f'Index built and saved under {config.DATA_DIR}')
            return 0


        if __name__ == '__main__':
            root = sys.argv[1] if len(sys.argv) > 1 else '.'
            sys.exit(main(root))
