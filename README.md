# Language Learning Tool (French Edition)

> Ứng dụng hỗ trợ học ngữ pháp tiếng Pháp thông qua tài liệu tự chọn (PDF, EPUB, TXT) theo triết lý kết hợp **Học ngầm (Comprehensible Input)** và **Học tường minh (Explicit Grammar Rules)**, kết thúc bằng **Luyện viết câu chủ động (Active Production)** và nhận phản hồi đối chiếu trực quan (Visual Diff).
>
> 🚫 Không gamification, không vệt streak, không khóa học cố định gò bó — người học hoàn toàn điều khiển công cụ học của mình.
>
> 🎨 Thiết kế theo phong cách **Typography-first (Editorial Minimalist)**: Bảng màu dịu mắt (Parchment, Deep Ink, Stone, French Bordeaux), tối ưu hóa trải nghiệm đọc và thao tác nhanh bằng phím tắt.

---

## 🌟 Triết lý & Luồng học cốt lõi

1. **Học ngầm (Comprehensible Input)**:
   * Người học tải lên cuốn sách hoặc tài liệu tiếng Pháp họ yêu thích (PDF, EPUB, TXT).
   * Hệ thống tự động phân tách câu, dùng spaCy phân tích cú pháp và nhận diện các cấu trúc ngữ pháp có trong từng câu.
   * Người học đọc sách theo dạng từng câu (sentence-by-sentence) với phím tắt điều hướng nhanh (`j`/`k`).
2. **Học tường minh (Explicit Rules & Conjugation)**:
   * Bấm `e` hoặc nút *"Giải thích"* tại bất kỳ câu nào để xem công thức ngữ pháp, ý nghĩa, các điểm lưu ý và bảng chia động từ.
   * Hệ thống tự động **đào (mine)** tất cả các câu khác trong cuốn sách đó cùng chứa cấu trúc ngữ pháp này để người học đối chiếu ngữ cảnh thực tế.
3. **Luyện viết câu chủ động & Sửa lỗi (Active Production & Visual Diff)**:
   * Bấm `p` hoặc nút *"Luyện cấu trúc này"* để mở Drawer thực hành.
   * Người học tự sáng tác một câu mới áp dụng cấu trúc mục tiêu (hỗ trợ thanh gõ ký tự đặc biệt tiếng Pháp: `é, è, ê, à, ç, œ, « »`).
   * Nhấn `Ctrl + Enter` (hoặc `Cmd + Enter`) để gửi câu. Hệ thống chấm điểm qua sự kết hợp giữa **spaCy deterministic rule-matching** và **LLM sư phạm**.
   * Kết quả trả về hiển thị **Visual Diff** (gạch đỏ chữ sai, xanh lá từ sửa chuẩn), giải thích ngữ pháp bằng tiếng Việt và gợi ý các cách diễn đạt tương đương.
4. **Sổ tay học tập (Notebook & Mastery Roadmap)**:
   * Theo dõi độ thuần thục theo từng chủ điểm ngữ pháp từ A1 đến B2.
   * Xem lại toàn bộ nhật ký các câu đã viết và lời khuyên sư phạm.

---

## 🏗️ Kiến trúc Công nghệ (Stack)

* **Frontend**:
  * React 19, TypeScript (strict mode)
  * Vite 8
  * Tailwind CSS v4 (cấu hình `@theme` biến màu parchment & ink typography)
  * Lucide React Icons
  * Vitest + Testing Library
* **Extension (TextChecker Companion)**:
  * WXT (Next-gen Web Extension Framework) + React 19 + TypeScript
  * Multi-provider AI (Google Gemini, OpenAI GPT, Anthropic Claude)
  * Design đồng bộ hệ thống Typography-first (Parchment & Deep Ink)
  * Inline real-time grammar checking & shortcut on-demand checking (Ctrl+Shift+G)
