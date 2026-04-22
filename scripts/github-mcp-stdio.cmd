@echo off
setlocal

for /f "usebackq delims=" %%T in (`gh auth token`) do set "GITHUB_PERSONAL_ACCESS_TOKEN=%%T"

if not defined GITHUB_PERSONAL_ACCESS_TOKEN (
  echo Failed to acquire GitHub token from gh auth. 1>&2
  exit /b 1
)

set "GITHUB_TOOLSETS=default,projects"
"%~dp0..\tools\github-mcp-server\github-mcp-server.exe" stdio
