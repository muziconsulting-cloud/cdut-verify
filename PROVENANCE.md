# Provenance

`cdut-verify` is a slice of a larger, private codebase: the Conquest Designer
University. The university code is not in this repository, and the Apache-2.0
licence does not apply to it.

This file records where the slice came from, what was left behind, and how a
reviewer can check the separation.

## The source

| | |
|---|---|
| Private repository | `https://github.com/muziconsulting-cloud/conquest-designer-university` |
| Visibility | Private. Read access can be granted to a reviewer on request. |
| Snapshot commit | `5c01ee5` (2026-11-10) |
| Tracked files | 1,557 |
| TypeScript files | 824 |
| TypeScript lines | 84,308 |
| Earlier public prototype | `https://github.com/muziconsulting-cloud/conquest-designer` |
| Prototype history | 34 commits, 2026-10-26 to 2026-10-27, public, all rights reserved |

The university repository is a **snapshot**: the codebase was staged in one
commit, so its Git history is short even though the work is not. The earlier
public prototype carries the longer commit history. The private tree is the
authoritative source for the slice; the public prototype is context.

A reviewer with access can reproduce the numbers:

```sh
git clone https://github.com/muziconsulting-cloud/conquest-designer-university
cd conquest-designer-university
git rev-list --count HEAD          # 2
git ls-files | wc -l               # 1557
git ls-files '*.ts' | wc -l        # 824
git ls-files '*.ts' | xargs wc -l  # 84308 total
```

## What was carried forward

The `.cdut` format, its canonical serialisation, Ed25519 signing and
verification, transcript issuing and verification, and the programme manifest
model. In this repository those are a standalone implementation with no import
from the private tree.

## What was excluded

The registrar, the curriculum catalogue, student records, internal services,
deployment configuration, credentials, sponsor integrations, and all private
data. None of it is copied here, and none of it is licensed here.

## Independence checks

Run from the root of this repository:

```sh
# No import reaches outside the slice.
grep -rnE "from ['\"](\.\./)+\.\./" src test        # no output

# No runtime dependency.
bun pm ls                                            # only @types/bun and typescript, both dev

# No reference to the private tree or its paths.
grep -rniE "conquest-stage|conquest-designer-university|src/registrar|src/house" src test
                                                     # no output
```

## Licence scope

| Code | Licence |
|---|---|
| This repository (`cdut-verify`) | Apache-2.0 |
| Conquest Designer University codebase | Proprietary, all rights reserved |
| The `.cdut` specification | Authored by Muzi Dlamini; this repository implements it |

Apache-2.0 applies to the files in this repository only. It grants no rights over
the university codebase, its curriculum, its student records or its marks. The
university remains closed.

## Declaration

> I confirm that I am the copyright holder of the code in this repository and the
> creator of the `.cdut` specification. The Conquest Designer University codebase
> remains proprietary and is not licensed by this repository. The slice imports
> nothing from that codebase and contains no student records, credentials or
> deployment configuration.
>
> — Muzi Dlamini, 2026-11-10

The machine-readable form of this record is in
[`provenance/extraction.json`](provenance/extraction.json).
