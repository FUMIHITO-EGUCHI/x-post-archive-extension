#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo 'Usage: cws-publish.sh status | publish <zip>' >&2
  exit 2
}

error() {
  if [[ ${GITHUB_ACTIONS:-} == true ]]; then
    printf '::error::%s\n' "$*" >&2
  else
    printf 'error: %s\n' "$*" >&2
  fi
  exit 1
}

[[ $# -ge 1 ]] || usage
case "$1" in
  status) [[ $# -eq 1 ]] || usage ;;
  publish) [[ $# -eq 2 ]] || usage ;;
  *) usage ;;
esac

for var in CWS_ACCESS_TOKEN CWS_PUBLISHER_ID CWS_EXTENSION_ID; do
  [[ -n ${!var:-} ]] || error "$var is required; configure it in the chrome-web-store environment variables (the access token is provided by the auth step)"
done
[[ $CWS_EXTENSION_ID =~ ^[a-p]{32}$ ]] || error 'Invalid CWS_EXTENSION_ID'
[[ $CWS_PUBLISHER_ID =~ ^[A-Za-z0-9._-]+$ ]] || error 'Invalid CWS_PUBLISHER_ID'
# Prevent the token from injecting curl config directives.
[[ $CWS_ACCESS_TOKEN =~ ^[A-Za-z0-9._~+/-]+=*$ ]] || error 'Invalid CWS_ACCESS_TOKEN format'
command -v curl >/dev/null || error 'curl is required'
command -v jq >/dev/null || error 'jq is required'

api_base=${CWS_API_BASE:-https://chromewebstore.googleapis.com}
item="publishers/$CWS_PUBLISHER_ID/items/$CWS_EXTENSION_ID"
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

api() {
  local method=$1 path=$2 status message response_body
  shift 2
  if ! status=$(printf 'header = "Authorization: Bearer %s"\n' "$CWS_ACCESS_TOKEN" | \
    curl --config - -sS -X "$method" -o "$temp_dir/response" -w '%{http_code}' "$@" "${api_base%/}$path"); then
    error "$method $path: request failed"
  fi
  if [[ ! $status =~ ^2[0-9][0-9]$ ]]; then
    message=$(jq -r '.error.message // empty' "$temp_dir/response" 2>/dev/null || true)
    if [[ -z $message ]]; then
      message=$(head -c 2000 "$temp_dir/response")
    fi
    message=${message//"$CWS_ACCESS_TOKEN"/[REDACTED]}
    error "$method $path: HTTP $status: $message"
  fi
  response_body=$(cat "$temp_dir/response")
  printf '%s\n' "${response_body//"$CWS_ACCESS_TOKEN"/[REDACTED]}"
}

summary() {
  local response=$1 lines
  lines=$(jq -r '
    def revision: if . == null then "none" else
      ((.state // "unknown") + " (" + ([.distributionChannels[]?.crxVersion // empty] | if length == 0 then "version unknown" else join(", ") end) + ")") end;
    "Published: \(.publishedItemRevisionStatus | revision)",
    "Submitted: \(.submittedItemRevisionStatus | revision)",
    "Last async upload: \(.lastAsyncUploadState // "unknown")",
    "Taken down: \(.takenDown // false)",
    "Warned: \(.warned // false)"' <<< "$response")
  printf '%s\n' "$lines"
  if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
    {
      printf '## Chrome Web Store status\n\n'
      while IFS= read -r line; do printf -- '- %s\n' "$line"; done <<< "$lines"
    } >> "$GITHUB_STEP_SUMMARY"
  fi
}

if [[ $1 == status ]]; then
  response=$(api GET "/v2/$item:fetchStatus")
  summary "$response"
  exit 0
fi

[[ -s $2 && -f $2 ]] || error "ZIP file does not exist or is empty: $2"
publish_type=${CWS_PUBLISH_TYPE:-DEFAULT_PUBLISH}
[[ $publish_type == DEFAULT_PUBLISH || $publish_type == STAGED_PUBLISH ]] || error 'Invalid CWS_PUBLISH_TYPE'
poll_interval=${CWS_POLL_INTERVAL:-10}
poll_max=${CWS_POLL_MAX:-30}
[[ $poll_interval =~ ^[0-9]+$ && $poll_max =~ ^[0-9]+$ ]] || error 'Poll interval and maximum must be non-negative integers'

response=$(api GET "/v2/$item:fetchStatus")
[[ $(jq -r '.takenDown // false' <<< "$response") != true ]] || error 'Item is taken down'
[[ $(jq -r '.submittedItemRevisionStatus.state // empty' <<< "$response") != PENDING_REVIEW ]] || error 'A submission is already in review; wait, or cancel it in the Developer Dashboard, then re-run this job'
if [[ -n ${CWS_EXPECTED_VERSION:-} ]] && jq -e --arg version "$CWS_EXPECTED_VERSION" \
  '[.publishedItemRevisionStatus.distributionChannels[]?.crxVersion, .submittedItemRevisionStatus.distributionChannels[]?.crxVersion] | index($version) != null' <<< "$response" >/dev/null; then
  error 'version already uploaded (Chrome Web Store rejects non-increasing versions)'
fi

# -T streams the file as the raw body without curl's default form Content-Type,
# matching the upload example in the CWS API v2 docs.
response=$(api POST "/upload/v2/$item:upload" -T "$2")
upload_state=$(jq -r '.uploadState // empty' <<< "$response")
case "$upload_state" in
  SUCCEEDED) ;;
  IN_PROGRESS)
    succeeded=false
    for ((i=0; i<poll_max; i++)); do
      sleep "$poll_interval"
      poll_response=$(api GET "/v2/$item:fetchStatus")
      poll_state=$(jq -r '.lastAsyncUploadState // empty' <<< "$poll_response")
      case "$poll_state" in
        SUCCEEDED) succeeded=true; break ;;
        FAILED|NOT_FOUND) error "Async upload failed: $poll_state" ;;
      esac
    done
    [[ $succeeded == true ]] || error 'Async upload timed out'
    ;;
  *) error "Upload failed ($upload_state): $response" ;;
esac
version=$(jq -r '.crxVersion // empty' <<< "$response")
if [[ -n ${CWS_EXPECTED_VERSION:-} ]]; then
  if [[ -z $version ]]; then
    echo 'warning: upload response has no crxVersion; version could not be checked' >&2
  elif [[ $version != "$CWS_EXPECTED_VERSION" ]]; then
    error "Upload version mismatch: expected $CWS_EXPECTED_VERSION, got $version"
  fi
fi

body=$(jq -n --arg type "$publish_type" '{publishType: $type}')
response=$(api POST "/v2/$item:publish" -H 'Content-Type: application/json' --data "$body")
state=$(jq -r '.state // empty' <<< "$response")
case "$state" in
  PENDING_REVIEW|STAGED|PUBLISHED|PUBLISHED_TO_TESTERS) printf 'Publish state: %s\n' "$state" ;;
  *) error "Unexpected publish state: $state: $response" ;;
esac
if jq -e '.warningInfo != null' <<< "$response" >/dev/null; then
  jq '.warningInfo' <<< "$response"
fi
response=$(api GET "/v2/$item:fetchStatus")
summary "$response"