* **Backend**:
  * Python 3.11+
  * FastAPI (RESTful API, Lifespan management)
  * spaCy 3.8+ với mô hình `fr_core_news_md`
  * SQLAlchemy 2.0 + SQLite (chạy hoàn toàn local)
  * PyPDF, BeautifulSoup4, Zipfile (xử lý PDF, EPUB, TXT)
  * Pytest + Httpx
* **LLM Provider Abstraction**:
  * Lớp trừu tượng độc lập hỗ trợ: **Mock Provider** (chạy offline không tốn API key), **OpenAI**, **Gemini**, **Ollama** (chạy LLM local).
* **Language Plugin Architecture**:
  * Thiết kế theo `BaseLanguageEngine` và `LanguageRegistry`, sẵn sàng mở rộng sang ngôn ngữ thứ hai (Tây Ban Nha, Đức, Nhật...) mà không sửa đổi core.

---

## 🚀 Hướng dẫn Cài đặt & Chạy ứng dụng

### 1. Yêu cầu hệ thống
* Python 3.11 trở lên
* Node.js 18 trở lên (đã kiểm thử tốt trên Node 20+)
* Git

---

### 2. Thiết lập Backend (FastAPI)

1. Mở terminal và chuyển vào thư mục backend:
   ```bash
   cd backend
   ```

2. Tạo và kích hoạt môi trường ảo Python:
   * **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```
   * **Linux / macOS**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Cài đặt các gói phụ thuộc:
   ```bash
   pip install -r requirements.txt
   ```

4. Tải mô hình ngôn ngữ spaCy tiếng Pháp:
   ```bash
   python -m spacy download fr_core_news_md
   ```

5. Thiết lập file cấu hình môi trường `.env`:
   ```bash
   cp .env.example .env
   ```
   *Mặc định hệ thống dùng `LLM_PROVIDER=mock` để chạy offline không cần API key. Nếu muốn dùng mô hình thật, mở `.env` và chọn `openai`, `gemini`, hoặc `ollama`.*

6. Khởi động Backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *Backend API docs sẽ khả dụng tại: `http://localhost:8000/docs`*

---

### 3. Thiết lập Frontend (React + Vite)

1. Mở một terminal mới và chuyển vào thư mục frontend:
   ```bash
   cd frontend
   ```

2. Cài đặt các gói node:
   ```bash
   npm install
   ```

3. Khởi động Frontend dev server:
   ```bash
   npm run dev
   ```
   *Giao diện web sẽ khả dụng tại: `http://localhost:5173`*

---

## ⚙️ Cấu hình LLM Provider (.env)

Hệ thống hỗ trợ 4 chế độ LLM thông qua biến môi trường `LLM_PROVIDER`:

| Giá trị | Mô tả | Yêu cầu cấu hình |
|---|---|---|
| `mock` | **(Mặc định)** Phản hồi offline tức thì, chấm điểm dựa trên spaCy, giải thích tiếng Việt sư phạm | Không cần API key |
| `openai` | Dùng OpenAI (GPT-4o, GPT-4o-mini) hoặc các API tương thích (Groq, DeepSeek) | `OPENAI_API_KEY`, tùy chọn `OPENAI_BASE_URL` |
| `gemini` | Dùng Google Gemini API (Gemini 1.5 Flash, Gemini 2.0 Flash) | `GEMINI_API_KEY`, tùy chọn `GEMINI_MODEL` |
| `ollama` | Dùng mô hình mã nguồn mở chạy local (Llama 3, Mistral, Qwen) | `OLLAMA_BASE_URL` (mặc định `http://localhost:11434/v1`) |

---

## ⌨️ Bảng Phím tắt Điều hướng nhanh trong Reader

