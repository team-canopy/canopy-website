# Canopy Website Agent Guidelines

## Content Style

Follow the Content Style section in `README.md` for all user-facing copy. Never use
em dashes in page content, metadata, accessible text, email templates, or content
entries. Prefer short sentences, commas, colons, or parentheses. Before committing
copy changes, run:

```bash
rg -n '\x{2014}' src public --glob '!*.mp4' --glob '!*.jpg' --glob '!*.png' --glob '!*.svg'
```

The command should return no matches.
