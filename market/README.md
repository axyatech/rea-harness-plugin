# Discover index

This directory is the repository's **format-1 DSH plugin market index**.
Adding the raw URL once in **Plugins → Discover → Add index source** makes the
plugin searchable and installable from the Harness UI:

```text
https://raw.githubusercontent.com/axyatech/rea-harness-plugin/main/market/index.json
```

The index is validated with DSH's `@deepseek-ai/dsh-plugin-market-index`
validator. Each release points at an immutable commit, so the install target
cannot drift when `main` moves:

`git+https://github.com/axyatech/rea-harness-plugin.git#<commit>`

## Release checklist

1. Update `package.json`'s version and commit the release.
2. Set `market/index.json`'s `version` and `publishTimestamp`, and set
   `source.commit` to that release commit's full SHA.
3. Copy a changed `icon.svg` here as `market/icon.svg`.
4. Validate:

   ```bash
   node --input-type=module -e "
     import { readFileSync } from 'node:fs'
     import { parseMarketIndex, marketInstallTarget } from '@deepseek-ai/dsh-plugin-market-index'
     const url = 'https://raw.githubusercontent.com/axyatech/rea-harness-plugin/main/market/index.json'
     const index = parseMarketIndex(JSON.parse(readFileSync('market/index.json', 'utf8')), url)
     console.log(marketInstallTarget(index.plugins[0].name, index.plugins[0].versions[0]))
   "
   ```

5. Commit the index update and push. `npm test` checks it against the current
   package version.

DSH has no official third-party market; Discover lists the indexes a user
adds. This index is the self-hosted catalog entry for the plugin.