| Phím tắt | Chức năng |
|---|---|
| `j` hoặc `↓` | Chuyển đến câu tiếp theo |
| `k` hoặc `↑` | Quay lại câu phía trước |
| `e` | Mở giải thích ngữ pháp và bảng chia động từ của câu đang chọn |
| `p` | Mở hộp thoại luyện viết câu chủ động với cấu trúc của câu đang chọn |
| `Esc` | Bỏ chọn câu hiện tại |
| `Ctrl + Enter` / `Cmd + Enter` | Nộp bài chấm điểm trong hộp luyện viết câu |

---

## 🧪 Kiểm thử (Testing)

Dự án tuân thủ nghiêm ngặt quy tắc kiểm thử tự động trên cả 2 tầng:

### Kiểm thử Backend (Pytest)
```powershell
cd backend
$env:PYTHONPATH="."; .venv\Scripts\pytest.exe -v
```
* **Kết quả**: 41/41 tests pass (Bao gồm test cấu hình, LLM provider, spaCy matchers, parser PDF/EPUB/TXT, REST endpoints, practice evaluation, và language plugin architecture).*

### Kiểm thử Frontend (Vitest)
```powershell
cd frontend
npm run test
```
* **Kết quả**: 16/16 tests pass (Bao gồm DocumentList, ReaderView, Header, DiacriticBar, DiffViewer, PracticeModal, GrammarCatalogView, và NotebookView).*

### Kiểm tra Build Production Frontend
```powershell
cd frontend
npm run build
```
* **Kết quả**: TypeScript strict compilation không lỗi, Vite bundle tối ưu hóa dung lượng.

---

### 4. Thiết lập Trình duyệt Extension (TextChecker Companion)

Tiện ích mở rộng trình duyệt (Chrome / Firefox / Edge) giúp người học kiểm tra lỗi ngữ pháp, chính tả trực tiếp khi viết câu trên bất kỳ trang web nào (Google Docs, mạng xã hội, form bài tập...):

1. Mở terminal và chuyển vào thư mục extension:
   ```bash
   cd extension
   ```

2. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```

3. Build extension:
   ```bash
   npm run build
   # Hoặc npm run dev để chạy chế độ development tự động reload
   ```

4. Cài đặt vào Chrome / Edge / Brave:
   * Truy cập `chrome://extensions/` (hoặc `edge://extensions/`).
   * Bật **Developer mode** (góc trên bên phải).
   * Nhấn **Load unpacked** (Tải tiện ích đã giải nén).
   * Chọn thư mục `extension/.output/chrome-mv3`.

5. Sử dụng:
   * Nhấn biểu tượng TextChecker trên thanh công cụ để mở Popup cài đặt API key (Gemini, OpenAI, Claude).
   * Chọn chế độ kiểm tra: **Real-time** (tự động theo thời gian thực) hoặc **On-demand** (nhấn `Ctrl + Shift + G`).
   * Giao diện Popup, Options và thẻ Popover trực quan đều đã được thiết kế đồng bộ theo phong cách Parchment & Deep Ink.

---

## 🧩 Mở rộng ngôn ngữ mới (Language Plugin Architecture)

Ứng dụng được thiết kế theo hướng module hóa để có thể bổ sung ngôn ngữ thứ 2 mà không phải viết lại logic:

1. Kế thừa lớp `BaseLanguageEngine` trong `backend/app/services/language_engine/base.py`:
   ```python
   from app.services.language_engine.base import BaseLanguageEngine

   class SpanishGrammarEngine(BaseLanguageEngine):
       @property
       def language_code(self) -> str:
           return "es"
       
       # Cài đặt các hàm analyze_sentence, check_target_rule, segment_into_sentences...
   ```
2. Đăng ký engine vào `LanguageRegistry`:
   ```python
   from app.services.language_engine.registry import get_language_registry
   get_language_registry().register(SpanishGrammarEngine())
   ```

---

## 📄 Bản quyền & Đóng góp
Dự án được xây dựng phục vụ mục đích nghiên cứu phương pháp thụ đắc ngôn ngữ tự nhiên kết hợp công nghệ xử lý ngôn ngữ tự nhiên (NLP) và trí tuệ nhân tạo.
