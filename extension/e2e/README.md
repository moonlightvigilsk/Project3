# E2E tests

The tests load the built extension (`.output/chrome-mv3`) into the Chrome installed on the machine with `puppeteer-core`. They then drive real pages served from `e2e/pages/`, plus the manual test page `test/index.html`.

```bash
npm run e2e                   # build, then run every test
npm run e2e:nobuild           # run on the current build
npm run e2e:nobuild -- lookup # only files whose name contains "lookup"
```

| Variable | Effect |
| --- | --- |
| `E2E_HEADFUL=1` | Shows the browser instead of running headless. |
| `CHROME_PATH=/path/to/chrome` | Uses another Chrome or Chromium. Common install paths on Windows, macOS and Linux are found without it. |
| `E2E_NETWORK=1` | Looks up words on Wiktionary instead of the seeded cache. |

| File | What it checks |
| --- | --- |
| `grammar.e2e.mjs` | Type an error, then check the underline and Apply. Covers an input (popover, keeps the capital), a textarea (suggestion panel), a multi-paragraph contenteditable, `test/index.html` (lines separated by `<br>`) and Lexical. Underlines must be under the exact characters. |
| `lookup.e2e.mjs` | Select `ami` to open the lookup card (lemma, IPA), then ☆ saves the word with its sentence and page. Then the popup lists it, the CSV export has its row, lookup works in a textarea, and saved words are highlighted on pages. |
| `review.e2e.mjs` | Checks the due-word badge and a flashcard review in the popup. Also searches the options table and changes a status, then restores a cleared notebook from the JSON backup. |
| `analysis.e2e.mjs` | Grammar analysis (US-17) against a fake backend (a small node server). Covers the "Analyze grammar" button on a long selection (structures, level, words highlighted in the card and in the page), the cache, the shortcut with only a caret (sentence around it, focus, Tab, Esc), the context menu on one word, "backend not running" then Retry, "Ask the assistant" from the card, and the options backend address with its connection test. Also the grammar card of a structure (US-18): opened from the keyboard, formula, explanation, page sentence first among the examples, "More examples", "Read more", ☆ to bookmarks, back to the analysis with focus on the structure, Esc; and a rule missing from the catalog. And "Write a sentence" (US-19): Enter sends, errors underlined in the grammar-check colour, Try again / Keep reading, attempts saved, and the popup "Practice" tab with its structure filter. |
| `keyboard.e2e.mjs` | Keyboard use (US-16). Shortcuts are simulated by sending the background's `RUN_COMMAND` message (puppeteer cannot press browser shortcuts). Checks that the lookup card and the error popover take focus, Tab stays inside them and Esc returns focus (and the selection or caret). Also covers the next error on each press, Enter to apply, the options shortcut list, and the side panel Alt+keys and menu. |

The Lexical test loads Lexical from esm.sh and is skipped when that fails (offline). Each file starts its own Chrome with a fresh profile, and the files run one after the other.
