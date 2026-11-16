# Selgo agents

Every agent Selgo offers is a folder in here. To deploy an agent, add or edit
its folder, then commit and push. The API loads the folders every time it
starts, so the change goes live with the next deploy. Locally, the API
restarts by itself when agent files change (see the run command in the main
README).

```
api/agents/
└── growth-marketing-coach/     the folder name is the agent's permanent id
    ├── agent.toml              name, industry, tagline, price, expert
    ├── instructions.md         how the agent behaves (never shown to users)
    ├── photo.jpg               optional: the expert's photo (under 300 KB)
    └── knowledge/              what the agent is trained on (.md or .txt)
        ├── chapter-1.md
        └── interviews/2024.md  subfolders are fine
```

## Add an agent

1. Copy the `_template` folder and rename the copy, using lowercase words and
   dashes, such as `real-estate-lead-qualifier`. Never rename a folder after
   it goes live: the name is how purchases, likes and comments find the agent.
2. Fill in `agent.toml` and `instructions.md`.
3. Put the training material in `knowledge/`.
4. Restart the API locally and check that it was loaded (see below), then
   commit and push.

## Change, hide or remove an agent

- **Change**: edit its files and push. Only what changed is reloaded.
- **Hide**: set `published = false` in `agent.toml`.
- **Remove**: delete the folder. The agent disappears from the market, but its
  record is kept because purchases, comments and likes point at it.

## Check that it worked

When the API starts, its terminal shows a line such as:

```
Agents synced: 2 found, 1 added, 0 updated, 1 retrained, 0 hidden, 0 skipped.
```

If a folder has a mistake, that agent is skipped and the terminal says why,
for example `Agent 'my-agent' was skipped: agent.toml: monthly_price: ...`.
The rest of Selgo keeps working, and the live version of that agent, if
there is one, stays as it was.

## Rules

- **Experts**: only train an agent on a real person's knowledge, or use their
  name, photo or voice, with their written permission.
- **Keep the GitHub repo private.** Agent instructions and expert knowledge
  are your product. In a public repo, anyone can read them.
- **Encoding**: save every file as UTF-8, which is VS Code's default.
- **Samples**: `growth-marketing-coach`, `social-media-content-planner`,
  `pricing-advisor` and `inventory-planner` are made-up samples for testing
  the market and the mentor's recommendations. Delete them before launch.
