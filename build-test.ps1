$ErrorActionPreference = "Continue"
& npm run build 2>&1 | Tee-Object -FilePath "build-log.txt"
