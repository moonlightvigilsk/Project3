# Store listing (Chrome Web Store, Microsoft Edge Add-ons)

Everything to paste into the developer dashboards for TextChecker 1.0.0. The package is
`npm run zip`, which writes `.output/textchecker-<version>-chrome.zip`; the same zip goes to both stores.

## Assets

| Asset | File | Store field |
| --- | --- | --- |
| Icon 128×128 (96px artwork, 16px transparent padding) | `public/icon/128.png` | Store icon (CWS); Edge: "Store logo" accepts 128–300px |
| Screenshots 1280×800, English | `store/screenshots/en/1-…6-*.png` | Screenshots (CWS: up to 5; Edge: up to 10) |
| Screenshots 1280×800, Vietnamese | `store/screenshots/vi/1-…6-*.png` | Vietnamese listing |
| Privacy policy | `PRIVACY.md`, published at a public URL (for example the file's page in the GitHub repository) | Privacy policy URL |

Icons: `node scripts/render-icons.mjs` (from `public/icon.svg`). Screenshots:
`npm run build && node scripts/store-screenshots.mjs` (demo page `e2e/pages/store-demo.html`,
fake backend `e2e/fake-backend.mjs`). For the Chrome Web Store, pick five: 1, 2, 3, 4, 5.

## Text

**Name** (manifest): TextChecker – French grammar in context

**Category**: Education (CWS: "Education"; Edge: "Education")

**Language**: English (default), Vietnamese (second listing)

### Short description (≤ 132 characters; manifest `description`)

EN: Read French on any page: look up words, keep a vocabulary notebook, see the grammar of a sentence and practise it.

VI: Đọc tiếng Pháp trên mọi trang: tra từ, lưu sổ từ vựng, xem ngữ pháp của câu và tự đặt câu để luyện.

### Detailed description (EN)

TextChecker helps you learn French from the texts you choose to read.

• Look up a word: select it and click 🔍 (or Alt+Shift+D). The card shows the definition, examples, etymology and English translation from Wiktionary, the pronunciation, and links to Larousse, Le Robert, CNRTL and Google Translate.
• Vocabulary notebook: save a word with ☆. The sentence where you met it and the page are kept with it. Review with flashcards, see saved words highlighted on pages, export to CSV/JSON.
• Grammar in context: select a sentence and click "Analyze grammar" (or Alt+Shift+G). See which structures it uses (passé composé, futur proche, negation, pronouns…) with their CEFR level, highlighted in the text.
• Grammar cards: formula, explanation, conjugation, key points and examples, starting with the sentence you are reading.
• Practise: write your own sentence with the structure and get feedback: is the structure used, which words are wrong, a correction. Your practice history is in the popup.
• Writing check: mistakes in text fields are underlined; apply a fix in one click.
• Keyboard first: every card works with Tab, Enter and Esc; four shortcuts you can change.
• Light and dark themes, interface in English, Vietnamese and French.

Grammar analysis, grammar cards and practice use the open-source grammar backend of the project (spaCy), which you run on your computer (default http://127.0.0.1:8000). Without it, looking up words, the notebook and the writing check still work.

Privacy: no account, no tracking. Words go to Wiktionary when you look them up; sentences go only to the grammar backend you set. Details in the privacy policy.

### Detailed description (VI)

TextChecker giúp bạn học tiếng Pháp từ chính những bài bạn chọn để đọc.

• Tra từ: bôi đen rồi bấm 🔍 (hoặc Alt+Shift+D). Thẻ tra từ có nghĩa, ví dụ, từ nguyên, bản dịch tiếng Anh từ Wiktionary, phát âm, và link sang Larousse, Le Robert, CNRTL, Google Dịch.
• Sổ từ vựng: bấm ☆ để lưu, kèm câu chứa từ và trang bạn đang đọc. Ôn bằng flashcard, tô từ đã lưu khi đọc, xuất CSV/JSON.
• Ngữ pháp trong ngữ cảnh: bôi đen một câu rồi bấm "Phân tích ngữ pháp" (hoặc Alt+Shift+G) để thấy câu dùng cấu trúc nào (passé composé, futur proche, phủ định, đại từ…) và trình độ, được tô ngay trên trang.
• Thẻ ngữ pháp: công thức, giải thích, bảng chia, điểm chính và ví dụ, mở đầu bằng chính câu bạn đang đọc.
• Tự đặt câu: viết câu dùng cấu trúc đó và nhận phản hồi: có dùng đúng cấu trúc không, sai ở đâu, bản sửa. Lịch sử luyện tập nằm trong popup.
• Kiểm tra khi viết: lỗi trong ô gõ được gạch chân, sửa bằng một cú bấm.
• Dùng được hoàn toàn bằng bàn phím; bốn phím tắt đổi được.
• Giao diện sáng/tối, tiếng Việt, tiếng Anh, tiếng Pháp.

Phân tích ngữ pháp, thẻ ngữ pháp và tự đặt câu dùng backend ngữ pháp mã nguồn mở của dự án (spaCy) chạy trên máy bạn (mặc định http://127.0.0.1:8000). Không có backend thì tra từ, sổ từ và kiểm tra khi viết vẫn dùng được.

Quyền riêng tư: không tài khoản, không theo dõi. Từ chỉ gửi tới Wiktionary khi bạn tra; câu chỉ gửi tới backend ngữ pháp bạn cài đặt. Chi tiết trong chính sách quyền riêng tư.

## Chrome Web Store "Privacy practices" tab

**Single purpose**: Help learners read French web pages: look up words, keep a vocabulary notebook, and understand and practise the grammar of the sentences they read.

**Permission justifications**

| Permission | Justification |
| --- | --- |
| Host permission `<all_urls>` | The lookup button, grammar underlines and cards are shown on whatever page the user reads; the background reaches Wiktionary and the user's grammar backend (a local address by default). |
| storage | Vocabulary notebook, practice history, bookmarks, settings. |
| contextMenus | "Look up", "Add to vocabulary" and "Analyze grammar" on selected text. |
| sidePanel | The grammar assistant panel. |
| offscreen | Plays Wiktionary pronunciation recordings outside the page, whose content security policy may block audio. |
| alarms | Updates the badge with the number of words due for review when they become due. |
| activeTab | Acts on the current tab from keyboard shortcuts and the popup. |

**Remote code**: No, the extension does not use remote code.

**Data usage** (check these boxes):
- Website content: yes. The text the user selects (a word or a sentence) is sent to Wiktionary or to the grammar backend the user configures, only when the user asks. The sentence and page address are stored locally with saved words and practice attempts.
- Personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity: no.

Certify: data is not sold, not used for unrelated purposes, not used for credit decisions.

## Edge Add-ons

Same package, same texts. Edge asks for: description (the detailed description), short description, category Education, privacy policy URL, search terms (`French, grammar, vocabulary, dictionary, Wiktionary, learn French`), and the screenshots. Notes for certification: "Grammar features need the open-source backend from the repository running locally (default http://127.0.0.1:8000); word lookup, vocabulary and writing check work without it."

## Notes for the reviewers (both stores)

Test account: none needed. To try the grammar features: clone the repository, `cd backend`, install `requirements.txt` and the spaCy model `fr_core_news_md`, run `uvicorn app.main:app --port 8000`. Then select a French sentence on any page and click "Analyze grammar".
