# Lộ trình: Công cụ học ngữ pháp tiếng Pháp qua ngữ cảnh (TextChecker): extension trước, app Windows sau

## Mục tiêu dự án
Theo tài liệu họp nhóm (`docs/prj3 meeting 1.pdf`):

> Công cụ học ngôn ngữ giúp người học tiếp thu ngữ pháp bằng cách kết hợp **đầu vào dễ hiểu** (comprehensible input, tức là văn bản người học tự chọn vì thấy thích) với **cấu trúc ngữ pháp được giải thích rõ ràng**. Người học được tự đặt câu và nhận phản hồi sửa lỗi.

Dự án kết hợp hai cách học:
- **Học ngầm** (implicit): đọc thật nhiều và tự nhận ra quy luật.
- **Học tường minh** (explicit): học quy tắc, bảng chia động từ, danh sách từ vựng.

Vòng học mà mọi tính năng phải phục vụ:

```
Đọc văn bản (trang web, PDF, EPUB)
  → Nhận ra cấu trúc trong câu        (ví dụ: aller + infinitif, "Nous allons visiter Hanoi")
  → Xem giải thích ngữ pháp + link nguồn (Wiktionary...)  |  Xem thêm câu ví dụ
  → Tự đặt câu dùng cấu trúc đó        (ví dụ: gõ "Je vais visiter mon ami")
  → AI chấm và phản hồi
  → Sửa / thử lại
  → Đọc tiếp
```

7 mục tiêu và nơi sẽ làm:

| # | Mục tiêu | Extension (GĐ 1) | App Windows (GĐ 2) |
|---|---|---|---|
| 1 | Nhận văn bản theo ngữ cảnh: PDF, EPUB | Trang web đang đọc là nguồn đầu vào | Reader PDF/EPUB (`frontend/`, `backend/` đã có) |
| 2 | Cho người học xem cấu trúc ngữ pháp | US-17, US-18 | US-26 |
| 3 | Cho người học tự đặt câu | US-19 | US-26 |
| 4 | Phản hồi sửa lỗi | Kiểm tra ngữ pháp sẵn có, US-11, US-12, US-19 | US-23 |
| 5 | Tích hợp từ điển và tài nguyên ngôn ngữ | US-02, US-03, US-04 | US-22 |
| 6 | Theo dõi từ vựng đã học | US-05 → US-10 | US-25 |
| 7 | Người học tự chủ động dùng công cụ, không theo giáo trình cố định | Mọi tính năng đều do người học tự kích hoạt trên nội dung họ chọn | Như extension |

Kiến trúc tổng quát: Người dùng → (văn bản / câu hỏi / câu trả lời) → công cụ học → **Wiktionary**, **mô hình AI**, **các trang khác** (Larousse, Le Robert, CNRTL...), **cơ sở dữ liệu** (sổ từ, lịch sử luyện tập).

### Nguyên tắc thiết kế UI
Lấy từ tài liệu họp, áp dụng cho mọi US có giao diện:
- Giao diện tối giản, ít thành phần thừa.
- Lấy chữ làm trọng tâm: typography là chính, nội dung quan trọng hơn trang trí.
- Bảng màu trầm, dịu (giữ hướng Parchment/Ink hiện có).
- Không làm theo kiểu game: không điểm, không chuỗi ngày, không huy hiệu. Số liệu chỉ để người học tự theo dõi.
- Ưu tiên desktop.
- Dùng tiện bằng cả bàn phím lẫn chuột: mọi thao tác chính đều có phím tắt và điều hướng bằng Tab/Esc/Enter.
- Thiết kế chi tiết: Figma `https://www.figma.com/design/QuccmBk7xrDj0Z7kIlLLaC/Untitled?node-id=2-511` (xem US-15).

## Context
Repo `Project3/` đã có:
- `extension/`: WXT + React 19 + TS. Đã có kiểm tra ngữ pháp (mock/AI), gạch chân, popover/panel, Apply (vừa sửa), "Thêm vào từ điển" (chỉ lưu mảng `string[]` trong `browser.storage.sync`, dùng để bỏ qua lỗi chính tả), i18n VI/EN/FR, popup và trang options.
- `backend/`: FastAPI + spaCy + SQLite, đã có `dictionary_service.py` (tra Wiktionary, có cache) và bảng `vocabulary_items` (lemma, định nghĩa, câu ngữ cảnh, trạng thái new/learning/known).
- `frontend/`: web app React đọc sách và học ngữ pháp.

Việc cần làm: thêm luồng **bôi đen từ → thẻ tra từ + lưu vào sổ từ vựng**, thêm luồng **bôi đen câu → nhận diện ngữ pháp → tự đặt câu → AI phản hồi**, hoàn thiện extension, sau đó đóng gói thành **app .exe cho Windows**. Extension được ưu tiên làm xong trước.

Quyết định đã chốt:
- Thẻ tra từ lấy nghĩa từ **Wiktionary**. Kèm nút mở **Larousse, Le Robert, CNRTL (TLFi), Google Translate** ở tab mới. Larousse và Le Robert không có API công khai nên chỉ mở link được.
- Sổ từ vựng **lưu local** (`chrome.storage.local`), có export. Đồng bộ backend để giai đoạn app Windows.

App Windows: làm web app rồi bọc lại thành .exe. Có 2 lựa chọn là **Electron** và **Tauri**. Đề xuất **Tauri 2**: file cài khoảng 5–10MB (Electron khoảng 100MB+), dùng WebView2 có sẵn trên Windows 10/11, có sẵn plugin global hotkey, tray, clipboard, autostart, updater, và tái dùng được toàn bộ code React/TS hiện có.

Mỗi user story (US) dưới đây được viết để giao nguyên cho Claude Code/Antigravity làm trong 1 phiên. Mỗi US có tiêu chí nghiệm thu (AC) và các file chính cần sửa.

Thứ tự làm ở giai đoạn 1 (số US giữ nguyên để không lệch các tham chiếu cũ):
1. US-15 (UI theo Figma), làm trước để các US sau dựng giao diện mới luôn.
2. US-03 → US-12: tra từ, sổ từ vựng, sửa lỗi kiểm tra ngữ pháp.
3. US-16 → US-19: phím tắt, ngữ pháp trong ngữ cảnh.
4. US-13 (E2E), US-14 (phát hành) làm cuối cùng.

---

## Giai đoạn 1: Extension

### Epic A: Bôi đen để tra từ

**US-01: Nút nổi khi bôi đen chữ** ✅ Đã xong
Là người dùng, khi tôi bôi đen một từ hoặc cụm từ (≤ 5 từ) ở bất kỳ trang nào, tôi muốn thấy một nút nhỏ cạnh vùng chọn để mở thẻ tra từ.
- AC: bắt `mouseup`/`selectionchange` (có debounce). Nút nằm trong Shadow DOM sẵn có (`createOverlayContainer` trong `content.ts`), đặt theo `range.getBoundingClientRect()`. Ẩn khi bỏ chọn, cuộn trang hoặc nhấn Esc. Vùng chọn > 5 từ không hiện nút tra từ (6–120 từ hiện nút "Hỏi trợ lý về câu này" thay thế), khi đang gõ trong ô có popover lỗi, hoặc trên trang extension. Chạy được trong input/textarea (lấy chữ qua `selectionStart/End`) và trong text thường.
- Cài đặt: bật/tắt, kiểu kích hoạt (hiện nút / mở thẻ ngay / chỉ khi giữ Alt).
- File: `extension/src/entrypoints/content.ts` (nên tách sang `src/lib/selection/` để `content.ts` không phình thêm), `src/types/index.ts` (thêm Settings), `src/entrypoints/options/App.tsx`.

**US-02: Thẻ tra từ (dữ liệu Wiktionary)** ✅ Đã xong
Là người học, khi bấm nút tôi muốn thấy ngay: từ gốc (lemma), IPA, từ loại, giống (m/f), 1–3 nghĩa tiếng Pháp và ví dụ, cùng nghĩa tiếng Anh nếu có.
- AC: background thêm message `LOOKUP_WORD`. Gọi Wiktionary REST `https://fr.wiktionary.org/api/rest_v1/page/definition/{word}` và `en.wiktionary.org`, có thể cần `action=parse` để lấy IPA. Port logic parse từ `backend/app/services/dictionary_service.py` sang TS (`src/lib/dictionary/wiktionary.ts`). Cache kết quả trong `storage.local` (LRU khoảng 500 từ). Có trạng thái loading, không tìm thấy, và lỗi mạng. Hiển thị trong ≤ 1,5s với mạng bình thường.
- Chuẩn hoá từ trước khi tra: bỏ dấu câu, đổi nháy cong thành nháy thẳng, tách mạo từ lược âm (`l'ami` thành `ami`, `j'ai` thành `avoir`). Dạng chia của động từ thì đi theo link "forme de …" của Wiktionary để ra lemma.
- File: `src/lib/dictionary/*`, `src/entrypoints/background.ts`, UI thẻ trong content script (dùng chung style với `.tc-popover`).

