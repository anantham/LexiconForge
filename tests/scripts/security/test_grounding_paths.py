"""Local synthetic regression checks; no NLP package, model, or private data."""
import json
import io
from contextlib import redirect_stdout
from types import SimpleNamespace
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts" / "grounding"))
from safe_paths import validate_stable_id, validate_chapter_ids, grounded_path, open_grounded, open_contained


class GroundingPathsTest(unittest.TestCase):
    def test_identifier_grammar(self):
        for value in (None, 1, "", "..", "../private", "..\\private", "/tmp/private", "C:\\private",
                      "a/b", "a\\b", "a.b", "x\x00y", "name ", "é", "x" * 129):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_stable_id(value)
        for value in ("ch1_hash_title", "calvino-u1", "u12", "a" * 128):
            self.assertEqual(validate_stable_id(value), value)

    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError):
            validate_chapter_ids([{"stableId": "u1"}, {"stableId": "u1"}])

    def test_normal_read_write_round_trip(self):
        with tempfile.TemporaryDirectory() as temp:
            with open_grounded(temp, "ch1_hash_title", "w") as handle:
                json.dump({"synthetic": True}, handle)
            with open_grounded(temp, "ch1_hash_title") as handle:
                self.assertEqual(json.load(handle), {"synthetic": True})
            self.assertEqual(grounded_path(temp, "ch1_hash_title").parent, Path(temp).resolve())

    def test_symlink_read_and_write_cannot_escape(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "grounded"
            root.mkdir()
            outside = Path(temp) / "private.json"
            outside.write_text('{"synthetic":true}')
            (root / "u1.grounded.json").symlink_to(outside)
            for mode in ("r", "w"):
                with self.subTest(mode=mode), self.assertRaises(ValueError):
                    open_grounded(root, "u1", mode)
            self.assertEqual(outside.read_text(), '{"synthetic":true}')
            (root / "index.json").symlink_to(outside)
            with self.assertRaises(ValueError):
                open_contained(root, "index.json", "w")

    def test_write_refuses_non_regular_file(self):
        with tempfile.TemporaryDirectory() as temp:
            (Path(temp) / "u1.grounded.json").mkdir()
            with self.assertRaises(OSError):
                open_grounded(temp, "u1", "w")

    def test_writer_validates_all_ids_before_loading_nlp_or_writing(self):
        import ground_source
        with tempfile.TemporaryDirectory() as temp:
            session = Path(temp) / "session.json"
            output = Path(temp) / "grounded"
            session.write_text(json.dumps({"chapters": [
                {"stableId": "u1", "content": "Synthetic"},
                {"stableId": "../outside", "content": "Synthetic"},
            ]}))
            with patch.object(sys, "argv", ["ground_source.py", "--session", str(session), "--out-dir", str(output)]):
                with self.assertRaises(ValueError):
                    ground_source.main()
            self.assertFalse(output.exists())

    def test_complete_synthetic_ground_build_validate_flow(self):
        import ground_source
        import build_reader_payload
        import validate_alignment
        token = SimpleNamespace(text="ciao", lemma_="ciao", pos_="INTJ", is_space=False,
                                i=0, idx=0, morph="", is_alpha=True, is_stop=False)
        class Document:
            text = "ciao"
            def __len__(self):
                return 1
            def __getitem__(self, index):
                return token
        class Sentence:
            text = "ciao"
            def __iter__(self):
                return iter([token])
        Document.sents = [Sentence()]
        fake_spacy = SimpleNamespace(load=lambda model: lambda text: Document())
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            session = root / "session.json"
            session.write_text(json.dumps({"chapters": [{"stableId": "u1", "chapterNumber": 1,
                                                        "title": "Synthetic", "content": "ciao", "fanTranslation": "Hello."}]}))
            grounded = root / "grounded"
            payload = root / "reader.json"
            commands = (
                (ground_source, ["--session", str(session), "--out-dir", str(grounded)]),
                (build_reader_payload, ["--session", str(session), "--grounded", str(grounded), "--out", str(payload)]),
                (validate_alignment, ["--session", str(session), "--grounded", str(grounded), "--payload", str(payload)]),
            )
            with patch.dict(sys.modules, {"spacy": fake_spacy}), redirect_stdout(io.StringIO()):
                for module, argv in commands:
                    with patch.object(sys, "argv", [module.__name__, *argv]):
                        result = module.main()
                        if module is validate_alignment:
                            self.assertEqual(result, 0)
            result = json.loads(payload.read_text())
            self.assertEqual(result["units"][0]["id"], "u1")
            self.assertEqual(result["units"][0]["blocks"][0]["pairs"][0]["it"][0]["s"], "ciao")
            self.assertEqual(result["units"][0]["blocks"][0]["pairs"][0]["en"], "Hello.")

    def test_readers_reject_imported_traversal_before_reading_files(self):
        import build_reader_payload
        import validate_alignment
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            session = root / "session.json"
            session.write_text(json.dumps({"chapters": [{"stableId": "../outside"}]}))
            payload = root / "payload.json"
            payload.write_text(json.dumps({"units": [{"id": "../outside", "n": 1, "blocks": []}]}))
            for module, argv in (
                (build_reader_payload, ["--session", str(session), "--grounded", temp, "--out", str(root / "out.json")]),
                (validate_alignment, ["--session", str(session), "--grounded", temp, "--payload", str(payload)]),
            ):
                with self.subTest(module=module.__name__), patch.object(sys, "argv", [module.__name__, *argv]):
                    with self.assertRaises(ValueError):
                        module.main()
            self.assertFalse((root / "out.json").exists())


if __name__ == "__main__":
    unittest.main()
