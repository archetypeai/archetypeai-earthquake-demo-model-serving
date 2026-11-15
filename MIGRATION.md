# Migration: Direct Query API → Inference API

This project is the [earthquake demo](https://github.com/archetypeai/archetypeai-earthquake-demo) with its Newton calls moved from the Direct Query API (`POST /api/lens/query`) to the Inference API: Newton C 2.6 → **Newton C 2.6** (same model, new endpoint). The UI, the USGS feeds, the data summary sent to Newton and the quick prompts are unchanged.

All measurements below were taken on production on 2026-11-14.

## Summary

- **Endpoint:** every call is `POST /api/inference/query` on `newton-c-2.6`, text only, with the system turn in `system_prompt`.
- **Shorter answers:** the Inference API stops a query after about 58 seconds and generates more slowly than Direct Query did (100–140 characters a second against about 210). With the original prompt and its 3,072-token budget, the longest answers timed out (`504 query_timeout`). The prompt now asks for answers under 300 words, and `max_new_tokens` is 1,536.
- **No more loops:** listing magnitudes, the model sometimes repeats itself ("M1.8, M1.9, M1.8, …") until it runs out of tokens or time; Direct Query did it too. A `repetition_penalty` of 1.1 stops it.
- **Faster:** a median of 11 s per answer instead of 22 s on the example questions, and 17 s instead of 24 s on the quick prompts. See [Results](#results).
- **Open-source fonts:** Geist and Geist Mono replace the design system's PP Neue Montreal, whose files can't be redistributed.

## Direct Query API vs Inference API

|                 | Direct Query API                         | Inference API                                    |
| --------------- | ---------------------------------------- | ------------------------------------------------ |
| Endpoint        | `POST /api/lens/query`                   | `POST /api/inference/query`                      |
| Model           | `Newton::c2_6_8b_fp8_260424d7a55d5e`     | `newton-c-2.6`                                   |
| System turn     | `instruction_prompt`                     | `system_prompt`                                  |
| Answer budget   | `max_new_tokens` 3,072                   | `max_new_tokens` 1,536, `repetition_penalty` 1.1 |
| Time limit      | None seen (answers took up to 50 s)      | About 58 s, then `504 query_timeout`             |
| Answer          | `response.response[0]`                   | `response.response[0]`                           |

`POST /api/inference/chat/completions` gives word-for-word the same answers in the same time, but it ignores `repetition_penalty` (and refuses `frequency_penalty`), so it can't stop the loops.

## What changed in the code

| File                       | Change                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/newton.js` | `POST /api/inference/query` on `newton-c-2.6`; the 300-word sentence added to the system prompt; 1,536 tokens and `repetition_penalty` 1.1; accepts the endpoint with or without `/api`. |
| `vite.config.js`           | The project's `.env` wins over `ATAI_*` shell variables.                                                                                                                               |
| `src/routes/layout.css`    | Geist and Geist Mono from `@fontsource-variable` instead of the design system's `fonts.css`; the font files in `static/fonts/` are gone.                                                |
| Removed                    | The Lens and Direct Query skills in `.claude/skills/` (listed in `CLAUDE.md`), which pointed coding agents at the old APIs.                                                            |
| `LICENSE`                  | Apache License 2.0, for the code.                                                                                                                                                      |

## Results

Both versions answered the same questions over the same frozen USGS feeds (past day, 199 events; past week, 1,899; M4.5+ past week, 119), one question at a time: the five example questions from the README and the app's three quick prompts, 24 questions in all.

|                                                  | Direct Query, original prompt | Inference API, original prompt | Inference API, this version |
| ------------------------------------------------ | ----------------------------- | ------------------------------ | --------------------------- |
| Answered                                         | 24/24                         | 4/5 (past day only)            | 24/24                       |
| Time per answer, example questions               | 7–50 s, median 22 s           | 20–42 s, one timeout at 58 s   | 8–16 s, median 11 s         |
| Time per answer, quick prompts                   | 13–45 s, median 24 s          | not run                        | 10–23 s, median 17 s        |
| Length, median words (example / quick)           | 519 / 788                     | 586 / not run                  | 217 / 303                   |
| Answers stuck in a loop                          | 1                             | 1 (the timeout)                | 0                           |
| Quoted M4+ magnitudes that match an event        | 193/194                       | not scored                     | 141/143                     |

What the answers say is much the same: the same sequences, regions and strongest events, in fewer words. Both versions sometimes judge activity against a wrong idea of the global background rate (for example, "10–20 M4+ earthquakes per month", when it's about 35 a day); that comes from the model, not the API.

Direct Query answers vary from run to run; Inference API answers are the same every time for the same input.

## Reproducing

The comparison scripts aren't part of the app. To check latency yourself, run `npm run dev`, open the chat and use the quick prompts; each answer's time shows in the network panel for `/api/analyze`.
