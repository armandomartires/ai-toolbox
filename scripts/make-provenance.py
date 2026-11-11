#!/usr/bin/env python3
"""Write a provenance statement for a release artifact to stdout (TASK-0283).

Usage: make-provenance.py ARTIFACT
An in-toto statement with a SLSA provenance predicate: the subject is the
artifact's sha256, the builder and commit come from the CI variables of the
pipeline that runs this. It is written by the pipeline and then signed by
cosign; it is not GitLab's runner-generated attestation, so it vouches for
who signed it (the pipeline identity), not for a hardened builder.
"""
import hashlib
import json
import os
import sys

if len(sys.argv) != 2:
    sys.exit(__doc__)
a = sys.argv[1]
with open(a, "rb") as f:
    digest = hashlib.sha256(f.read()).hexdigest()
env = os.environ
need = ("CI_COMMIT_TAG", "CI_PROJECT_URL", "CI_COMMIT_SHA", "CI_SERVER_URL", "CI_PROJECT_PATH", "CI_JOB_URL")
missing = [k for k in need if not env.get(k)]
if missing:
    sys.exit("make-provenance: missing CI variables: " + ", ".join(missing))
print(json.dumps({
    "_type": "https://in-toto.io/Statement/v1",
    "subject": [{"name": os.path.basename(a), "digest": {"sha256": digest}}],
    "predicateType": "https://slsa.dev/provenance/v1",
    "predicate": {
        "buildDefinition": {
            "buildType": env["CI_SERVER_URL"] + "/" + env["CI_PROJECT_PATH"] + "//.gitlab-ci.yml",
            "externalParameters": {"ref": env["CI_COMMIT_TAG"], "project": env["CI_PROJECT_URL"]},
            "resolvedDependencies": [{"uri": env["CI_PROJECT_URL"], "digest": {"gitCommit": env["CI_COMMIT_SHA"]}}]},
        "runDetails": {
            "builder": {"id": env["CI_SERVER_URL"] + "/" + env["CI_PROJECT_PATH"] + "//.gitlab-ci.yml"},
            "metadata": {"invocationId": env["CI_JOB_URL"]}}}}, indent=2))
