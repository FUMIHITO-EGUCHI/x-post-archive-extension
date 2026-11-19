#!/usr/bin/env bash
set -euo pipefail

if python3 -c 'import sys' >/dev/null 2>&1; then
  python_cmd=python3
elif python -c 'import sys' >/dev/null 2>&1; then
  python_cmd=python
else
  echo 'FAIL Python is required' >&2
  exit 1
fi
temp_dir=$(mktemp -d)
server_pid=''
cleanup() {
  if [[ -n $server_pid ]]; then kill "$server_pid" 2>/dev/null || true; fi
  rm -rf "$temp_dir"
}
trap cleanup EXIT

"$python_cmd" -c '
import base64, json, os, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

root = Path(sys.argv[1])
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def handle_request(self):
        scenario = (root / "scenario").read_text().strip()
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        with (root / "requests").open("a") as log:
            log.write(json.dumps({"method": self.command, "path": self.path,
                "auth": self.headers.get("Authorization"), "body": base64.b64encode(body).decode()}) + "\n")
        status = 200
        if scenario == "forbidden":
            status, result = 403, {"error": {"code": 403, "message": "permission denied by mock", "status": "PERMISSION_DENIED"}}
        elif self.path.endswith(":fetchStatus"):
            result = {"publishedItemRevisionStatus": {"state": "PUBLISHED", "distributionChannels": [{"crxVersion": "1.0.0"}]}}
            if scenario == "pending": result["submittedItemRevisionStatus"] = {"state": "PENDING_REVIEW"}
            if scenario == "async": result["lastAsyncUploadState"] = "SUCCEEDED"
        elif self.path.endswith(":upload"):
            if scenario == "failed": result = {"uploadState": "FAILED"}
            elif scenario == "async": result = {"uploadState": "IN_PROGRESS"}
            else: result = {"uploadState": "SUCCEEDED", "crxVersion": "9.9.9" if scenario == "mismatch" else "1.1.0"}
        elif self.path.endswith(":publish"):
            result = {"state": "PENDING_REVIEW"}
        else:
            status, result = 404, {"error": {"message": "unknown path"}}
        data = json.dumps(result).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    do_GET = handle_request
    do_POST = handle_request

server = HTTPServer(("127.0.0.1", 0), Handler)
(root / "port").write_text(str(server.server_port))
server.serve_forever()
' "$temp_dir" &
server_pid=$!
for ((i=0; i<100; i++)); do
  [[ ! -s $temp_dir/port ]] || break
  sleep 0.1
done
if [[ ! -s $temp_dir/port ]]; then echo 'FAIL mock server startup' >&2; exit 1; fi
mock_port=$(cat "$temp_dir/port")
export CWS_API_BASE="http://127.0.0.1:$mock_port"
export CWS_ACCESS_TOKEN=test-token CWS_EXTENSION_ID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export CWS_PUBLISHER_ID=pub-123 CWS_POLL_INTERVAL=0 CWS_POLL_MAX=3 CWS_EXPECTED_VERSION=1.1.0
printf 'mock zip bytes\000\377\n' > "$temp_dir/test.zip"
failures=0

run_case() {
  local name=$1 scenario=$2 expected_code=$3 expected_text=$4
  shift 4
  printf '%s' "$scenario" > "$temp_dir/scenario"
  : > "$temp_dir/requests"
  local code=0
  bash scripts/cws-publish.sh "$@" > "$temp_dir/output" 2>&1 || code=$?
  if [[ $code == "$expected_code" ]] && grep -Fq "$expected_text" "$temp_dir/output" && ! grep -Fq 'test-token' "$temp_dir/output"; then
    printf 'PASS %s\n' "$name"
  else
    printf 'FAIL %s (exit %s, expected %s)\n' "$name" "$code" "$expected_code"
    cat "$temp_dir/output"
    failures=$((failures + 1))
  fi
}

assert_requests() {
  local name=$1 check=$2
  if "$python_cmd" -c '
import base64, json, sys
from pathlib import Path
root, check = Path(sys.argv[1]), sys.argv[2]
requests = [json.loads(line) for line in (root / "requests").read_text().splitlines()]
uploads = [r for r in requests if r["path"].endswith(":upload")]
publishes = [r for r in requests if r["path"].endswith(":publish")]
if check == "happy":
    assert requests and all(r["auth"] == "Bearer test-token" for r in requests)
    assert len(uploads) == 1 and base64.b64decode(uploads[0]["body"]) == (root / "test.zip").read_bytes()
    assert len(publishes) == 1 and json.loads(base64.b64decode(publishes[0]["body"])) == {"publishType": "DEFAULT_PUBLISH"}
elif check == "no-upload": assert not uploads
elif check == "no-publish": assert not publishes
' "$temp_dir" "$check"; then
    printf 'PASS %s\n' "$name"
  else
    printf 'FAIL %s\n' "$name"
    failures=$((failures + 1))
  fi
}

run_case 'status OK' status 0 'Published: PUBLISHED (1.0.0)' status
run_case 'publish happy path' happy 0 'Publish state: PENDING_REVIEW' publish "$temp_dir/test.zip"
assert_requests 'authorization and request bodies' happy
run_case 'existing pending review' pending 1 'submission is already in review' publish "$temp_dir/test.zip"
assert_requests 'pending review prevents upload' no-upload
CWS_EXPECTED_VERSION=1.0.0
run_case 'version already published' status 1 'version already uploaded' publish "$temp_dir/test.zip"
assert_requests 'existing version prevents upload' no-upload
CWS_EXPECTED_VERSION=1.1.0
run_case 'async upload succeeds' async 0 'Publish state: PENDING_REVIEW' publish "$temp_dir/test.zip"
run_case 'upload failed' failed 1 'Upload failed' publish "$temp_dir/test.zip"
run_case 'version mismatch' mismatch 1 'Upload version mismatch' publish "$temp_dir/test.zip"
assert_requests 'version mismatch prevents publish' no-publish
run_case 'HTTP error' forbidden 1 'HTTP 403: permission denied by mock' status
saved_publisher=$CWS_PUBLISHER_ID
unset CWS_PUBLISHER_ID
run_case 'missing environment variable' status 1 'CWS_PUBLISHER_ID is required' status
export CWS_PUBLISHER_ID=$saved_publisher
saved_extension=$CWS_EXTENSION_ID
export CWS_EXTENSION_ID=invalid
run_case 'invalid extension id' status 1 'Invalid CWS_EXTENSION_ID' status
export CWS_EXTENSION_ID=$saved_extension
run_case 'wrong arguments' status 2 'Usage:' publish

if (( failures > 0 )); then exit 1; fi
