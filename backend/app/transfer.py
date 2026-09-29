"""Export or import a whole event from the command line.

    python -m app.transfer export sample-hack-2026 event.json
    python -m app.transfer import event.json [--dry-run]

The file format is described in app/services/portable.py and DATA-MODEL.md.
"""

import argparse
import json
import sys

from app.database import SessionLocal, init_db
from app.services.events import resolve_event
from app.services.portable import ImportError_, conflicts, export_event, import_event, summarize, validate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.transfer", description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    out = sub.add_parser("export", help="write one event to a JSON file")
    out.add_argument("slug")
    out.add_argument("file", nargs="?", help="defaults to stdout")
    inp = sub.add_parser("import", help="create or update an event from a JSON file")
    inp.add_argument("file")
    inp.add_argument("--dry-run", action="store_true", help="check the file, write nothing")
    args = parser.parse_args(argv)

    init_db()
    db = SessionLocal()
    try:
        if args.command == "export":
            body = json.dumps(export_event(db, resolve_event(db, args.slug)), indent=2, ensure_ascii=False)
            if args.file:
                with open(args.file, "w", encoding="utf-8") as handle:
                    handle.write(body)
                print(f"wrote {args.file}", file=sys.stderr)
            else:
                print(body)
            return 0

        with open(args.file, encoding="utf-8") as handle:
            data = json.load(handle)
        problems = validate(data) or conflicts(db, data)
        if problems:
            print("cannot import:", *problems, sep="\n  ", file=sys.stderr)
            return 1
        print(json.dumps(summarize(data)))
        if args.dry_run:
            print("dry run: nothing written", file=sys.stderr)
            return 0
        try:
            event = import_event(db, data)
        except ImportError_ as err:
            print("cannot import:", *err.problems, sep="\n  ", file=sys.stderr)
            return 1
        db.commit()
        print(f"imported {event.name} as /events/{event.slug}", file=sys.stderr)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
