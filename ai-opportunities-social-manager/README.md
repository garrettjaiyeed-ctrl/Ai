# AI Opportunities Social Manager

A local-first social comment assistant for AI Opportunities clients.

## Phase 1 goal

Make Amore's TikTok workflow reliable:

- Open a saved browser session
- Load a TikTok video
- Scan visible comments
- Generate short AI reply drafts from client knowledge
- Approve, edit, or skip each reply
- Insert an approved reply into TikTok for a human to post
- Avoid duplicate replies
- Flag legal, complaint, and sensitive comments for manual handling

## Safety model

This project intentionally keeps a human in the loop. It does not mass-post unattended replies. Client passwords and API keys must never be committed to GitHub.

## Local setup

1. Install Node.js LTS.
2. Copy `.env.example` to `.env`.
3. Copy `config/clients/amore.example.json` to `config/clients/amore.json`.
4. Add your OpenAI API key to `.env`.
5. Run:

```bash
npm install
npm run install-browser
npm start
```

6. Open `http://localhost:3030`.

## Roadmap

- Phase 1: TikTok comment workflow for Amore
- Phase 2: Multiple client profiles and analytics
- Phase 3: Instagram, Facebook, and YouTube inboxes
- Phase 4: Buffer integration, lead tracking, and team accounts
