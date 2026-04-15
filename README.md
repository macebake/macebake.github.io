# macey.info

Static site for `macey.info`.

## Run locally

Serve the repo over HTTP from the project root:

```bash
cd /Users/macey/git/macebake.github.io
python3 -m http.server 4191
```

Then open:

```text
http://localhost:4191/
```

Notes:

- Use a local server, not `file://index.html`, because the site loads local assets and blog post fragments.
- If `4191` is already in use, pick another port and open that URL instead.