**US-03: Nút mở từ điển ngoài** ✅ Đã xong
Là người học, tôi muốn có các nút Larousse / Le Robert / CNRTL / Google Translate / Wiktionary mở tab mới với từ đang tra.
- AC: các mẫu URL đặt ở một chỗ (`src/lib/dictionary/sources.ts`): `larousse.fr/dictionnaires/francais/{w}`, `dictionnaire.lerobert.com/definition/{w}`, `cnrtl.fr/definition/{w}`, `translate.google.com/?sl=fr&tl=vi&text={w}`. Trong Options có thể chọn nguồn nào hiển thị và thứ tự. Ngôn ngữ đích của Google Translate lấy theo `uiLanguage`.

**US-04: Phát âm** ✅ Đã xong
Là người học, tôi muốn bấm 🔊 để nghe phát âm.
- AC: dùng `speechSynthesis` với giọng `fr-FR` (không cần API). Có file audio Wiktionary/Commons thì ưu tiên phát file đó. Không có giọng fr thì ẩn nút.

### Epic B: Sổ từ vựng cá nhân

**US-05: Mô hình dữ liệu cho sổ từ vựng** ✅ Đã xong
Là dev, tôi cần đổi "từ điển" từ `string[]` thành bản ghi đầy đủ để dùng cho cả hai việc: bỏ qua lỗi chính tả và học từ.
- AC: kiểu `VocabEntry { id, word, lemma, pos, gender, ipa, definitions[], note, contextSentence, sourceUrl, sourceTitle, status: 'new'|'learning'|'known', ignoreSpelling: boolean, createdAt, updatedAt, reviewCount }`. Lưu trong `storage.local` (giới hạn 8KB/item của `sync` không đủ). Có migration: mảng `dictionary` cũ chuyển thành entry với `ignoreSpelling=true`. Lọc lỗi chính tả ở `background.ts` (đoạn `dictionaryStorage`) đọc từ store mới. Có unit test cho phần migration.
- File: `src/lib/storage.ts`, `src/types/index.ts`, `src/entrypoints/background.ts`. Khớp tên trường với `backend/app/models/vocabulary.py` để sau này đồng bộ dễ.
- Đã làm:
  - `VocabEntry` có thêm trường `saved` (từ nằm trong danh sách học). Lý do: một bản ghi chỉ có `ignoreSpelling` (ví dụ tên riêng) không nên xuất hiện trong flashcard hay export. Bản ghi bị xoá khi cả `saved` lẫn `ignoreSpelling` đều là false. `id` là lemma đã chuẩn hoá (NFC, chữ thường), nên mỗi từ chỉ có một bản ghi.
  - Lưu ở `storage.local`, mỗi từ một key `vocab:<id>` cộng bản ghi nhỏ `vocabulary` (`{ version: 2, index, importedLegacy, rev }`), nên lưu từ, ghi chú hay chấm flashcard (US-10) chỉ ghi đúng bản ghi đó. Bản đầu (version 1, mọi từ trong một key) được tự chuyển sang. Chỉ background ghi (`src/lib/vocabulary/store.ts`, mỗi lần một lệnh), nên nhiều tab ghi cùng lúc không đè nhau. Content script và các trang extension đọc trực tiếp, ghi qua message `VOCAB_COMMAND` (`src/lib/vocabulary/client.ts`).
  - Migration chạy một lần ở background: mảng `dictionary` (sync) thành bản ghi `ignoreSpelling`, ☆ từ trong `bookmarks` thành bản ghi `saved` (tách loại từ / IPA / nghĩa từ subtitle) và được chuyển ra khỏi `bookmarks`. Key `dictionary` cũ trong sync được giữ nguyên làm bản sao lưu. Từ do máy khác (còn chạy bản cũ) thêm vào đó được nhập thêm, mỗi từ một lần (từ đã bỏ ở đây không bị nhập lại).
  - Background nạp lại sổ khi storage bị đổi từ nơi khác (xoá dữ liệu, import), nên không ghi đè dữ liệu cũ trở lại.
  - `id` là chữ thường: "Paris" và "paris" là cùng một bản ghi (cố ý, giống từ điển cá nhân cũ).
  - Lọc lỗi chính tả đọc từ store mới. Kết quả lấy từ cache kiểm tra ngữ pháp cũng được lọc lại.
  - ☆ trên thẻ tra từ lưu `VocabEntry` đầy đủ (lemma, loại từ, giống, IPA của lemma, 3 nghĩa, URL và tiêu đề trang). Side panel "Từ vựng đã lưu" và tab "Từ điển cá nhân" trong Options đọc từ store mới.
  - `toBackendVocabulary()` ánh xạ sang cột `vocabulary_items`: `word` ↔ `surface_form`, `definitions` ↔ `definition`, epoch ms ↔ ISO.
- Câu chứa từ (`contextSentence`): làm ở US-06.

**US-06: "Thêm vào sổ" từ thẻ tra từ và từ popover lỗi** ✅ Đã xong
Là người học, tôi muốn bấm ⭐ trên thẻ tra từ để lưu từ, kèm câu chứa từ đó và URL trang.
- AC: tự lấy câu chứa vùng chọn (tách câu quanh range). Từ đã có trong sổ thì nút hiện "Đã lưu", bấm lần nữa mở sửa ghi chú hoặc xoá. Nút "+ Thêm vào từ điển" ở popover lỗi chính tả tạo entry với `ignoreSpelling=true`. Có menu chuột phải (`browser.contextMenus`, thêm permission `contextMenus`): "Tra từ" và "Thêm vào sổ từ vựng".
- Đã làm:
  - Tách câu (`extractSentence` trong `src/lib/selection/selection-info.ts`): lấy chữ của khối gần nhất (p, li, td…) hoặc của input/textarea, cắt theo . ! ? … và xuống dòng. Không cắt ở chữ viết tắt (M., etc.), chữ cái đầu (J. K.), số thập phân, URL. Giữ ngoặc kép kiểu Pháp « … ». Câu dài hơn 300 ký tự thì cắt quanh từ.
  - ☆ chưa lưu: lưu ngay kèm câu, URL, tiêu đề trang. Đã lưu: nút hiện "★ Đã lưu", bấm mở khung sửa (câu chứa từ, ghi chú, "Lưu ghi chú", "Xoá khỏi sổ"). Phím gõ trong ô ghi chú không lọt ra phím tắt của trang.
  - "+ Thêm vào từ điển" lưu `ignoreSpelling` (US-05) và bỏ luôn các lỗi chính tả khác của cùng từ trong kết quả đang hiện.
  - Menu chuột phải "Tra từ “%s”" và "Thêm “%s” vào sổ từ vựng" (theo ngôn ngữ giao diện). Content script của đúng frame mở thẻ tại vùng chọn; "Thêm" tự lưu khi tra xong rồi mở khung ghi chú để xác nhận. Trang không có content script (trang trình duyệt, trình xem PDF): "Tra từ" mở Wiktionary, "Thêm" lưu ở background (không có câu).
  - Sửa kèm (US-02): dạng chia viết bằng `{{lien|…}}` ("Pluriel d’{{lien|enfant|fr}}") giờ ra đúng lemma. Kết quả tra có `parserVersion`; kết quả trong cache do bộ phân tích cũ tạo ra được tra lại.
  - Lưu lại một từ đã có (menu "Thêm"): câu, URL và tiêu đề trang mới nhất thay cho cái cũ (thay cả ba cùng lúc).
  - Vùng chọn dài hơn 5 từ: menu chuột phải không tra/lưu, thẻ báo "Vùng chọn quá dài…". Không có content script thì "Tra từ" mở trang tìm kiếm Wiktionary.
  - Ghi chú đang gõ dở được lưu khi đóng khung sửa hoặc đóng thẻ (Esc, ×, bấm ra ngoài).
  - Dòng ngăn bởi `<br>` (thơ, địa chỉ) là các câu riêng.

**US-07: Xem và quản lý sổ trong popup/options** ✅ Đã xong
Là người học, tôi muốn xem danh sách từ đã lưu: tìm kiếm, lọc theo trạng thái, sửa ghi chú, xoá, đổi trạng thái.
- AC: popup có tab "Sổ từ" (10 từ gần nhất và ô tìm kiếm). Trang options có bảng đầy đủ. Có i18n VI/EN/FR (`src/lib/i18n.ts`). Giữ style Parchment/Ink hiện có.
- Đã làm:
  - Tìm kiếm, lọc, sắp xếp là hàm thuần `src/lib/vocabulary/browse.ts` (có unit test). Tìm không phân biệt hoa thường, dấu, chữ ghép (`ecole` ra `école`, `coeur` ra `cœur`). Tìm trong từ, dạng gặp, nghĩa, ghi chú, câu chứa từ, tiêu đề trang; khớp ở từ được xếp trước.
  - "Gần nhất" = mới thêm (`createdAt`): đổi trạng thái hay sửa ghi chú không đẩy từ lên đầu.
  - Popup: tab "Tổng quan" / "Sổ từ" (nhớ tab lần trước). 10 từ mới thêm hoặc 10 kết quả tìm, đổi trạng thái ngay trên dòng, bấm từ để mở nghĩa, câu chứa từ, trang nguồn, ghi chú, nút xoá. Link "Mở sổ đầy đủ" mở `options.html#vocabulary`.
  - Options: tab "Sổ từ vựng" dạng bảng: ô tìm, lọc theo trạng thái (kèm số từ mỗi loại), sắp xếp (mới thêm / A→Z / theo trạng thái, nhớ lựa chọn), sửa ghi chú, đổi trạng thái, xoá. Hiện 50 dòng, "Xem thêm" để tải tiếp.
  - Thành phần dùng chung: `src/components/vocab.tsx`. Danh sách tự cập nhật khi sổ đổi ở nơi khác. Ghi chú tự lưu khi ngừng gõ, khi rời ô và khi đóng popup; ghi chú đang gõ dở không bị cập nhật từ nơi khác ghi đè.
  - Xoá cần xác nhận. Xoá khỏi sổ chỉ bỏ cờ `saved`: từ vẫn nằm trong danh sách bỏ qua chính tả nếu đã thêm ở đó.

