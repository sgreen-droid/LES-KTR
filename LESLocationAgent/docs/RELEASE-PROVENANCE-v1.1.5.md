# LES Location Agent v1.1.5 Release Provenance

The `v1.1.5` GitHub Release was rebuilt from the corrected Windows-agent source to
replace mixed or stale release assets. This record identifies the exact tagged
source, workflow run, and installer integrity value that Action1 deployment must
use.

## Release source

| Item | Value |
| --- | --- |
| GitHub tag | `v1.1.5` |
| Tagged source commit | `2c4c2c673307a24bea7ff802f58834bba9d1b1dd` |
| Tagged Windows Build | `https://github.com/sgreen-droid/LES-KTR/actions/runs/32878003351` |
| Build result | Successful |
| Release page | `https://github.com/sgreen-droid/LES-KTR/releases/tag/v1.1.5` |

## Published installer integrity

| Item | Value |
| --- | --- |
| MSI URL | `https://github.com/sgreen-droid/LES-KTR/releases/download/v1.1.5/LESLocationAgent.msi` |
| MSI SHA-256 | `462D9140141A640A16CC45FD8D3DE7B12629724DE02476CD15EE9E33DF47154E` |

The public MSI download was independently hashed after release. Its SHA-256
matches both `SHA256-MANIFEST.txt` and the generated
`Action1-Install-LESLocationAgent.ps1` release asset. The generated installer
script also contains the exact MSI URL above and no unreplaced installer
placeholders.

## Release asset set

The release includes the MSI, `SHA256-MANIFEST.txt`, and these Action1 scripts:

- `Action1-Install-LESLocationAgent.ps1`
- `Action1-Location-Sync.ps1`
- `Action1-LESLocationAgent-Health.ps1`

Only use the installer script downloaded from this release together with its
matching MSI. Do not mix an MSI or script from a branch build with these tagged
release assets.