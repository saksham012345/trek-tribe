# AI Training with Movie Data - Quick Start

## What This Does

Transforms your movie datasets into **conversational personality training** for the Trek Tribe AI chat support. The AI becomes more:
- 🎭 Empathetic and understanding
- 💪 Encouraging and supportive  
- 😄 Positive and uplifting
- 📖 Story-driven and engaging

**Note**: Movies are NOT added as recommendations. They inspire the AI's communication style!

## Quick Run

```bash
cd services/api
npm run train:ai
```

## What Happens

1. **Parses** your movie datasets (TSV files)
2. **Generates** 14 conversational training documents
3. **Creates** embeddings for semantic search
4. **Stores** in Knowledge Base for RAG
5. **Shows** training results

## Expected Result

```
🎉 Training Complete!
✅ Total Ingested: 14
📊 Movie-inspired docs: 14
📊 Total docs: 22
```

## Files Needed

- `movie_characters_metadata.tsv` (root directory)
- `movie_titles_metadata.tsv` (root directory)

## Result

Your AI will respond with more personality:

**User**: "I'm nervous about my first trek"

**AI Response** (before training):
> "Our beginner treks are suitable for first-timers."

**AI Response** (after training):
> "I completely understand! Planning your first trek can feel like a big step—and that's totally normal! 😊 Just like every great adventure, your journey starts with courage. Don't worry, we're here to support you every step of the way! Our beginner-friendly treks are designed for first-timers with experienced guides. Want me to show you some perfect beginner treks? 🏔️"

## Categories Added

- **Personality Traits** (4 docs)
  - Encouraging tone
  - Empathy
  - Positivity
  - Storytelling

- **Uplifting Themes** (5 docs)
  - Adventure & exploration
  - Overcoming challenges
  - Finding joy
  - Building connections
  - Pushing boundaries

- **Engagement Hooks** (5 docs)
  - Action enthusiasts
  - Adventure seekers
  - Fun lovers
  - Deep thinkers
  - Thrill seekers

## Verification

Test in chat:
1. Open Trek Tribe website
2. Start chat with AI
3. Ask questions about trekking
4. Notice more engaging, human-like responses

## Need Help?

See the full guide: `../../AI_TRAINING_GUIDE.md`

## Customization

Edit this file to add more personality:
- `src/scripts/trainAIWithMovieData.ts`

Then re-run:
```bash
npm run train:ai
```

---

**That's it!** Your AI is now more human and engaging! 🚀