**US-08: Export / Import** ✅ Đã xong
Là người học, tôi muốn xuất sổ ra CSV và file Anki (TSV: front = từ + IPA, back = nghĩa + câu ví dụ), và nhập lại từ JSON.
- AC: tải file qua `Blob` và `a[download]`. Import trùng lemma thì gộp. CSV khớp với cột của `GET /vocabulary/export/csv` ở backend.
- Đã làm (`src/lib/vocabulary/transfer.ts`, có unit test; UI ở tab "Sổ từ vựng" của options, `VocabTransfer.tsx`):
  - Xuất các từ đang hiện theo ô tìm và bộ lọc (không lọc thì xuất cả sổ). Tên file theo mẫu backend `vocab_export_YYYYMMDD_HHMMSS.csv`.
  - CSV: đúng 9 cột và thứ tự của backend, mọi ô trong ngoặc kép, xuống dòng CRLF. "Số lần gặp" = 1 (extension chưa đếm), "Nghĩa tiếng Việt" để trống, nhiều nghĩa nối bằng `; `. Có BOM UTF-8 để Excel hiện đúng dấu. Ô bắt đầu bằng `= + - @` được thêm `'` để bảng tính không chạy như công thức.
  - Anki (`.tsv`): có dòng khai báo `#separator:tab`, `#html:true`, `#columns`, `#tags column` nên Anki 2.1.55+ nhập không cần chỉnh. Mặt trước: từ + IPA (+ dạng gặp nếu khác). Mặt sau: từ loại, nghĩa, câu chứa từ, ghi chú. Tag `textchecker` và `textchecker::<trạng thái>`.
  - JSON sao lưu `{ format: "textchecker-vocabulary", version: 1, entries }`: đủ mọi trường, nhập lại được.
  - Nhập JSON: nhận file sao lưu, mảng từ, hoặc dạng cũ `{ entries: {…} }`; tối đa 5 MB. Background kiểm tra lại dữ liệu: bỏ mục hỏng, cắt chữ quá dài, chỉ giữ link http(s). Trùng lemma (không phân biệt hoa thường) thì gộp: bản sửa sau cùng quyết định trạng thái và câu/URL/tiêu đề, trường trống được điền từ bản kia, ghi chú khác nhau được nối, giữ ngày tạo sớm nhất và số lần ôn cao nhất. Báo số từ mới / gộp / bỏ qua.

**US-09: Đánh dấu từ đã lưu khi đọc trang (tuỳ chọn)** ✅ Đã xong
Là người học, tôi muốn các từ trong sổ (status ≠ known) được highlight nhẹ trên trang tôi đang đọc, để ôn lại theo ngữ cảnh.
- AC: tắt mặc định. Dùng TreeWalker và CSS Custom Highlight API (`CSS.highlights`) để không sửa DOM của trang. Giới hạn số node xử lý để không làm lag.
- Đã làm:
  - Cài đặt `vocabHighlight` (mặc định tắt), bật ở tab Cài đặt của options, có mẫu màu. Chỉ chạy khi extension đang bật. Bật/tắt và đổi sổ từ có hiệu lực ngay trên các trang đang mở.
  - Tìm từ (`src/lib/vocab-highlight/matcher.ts`, có unit test): từ đã lưu, trạng thái Mới (xanh) hoặc Đang học (vàng). Khớp nguyên từ, không phân biệt hoa thường, sau mạo từ lược âm (`l'école`), cụm nhiều từ (kể cả xuống dòng). Không khớp trong từ khác (`peut-être`, `maisonnette`). Ngoài lemma và dạng đã gặp còn có số nhiều / giống cái đều của danh từ, tính từ (`maisons`, `bateaux`, `grande(s)`); động từ chỉ khớp lemma và dạng đã gặp (chưa sinh dạng chia).
  - Tô (`src/lib/vocab-highlight/highlighter.ts`): Range + `CSS.highlights`, style `::highlight()` đưa vào trang bằng constructed stylesheet (không bị CSP của trang chặn). Không sửa DOM. Bỏ qua ô nhập, vùng soạn thảo (contenteditable), code/pre, script/style, khung của extension.
  - Giới hạn: tối đa 8000 text node mỗi lần quét trang, 2000 node mỗi đợt nội dung mới, 1 triệu ký tự, 3000 từ được tô mỗi trang; quét theo lát 8 ms trong lúc trình duyệt rảnh. Nội dung thêm sau (cuộn vô hạn, SPA) được quét thêm; chữ bị sửa hoặc xoá thì bỏ tô.

**US-10: Ôn tập nhanh (flashcard)** ✅ Đã xong
Là người học, tôi muốn ôn các từ đã lưu bằng flashcard đơn giản trong popup, chấm Quên / Nhớ.
- AC: dùng thuật toán SM-2 rút gọn (thêm `dueAt`, `ease` vào `VocabEntry`). Badge trên icon extension hiện số từ đến hạn ôn (có thể tắt). Không thêm điểm, chuỗi ngày hay hiệu ứng ăn mừng (xem Nguyên tắc thiết kế UI). Mỗi thẻ hiện kèm câu ngữ cảnh đã lưu, để ôn theo ngữ cảnh chứ không học từ rời.
- Đã làm:
  - `VocabEntry` thêm `dueAt`, `ease`, `intervalDays` (dữ liệu cũ tự nhận giá trị mặc định: đến hạn ngay, ease 2.5). Lịch ôn trong `src/lib/vocabulary/review.ts` (có unit test): "Nhớ" → 1 ngày, 6 ngày, rồi khoảng cách × ease (ease giữ nguyên); "Quên" → gặp lại sau 10 phút, ease −0.2 (tối thiểu 1.3). Khoảng cách ≥ 21 ngày thì từ tự chuyển "Đã thuộc".
  - Ôn tập gồm các từ đã lưu, chưa thuộc, đã đến hạn (từ mới đến hạn ngay, theo thứ tự thêm vào). Từ "Đã thuộc" không đưa vào ôn; đổi tay về "Đang học" thì đến hạn ngay, về "Mới" thì học lại từ đầu.
  - Popup có tab "Ôn tập" (kèm số từ đến hạn). Mặt trước: từ, IPA, từ loại và câu chứa từ (từ in đậm). Mặt sau: nghĩa, ghi chú, trang nguồn. Nút Quên / Nhớ ghi rõ lần ôn tiếp (vd. "10 phút", "6 ngày"). Phím: Space/Enter lật thẻ, 1/← Quên, 2/→ Nhớ. Từ quên được hỏi lại ở cuối lượt. Hết lượt chỉ hiện số từ đã ôn và giờ ôn tiếp theo, không điểm, không chuỗi ngày, không hiệu ứng.
  - Badge trên icon: số từ đến hạn (tooltip theo ngôn ngữ giao diện), cập nhật khi sổ đổi và bằng `chrome.alarms` đúng lúc từ tiếp theo đến hạn (thêm permission `alarms`). Tắt được ở Cài đặt (`reviewBadge`, mặc định bật).

### Epic C: Hoàn thiện phần kiểm tra ngữ pháp sẵn có

