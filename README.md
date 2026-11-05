Do not write generated reponse here! Write in ./CLAUDE.md instead  
##  Technology stack 

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




# Todo
## setup docker pipeline 
- 1. Code is merged into the main branch
- 2. Code is built into and executable 
- 3. Docker image is built with all dependancies

