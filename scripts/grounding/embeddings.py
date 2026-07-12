"""
Cross-lingual sentence embeddings as the alignment anchor.

The gloss-bag lexical anchor hit a proven ceiling (two drift pairs no weight tuning
could fix without breaking others). A multilingual embedding model gives true
IT<->EN semantic similarity per candidate span — local, free, deterministic
inference. Vectors are cached on disk (data/<book>/, gitignored) keyed by text
hash, so re-runs cost nothing.
"""
import hashlib
import os

import numpy as np

MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def _key(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


class SentenceSim:
    def __init__(self, cache_path, model_name=MODEL):
        self.cache_path = cache_path
        self.model_name = model_name
        self._model = None
        self._cache = {}
        if os.path.exists(cache_path):
            z = np.load(cache_path)
            self._cache = {k: z[k] for k in z.files}
        self._dirty = False

    def _encode(self, texts):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)
        vecs = self._model.encode(texts, normalize_embeddings=True,
                                  batch_size=64, show_progress_bar=False)
        return np.asarray(vecs, dtype=np.float32)

    def vectors(self, texts):
        """Normalized embedding per text, cache-first."""
        missing = [t for t in texts if _key(t) not in self._cache]
        if missing:
            for t, v in zip(missing, self._encode(missing)):
                self._cache[_key(t)] = v
            self._dirty = True
        return np.stack([self._cache[_key(t)] for t in texts]) if texts else np.zeros((0, 384), np.float32)

    def save(self):
        if self._dirty:
            os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
            np.savez_compressed(self.cache_path, **self._cache)
            self._dirty = False


def span_sim(it_vecs, en_vecs, i0, i1, j0, j1):
    """Cosine similarity between the (renormalized) means of two spans."""
    a = it_vecs[i0:i1].mean(axis=0)
    b = en_vecs[j0:j1].mean(axis=0)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(a @ b / (na * nb))