**US-11: Đồng bộ mô hình text cho contenteditable** ✅ Đã xong
Gạch chân đang lệch ở editor nhiều đoạn, vì `getTextFromElement` dùng `innerText` còn ánh xạ vị trí lại dùng text node.
- AC: dùng một mô hình text chung (text node + `\n` ở ranh giới block) cho cả 3 việc: gửi đi kiểm tra, vẽ gạch chân, và Apply. Dùng lại `getContenteditableWalkerText` trong `src/lib/utils.ts`. Kiểm thử bằng trang Lexical nhiều đoạn và `test/index.html`.
- Đã làm:
  - Mô hình chung `src/lib/editable-text.ts` (có unit test, dùng `linkedom` làm DOM khi test): text node theo thứ tự, `<br>` = `\n`, ranh giới block (p, div, li, h1…, hoặc phần tử hiển thị dạng block) = một `\n` nếu chưa có xuống dòng; bỏ khoảng trắng chỉ dùng để thụt lề HTML giữa các block, bỏ script/style. Mỗi ký tự ứng đúng một vị trí trong text node, `\n` ảo ở ranh giới block không thuộc node nào (đầu đoạn chọn sẽ nhảy sang node sau, cuối đoạn chọn giữ ở node trước).
  - `getTextFromElement` (text gửi đi kiểm tra), `getContenteditableWalkerText`, `getContenteditableRange` (Apply) và gạch chân trong `content.ts` cùng dùng mô hình này; gạch chân dựng mô hình một lần cho mỗi lần vẽ. Text được đọc từ phần tử editor gốc, không phải phần tử con nhận sự kiện.
  - Sửa kèm (phát hiện khi test): `resolveSuggestions` bỏ mất các sửa chỉ khác khoảng trắng (`" ,"` → `","`, khoảng trắng kép) nên hai quy tắc dấu câu chưa bao giờ hiện. Nay giữ lại; khoảng trắng kép chỉ nhận đúng vị trí, không dò chỗ khác.
  - E2E: Lexical 0.17 (3 đoạn + dòng trống), `test/index.html` (`<br>`), editor thường (Enter tạo `<div>`): mọi gạch chân trùng đúng vị trí chữ (sai số < 1,5px), Apply sửa đúng chữ, gạch chân còn lại vẫn đúng sau Apply.

**US-12: Gợi ý không phân biệt hoa thường và giữ nguyên chữ hoa** ✅ Đã xong
`Tu as fais` hiện không bị phát hiện.
- AC: mock rules khớp không phân biệt hoa thường. Bản thay thế giữ chữ hoa đầu câu như bản gốc (`Tu as fait`). Thêm test vào `src/lib/suggestions/__tests__/`.
- Đã làm:
  - Mock rules (`src/lib/checker/mock-checker.ts`): mọi quy tắc khớp không phân biệt hoa thường; quy tắc dạng chữ chỉ khớp nguyên từ (`mangé` không khớp trong `mangées`), chữ có dấu tính là chữ cái.
  - Giữ chữ hoa (`src/lib/suggestions/case.ts`, áp dụng trong `resolveSuggestions` nên dùng cho cả mock và AI): bản thay thế viết thường được đổi theo bản gốc: viết hoa chữ đầu (`Tu as fais` → `Tu as fait`, `C est` → `C'est`) hoặc viết hoa toàn bộ (`TU AS FAIS` → `TU AS FAIT`). Bản thay thế có chữ hoa riêng giữ nguyên (`paris` → `Paris`). Gợi ý sửa chữ hoa (`Le` → `le` giữa câu) không bị đổi ngược lại.
  - `resolveSuggestions` tìm bản gốc không phân biệt hoa thường ở bước tìm mềm, nên AI trả `mon amis` vẫn khớp `Mon amis` trong văn bản.
  - Test: `src/lib/suggestions/__tests__/case.test.ts`. E2E: input, textarea, contenteditable đều phát hiện lỗi viết hoa, popover và Apply giữ đúng chữ hoa.

**US-13: Bộ test E2E tự động** ✅ Đã xong
Dùng puppeteer-core nạp `.output/chrome-mv3` (`enableExtensions` + `pipe:true`) và chạy kịch bản: gõ lỗi → gạch chân → Apply qua panel/popover → bôi đen → thẻ tra từ → lưu từ. Chạy trên input, textarea, contenteditable và Lexical.
- File: `extension/e2e/*.mjs`, script `npm run e2e`.
- Đã làm (xem `extension/e2e/README.md`):
  - `npm run e2e` = build rồi chạy mọi file `e2e/*.e2e.mjs` bằng `node:test` (có sẵn trong Node, không thêm test runner); `npm run e2e:nobuild -- <tên>` chạy riêng một file. Chạy headless; `E2E_HEADFUL=1` để xem trình duyệt, `CHROME_PATH` để chọn Chrome/Chromium (tự tìm đường dẫn cài đặt phổ biến trên Windows/macOS/Linux). `puppeteer-core` thêm vào devDependencies (không tải trình duyệt).
  - `grammar.e2e.mjs`: input (popover, giữ chữ hoa), textarea (panel, lỗi ở dòng 2), contenteditable nhiều đoạn, `test/index.html` (`<br>`), Lexical (từ esm.sh, tự bỏ qua nếu offline). Kiểm tra gạch chân nằm đúng chữ và Apply sửa đúng.
  - `lookup.e2e.mjs`: bôi đen `ami` → thẻ có lemma, IPA `/a.mi/` → ☆ lưu kèm câu, URL, tiêu đề → popup có từ → export CSV có dòng `ami` đúng cột backend; tra từ trong textarea; tô từ đã lưu trên trang. Dùng cache tra từ có sẵn (không phụ thuộc Wiktionary); `E2E_NETWORK=1` để tra Wiktionary thật.
  - `review.e2e.mjs`: badge số từ đến hạn, ôn flashcard trong popup, tìm và đổi trạng thái ở bảng options, sao lưu JSON rồi khôi phục sau khi xoá sổ.
  - CI (`.github/workflows/ci.yml`): job `test` chạy unit test và `npm run e2e` với Chrome có sẵn trên runner Ubuntu.
  - Phát hiện khi chạy với Wiktionary thật: lưu `ami` trong câu "mon ami" ghi từ loại `adjectif` (lấy mục đầu tiên của Wiktionary), chưa chọn theo ngữ cảnh.

