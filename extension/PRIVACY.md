# TextChecker – Privacy policy

Last updated: 5 November 2026

TextChecker is a browser extension for learning French from the pages you read. It has no
server of its own, no account, no analytics and no advertising. This page lists everything
the extension sends over the network and everything it keeps on your device.

*Bản tiếng Việt ở cuối trang.*

## What is sent, and to whom

The extension only sends text when you use a feature. Nothing is sent in the background.

| When you… | What is sent | Sent to |
| --- | --- | --- |
| Look up a word (button, shortcut or context menu) | The selected word | Wiktionary (`fr.wiktionary.org`, `en.wiktionary.org`) |
| Play a pronunciation | Nothing but the request for the recording | Wikimedia Commons (`commons.wikimedia.org`, `upload.wikimedia.org`) |
| Analyze the grammar of a sentence, open a grammar card, or write a practice sentence | The sentence, or the sentence you wrote, and the grammar rule | The **grammar backend** set in Settings. By default this is `http://127.0.0.1:8000`, a program running on your own computer (the project's `backend/` folder). If you change the address, the text goes to that server. That backend keeps your practice sentences in its own database. |
| Open the preview of a study page (👁) | A request for that page, without cookies | Only these sites: lawlessfrench.com, francaisfacile.com, bonjourdefrance.com, lepointdufle.net, wiktionary.org, cnrtl.fr, larousse.fr, bescherelle.com, leconjugueur.lefigaro.fr, tv5monde.com |
| Click a dictionary or "Read more" link | Nothing; the page opens in a new tab | Larousse, Le Robert, CNRTL, Google Translate, Wiktionary |
| Use AI features (off in this version) | The text being checked, or your chat messages and the sentence you asked about | The AI provider **you** choose (Google, OpenAI or Anthropic), with **your** API key. Only when AI is turned on and a key is set. |

Grammar checking of text fields runs inside the extension with local rules: the text you type is
not sent anywhere.

## What is kept on your device

| Data | Where | Notes |
| --- | --- | --- |
| Vocabulary notebook: word, definitions, your note, the sentence where you met the word, the page address and title, review dates | Browser local storage | Included in your exports (JSON/CSV). Delete words in the notebook, or remove the extension. |
| Practice history: your sentences, the grammar rule, the result, the page address and title | Browser local storage | Popup → Practice → "Clear history". |
| Bookmarks, chat history, the sentence sent to the assistant | Browser local storage / session storage | Deleted from the side panel; session storage is cleared when the browser closes. |
| Recent grammar-check results (including the checked text) | Browser local storage | Kept for about one hour, at most 100 entries. |
| Dictionary results, grammar analyses | Browser local / session storage | Caches, to avoid asking twice. |
| Settings, API keys (if you add any), usage counters | Browser sync storage | Synced by your browser between your own devices if browser sync is on. |

The extension does not read or keep the pages you visit. On a page, it only reads the text you
select or the text field you are typing in.

## Permissions

- **Access to all sites**: show the lookup button, the grammar underlines and the cards on any page,
  and reach Wiktionary and the grammar backend.
- **storage**: the notebook, history and settings above.
- **contextMenus**: "Look up", "Add to vocabulary" and "Analyze grammar" in the right-click menu.
- **sidePanel**: the grammar assistant panel.
- **offscreen**: play pronunciation recordings even on pages that block audio.
- **alarms**: update the number of words due for review on the toolbar icon.
- **activeTab**: act on the current tab when you use a shortcut or the popup.

## Sharing

No data is sold or shared. The only recipients are the services in the first table, and only for
the action you started. The extension contains no remote code.

## Contact

Questions or requests: open an issue on the project's repository.

---

# Chính sách quyền riêng tư (tiếng Việt)

TextChecker là extension trình duyệt để học tiếng Pháp từ chính trang bạn đang đọc. Extension
không có máy chủ riêng, không tài khoản, không thống kê sử dụng, không quảng cáo.

**Gửi đi đâu (chỉ khi bạn dùng tính năng):**
- Tra từ: từ đang chọn gửi tới Wiktionary. Phát âm: tải bản ghi từ Wikimedia Commons.
- Phân tích ngữ pháp, thẻ ngữ pháp, tự đặt câu: câu đó (hoặc câu bạn viết) gửi tới **backend ngữ pháp** trong Cài đặt, mặc định `http://127.0.0.1:8000` là chương trình chạy trên chính máy bạn. Đổi địa chỉ thì câu được gửi tới máy chủ đó. Backend lưu các câu luyện tập vào cơ sở dữ liệu của nó.
- Xem trước trang tài liệu (👁): tải trang, không gửi cookie, chỉ với các trang học trong danh sách ở trên.
- Link từ điển, "Đọc thêm": chỉ mở tab mới khi bạn bấm.
- Tính năng AI (đang tắt ở bản này): chỉ khi bật AI và có API key, văn bản hoặc tin nhắn được gửi tới nhà cung cấp AI **bạn** chọn.
- Kiểm tra lỗi trong ô gõ chạy bằng quy tắc ngay trong extension, chữ bạn gõ không gửi đi đâu.

**Lưu trên máy:** sổ từ vựng (kèm câu chứa từ, địa chỉ và tiêu đề trang), lịch sử luyện tập (câu, cấu trúc, kết quả, trang), đánh dấu, lịch sử trò chuyện, kết quả kiểm tra gần đây (khoảng 1 giờ, tối đa 100), bộ nhớ đệm tra từ và phân tích. Cài đặt, API key và số liệu sử dụng nằm trong vùng đồng bộ của trình duyệt (đồng bộ giữa các máy của bạn nếu bật đồng bộ). Xoá được trong extension hoặc bằng cách gỡ extension.

Không bán, không chia sẻ dữ liệu; không có mã tải từ xa.