**US-14: Phát hành** ✅ Đã chuẩn bị xong (còn bước nộp lên store, cần tài khoản nhà phát triển)
Icon PNG 16/48/128, ảnh chụp màn hình, privacy policy (nêu rõ chữ chỉ gửi lên Wiktionary, nhà cung cấp AI do người dùng chọn, và backend nếu người dùng bật; sổ từ vựng lưu trên máy câu chứa từ cùng URL và tiêu đề trang nơi gặp từ (US-06), các dữ liệu này đi theo khi export (US-08) hoặc đồng bộ (US-25)), `wxt zip`, nộp Chrome Web Store và Edge Add-ons. Workflow `release.yml` đã có sẵn, cần kiểm tra lại.
- Đã làm:
  - Icon: `public/icon.svg` vẽ lại theo màu accent (#3460C8), render ra `public/icon/{16,32,48,128}.png` bằng `scripts/render-icons.mjs` (Chrome cục bộ). Bản 128 có 16px lề trong suốt theo quy định của Chrome Web Store. WXT tự đưa vào `manifest.icons` (trước đó manifest không có icon nào).
  - Manifest: tên "TextChecker – French grammar in context", `short_name` TextChecker, mô tả mới (114 ký tự, bỏ chữ "AI" vì AI đang tắt). Version lấy từ `package.json` (bỏ version viết cứng).
  - Ảnh chụp 1280×800, tiếng Anh và tiếng Việt, 6 ảnh mỗi bộ (`store/screenshots/{en,vi}/`): thẻ tra từ, phân tích câu, thẻ ngữ pháp, tự đặt câu, lịch sử luyện tập, side panel. Tạo lại bằng `scripts/store-screenshots.mjs` (trang mẫu `e2e/pages/store-demo.html`, backend giả `e2e/fake-backend.mjs`, tách ra từ `analysis.e2e.mjs`).
  - Privacy policy `extension/PRIVACY.md` (Anh + Việt): bảng gửi gì / khi nào / tới đâu (Wiktionary, Wikimedia, backend ngữ pháp, trang xem trước, nhà cung cấp AI khi bật), dữ liệu lưu trên máy, quyền và lý do, không chia sẻ, không mã tải từ xa. Kèm sửa: kết quả kiểm tra (có chứa chữ đã gõ) hết hạn sau 1 giờ giờ được xoá khỏi `storage.local` ở lần ghi sau, thay vì nằm lại mãi.
  - Nội dung đăng store `extension/store/listing.md`: mô tả ngắn và dài (EN/VI), danh mục, lý do cho từng quyền, "single purpose", mục khai báo dữ liệu của Chrome Web Store, phần cho Edge, ghi chú cho người duyệt (cách chạy backend).
  - `npm run zip` → `.output/textchecker-1.0.0-chrome.zip` (301 KB, dùng cho cả Chrome Web Store và Edge), `npm run zip:firefox` → bản Firefox + sources zip. Đã kiểm tra nội dung zip (manifest, icon, không có source map hay file test).
  - `release.yml`: kiểm tra tag trùng version trong `package.json`, chạy tsc + unit test + e2e trước khi phát hành, tạo zip bằng `wxt zip`, sửa hướng dẫn cài (Firefox chọn file zip), mô tả release theo sản phẩm hiện tại, link privacy policy.
  - README của extension viết lại theo sản phẩm hiện tại (bản cũ vẫn là "LanguageTool alternative" của dự án gốc), có mục Release.
  - Test: `vitest run` 236, `npm run e2e` 34 kịch bản đều qua.
- Còn lại (làm tay): đưa `PRIVACY.md` lên một URL công khai (ví dụ trang file trên GitHub), tạo tài khoản nhà phát triển Chrome Web Store (phí 5 USD một lần) và Partner Center cho Edge, upload zip, điền nội dung theo `store/listing.md`, gửi duyệt.

### Epic D: Giao diện theo thiết kế

**US-15: Áp dụng thiết kế Figma** ✅ Đã xong (phím tắt trong menu chuyển sang US-16, chat không cần AI chuyển sang US-17/US-18)
Là người dùng, tôi muốn giao diện extension thống nhất theo bản thiết kế, gọn và dễ đọc.
- Nguồn: Figma `https://www.figma.com/design/QuccmBk7xrDj0Z7kIlLLaC/Untitled?node-id=2-511`. Ảnh chụp: `docs/design/desktop-sidepanel-wordcard.png`, `docs/design/grammar-card-source-preview.png`.
- Thiết kế gồm 4 phần:
  1. **Side panel "Chat"** (Chrome side panel, rộng khoảng 412px, nền xám nhạt): tiêu đề "Chat ▾" ở giữa, bấm vào mở menu. Ba nút thao tác dạng thẻ trắng: "Give examples for [grammar concept]", "Practice [grammar concept] with sentences", "Give short grammar explanation and link study resources". Bong bóng chào "Pick one of the actions above to start chatting with me!". Ô nhập "What would you like to know?" có nút gửi tròn.
  2. **Menu** (nền mờ, bo góc, mục đang chọn nền xanh): Bookmarks, Chat history / Saved vocabularies, Saved resources / Settings.
  3. **Thẻ tra từ** (nổi trên trang): thanh xám bo tròn có ☆ và `Wiktionary/<từ>`, từ cỡ lớn in đậm, dòng phụ `nom · /IPA/ · féminin`, các mục DEFINITION, USAGE D'EXEMPLE, ÉTYMOLOGIE, TRADUCTIONS. Câu đang hỏi trên trang được tô nền xanh lá nhạt.
  4. **Thẻ ngữ pháp**: thanh ☆ `grammar/<id>`, tên cấu trúc, `Form: …`, PATTERNS, CORE USES, EXAMPLES, SOURCE. Bên cạnh là bản xem trước trang nguồn (thanh ☆ + URL).
- Đã làm:
  - Token màu trung tính trong `src/styles.css` (giữ tên token cũ nên popup/options tự đổi màu), thêm `accent`, `panel`, `highlight`. Màu cứng trong popover lỗi (`content.ts`) cũng đổi sang bảng màu mới.
  - Thẻ tra từ làm lại theo thiết kế (`src/lib/selection/lookup-ui.ts`), có thêm phần **từ nguyên** (parse mục `{{S|étymologie}}`, hiểu template `{{étyl}}`, `{{date}}`, `{{siècle}}`), có ☆ lưu từ.
  - Bôi đen hơn 5 từ thì hiện nút 💬 "Hỏi trợ lý về câu này": mở side panel, kèm câu đó làm ngữ cảnh, câu được tô xanh trên trang (CSS Custom Highlight API, không sửa DOM). (Từ US-17: nút nổi là "Phân tích ngữ pháp", nút "Hỏi trợ lý về câu này" nằm trong thẻ phân tích.)
  - Side panel (`src/entrypoints/sidepanel/`): menu, 3 thao tác nhanh, chat với AI (`CHAT_SEND` ở background, `src/lib/chat/*`), thẻ ngữ pháp do AI trả JSON (link nguồn chỉ chấp nhận các trang trong danh sách tin cậy, không thì dùng link tìm kiếm), lịch sử trò chuyện, danh sách đã lưu. Popup có nút "Mở trợ lý ngữ pháp".
  - Bookmark lưu ở `storage.local` (`src/lib/bookmarks.ts`): từ, thẻ ngữ pháp, tài liệu.
  - i18n VI/EN/FR cho mọi chuỗi mới. Test mới: từ nguyên, chọn câu, parse thẻ ngữ pháp.
  - **Xem trước trang nguồn** (thẻ bên phải trong thiết kế): nút 👁 cạnh link SOURCE của thẻ ngữ pháp mở thẻ xem trước ngay bên dưới (thanh ☆ + URL + ×, Esc để đóng). Các trang học đều chặn nhúng iframe (`X-Frame-Options`), nên side panel tải trang về (`src/lib/chat/source-preview.ts`) và chỉ giữ chữ đọc được: tiêu đề, đoạn văn, mục danh sách, chữ đậm. Bỏ nav/header/footer/aside/script/form; tối đa 80 khối, 12.000 ký tự, có link "Đọc tiếp trên trang gốc". Hiển thị bằng React text, không đưa HTML của trang vào extension. Chỉ tải các trang trong danh sách nguồn tin cậy (`TRUSTED_SOURCE_HOSTS`), không gửi cookie, timeout 10 s, tối đa 3 MB, nhận đúng bảng mã (header hoặc `<meta charset>`). Chỉ tải khi người dùng bấm 👁. Lỗi thì báo và cho mở tab mới. Mục "Tài liệu đã lưu" cũng mở bản xem trước thay vì tab mới.
  - **Chế độ tối**: cài đặt "Giao diện sáng / tối" (Theo hệ thống / Sáng / Tối, mặc định theo hệ thống) ở tab Cấu hình. Popup, options, side panel: `data-theme` trên `<html>`, `src/styles.css` đổi giá trị token (nền tối, chữ sáng; `white` là màu thẻ; thêm token `info`, `note`, `ok`, `star`, `context` thay cho màu hex viết cứng). Theme được nhớ trong `localStorage` để trang không nháy sáng khi mở (`src/lib/page-theme.ts`). Thẻ tra từ, popover lỗi, nút nổi trên trang: màu là biến `--tc-*` trên shadow host (`OVERLAY_THEME_CSS` trong `src/lib/theme.ts`), đổi ngay khi đổi cài đặt.
  - Test mới: `src/lib/chat/__tests__/source-preview.test.ts`, `src/lib/__tests__/theme.test.ts`.
- Chuyển sang US khác:
  - Phím tắt trong menu (⌘Z, ⌘V… như trên thiết kế trùng với Undo/Paste của trình duyệt): đã làm ở US-16 bằng Alt+chữ.
  - Khi `ENABLE_AI = false`, chat chỉ báo là AI đang tắt. Bản chạy không cần AI (lấy thẻ ngữ pháp từ backend `/api/grammar/*`) thuộc US-17/US-18.
- Ghi chú cho US-14 (privacy policy): bản xem trước tải trang nguồn (chỉ các trang học tin cậy) khi người dùng bấm 👁, không gửi cookie.
- File: `src/styles.css`, `src/lib/theme.ts`, `src/lib/page-theme.ts`, `src/lib/selection/*`, `src/lib/chat/*`, `src/lib/bookmarks.ts`, `src/entrypoints/sidepanel/*`, `src/entrypoints/background.ts`, `src/entrypoints/popup/App.tsx`, `wxt.config.ts` (permission `sidePanel`).

**US-16: Phím tắt và điều hướng bằng bàn phím** ✅ Đã xong
Là người dùng desktop, tôi muốn làm mọi thao tác chính mà không cần chuột.
- AC: khai báo `commands` trong `wxt.config.ts`: tra từ đang chọn, kiểm tra/nhận diện ngữ pháp câu đang chọn, mở sổ từ. Người dùng đổi phím ở `chrome://extensions/shortcuts`, trang options có link tới đó và hiện phím hiện tại. Trong popover, thẻ tra từ, thẻ ngữ pháp: Tab/Shift+Tab di chuyển giữa các nút, Enter để chọn, Esc để đóng, focus trả về chỗ cũ khi đóng. Có `aria-label` cho nút chỉ có icon.
- Đã làm:
  - 4 phím tắt (Chrome chỉ nhận tối đa 4 phím gợi ý), định nghĩa chung ở `src/lib/commands.ts`. Dùng Alt+Shift+chữ để không trùng phím của Chrome (Ctrl+Shift+G cũ là "Tìm ngược" của Chrome; Chrome không nhận Alt+Shift+C):
    - **Alt+Shift+D** tra từ đang chọn. Thẻ tra từ nhận focus. Không có vùng chọn thì thẻ hướng dẫn bôi đen. Vùng chọn dài thì thẻ báo quá dài. Chạy cả khi đã tắt nút tra từ.
    - **Alt+Shift+G** trong ô đang gõ: kiểm tra ngay, mở popover lỗi ở con trỏ (hoặc lỗi kế tiếp), focus vào "Áp dụng". Nhấn tiếp để sang lỗi sau (quay vòng). Ngoài ô gõ, khi có vùng chọn: hiện nút 💬 "Hỏi trợ lý về câu này" và focus vào đó, Enter để mở side panel. (Side panel chỉ mở được ngay trong lúc xử lý phím tắt, mà lúc đó background chưa biết trang đang ở ô gõ hay không, nên phải thêm bước Enter. US-17 đã đổi chỗ này thành mở thẻ phân tích ngữ pháp.)
    - **Alt+Shift+K** mở trợ lý (side panel), gửi kèm câu đang chọn, hoặc câu chứa từ đang chọn, và tô câu đó trên trang.
    - **Alt+Shift+V** mở sổ từ vựng (`options.html#vocabulary`). Nếu trang options đã mở thì chuyển sang tab đó.
  - Background gửi `RUN_COMMAND` tới tab, chỉ frame đang có focus xử lý (`document.hasFocus()`). Trang không có content script (trang của trình duyệt, trình xem PDF) thì bỏ qua.
  - Focus (`src/lib/focus.ts`): thẻ tra từ, popover lỗi, bảng danh sách lỗi và nút nổi mở bằng bàn phím sẽ nhận focus. Tab / Shift+Tab chỉ chạy vòng trong thẻ. Esc đóng thẻ rồi trả focus về chỗ cũ, kèm vùng chọn trên trang hoặc vị trí con trỏ trong ô gõ. Phím gõ trong thẻ không lọt ra phím tắt của trang. Mở bằng chuột thì không lấy focus (giữ hành vi cũ), nhưng Esc vẫn đóng được popover và bảng lỗi. Bấm Enter/Space trên nút 🔍 hoặc nút nổi của câu (💬, từ US-17 là "Phân tích ngữ pháp") thì thẻ mở ra cũng nhận focus. Từ US-17/US-18, thẻ phân tích và thẻ ngữ pháp trên trang theo cùng quy tắc.
  - Áp dụng sửa bằng bàn phím xong thì focus về lại ô gõ. Nút trạng thái (số lỗi) giờ là nút thật (`role=button`, Tab tới được, Enter mở bảng lỗi).
  - Vị trí con trỏ trong contenteditable được tính theo mô hình text chung (`offsetOfPosition` trong `src/lib/editable-text.ts`). Chọn lỗi theo con trỏ và chuyển lỗi kế tiếp: `src/lib/suggestions/navigation.ts`.
  - Options, tab Cấu hình, mục "Phím tắt": hiện phím đang đặt (đọc từ `commands.getAll()`, "Chưa đặt" nếu bị gỡ, tự cập nhật khi quay lại trang). Nút "Đổi phím tắt" mở `chrome://extensions/shortcuts` (Edge: `edge://`). Nếu không mở được thì hiện địa chỉ để dán vào thanh địa chỉ. Kèm hướng dẫn phím trong thẻ và trong side panel.
  - Side panel (phần còn lại của US-15): Alt+B đã đánh dấu, Alt+H lịch sử, Alt+V từ vựng, Alt+R tài liệu, Alt+N cuộc trò chuyện mới, Alt+S cài đặt. Phím được hiện ngay trong menu (macOS hiện ⌥B). Alt+1/2/3 cho ba thao tác nhanh, `/` để vào ô nhập, Esc trong danh sách để quay về chat. Menu: mũi tên, Home/End; Esc đóng menu và trả focus về nút menu; Tab đóng menu. Không dùng ⌘Z, ⌘V như thiết kế vì trùng Undo/Paste.
  - `aria-label`: thêm cho nút đóng bảng lỗi, nút trạng thái, nút cài đặt trong popup. Popover và bảng lỗi có `role=dialog`.
  - Test: `src/lib/__tests__/commands.test.ts`, `src/lib/suggestions/__tests__/navigation.test.ts`, `offsetOfPosition` trong `editable-text.test.ts`. E2E `e2e/keyboard.e2e.mjs` gồm 8 kịch bản; phím tắt được giả lập bằng cách gửi `RUN_COMMAND` như background.
- Hết Epic D: đã chạy toàn bộ `vitest run` (195 test) và `npm run e2e` (22 kịch bản), tất cả đều qua.
- Kiểm tra lại Epic C/D sau US-17/US-18: `vitest run` 226 test, `npm run e2e` 32 kịch bản đều qua. Sửa thêm: mở side panel qua `src/lib/side-panel.ts` (Firefox dùng `sidebarAction`, không còn lỗi `sidePanel` undefined ở bản Firefox mà CI vẫn build); permission `sidePanel`/`offscreen` chỉ khai báo cho Chrome; công tắc Bật/Tắt trong popup có `role=switch` + `aria-checked`, nút gạt nhìn thấy được ở chế độ tối; chuỗi hướng dẫn (chat, phím tắt trong thẻ) cập nhật theo nút "Phân tích ngữ pháp".

### Epic E: Ngữ pháp trong ngữ cảnh (vòng học chính)

Epic này hiện thực vòng học ở đầu file ngay trên trang web người học đang đọc. Backend đã có sẵn: catalog ngữ pháp (`backend/grammar/fr/*.yaml`, `GET /api/grammar/rules`), spaCy matcher (`POST /api/grammar/analyze`; có futur proche, passé composé, imparfait, conditionnel, subjonctif, phủ định, đại từ COD/COI), chấm câu (`POST /api/practice/submit`: kiểm tra cấu trúc bằng spaCy rồi mới gọi LLM, LLM lỗi vẫn trả kết quả kiểm tra cấu trúc; `/api/practice/explain`, `/api/practice/history`). Mọi API đều có tiền tố `/api`.

**US-17: Nhận diện cấu trúc ngữ pháp trong câu đang chọn** ✅ Đã xong
Là người học, khi bôi đen một câu (hoặc chọn "Phân tích ngữ pháp" ở menu chuột phải), tôi muốn thấy câu đó dùng những cấu trúc ngữ pháp nào, với phần chữ tương ứng được tô nhẹ.
- AC: vùng chọn > 5 từ thì nút nổi đổi thành "Phân tích ngữ pháp" (phím tắt Alt+Shift+G ngoài ô gõ hiện đang focus nút 💬 "Hỏi trợ lý", đổi theo, xem US-16). Không có vùng chọn thì lấy cả câu quanh con trỏ (dùng lại phần tách câu của US-06). Background thêm message `ANALYZE_GRAMMAR` gọi `POST /api/grammar/analyze` ở backend (URL backend cấu hình trong options, mặc định `http://127.0.0.1:8000`). Backend không chạy thì báo rõ, kèm hướng dẫn bật backend, không lỗi im lặng. Hiển thị danh sách cấu trúc (tên, trình độ A1–C2) và tô từ liên quan trong câu. Cache theo câu.
- Tuỳ chọn sau: bộ nhận diện cơ bản bằng regex chạy offline trong extension cho vài cấu trúc phổ biến (aller + infinitif, passé composé, ne…pas).
- File: `src/lib/grammar/*` (mới), `src/entrypoints/background.ts`, `src/types/index.ts`, `src/entrypoints/options/App.tsx`. Backend: kiểm tra lại CORS cho origin `chrome-extension://`.
- Đã làm:
  - Bôi đen hơn 5 từ: nút nổi giờ là "Phân tích ngữ pháp" (thay cho nút 💬 của US-15). Nút "Hỏi trợ lý về câu này" chuyển vào thẻ phân tích.
  - **Alt+Shift+G** ngoài ô gõ: mở thẻ phân tích ngay, thẻ nhận focus (không cần bấm Enter như ở US-16). Có vùng chọn dài thì phân tích vùng chọn; chọn một từ hoặc chỉ đặt con trỏ thì phân tích câu chứa nó (`getSentenceAtCaret` trong `selection-info.ts`, dùng lại phần tách câu của US-06, tách thành `sentenceBounds`). Không có gì thì thẻ hướng dẫn. Trong ô gõ vẫn là kiểm tra lỗi như US-16.
  - Menu chuột phải "Phân tích ngữ pháp" (`CONTEXT_MENU_ANALYZE`): vùng chọn dài thì phân tích vùng chọn, một từ thì phân tích câu chứa từ đó.
  - Background: message `ANALYZE_GRAMMAR` gọi `POST {backend}/api/grammar/analyze` (timeout 15 s, không gửi cookie), đọc thêm `GET /api/grammar/rules` để lấy tên và trình độ (lỗi thì dùng trình độ của catalog có sẵn). Kết quả gom theo cấu trúc, mỗi cấu trúc có các đoạn chữ khớp (offset được kiểm lại với `matched_text`). Cache theo (địa chỉ backend, câu): tối đa 100 câu, trong bộ nhớ và `storage.session`. Chỉ cache kết quả thành công. Code: `src/lib/grammar/backend.ts`.
  - Thẻ phân tích (`src/lib/grammar/analysis-ui.ts`, cùng khung với thẻ tra từ, có chế độ tối): câu với phần chữ của các cấu trúc được tô, danh sách cấu trúc (tên, trình độ, chữ khớp). Rê chuột hoặc Tab tới một cấu trúc thì chỉ tô chữ của cấu trúc đó; bấm để giữ (US-18 sẽ mở thẻ ngữ pháp ở đây). Trên trang, chữ khớp cũng được tô nhẹ bằng CSS Custom Highlight API (`src/lib/grammar/page-highlight.ts`), đóng thẻ thì bỏ tô. Tab/Esc/focus như US-16.
  - Backend không chạy: thẻ báo "Không kết nối được backend ngữ pháp ở …", hiện lệnh bật backend (`cd backend && uvicorn app.main:app --port 8000`), nút "Thử lại" và "Đổi địa chỉ backend" (mở options). Backend trả lỗi (ví dụ thiếu model spaCy) thì hiện mã lỗi và `detail`. Hết thời gian chờ cũng báo riêng.
  - Options, tab Cấu hình, mục "Backend ngữ pháp": ô địa chỉ (mặc định `http://127.0.0.1:8000`, nhận cả `127.0.0.1:8000/` hay `…/api`, chuẩn hoá khi lưu), nút "Kiểm tra kết nối" (đọc `/api/grammar/rules`, báo số cấu trúc), nút "Mặc định". `Settings.backendUrl`.
  - CORS: background có host permission nên request không bị CORS chặn. Backend vẫn thêm `cors_origin_regex` (mặc định `^(chrome|moz)-extension://[A-Za-z0-9-]+$`, `CORS_ORIGIN_REGEX` trong `.env`) để trang của extension gọi trực tiếp được. Thêm test `test_extension_origins_allowed_by_regex` (chưa chạy được pytest vì máy chưa có Python).
  - Test: `src/lib/grammar/__tests__/backend.test.ts` (chuẩn hoá URL, gom kết quả, lỗi mạng/HTTP/timeout, cache, chia đoạn tô chữ), `sentenceBounds` trong `selection-info.test.ts`. E2E `e2e/analysis.e2e.mjs` (8 kịch bản, backend giả bằng server node); sửa kịch bản Alt+Shift+G trong `keyboard.e2e.mjs`.
- Ghi chú cho US-14 (privacy policy): câu người dùng yêu cầu phân tích được gửi tới địa chỉ backend trong cài đặt (mặc định máy của họ).

**US-18: Thẻ ngữ pháp: giải thích, công thức, ví dụ** ✅ Đã xong (nút "Tự đặt câu" đã có từ US-19)
Là người học, khi bấm vào một cấu trúc vừa nhận diện, tôi muốn đọc giải thích ngắn, công thức và vài câu ví dụ.
- AC: lấy từ `GET /api/grammar/rules/{id}`: tên, công thức (ví dụ `Sujet + aller (présent) + infinitif`), giải thích theo `uiLanguage` (`description_vi`/`description_en`, chưa có tiếng Pháp thì dùng tiếng Anh), 2–3 câu ví dụ (`examples_correct`). Câu gốc trên trang hiện đầu tiên làm ví dụ ngữ cảnh. Có link "Đọc thêm" (Wiktionary hoặc nguồn khác ghi trong YAML). Có nút "Thêm ví dụ" (lấy thêm từ catalog, hoặc nhờ AI tạo nếu đã bật AI) và nút "Tự đặt câu" chuyển sang US-19. Giao diện dùng chung khung với thẻ tra từ.
- File: `src/lib/grammar/*`, UI thẻ trong content script, có thể thêm trường `links` vào YAML trong `backend/grammar/fr/`.
- Đã làm:
  - Bấm (hoặc Enter) vào một cấu trúc trong thẻ phân tích thì thẻ chuyển thành thẻ ngữ pháp, cùng chỗ, cùng khung: thanh ☆ `grammar/<id>` ×, nút "← Phân tích câu", tên, dòng phụ `trình độ · nhóm`, `Công thức: …`, GIẢI THÍCH, MẪU CÂU (bảng chia trong catalog), ĐIỂM CHÍNH (`key_points`), VÍ DỤ, ĐỌC THÊM. Focus đi theo thẻ; quay lại thì focus về đúng cấu trúc vừa mở. Esc đóng hẳn và trả focus/vùng chọn như US-16. Trên trang chỉ tô chữ của cấu trúc đang xem.
  - Dữ liệu: message `GRAMMAR_RULE` ở background gọi `GET /api/grammar/rules/{id}` (cache 30 phút theo backend + id). `src/lib/grammar/rule.ts` đọc kết quả: giải thích theo `uiLanguage` (`description_vi` / `description_en`; tiếng Pháp lấy `description` của catalog có sẵn, vì rule từ YAML chép tiếng Việt vào đó); thiếu ngôn ngữ thì dùng tiếng Anh, rồi tiếng Pháp, rồi tiếng Việt, kèm nhãn nhỏ EN/FR/VI cho biết ngôn ngữ đang hiện.
  - Ví dụ: câu trên trang đứng đầu ("Trong bài bạn đang đọc", chữ của cấu trúc được gạch chân), sau đó 3 câu của catalog (`examples_correct` kèm ghi chú, rồi `examples`, bỏ trùng và bỏ câu trùng với câu trên trang). "Thêm ví dụ" thêm 3 câu mỗi lần; hết catalog thì nút biến mất, hoặc thành "Thêm ví dụ với trợ lý" (mở side panel với câu này) khi `ENABLE_AI` bật.
  - "Đọc thêm": trường `links` mới ở backend (`GrammarRuleMetadata.links`, đọc từ YAML; đã thêm cho `aller_infinitif.yaml`). Chỉ nhận link thuộc danh sách trang tin cậy (`TRUSTED_SOURCE_HOSTS`). Rule không có link thì dùng trang Wiktionnaire của thuật ngữ (futur proche, passé composé, imparfait, négation, pronom personnel, conditionnel, subjonctif).
  - ☆ lưu thẻ vào mục "Đã đánh dấu" của side panel (cùng dạng `GrammarCard` với thẻ AI, mở lại được không cần backend).
  - Backend chưa chạy / lỗi: như thẻ phân tích (lệnh bật backend, Thử lại, Đổi địa chỉ). Rule không có trong catalog (404): báo "Chưa có thẻ ngữ pháp…" nhưng vẫn hiện câu trên trang làm ví dụ.
  - Chưa làm: nút "Tự đặt câu" (đã có chỗ `onPractice` trong `rule-ui.ts`, nút chỉ hiện khi có handler) sẽ làm cùng ô nhập của US-19, để không có nút bấm vào không làm gì.
  - Test: `src/lib/grammar/__tests__/rule.test.ts` (đọc rule YAML/catalog, chọn ngôn ngữ, lọc link, ví dụ, thẻ bookmark, lỗi 404/mạng). E2E thêm 2 kịch bản vào `e2e/analysis.e2e.mjs` (thẻ đầy đủ bằng bàn phím: Thêm ví dụ, Đọc thêm, ☆, quay lại, Esc; và rule 404). Backend: `tests/test_grammar_catalog_links.py` (chưa chạy được vì máy chưa có Python).

**US-19: Tự đặt câu và nhận phản hồi** ✅ Đã xong
Là người học, sau khi đọc thẻ ngữ pháp tôi muốn tự viết một câu dùng cấu trúc đó (ví dụ gõ `Je vais visiter mon ami`) và được chấm ngay: đúng/sai cấu trúc, lỗi ngữ pháp/chính tả, bản sửa và giải thích ngắn.
- AC: ô nhập ngay trong thẻ ngữ pháp, Enter để gửi. Gọi `POST /api/practice/submit` (`user_sentence` + `target_rule_id`). Nếu trả về `llm_unavailable` thì vẫn hiện kết quả kiểm tra cấu trúc và ghi chú "chưa có phản hồi AI". Hiện: có dùng đúng cấu trúc không, các lỗi được gạch chân bằng cùng kiểu gạch chân của phần kiểm tra ngữ pháp, bản sửa, giải thích theo `uiLanguage`. Có "Thử lại" (giữ câu cũ để sửa) và "Đọc tiếp" (đóng thẻ). Lưu mỗi lần làm (câu, rule, kết quả, URL nguồn) vào `storage.local`, và đồng bộ backend nếu có. Popup có mục "Lịch sử luyện tập" đơn giản: danh sách theo thời gian, lọc theo cấu trúc. Không chấm điểm kiểu game.
- File: `src/lib/grammar/*`, `src/lib/storage.ts`, `src/entrypoints/background.ts`, `src/entrypoints/popup/*`.
- Đã làm:
  - Thẻ ngữ pháp có nút "Tự đặt câu": mở ô nhập ngay cuối thẻ (focus vào ô, placeholder nêu tên cấu trúc). Enter gửi, Shift+Enter xuống dòng; phím gõ trong ô không lọt ra trang. Tab/Esc như US-16.
  - Background: message `PRACTICE_SUBMIT` gọi `POST /api/practice/submit` (`user_sentence`, `target_rule_id`, `target_rule_name`; timeout 45 s vì backend có thể chờ LLM). Code: `src/lib/grammar/practice.ts`, `backend.ts` (`submitPractice`), giao diện `src/lib/grammar/practice-ui.ts`.
  - Kết quả: câu đúng / có dùng cấu trúc nhưng còn lỗi / chưa dùng cấu trúc; câu của người học với chỗ sai gạch chân dày 3px cùng màu với gạch chân của phần kiểm tra ngữ pháp (`getSuggestionColor`); "Bản sửa"; danh sách lỗi `« chữ sai » → gợi ý · giải thích`. Không hiện điểm số.
  - Phản hồi AI: chỉ tính là AI khi backend dùng model thật. `llm_unavailable` hoặc backend đang chạy provider `mock` thì ghi "Chưa có phản hồi AI: kết quả chỉ từ phần kiểm tra cấu trúc", và các lỗi chia động từ / nguyên mẫu / thiếu cấu trúc được giải thích bằng câu của extension theo `uiLanguage`. Giải thích do LLM viết chỉ có tiếng Việt (`explanation_vi`), giao diện EN/FR thì kèm nhãn VI.
  - "Thử lại" giữ nguyên câu cũ trong ô để sửa (focus cuối câu); "Đọc tiếp" đóng thẻ và trả vùng chọn trên trang.
  - Lịch sử: mỗi lần chấm được lưu ở `storage.local` (`practiceHistory`, tối đa 500, mới nhất trước): câu, cấu trúc, đúng/sai, bản sửa, lỗi, URL và tiêu đề trang đang đọc. Đồng bộ backend: `/api/practice/submit` tự lưu mỗi lần vào SQLite (`/api/practice/history`), nên không cần gửi lại.
  - Popup có tab "Luyện tập" (Lịch sử luyện tập): danh sách theo thời gian, lọc theo cấu trúc (kèm số câu), link về trang đang đọc, nút xoá lịch sử. Không có điểm hay chuỗi ngày.
  - Backend (chưa chạy được pytest vì máy chưa có Python):
    - `practice_rule_verifier.py`: các bước kiểm tra trợ động từ "aller" / động từ nguyên mẫu trước đây áp cho mọi cấu trúc, nên câu passé composé hay phủ định đúng vẫn bị chấm sai. Nay chỉ áp cho `aller_infinitif` / `futur_proche`; cấu trúc khác chỉ dựa vào matcher.
    - Mock LLM: trường hợp "thiếu cấu trúc" không còn nói về aller + infinitif và không bịa câu sửa cho cấu trúc khác.
    - `PracticeSubmitResponse.llm_provider`: provider đã viết phản hồi (null khi không có).
    - Test mới `tests/test_practice_other_rules.py`.
  - Test: `src/lib/grammar/__tests__/practice.test.ts`. E2E thêm 2 kịch bản vào `e2e/analysis.e2e.mjs` (tự đặt câu bằng bàn phím: lỗi gạch chân đúng màu, Thử lại, Đọc tiếp, lịch sử được lưu; tab Luyện tập của popup và bộ lọc).
- Ghi chú cho US-14 (privacy policy): câu tự đặt được gửi tới backend trong cài đặt (backend lưu vào SQLite của nó); lịch sử luyện tập lưu trên máy kèm URL và tiêu đề trang đang đọc.
- Hết Epic E: `vitest run` 236 test, `npm run e2e` 34 kịch bản, build Chrome và Firefox đều qua. Chưa chạy pytest (máy chưa có Python).

---

## Giai đoạn 2: App Windows (.exe) bằng Tauri 2

Kiến trúc:
- Thư mục mới `desktop/` (Tauri 2, frontend Vite + React).
- Logic lõi dùng chung: tách `extension/src/lib/{checker,suggestions,dictionary,ai}` thành package `packages/core` (npm workspaces) để extension và desktop cùng import.
- Backend Python (spaCy, đọc sách) chạy như **sidecar** của Tauri: đóng gói bằng PyInstaller, Tauri tự khởi động `backend.exe` trên cổng localhost.

**US-20: Tách package lõi dùng chung**
- AC: `packages/core` chứa checker, resolve, dictionary, kiểu dữ liệu. Extension build và test vẫn chạy. Không còn import `browser.*` trong core (chuyển lớp lưu trữ thành interface có 2 bản cài đặt: `chrome.storage` và Tauri store/SQLite).

**US-21: Khung app Tauri**
- AC: `npm create tauri-app` (React-TS) trong `desktop/`. Cửa sổ chính gồm các tab Kiểm tra văn bản (dán chữ vào, gạch chân, Apply), Tra từ, Sổ từ vựng, Cài đặt. Build ra `.msi`/`.exe` (NSIS) bằng `npm run tauri build`. Cần cài Rust và WebView2.

**US-22: Phím tắt toàn hệ thống: tra từ ở mọi ứng dụng**
Là người dùng, khi bôi đen chữ trong Word, Zalo PC, PDF reader… rồi nhấn `Ctrl+Shift+D`, tôi muốn một cửa sổ nhỏ hiện cạnh con trỏ chuột với thẻ tra từ.
- AC: dùng `tauri-plugin-global-shortcut`. Lấy chữ đang chọn bằng cách lưu clipboard cũ → giả lập `Ctrl+C` → đọc clipboard → khôi phục clipboard cũ (Rust, crate `enigo` hoặc `windows`). Cửa sổ popup không viền, luôn ở trên, tự ẩn khi mất focus.

**US-23: Phím tắt toàn hệ thống: kiểm tra và sửa đoạn văn ở mọi ứng dụng**
Bôi đen đoạn văn rồi nhấn `Ctrl+Shift+G`: popup hiện danh sách lỗi. Bấm "Áp dụng tất cả" thì app dán bản đã sửa đè lên vùng chọn (giả lập `Ctrl+V`).
- Không làm: gạch chân lỗi trực tiếp trong mọi ứng dụng Windows. Gạch chân chỉ có trong trình duyệt (extension).

**US-24: Tray, khởi động cùng Windows, tự cập nhật**
- AC: `tauri-plugin-autostart`, icon ở tray có menu (Bật/Tắt, Mở sổ từ, Thoát). Dùng `tauri-plugin-updater` với GitHub Releases.

**US-25: Backend sidecar và đồng bộ sổ từ**
- AC: PyInstaller đóng gói `backend/` thành `backend.exe` (gồm model `fr_core_news_md`), khai báo `externalBin` trong Tauri. Sổ từ trên desktop lưu vào SQLite qua API `/vocabulary` sẵn có. Extension có tuỳ chọn "Đồng bộ với app desktop" (gọi `http://127.0.0.1:<port>` khi app đang chạy, gộp theo `lemma` + `updatedAt`).

**US-26: Tích hợp web app đọc sách**
Nhúng `frontend/` (Reader, Ngữ pháp, Notebook) làm các tab của app desktop, trỏ API sang sidecar.

**US-27: Đóng gói và ký số**
Workflow GitHub Actions build Windows (`tauri-action`) và tạo Release. Tuỳ chọn ký code (chưa ký thì SmartScreen sẽ cảnh báo).

---

## Mẫu prompt giao cho Claude/Antigravity
```
Đọc README.md và extension/src/entrypoints/content.ts, extension/src/lib/utils.ts.
Thực hiện US-0X theo file docs/user-stories.md (nội dung US + AC).
Ràng buộc: TypeScript strict, giữ style Parchment/Ink, i18n VI/EN/FR, không thêm thư viện nặng.
Xong thì: npx tsc --noEmit, npx vitest run <file test của US này>, npx wxt build. Chỉ chạy toàn bộ test (vitest run + e2e) khi xong cả epic.
```

Code xong 1 US thì mở phiên mới (để review không bị ảnh hưởng bởi ngữ cảnh lúc code) và chạy lệnh review trong Claude Code:
```
/review-us US-0X          # chỉ review: checklist AC + rà lỗi + chạy tsc/vitest/build
/review-us US-0X --fix    # review rồi sửa các mục chưa đạt và lỗi tìm thấy
/review-us                # không ghi US thì lấy US cuối cùng đã đánh dấu ✅
```
Lệnh nằm ở `.claude/commands/review-us.md`.


## Kiểm thử
- Mỗi US: `npx tsc --noEmit`, `npx wxt build`, và chỉ chạy test liên quan tới US đó: `npx vitest run <đường dẫn hoặc tên file test>` (file test mới/sửa và test của module bị đụng tới). Không chạy lại toàn bộ test từ US-01.
- Xong cả một epic (US cuối của epic): chạy toàn bộ `npx vitest run`, `npm run e2e` (nếu đã có), `pytest` trong `backend/` (nếu epic đụng backend).
- E2E (sau US-13): puppeteer-core với Chrome đã cài, chạy trên `test/index.html` và trang Lexical. Kiểm tra: bôi đen `ami` → thẻ hiện IPA `/a.mi/` → bấm lưu → popup có từ đó → export CSV có dòng `ami`. Vòng ngữ pháp (cần backend chạy): bôi đen `Nous allons visiter Hanoi.` → nhận diện `aller_infinitif` → mở thẻ ngữ pháp → gõ `Je vais visiter mon ami` → kết quả "đúng cấu trúc" → lịch sử luyện tập có câu đó.
- Thủ công: Reload extension trong `chrome://extensions`, thử trên Gmail, Messenger, Google Translate, Wikipedia FR.
- Desktop: `npm run tauri dev`, thử phím tắt trong Notepad/Word, cài file `.msi` trên máy Windows sạch.
