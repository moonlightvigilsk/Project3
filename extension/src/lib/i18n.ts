import type { UILanguage, SuggestionType } from '@/types';

export interface Translations {
  appName: string;
  settings: string;
  active: string;
  disabled: string;
  localRulesBadge: string;
  checkEnabled: string;
  checkDisabled: string;
  realtime: string;
  ondemand: string;
  realtimeDesc: string;
  ondemandDesc: string;
  switchMode: string;
  sessionStats: string;
  analyses: string;
  errors: string;
  corrected: string;
  languageSelect: string;

  // Options page
  pageTitle: string;
  pageSubtitle: string;
  tabSettings: string;
  tabDictionary: string;
  tabStats: string;
  tabApiKeys: string;
  offlineBannerTitle: string;
  offlineBannerDesc: string;
  analysisMode: string;
  realtimeDescLong: string;
  ondemandDescLong: string;
  targetLanguage: string;
  uiLanguageLabel: string;
  themeLabel: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  delayLabel: string;
  dictTitle: string;
  dictDesc: string;
  dictEmpty: string;
  dictEmptyDesc: string;
  statsTitle: string;
  statsDesc: string;
  savedNotice: string;

  // In-page Popover & Widgets
  applyCorrection: string;
  ignore: string;
  addToDict: string;
  allGood: string;
  issuesFound: (count: number) => string;
  statusDragHint: string;
  errorState: string;
  panelTitle: string;
  applyAll: string;
  // Selection lookup
  selectionLookupTitle: string;
  selectionLookupDesc: string;
  lookupTriggerLabel: string;
  lookupTriggerButton: string;
  lookupTriggerButtonDesc: string;
  lookupTriggerInstant: string;
  lookupTriggerInstantDesc: string;
  lookupTriggerAlt: string;
  lookupTriggerAltDesc: string;
  lookupSourcesTitle: string;
  lookupSourcesLabel: string;
  lookupSourcesDesc: string;
  lookupOpenIn: (source: string) => string;
  lookupSpeak: string;
  lookupSpeakRecording: (region: string | null) => string;
  lookupSpeakSynth: string;
  lookupSpeakFailed: string;
  vocabSave: string;
  vocabSaved: string;
  vocabSavedHint: string;
  vocabContext: string;
  vocabNote: string;
  vocabNotePlaceholder: string;
  vocabSaveNote: string;
  vocabNoteSaved: string;
  vocabRemove: string;
  vocabSaveFailed: string;
  // Vocabulary notebook pages (US-07)
  tabVocabulary: string;
  popupTabOverview: string;
  popupTabVocab: string;
  vocabTitle: string;
  vocabDesc: string;
  vocabSearchPlaceholder: string;
  vocabFilterAll: string;
  vocabStatusNew: string;
  vocabStatusLearning: string;
  vocabStatusKnown: string;
  vocabStatusLabel: string;
  vocabSortLabel: string;
  vocabSortRecent: string;
  vocabSortAlpha: string;
  vocabSortStatus: string;
  vocabColWord: string;
  vocabColMeaning: string;
  vocabColAdded: string;
  vocabEmpty: string;
  vocabEmptyDesc: string;
  vocabNoMatch: string;
  vocabRecentTitle: string;
  vocabMatches: (shown: number, total: number) => string;
  vocabOpenAll: (total: number) => string;
  vocabShowMore: string;
  vocabConfirmRemove: string;
  vocabCancel: string;
  // Export / import (US-08)
  vocabExportLabel: (count: number, filtered: boolean) => string;
  vocabExportCsv: string;
  vocabExportCsvHint: string;
  vocabExportAnki: string;
  vocabExportAnkiHint: string;
  vocabExportJson: string;
  vocabExportJsonHint: string;
  vocabImport: string;
  vocabImportHint: string;
  vocabImportDone: (added: number, merged: number, skipped: number) => string;
  vocabImportInvalid: string;
  vocabImportTooLarge: (maxMb: number) => string;
  vocabHighlightTitle: string;
  vocabHighlightDesc: string;
  // Flashcards (US-10)
  popupTabReview: string;
  reviewBadgeTitle: (due: number) => string;
  reviewShowAnswer: string;
  reviewForgot: string;
  reviewRemembered: string;
  reviewProgress: (current: number, total: number) => string;
  reviewDoneTitle: string;
  reviewDoneDesc: (count: number) => string;
  reviewNothingDue: string;
  reviewNextDue: (when: string) => string;
  reviewEmpty: string;
  reviewKeysHint: string;
  reviewFailed: string;
  reviewBadgeSettingTitle: string;
  reviewBadgeSettingDesc: string;
  /** Context menu titles; `%s` is replaced by the browser with the selection. */
  ctxLookup: string;
  ctxSaveToVocab: string;
  ctxSelectionTooLong: (maxWords: number) => string;
  moveUp: string;
  moveDown: string;
  lookupButtonTitle: string;
  close: string;
  lookupLoading: string;
  lookupNotFound: (word: string) => string;
  lookupError: string;
  lookupRetry: string;
  lookupFormOf: string;
  lookupEnglish: string;
  lookupMore: string;
  // Cards (word card, grammar card)
  cardDefinition: string;
  cardExample: string;
  cardEtymology: string;
  cardTranslations: string;
  cardForm: string;
  cardPatterns: string;
  cardUses: string;
  cardExamples: string;
  cardSource: string;
  bookmarkAdd: string;
  bookmarkRemove: string;
  openSource: string;
  sourcePreviewTitle: string;
  sourcePreviewShow: string;
  sourcePreviewHide: string;
  sourcePreviewLoading: string;
  sourcePreviewFailed: string;
  sourcePreviewEmpty: string;
  sourcePreviewMore: string;
  // Keyboard shortcuts (US-16)
  lookupNoSelection: string;
  shortcutsTitle: string;
  shortcutsDesc: string;
  shortcutsChange: string;
  shortcutNotSet: string;
  shortcutLookup: string;
  shortcutGrammar: string;
  shortcutAssistant: string;
  shortcutVocabulary: string;
  shortcutsInCards: string;
  shortcutsInPanel: string;
  shortcutsOpenFailed: string;
  // Chat side panel
  askButtonTitle: string;
  // Grammar analysis (US-17)
  analyzeButtonTitle: string;
  ctxAnalyze: string;
  analysisTitle: string;
  analysisLoading: string;
  analysisStructures: string;
  analysisNone: string;
  analysisHint: string;
  analysisLevel: (level: string) => string;
  analysisNoSentence: string;
  analysisUnreachable: (url: string) => string;
  analysisStartHint: string;
  analysisOpenSettings: string;
  analysisTimeout: string;
  analysisBackendError: (status: number | null, message: string) => string;
  extensionInvalidated: string;
  reloadPage: string;
  backendTitle: string;
  backendDesc: string;
  backendTest: string;
  backendTesting: string;
  backendOk: (rules: number) => string;
  backendUnreachable: string;
  backendError: (status: number | null, message: string) => string;
  backendInvalidUrl: string;
  backendReset: string;
  // Grammar card of a rule (US-18)
  ruleBack: string;
  ruleExplanation: string;
  ruleKeyPoints: string;
  ruleContextExample: string;
  ruleMoreExamples: string;
  ruleMoreFromAssistant: string;
  rulePractice: string;
  ruleReadMore: string;
  ruleNotFound: string;
  // Practice (US-19)
  practiceTitle: string;
  practicePlaceholder: (rule: string) => string;
  practiceHint: string;
  practiceSend: string;
  practiceChecking: string;
  practiceCorrect: string;
  practiceUsesWithErrors: string;
  practiceMissing: (rule: string) => string;
  practiceCorrection: string;
  practiceNoAi: string;
  practiceRetry: string;
  practiceDone: string;
  practiceErrConjugation: (verb: string, subject: string | null) => string;
  practiceErrInfinitive: (verb: string) => string;
  practiceErrMissing: (rule: string, formula: string) => string;
  historyTab: string;
  historyTitle: string;
  historyAllRules: string;
  historyEmpty: string;
  historyUsed: string;
  historyNotUsed: string;
  historyWithErrors: string;
  historyFrom: string;
  historyClear: string;
  historyClearConfirm: string;
  openChatPanel: string;
  chatTitle: string;
  chatMenu: string;
  menuBookmarks: string;
  menuChatHistory: string;
  menuSavedVocab: string;
  menuSavedResources: string;
  menuSettings: string;
  menuNewChat: string;
  chatActionExamples: (concept: string) => string;
  chatActionPractice: (concept: string) => string;
  chatActionExplain: (concept: string) => string;
  chatConceptFallback: string;
  chatGreeting: string;
  chatNeedContext: string;
  chatPlaceholder: string;
  chatSend: string;
  chatContextLabel: string;
  chatClearContext: string;
  chatThinking: string;
  chatAiDisabled: string;
  chatNoApiKey: (provider: string) => string;
  chatError: (message: string) => string;
  emptyBookmarks: string;
  emptyHistory: string;
  emptyVocab: string;
  emptyResources: string;
  remove: string;
  types: Record<SuggestionType, string>;
}

export const TRANSLATIONS: Record<UILanguage, Translations> = {
  vi: {
    appName: 'TextChecker',
    settings: 'Cài đặt',
    active: 'Đang bật',
    disabled: 'Đã tắt',
    localRulesBadge: 'Quy tắc cục bộ',
    checkEnabled: 'Đang bật kiểm tra',
    checkDisabled: 'Tạm dừng kiểm tra',
    realtime: 'Thời gian thực',
    ondemand: 'Theo yêu cầu',
    realtimeDesc: 'Kiểm tra liên tục khi gõ',
    ondemandDesc: 'Phím tắt: Ctrl+Shift+G',
    switchMode: 'Chuyển',
    sessionStats: 'Thống kê phiên làm việc',
    analyses: 'Lần phân tích',
    errors: 'Lỗi',
    corrected: 'Đã sửa',
    languageSelect: 'Ngôn ngữ giao diện',

    pageTitle: 'TextChecker • Cài đặt',
    pageSubtitle: 'Trợ lý học ngữ pháp và hỗ trợ viết tiếng Pháp.',
    tabSettings: 'Cấu hình',
    tabDictionary: 'Từ điển cá nhân',
    tabStats: 'Thống kê',
    tabApiKeys: 'Khóa API',
    offlineBannerTitle: 'Bộ máy Quy tắc Ngữ pháp Cục bộ Đang Chạy',
    offlineBannerDesc:
      'Hệ thống phân tích ngữ pháp trực tiếp ngay trên máy của bạn (hòa hợp số, chia động từ, dấu câu), chạy tức thì không cần mạng hay API key.',
    analysisMode: 'Chế độ phân tích',
    realtimeDescLong: 'Kiểm tra liên tục ngay khi bạn gõ câu.',
    ondemandDescLong: 'Chỉ kiểm tra khi nhấn phím tắt (Ctrl+Shift+G).',
    targetLanguage: 'Ngôn ngữ đích học tập',
    uiLanguageLabel: 'Ngôn ngữ giao diện (UI)',
    themeLabel: 'Giao diện sáng / tối',
    themeSystem: 'Theo hệ thống',
    themeLight: 'Sáng',
    themeDark: 'Tối',
    delayLabel: 'Độ trễ chờ sau khi gõ',
    dictTitle: 'Từ điển cá nhân',
    dictDesc: 'Danh sách các từ được bỏ qua không báo lỗi trong quá trình viết.',
    dictEmpty: 'Chưa có từ nào trong danh sách bỏ qua',
    dictEmptyDesc: 'Bấm "Bỏ qua" trong các hộp thoại gợi ý để thêm từ mới.',
    statsTitle: "Báo cáo tổng kết sử dụng",
    statsDesc: 'Thống kê số lần phát hiện và sửa lỗi trên toàn bộ các trang bạn đã duyệt.',
    savedNotice: 'Đã lưu cài đặt',

    applyCorrection: 'Áp dụng sửa lỗi',
    ignore: 'Bỏ qua',
    addToDict: 'Thêm vào từ điển',
    allGood: 'Chính xác! Không có lỗi.',
    issuesFound: (n: number) => `${n} lỗi phát hiện`,
    statusDragHint: 'Kéo để di chuyển · nhấp đúp để về chỗ cũ',
    errorState: 'Lỗi',
    panelTitle: 'Danh sách gợi ý sửa lỗi',
    applyAll: 'Sửa tất cả',
    selectionLookupTitle: "Tra từ khi bôi đen",
    selectionLookupDesc: "Bôi đen một từ hoặc cụm từ ngắn (tối đa 5 từ) trên bất kỳ trang nào để tra nghĩa.",
    lookupTriggerLabel: "Cách mở thẻ tra từ",
    lookupTriggerButton: "Hiện nút",
    lookupTriggerButtonDesc: "Hiện một nút nhỏ cạnh vùng chọn, bấm để tra.",
    lookupTriggerInstant: "Mở ngay",
    lookupTriggerInstantDesc: "Mở thẻ tra từ ngay khi bôi đen xong.",
    lookupTriggerAlt: "Giữ Alt",
    lookupTriggerAltDesc: "Chỉ mở thẻ khi giữ phím Alt lúc bôi đen.",
    lookupSourcesTitle: 'Từ điển khác',
    lookupSourcesLabel: 'Nút mở từ điển ngoài',
    lookupSourcesDesc: 'Chọn từ điển hiện trên thẻ tra từ và sắp xếp thứ tự.',
    lookupOpenIn: (source) => `Mở trong ${source} (tab mới)`,
    lookupSpeak: 'Nghe phát âm',
    lookupSpeakRecording: (region) => `Nghe phát âm (bản ghi Wiktionary${region ? `, ${region}` : ''})`,
    lookupSpeakSynth: 'Nghe phát âm (giọng đọc của trình duyệt)',
    lookupSpeakFailed: 'Không phát được âm thanh',
    vocabSave: 'Lưu vào sổ từ vựng',
    vocabSaved: 'Đã lưu',
    vocabSavedHint: 'Đã lưu · bấm để sửa ghi chú hoặc xoá',
    vocabContext: 'Câu chứa từ',
    vocabNote: 'Ghi chú',
    vocabNotePlaceholder: 'Ghi chú của bạn về từ này…',
    vocabSaveNote: 'Lưu ghi chú',
    vocabNoteSaved: 'Đã lưu ghi chú',
    vocabRemove: 'Xoá khỏi sổ',
    vocabSaveFailed: 'Không lưu được, thử lại',
    tabVocabulary: 'Sổ từ vựng',
    popupTabOverview: 'Tổng quan',
    popupTabVocab: 'Sổ từ',
    vocabTitle: 'Sổ từ vựng',
    vocabDesc: 'Các từ bạn đã lưu từ thẻ tra từ, kèm câu chứa từ và trang gặp từ.',
    vocabSearchPlaceholder: 'Tìm từ, nghĩa, ghi chú…',
    vocabFilterAll: 'Tất cả',
    vocabStatusNew: 'Mới',
    vocabStatusLearning: 'Đang học',
    vocabStatusKnown: 'Đã thuộc',
    vocabStatusLabel: 'Trạng thái',
    vocabSortLabel: 'Sắp xếp',
    vocabSortRecent: 'Mới thêm',
    vocabSortAlpha: 'A → Z',
    vocabSortStatus: 'Theo trạng thái',
    vocabColWord: 'Từ',
    vocabColMeaning: 'Nghĩa và câu chứa từ',
    vocabColAdded: 'Ngày thêm',
    vocabEmpty: 'Sổ từ còn trống',
    vocabEmptyDesc: 'Bôi đen một từ trên trang, rồi bấm ☆ trên thẻ tra từ để lưu.',
    vocabNoMatch: 'Không có từ nào khớp',
    vocabRecentTitle: 'Từ mới thêm',
    vocabMatches: (shown, total) => (shown < total ? `${shown}/${total} từ khớp` : `${total} từ khớp`),
    vocabOpenAll: (total) => `Mở sổ đầy đủ (${total} từ)`,
    vocabShowMore: 'Xem thêm',
    vocabConfirmRemove: 'Xoá từ này?',
    vocabCancel: 'Huỷ',
    vocabExportLabel: (n, filtered) => (filtered ? `Xuất ${n} từ đang lọc:` : `Xuất ${n} từ:`),
    vocabExportCsv: 'CSV',
    vocabExportCsvHint: 'Mở bằng Excel / Google Sheets (cùng cột với file CSV của backend)',
    vocabExportAnki: 'Anki',
    vocabExportAnkiHint: 'Anki → Nhập tệp: mặt trước là từ + IPA, mặt sau là nghĩa + câu chứa từ',
    vocabExportJson: 'Sao lưu JSON',
    vocabExportJsonHint: 'Bản sao lưu đầy đủ, nhập lại được ở máy khác',
    vocabImport: 'Nhập từ JSON',
    vocabImportHint: 'Từ đã có trong sổ (trùng lemma) sẽ được gộp, không bị nhân đôi',
    vocabImportDone: (added, merged, skipped) =>
      `Đã nhập: ${added} từ mới, ${merged} từ gộp với từ đã có` + (skipped ? `, bỏ qua ${skipped} mục không hợp lệ` : '') + '.',
    vocabImportInvalid: 'File không đọc được: cần file JSON sao lưu sổ từ (hoặc danh sách từ).',
    vocabImportTooLarge: (mb) => `File quá lớn (tối đa ${mb} MB).`,
    vocabHighlightTitle: "Tô từ trong sổ khi đọc trang",
    vocabHighlightDesc: "Các từ đã lưu mà chưa thuộc (Mới, Đang học) được tô nhẹ trên trang bạn đang đọc, để ôn lại theo ngữ cảnh. Không sửa nội dung trang.",
    popupTabReview: 'Ôn tập',
    reviewBadgeTitle: (n) => `${n} từ đến hạn ôn`,
    reviewShowAnswer: 'Xem nghĩa',
    reviewForgot: 'Quên',
    reviewRemembered: 'Nhớ',
    reviewProgress: (i, n) => `${i} / ${n}`,
    reviewDoneTitle: 'Đã ôn hết các từ đến hạn.',
    reviewDoneDesc: (n) => `Lượt này: ${n} từ.`,
    reviewNothingDue: 'Không có từ nào đến hạn ôn.',
    reviewNextDue: (when) => `Lượt ôn tiếp theo: ${when}.`,
    reviewEmpty: 'Chưa có từ để ôn. Lưu từ bằng ☆ trên thẻ tra từ; từ "Đã thuộc" không đưa vào ôn tập.',
    reviewKeysHint: 'Phím: Space lật thẻ · 1 Quên · 2 Nhớ',
    reviewFailed: 'Không lưu được kết quả, thử lại',
    reviewBadgeSettingTitle: 'Số từ cần ôn trên biểu tượng',
    reviewBadgeSettingDesc: 'Hiện trên biểu tượng extension số từ đã đến hạn ôn.',
    ctxLookup: 'Tra từ “%s”',
    ctxSaveToVocab: 'Thêm “%s” vào sổ từ vựng',
    ctxSelectionTooLong: (n) => `Vùng chọn quá dài. Hãy chọn một từ hoặc cụm từ (tối đa ${n} từ) để tra hoặc lưu.`,
    moveUp: 'Lên',
    moveDown: 'Xuống',
    lookupButtonTitle: "Tra từ này",
    close: "Đóng",
    lookupLoading: 'Đang tra từ…',
    lookupNotFound: (w: string) => `Không tìm thấy « ${w} » trong Wiktionary.`,
    lookupError: 'Không kết nối được tới Wiktionary.',
    lookupRetry: 'Thử lại',
    lookupFormOf: 'Dạng của',
    lookupEnglish: 'Tiếng Anh',
    lookupMore: 'Xem đầy đủ trên Wiktionary',
    cardDefinition: 'Định nghĩa',
    cardExample: 'Ví dụ',
    cardEtymology: 'Từ nguyên',
    cardTranslations: 'Dịch',
    cardForm: 'Công thức',
    cardPatterns: 'Mẫu câu',
    cardUses: 'Cách dùng',
    cardExamples: 'Ví dụ',
    cardSource: 'Nguồn',
    bookmarkAdd: 'Lưu',
    bookmarkRemove: 'Bỏ lưu',
    openSource: 'Mở trang nguồn',
    sourcePreviewTitle: "Xem trước trang nguồn",
    sourcePreviewShow: "Xem trước trang nguồn",
    sourcePreviewHide: "Ẩn xem trước",
    sourcePreviewLoading: "Đang tải trang…",
    sourcePreviewFailed: "Không tải được nội dung trang.",
    sourcePreviewEmpty: "Trang không có đoạn văn nào để xem trước.",
    sourcePreviewMore: "Đọc tiếp trên trang gốc",
    lookupNoSelection: "Bôi đen một từ hoặc cụm từ trên trang, rồi nhấn lại phím tắt.",
    shortcutsTitle: "Phím tắt",
    shortcutsDesc: "Dùng được trên mọi trang. Đổi phím trong trang phím tắt của trình duyệt.",
    shortcutsChange: "Đổi phím tắt",
    shortcutNotSet: "Chưa đặt",
    shortcutLookup: "Tra từ đang chọn",
    shortcutGrammar: "Kiểm tra ô đang gõ (nhấn tiếp để sang lỗi sau), hoặc phân tích ngữ pháp câu đang chọn / câu ở con trỏ",
    shortcutAssistant: "Mở trợ lý ngữ pháp với câu đang chọn",
    shortcutVocabulary: "Mở sổ từ vựng",
    shortcutsInCards: "Trong thẻ tra từ, thẻ phân tích / thẻ ngữ pháp và popover lỗi: Tab / Shift+Tab chuyển giữa các nút, Enter để chọn, Esc để đóng và quay lại chỗ đang đọc hoặc đang gõ.",
    shortcutsInPanel: "Trong trợ lý (side panel): Alt+B đã đánh dấu, Alt+H lịch sử, Alt+V từ vựng, Alt+R tài liệu, Alt+N cuộc trò chuyện mới, Alt+S cài đặt, Alt+1/2/3 ba thao tác nhanh, / để gõ câu hỏi.",
    shortcutsOpenFailed: "Mở trang này bằng cách dán địa chỉ vào thanh địa chỉ:",
    askButtonTitle: 'Hỏi trợ lý về câu này',
    analyzeButtonTitle: 'Phân tích ngữ pháp',
    ctxAnalyze: 'Phân tích ngữ pháp',
    analysisTitle: 'Phân tích ngữ pháp',
    analysisLoading: 'Đang phân tích…',
    analysisStructures: 'Cấu trúc trong câu',
    analysisNone: 'Không thấy cấu trúc nào trong danh sách đang hỗ trợ (futur proche, passé composé, imparfait, phủ định, đại từ COD/COI, conditionnel, subjonctif).',
    analysisHint: 'Rê chuột hoặc Tab tới một cấu trúc để chỉ tô phần chữ của nó; bấm để xem giải thích, công thức và ví dụ.',
    analysisLevel: (l: string) => `Trình độ ${l}`,
    analysisNoSentence: 'Bôi đen một câu tiếng Pháp, hoặc bấm vào trong câu, rồi nhấn lại phím tắt.',
    analysisUnreachable: (url: string) => `Không kết nối được backend ngữ pháp ở ${url}.`,
    analysisStartHint: 'Bật backend (thư mục backend/ của dự án) rồi bấm Thử lại:',
    analysisOpenSettings: 'Đổi địa chỉ backend',
    analysisTimeout: 'Backend không trả lời kịp. Thử lại sau giây lát.',
    analysisBackendError: (status: number | null, m: string) => `Backend báo lỗi${status ? ` (${status})` : ''}: ${m}`,
    extensionInvalidated: 'Tiện ích vừa được cập nhật hoặc tải lại. Hãy tải lại trang này để tiếp tục sử dụng TextChecker.',
    reloadPage: 'Tải lại trang',
    backendTitle: 'Backend ngữ pháp',
    backendDesc: 'Máy chủ phân tích ngữ pháp (spaCy) trong thư mục backend/ của dự án. Chỉ câu bạn yêu cầu phân tích mới được gửi tới địa chỉ này.',
    backendTest: 'Kiểm tra kết nối',
    backendTesting: 'Đang kiểm tra…',
    backendOk: (n: number) => `Đã kết nối: backend có ${n} cấu trúc ngữ pháp.`,
    backendUnreachable: 'Không kết nối được. Backend đã chạy chưa?',
    backendError: (status: number | null, m: string) => `Có trả lời nhưng không phải backend ngữ pháp${status ? ` (${status})` : ''}: ${m}`,
    backendInvalidUrl: 'Địa chỉ không hợp lệ (ví dụ http://127.0.0.1:8000).',
    backendReset: 'Mặc định',
    ruleBack: 'Phân tích câu',
    ruleExplanation: 'Giải thích',
    ruleKeyPoints: 'Điểm chính',
    ruleContextExample: 'Trong bài bạn đang đọc',
    ruleMoreExamples: 'Thêm ví dụ',
    ruleMoreFromAssistant: 'Thêm ví dụ với trợ lý',
    rulePractice: 'Tự đặt câu',
    ruleReadMore: 'Đọc thêm',
    ruleNotFound: 'Chưa có thẻ ngữ pháp cho cấu trúc này trong catalog của backend.',
    practiceTitle: 'Tự đặt câu',
    practicePlaceholder: (r: string) => `Viết một câu tiếng Pháp dùng ${r}…`,
    practiceHint: 'Enter để gửi · Shift+Enter xuống dòng',
    practiceSend: 'Gửi',
    practiceChecking: 'Đang chấm…',
    practiceCorrect: 'Câu dùng đúng cấu trúc, không thấy lỗi.',
    practiceUsesWithErrors: 'Có dùng cấu trúc, nhưng còn lỗi.',
    practiceMissing: (r: string) => `Câu chưa dùng cấu trúc ${r}.`,
    practiceCorrection: 'Bản sửa',
    practiceNoAi: 'Chưa có phản hồi AI: kết quả chỉ từ phần kiểm tra cấu trúc của backend.',
    practiceRetry: 'Thử lại',
    practiceDone: 'Đọc tiếp',
    practiceErrConjugation: (v: string, s: string | null) => `"${v}" chưa chia đúng${s ? ` với chủ ngữ "${s}"` : ''}.`,
    practiceErrInfinitive: (v: string) => `Động từ chính phải ở dạng nguyên mẫu (infinitif), không phải "${v}".`,
    practiceErrMissing: (r: string, f: string) => `Không thấy cấu trúc ${r} trong câu${f ? ` (công thức: ${f})` : ''}.`,
    historyTab: 'Luyện tập',
    historyTitle: 'Lịch sử luyện tập',
    historyAllRules: 'Mọi cấu trúc',
    historyEmpty: 'Chưa có câu nào. Mở thẻ ngữ pháp trên trang (bôi đen câu → Phân tích ngữ pháp → bấm một cấu trúc) rồi bấm "Tự đặt câu".',
    historyUsed: 'Đúng cấu trúc',
    historyNotUsed: 'Chưa dùng cấu trúc',
    historyWithErrors: 'Có dùng cấu trúc, còn lỗi',
    historyFrom: 'Khi đọc',
    historyClear: 'Xoá lịch sử',
    historyClearConfirm: 'Xoá toàn bộ lịch sử luyện tập trên máy này?',
    openChatPanel: 'Mở trợ lý ngữ pháp',
    chatTitle: 'Trò chuyện',
    chatMenu: 'Mở menu',
    menuBookmarks: 'Đã đánh dấu',
    menuChatHistory: 'Lịch sử trò chuyện',
    menuSavedVocab: 'Từ vựng đã lưu',
    menuSavedResources: 'Tài liệu đã lưu',
    menuSettings: 'Cài đặt',
    menuNewChat: 'Cuộc trò chuyện mới',
    chatActionExamples: (c: string) => `Cho ví dụ về ${c}`,
    chatActionPractice: (c: string) => `Luyện ${c} bằng cách đặt câu`,
    chatActionExplain: (c: string) => `Giải thích ngắn ${c} và gợi ý tài liệu`,
    chatConceptFallback: 'ngữ pháp trong câu này',
    chatGreeting: 'Chọn một thao tác ở trên để bắt đầu trò chuyện với tôi!',
    chatNeedContext: 'Bôi đen một câu tiếng Pháp trên trang, bấm "Phân tích ngữ pháp" rồi "Hỏi trợ lý về câu này" (hoặc nhấn Alt+Shift+K), hoặc gõ câu hỏi bên dưới.',
    chatPlaceholder: 'Bạn muốn biết điều gì?',
    chatSend: 'Gửi',
    chatContextLabel: 'Câu đang hỏi',
    chatClearContext: 'Bỏ câu này',
    chatThinking: 'Đang trả lời…',
    chatAiDisabled: 'Trợ lý AI đang tắt (ENABLE_AI = false trong src/lib/config.ts). Bật AI và thêm API key trong Cài đặt để trò chuyện.',
    chatNoApiKey: (p: string) => `Chưa có API key cho ${p}. Thêm key trong Cài đặt.`,
    chatError: (m: string) => `Không gọi được AI: ${m}`,
    emptyBookmarks: 'Chưa có gì. Bấm ☆ trên thẻ tra từ hoặc thẻ ngữ pháp để lưu.',
    emptyHistory: 'Chưa có cuộc trò chuyện nào.',
    emptyVocab: 'Chưa có từ nào. Bấm ☆ trên thẻ tra từ để lưu từ.',
    emptyResources: 'Chưa có tài liệu nào. Bấm ☆ cạnh nguồn trên thẻ ngữ pháp để lưu.',
    remove: 'Xoá',
    types: {
      spelling: 'Chính tả',
      grammar: 'Ngữ pháp',
      punctuation: 'Dấu câu',
      style: 'Văn phong',
    },
  },
  en: {
    appName: 'TextChecker',
    settings: 'Settings',
    active: 'Active',
    disabled: 'Disabled',
    localRulesBadge: 'Local rules',
    checkEnabled: 'Checking enabled',
    checkDisabled: 'Checking paused',
    realtime: 'Real-time',
    ondemand: 'On-demand',
    realtimeDesc: 'Checks as you type',
    ondemandDesc: 'Shortcut: Ctrl+Shift+G',
    switchMode: 'Switch',
    sessionStats: 'Session Statistics',
    analyses: 'Checks',
    errors: 'Issues',
    corrected: 'Fixed',
    languageSelect: 'Interface Language',

    pageTitle: 'TextChecker • Settings',
    pageSubtitle: 'Writing and French grammar learning assistant.',
    tabSettings: 'Configuration',
    tabDictionary: 'Personal Dictionary',
    tabStats: 'Statistics',
    tabApiKeys: 'API Keys',
    offlineBannerTitle: 'Local Grammar Rule Engine Active',
    offlineBannerDesc:
      'Analyzes grammar locally on your device without network calls or API keys (agreement, conjugations, elisions).',
    analysisMode: 'Analysis Mode',
    realtimeDescLong: 'Continuously checks as you type.',
    ondemandDescLong: 'Checks only when keyboard shortcut is pressed (Ctrl+Shift+G).',
    targetLanguage: 'Target Language',
    uiLanguageLabel: 'Interface Language (UI)',
    themeLabel: 'Theme',
    themeSystem: 'Match system',
    themeLight: 'Light',
    themeDark: 'Dark',
    delayLabel: 'Typing Debounce Delay',
    dictTitle: 'Personal Dictionary',
    dictDesc: 'Words ignored by the spellchecker during your writing sessions.',
    dictEmpty: 'No ignored words yet',
    dictEmptyDesc: 'Click "Ignore" in suggestion popovers to add words here.',
    statsTitle: 'Usage Overview',
    statsDesc: 'Cumulative stats for issues detected and corrections applied across your browsing.',
    savedNotice: 'Settings saved',

    applyCorrection: 'Apply correction',
    ignore: 'Ignore',
    addToDict: 'Add to dictionary',
    allGood: 'All good! No issues.',
    issuesFound: (n: number) => `${n} issue${n > 1 ? 's' : ''} found`,
    statusDragHint: 'Drag to move · double-click to reset',
    errorState: 'Error',
    panelTitle: 'Correction Suggestions',
    applyAll: 'Fix all',
    selectionLookupTitle: "Look up on selection",
    selectionLookupDesc: "Select a word or short phrase (up to 5 words) on any page to look it up.",
    lookupTriggerLabel: "How to open the lookup card",
    lookupTriggerButton: "Show button",
    lookupTriggerButtonDesc: "Show a small button next to the selection; click it to look up.",
    lookupTriggerInstant: "Open instantly",
    lookupTriggerInstantDesc: "Open the lookup card as soon as you finish selecting.",
    lookupTriggerAlt: "Hold Alt",
    lookupTriggerAltDesc: "Only open the card when Alt is held while selecting.",
    lookupSourcesTitle: 'Other dictionaries',
    lookupSourcesLabel: 'External dictionary buttons',
    lookupSourcesDesc: 'Choose which dictionaries appear on the lookup card and their order.',
    lookupOpenIn: (source) => `Open in ${source} (new tab)`,
    lookupSpeak: 'Listen',
    lookupSpeakRecording: (region) => `Listen (Wiktionary recording${region ? `, ${region}` : ''})`,
    lookupSpeakSynth: "Listen (browser's speech voice)",
    lookupSpeakFailed: 'Could not play the audio',
    vocabSave: 'Save to vocabulary',
    vocabSaved: 'Saved',
    vocabSavedHint: 'Saved · click to edit the note or remove',
    vocabContext: 'Sentence',
    vocabNote: 'Note',
    vocabNotePlaceholder: 'Your note about this word…',
    vocabSaveNote: 'Save note',
    vocabNoteSaved: 'Note saved',
    vocabRemove: 'Remove from vocabulary',
    vocabSaveFailed: 'Could not save, try again',
    tabVocabulary: 'Vocabulary',
    popupTabOverview: 'Overview',
    popupTabVocab: 'Vocabulary',
    vocabTitle: 'Vocabulary notebook',
    vocabDesc: 'Words saved from the lookup card, with the sentence and page where you met them.',
    vocabSearchPlaceholder: 'Search words, meanings, notes…',
    vocabFilterAll: 'All',
    vocabStatusNew: 'New',
    vocabStatusLearning: 'Learning',
    vocabStatusKnown: 'Known',
    vocabStatusLabel: 'Status',
    vocabSortLabel: 'Sort',
    vocabSortRecent: 'Recently added',
    vocabSortAlpha: 'A → Z',
    vocabSortStatus: 'By status',
    vocabColWord: 'Word',
    vocabColMeaning: 'Meaning and sentence',
    vocabColAdded: 'Added',
    vocabEmpty: 'Your notebook is empty',
    vocabEmptyDesc: 'Select a word on a page, then click ☆ on the lookup card to save it.',
    vocabNoMatch: 'No matching words',
    vocabRecentTitle: 'Recently added',
    vocabMatches: (shown, total) => (shown < total ? `${shown} of ${total} matches` : `${total} ${total === 1 ? 'match' : 'matches'}`),
    vocabOpenAll: (total) => `Open full notebook (${total} ${total === 1 ? 'word' : 'words'})`,
    vocabShowMore: 'Show more',
    vocabConfirmRemove: 'Remove this word?',
    vocabCancel: 'Cancel',
    vocabExportLabel: (n, filtered) =>
      `Export ${n} ${filtered ? 'filtered ' : ''}${n === 1 ? 'word' : 'words'}:`,
    vocabExportCsv: 'CSV',
    vocabExportCsvHint: 'Open in Excel / Google Sheets (same columns as the backend CSV)',
    vocabExportAnki: 'Anki',
    vocabExportAnkiHint: 'Anki → Import File: front = word + IPA, back = meaning + sentence',
    vocabExportJson: 'JSON backup',
    vocabExportJsonHint: 'Full backup, can be imported on another computer',
    vocabImport: 'Import JSON',
    vocabImportHint: 'Words already in the notebook (same lemma) are merged, not duplicated',
    vocabImportDone: (added, merged, skipped) =>
      `Imported: ${added} new, ${merged} merged with existing words` + (skipped ? `, ${skipped} invalid items skipped` : '') + '.',
    vocabImportInvalid: 'Could not read this file: a vocabulary JSON backup (or a list of words) is needed.',
    vocabImportTooLarge: (mb) => `File too large (max ${mb} MB).`,
    vocabHighlightTitle: "Highlight notebook words on pages",
    vocabHighlightDesc: "Saved words not known yet (New, Learning) are lightly highlighted on the pages you read, to review them in context. Page text is not changed.",
    popupTabReview: 'Review',
    reviewBadgeTitle: (n) => `${n} ${n === 1 ? 'word' : 'words'} due for review`,
    reviewShowAnswer: 'Show meaning',
    reviewForgot: 'Forgot',
    reviewRemembered: 'Remembered',
    reviewProgress: (i, n) => `${i} / ${n}`,
    reviewDoneTitle: 'No more words due.',
    reviewDoneDesc: (n) => `This session: ${n} ${n === 1 ? 'word' : 'words'}.`,
    reviewNothingDue: 'No words due for review.',
    reviewNextDue: (when) => `Next review: ${when}.`,
    reviewEmpty: 'Nothing to review yet. Save words with ☆ on the lookup card; "Known" words are not reviewed.',
    reviewKeysHint: 'Keys: Space flip · 1 Forgot · 2 Remembered',
    reviewFailed: 'Could not save the answer, try again',
    reviewBadgeSettingTitle: 'Due-word count on the icon',
    reviewBadgeSettingDesc: 'Shows on the extension icon how many saved words are due for review.',
    ctxLookup: 'Look up “%s”',
    ctxSaveToVocab: 'Add “%s” to vocabulary',
    ctxSelectionTooLong: (n) => `The selection is too long. Select a word or phrase (up to ${n} words) to look it up or save it.`,
    moveUp: 'Move up',
    moveDown: 'Move down',
    lookupButtonTitle: "Look up this word",
    close: "Close",
    lookupLoading: 'Looking up…',
    lookupNotFound: (w: string) => `No entry for « ${w} » on Wiktionary.`,
    lookupError: 'Could not reach Wiktionary.',
    lookupRetry: 'Retry',
    lookupFormOf: 'Form of',
    lookupEnglish: 'English',
    lookupMore: 'Full entry on Wiktionary',
    cardDefinition: 'Definition',
    cardExample: 'Example',
    cardEtymology: 'Etymology',
    cardTranslations: 'Translations',
    cardForm: 'Form',
    cardPatterns: 'Patterns',
    cardUses: 'Core uses',
    cardExamples: 'Examples',
    cardSource: 'Source',
    bookmarkAdd: 'Save',
    bookmarkRemove: 'Remove from saved',
    openSource: 'Open source page',
    sourcePreviewTitle: "Source page preview",
    sourcePreviewShow: "Preview source page",
    sourcePreviewHide: "Hide preview",
    sourcePreviewLoading: "Loading page…",
    sourcePreviewFailed: "Could not load the page content.",
    sourcePreviewEmpty: "The page has no text to preview.",
    sourcePreviewMore: "Continue on the original page",
    lookupNoSelection: "Select a word or short phrase on the page, then press the shortcut again.",
    shortcutsTitle: "Keyboard shortcuts",
    shortcutsDesc: "Work on any page. Change the keys on the browser’s shortcuts page.",
    shortcutsChange: "Change shortcuts",
    shortcutNotSet: "Not set",
    shortcutLookup: "Look up the selected word",
    shortcutGrammar: "Check the text field (press again for the next error), or analyze the grammar of the selected sentence / the sentence at the caret",
    shortcutAssistant: "Open the grammar assistant with the selected sentence",
    shortcutVocabulary: "Open the vocabulary notebook",
    shortcutsInCards: "In the word card, the grammar analysis / grammar card and the error popover: Tab / Shift+Tab move between buttons, Enter selects, Esc closes and returns to where you were reading or typing.",
    shortcutsInPanel: "In the assistant (side panel): Alt+B bookmarks, Alt+H history, Alt+V vocabulary, Alt+R resources, Alt+N new chat, Alt+S settings, Alt+1/2/3 the quick actions, / to type a question.",
    shortcutsOpenFailed: "Open this page by pasting the address in the address bar:",
    askButtonTitle: 'Ask the assistant about this sentence',
    analyzeButtonTitle: 'Analyze grammar',
    ctxAnalyze: 'Analyze grammar',
    analysisTitle: 'Grammar analysis',
    analysisLoading: 'Analyzing…',
    analysisStructures: 'Structures in this sentence',
    analysisNone: 'No structure from the supported list found (futur proche, passé composé, imparfait, negation, COD/COI pronouns, conditionnel, subjonctif).',
    analysisHint: 'Hover or Tab to a structure to highlight only its words; click it for the explanation, formula and examples.',
    analysisLevel: (l: string) => `Level ${l}`,
    analysisNoSentence: 'Select a French sentence, or click inside one, then press the shortcut again.',
    analysisUnreachable: (url: string) => `Could not reach the grammar backend at ${url}.`,
    analysisStartHint: 'Start the backend (the project’s backend/ folder), then press Retry:',
    analysisOpenSettings: 'Change backend address',
    analysisTimeout: 'The backend did not answer in time. Try again in a moment.',
    analysisBackendError: (status: number | null, m: string) => `The backend returned an error${status ? ` (${status})` : ''}: ${m}`,
    extensionInvalidated: 'The extension was just updated or reloaded. Reload this page to keep using TextChecker.',
    reloadPage: 'Reload page',
    backendTitle: 'Grammar backend',
    backendDesc: 'Grammar analysis server (spaCy) in the project’s backend/ folder. Only sentences you ask to analyze are sent to this address.',
    backendTest: 'Test connection',
    backendTesting: 'Testing…',
    backendOk: (n: number) => `Connected: the backend knows ${n} grammar structures.`,
    backendUnreachable: 'Could not connect. Is the backend running?',
    backendError: (status: number | null, m: string) => `Something answered, but not the grammar backend${status ? ` (${status})` : ''}: ${m}`,
    backendInvalidUrl: 'Invalid address (for example http://127.0.0.1:8000).',
    backendReset: 'Default',
    ruleBack: 'Sentence analysis',
    ruleExplanation: 'Explanation',
    ruleKeyPoints: 'Key points',
    ruleContextExample: 'In the text you are reading',
    ruleMoreExamples: 'More examples',
    ruleMoreFromAssistant: 'More examples from the assistant',
    rulePractice: 'Write a sentence',
    ruleReadMore: 'Read more',
    ruleNotFound: 'The backend catalog has no grammar card for this structure yet.',
    practiceTitle: 'Write a sentence',
    practicePlaceholder: (r: string) => `Write a French sentence using ${r}…`,
    practiceHint: 'Enter to send · Shift+Enter for a new line',
    practiceSend: 'Send',
    practiceChecking: 'Checking…',
    practiceCorrect: 'The sentence uses the structure correctly, no error found.',
    practiceUsesWithErrors: 'The structure is used, but there are errors.',
    practiceMissing: (r: string) => `The sentence does not use ${r} yet.`,
    practiceCorrection: 'Correction',
    practiceNoAi: 'No AI feedback: the result only comes from the backend’s structure check.',
    practiceRetry: 'Try again',
    practiceDone: 'Keep reading',
    practiceErrConjugation: (v: string, s: string | null) => `"${v}" is not conjugated correctly${s ? ` for the subject "${s}"` : ''}.`,
    practiceErrInfinitive: (v: string) => `The main verb must be an infinitive, not "${v}".`,
    practiceErrMissing: (r: string, f: string) => `${r} was not found in the sentence${f ? ` (form: ${f})` : ''}.`,
    historyTab: 'Practice',
    historyTitle: 'Practice history',
    historyAllRules: 'All structures',
    historyEmpty: 'No sentence yet. Open a grammar card on a page (select a sentence → Analyze grammar → click a structure), then "Write a sentence".',
    historyUsed: 'Structure used correctly',
    historyNotUsed: 'Structure not used',
    historyWithErrors: 'Structure used, with errors',
    historyFrom: 'While reading',
    historyClear: 'Clear history',
    historyClearConfirm: 'Delete the whole practice history on this computer?',
    openChatPanel: 'Open grammar assistant',
    chatTitle: 'Chat',
    chatMenu: 'Open menu',
    menuBookmarks: 'Bookmarks',
    menuChatHistory: 'Chat history',
    menuSavedVocab: 'Saved vocabulary',
    menuSavedResources: 'Saved resources',
    menuSettings: 'Settings',
    menuNewChat: 'New chat',
    chatActionExamples: (c: string) => `Give examples for ${c}`,
    chatActionPractice: (c: string) => `Practice ${c} with sentences`,
    chatActionExplain: (c: string) => `Give a short explanation of ${c} and link study resources`,
    chatConceptFallback: 'the grammar in this sentence',
    chatGreeting: 'Pick one of the actions above to start chatting with me!',
    chatNeedContext: 'Select a French sentence on the page, click "Analyze grammar" then "Ask the assistant about this sentence" (or press Alt+Shift+K), or type a question below.',
    chatPlaceholder: 'What would you like to know?',
    chatSend: 'Send',
    chatContextLabel: 'Asking about',
    chatClearContext: 'Remove this sentence',
    chatThinking: 'Thinking…',
    chatAiDisabled: 'The AI assistant is off (ENABLE_AI = false in src/lib/config.ts). Turn AI on and add an API key in Settings to chat.',
    chatNoApiKey: (p: string) => `No API key for ${p}. Add one in Settings.`,
    chatError: (m: string) => `The AI request failed: ${m}`,
    emptyBookmarks: 'Nothing yet. Click ☆ on a word card or grammar card to save it.',
    emptyHistory: 'No conversations yet.',
    emptyVocab: 'No words yet. Click ☆ on a word card to save a word.',
    emptyResources: 'No resources yet. Click ☆ next to a grammar card source to save it.',
    remove: 'Remove',
    types: {
      spelling: 'Spelling',
      grammar: 'Grammar',
      punctuation: 'Punctuation',
      style: 'Style',
    },
  },
  fr: {
    appName: 'TextChecker',
    settings: 'Paramètres',
    active: 'Actif',
    disabled: 'Désactivé',
    localRulesBadge: 'Règles locales',
    checkEnabled: 'Vérification activée',
    checkDisabled: 'Vérification suspendue',
    realtime: 'Temps réel',
    ondemand: 'À la demande',
    realtimeDesc: 'Vérification continue',
    ondemandDesc: 'Raccourci: Ctrl+Shift+G',
    switchMode: 'Basculer',
    sessionStats: 'Statistiques de session',
    analyses: 'Analyses',
    errors: 'Erreurs',
    corrected: 'Corrigées',
    languageSelect: "Langue de l'interface",

    pageTitle: 'TextChecker • Paramètres',
    pageSubtitle: 'Assistant de rédaction et apprentissage de la grammaire française.',
    tabSettings: 'Configuration',
    tabDictionary: 'Dictionnaire personnel',
    tabStats: 'Statistiques',
    tabApiKeys: 'Clés API',
    offlineBannerTitle: 'Moteur de Règles Grammaticales Actif',
    offlineBannerDesc:
      'L\'assistant analyse vos textes localement avec les règles grammaticales autonomes (accords, élisions, verbes), sans appel réseau ni clé API.',
    analysisMode: 'Mode d\'analyse',
    realtimeDescLong: 'Vérifie au fur et à mesure de votre saisie.',
    ondemandDescLong: 'Vérifie au raccourci clavier (Ctrl+Shift+G).',
    targetLanguage: 'Langue cible',
    uiLanguageLabel: "Langue de l'interface (UI)",
    themeLabel: 'Thème',
    themeSystem: 'Comme le système',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    delayLabel: 'Délai de temporisation',
    dictTitle: 'Dictionnaire personnel',
    dictDesc: 'Mots ignorés par le correcteur lors de vos sessions.',
    dictEmpty: 'Aucun mot ignoré pour le moment',
    dictEmptyDesc: 'Utilisez « Ignorer » dans les popovers pour en ajouter.',
    statsTitle: 'Bilan d\'utilisation',
    statsDesc: 'Statistiques de détection et corrections appliquées sur l\'ensemble de votre navigation.',
    savedNotice: 'Paramètres enregistrés',

    applyCorrection: 'Appliquer la correction',
    ignore: 'Ignorer',
    addToDict: 'Ajouter au dictionnaire',
    allGood: 'Tout est bon ! Aucun problème.',
    issuesFound: (n: number) => `${n} problème${n > 1 ? 's' : ''} trouvé${n > 1 ? 's' : ''}`,
    statusDragHint: 'Faites glisser pour déplacer · double-clic pour rétablir',
    errorState: 'Erreur',
    panelTitle: 'Suggestions de correction',
    applyAll: 'Tout corriger',
    selectionLookupTitle: "Recherche à la sélection",
    selectionLookupDesc: "Sélectionnez un mot ou une courte expression (5 mots max.) sur n'importe quelle page pour le rechercher.",
    lookupTriggerLabel: "Ouverture de la fiche",
    lookupTriggerButton: "Afficher un bouton",
    lookupTriggerButtonDesc: "Affiche un petit bouton à côté de la sélection ; cliquez pour rechercher.",
    lookupTriggerInstant: "Ouvrir immédiatement",
    lookupTriggerInstantDesc: "Ouvre la fiche dès la fin de la sélection.",
    lookupTriggerAlt: "Maintenir Alt",
    lookupTriggerAltDesc: "N'ouvre la fiche que si Alt est maintenu pendant la sélection.",
    lookupSourcesTitle: 'Autres dictionnaires',
    lookupSourcesLabel: 'Boutons des dictionnaires externes',
    lookupSourcesDesc: "Choisissez les dictionnaires affichés sur la fiche et leur ordre.",
    lookupOpenIn: (source) => `Ouvrir dans ${source} (nouvel onglet)`,
    lookupSpeak: 'Écouter',
    lookupSpeakRecording: (region) => `Écouter (enregistrement Wiktionary${region ? `, ${region}` : ''})`,
    lookupSpeakSynth: 'Écouter (voix de synthèse du navigateur)',
    lookupSpeakFailed: "Impossible de lire l'audio",
    vocabSave: 'Ajouter au vocabulaire',
    vocabSaved: 'Enregistré',
    vocabSavedHint: 'Enregistré · cliquez pour modifier la note ou retirer',
    vocabContext: 'Phrase',
    vocabNote: 'Note',
    vocabNotePlaceholder: 'Votre note sur ce mot…',
    vocabSaveNote: 'Enregistrer la note',
    vocabNoteSaved: 'Note enregistrée',
    vocabRemove: 'Retirer du vocabulaire',
    vocabSaveFailed: "Échec de l'enregistrement, réessayez",
    tabVocabulary: 'Vocabulaire',
    popupTabOverview: 'Aperçu',
    popupTabVocab: 'Vocabulaire',
    vocabTitle: 'Carnet de vocabulaire',
    vocabDesc: 'Les mots enregistrés depuis la fiche de recherche, avec la phrase et la page où vous les avez rencontrés.',
    vocabSearchPlaceholder: 'Chercher un mot, un sens, une note…',
    vocabFilterAll: 'Tous',
    vocabStatusNew: 'Nouveau',
    vocabStatusLearning: 'En cours',
    vocabStatusKnown: 'Acquis',
    vocabStatusLabel: 'Statut',
    vocabSortLabel: 'Trier',
    vocabSortRecent: 'Ajout récent',
    vocabSortAlpha: 'A → Z',
    vocabSortStatus: 'Par statut',
    vocabColWord: 'Mot',
    vocabColMeaning: 'Sens et phrase',
    vocabColAdded: 'Ajouté le',
    vocabEmpty: 'Votre carnet est vide',
    vocabEmptyDesc: 'Sélectionnez un mot sur une page, puis cliquez sur ☆ dans la fiche pour l’enregistrer.',
    vocabNoMatch: 'Aucun mot ne correspond',
    vocabRecentTitle: 'Ajouts récents',
    vocabMatches: (shown, total) => (shown < total ? `${shown} sur ${total} résultats` : `${total} résultat${total > 1 ? 's' : ''}`),
    vocabOpenAll: (total) => `Ouvrir le carnet complet (${total} mot${total > 1 ? 's' : ''})`,
    vocabShowMore: 'Afficher plus',
    vocabConfirmRemove: 'Retirer ce mot ?',
    vocabCancel: 'Annuler',
    vocabExportLabel: (n, filtered) => `Exporter ${n} mot${n > 1 ? 's' : ''}${filtered ? ' filtré' + (n > 1 ? 's' : '') : ''} :`,
    vocabExportCsv: 'CSV',
    vocabExportCsvHint: 'À ouvrir dans Excel / Google Sheets (mêmes colonnes que le CSV du backend)',
    vocabExportAnki: 'Anki',
    vocabExportAnkiHint: 'Anki → Importer un fichier : recto = mot + API, verso = sens + phrase',
    vocabExportJson: 'Sauvegarde JSON',
    vocabExportJsonHint: 'Sauvegarde complète, réimportable sur un autre ordinateur',
    vocabImport: 'Importer un JSON',
    vocabImportHint: 'Les mots déjà présents (même lemme) sont fusionnés, sans doublon',
    vocabImportDone: (added, merged, skipped) =>
      `Import terminé : ${added} nouveau${added > 1 ? 'x' : ''}, ${merged} fusionné${merged > 1 ? 's' : ''}` +
      (skipped ? `, ${skipped} élément${skipped > 1 ? 's' : ''} invalide${skipped > 1 ? 's' : ''} ignoré${skipped > 1 ? 's' : ''}` : '') +
      '.',
    vocabImportInvalid: 'Fichier illisible : il faut une sauvegarde JSON du vocabulaire (ou une liste de mots).',
    vocabImportTooLarge: (mb) => `Fichier trop volumineux (${mb} Mo max).`,
    vocabHighlightTitle: "Surligner les mots du carnet sur les pages",
    vocabHighlightDesc: "Les mots enregistrés pas encore acquis (Nouveau, En cours) sont légèrement surlignés sur les pages que vous lisez, pour les réviser en contexte. Le texte des pages n’est pas modifié.",
    popupTabReview: 'Révision',
    reviewBadgeTitle: (n) => `${n} mot${n > 1 ? 's' : ''} à réviser`,
    reviewShowAnswer: 'Voir le sens',
    reviewForgot: 'Oublié',
    reviewRemembered: 'Retenu',
    reviewProgress: (i, n) => `${i} / ${n}`,
    reviewDoneTitle: 'Plus aucun mot à réviser.',
    reviewDoneDesc: (n) => `Cette session : ${n} mot${n > 1 ? 's' : ''}.`,
    reviewNothingDue: 'Aucun mot à réviser pour le moment.',
    reviewNextDue: (when) => `Prochaine révision : ${when}.`,
    reviewEmpty: 'Rien à réviser. Enregistrez des mots avec ☆ dans la fiche ; les mots « Acquis » ne sont pas révisés.',
    reviewKeysHint: 'Touches : Espace retourner · 1 Oublié · 2 Retenu',
    reviewFailed: "Échec de l'enregistrement, réessayez",
    reviewBadgeSettingTitle: 'Nombre de mots à réviser sur l’icône',
    reviewBadgeSettingDesc: 'Affiche sur l’icône de l’extension le nombre de mots dont la révision est due.',
    ctxLookup: 'Rechercher « %s »',
    ctxSaveToVocab: 'Ajouter « %s » au vocabulaire',
    ctxSelectionTooLong: (n) => `La sélection est trop longue. Sélectionnez un mot ou une expression (${n} mots max.) pour le rechercher ou l'enregistrer.`,
    moveUp: 'Monter',
    moveDown: 'Descendre',
    lookupButtonTitle: "Rechercher ce mot",
    close: "Fermer",
    lookupLoading: 'Recherche…',
    lookupNotFound: (w: string) => `Aucune entrée pour « ${w} » dans le Wiktionnaire.`,
    lookupError: 'Impossible de joindre le Wiktionnaire.',
    lookupRetry: 'Réessayer',
    lookupFormOf: 'Forme de',
    lookupEnglish: 'Anglais',
    lookupMore: 'Article complet sur le Wiktionnaire',
    cardDefinition: 'Définition',
    cardExample: 'Exemple',
    cardEtymology: 'Étymologie',
    cardTranslations: 'Traductions',
    cardForm: 'Forme',
    cardPatterns: 'Structures',
    cardUses: 'Emplois',
    cardExamples: 'Exemples',
    cardSource: 'Source',
    bookmarkAdd: 'Enregistrer',
    bookmarkRemove: 'Retirer des favoris',
    openSource: 'Ouvrir la source',
    sourcePreviewTitle: "Aperçu de la source",
    sourcePreviewShow: "Aperçu de la page source",
    sourcePreviewHide: "Masquer l’aperçu",
    sourcePreviewLoading: "Chargement de la page…",
    sourcePreviewFailed: "Impossible de charger le contenu de la page.",
    sourcePreviewEmpty: "La page n’a pas de texte à prévisualiser.",
    sourcePreviewMore: "Lire la suite sur la page d’origine",
    lookupNoSelection: "Sélectionnez un mot ou une courte expression sur la page, puis appuyez de nouveau sur le raccourci.",
    shortcutsTitle: "Raccourcis clavier",
    shortcutsDesc: "Fonctionnent sur toutes les pages. Modifiez les touches dans la page des raccourcis du navigateur.",
    shortcutsChange: "Modifier les raccourcis",
    shortcutNotSet: "Non défini",
    shortcutLookup: "Chercher le mot sélectionné",
    shortcutGrammar: "Vérifier le champ (appuyez encore pour l’erreur suivante), ou analyser la grammaire de la phrase sélectionnée / de la phrase au curseur",
    shortcutAssistant: "Ouvrir l’assistant de grammaire avec la phrase sélectionnée",
    shortcutVocabulary: "Ouvrir le carnet de vocabulaire",
    shortcutsInCards: "Dans la fiche du mot, l’analyse / la fiche de grammaire et la bulle d’erreur : Tab / Maj+Tab passent d’un bouton à l’autre, Entrée valide, Échap ferme et revient là où vous lisiez ou écriviez.",
    shortcutsInPanel: "Dans l’assistant (panneau latéral) : Alt+B favoris, Alt+H historique, Alt+V vocabulaire, Alt+R ressources, Alt+N nouvelle discussion, Alt+S paramètres, Alt+1/2/3 actions rapides, / pour écrire une question.",
    shortcutsOpenFailed: "Ouvrez cette page en collant l’adresse dans la barre d’adresse :",
    askButtonTitle: "Interroger l'assistant sur cette phrase",
    analyzeButtonTitle: 'Analyser la grammaire',
    ctxAnalyze: 'Analyser la grammaire',
    analysisTitle: 'Analyse grammaticale',
    analysisLoading: 'Analyse en cours…',
    analysisStructures: 'Structures de la phrase',
    analysisNone: 'Aucune structure de la liste prise en charge (futur proche, passé composé, imparfait, négation, pronoms COD/COI, conditionnel, subjonctif).',
    analysisHint: 'Survolez une structure ou atteignez-la avec Tab pour ne surligner que ses mots ; cliquez pour l’explication, la formule et des exemples.',
    analysisLevel: (l: string) => `Niveau ${l}`,
    analysisNoSentence: 'Sélectionnez une phrase, ou cliquez dans une phrase, puis appuyez de nouveau sur le raccourci.',
    analysisUnreachable: (url: string) => `Impossible de joindre le serveur de grammaire à ${url}.`,
    analysisStartHint: 'Démarrez le serveur (dossier backend/ du projet), puis cliquez sur Réessayer :',
    analysisOpenSettings: 'Changer l’adresse du serveur',
    analysisTimeout: 'Le serveur n’a pas répondu à temps. Réessayez dans un instant.',
    analysisBackendError: (status: number | null, m: string) => `Le serveur a renvoyé une erreur${status ? ` (${status})` : ''} : ${m}`,
    extensionInvalidated: 'L’extension vient d’être mise à jour ou rechargée. Rechargez cette page pour continuer à utiliser TextChecker.',
    reloadPage: 'Recharger la page',
    backendTitle: 'Serveur de grammaire',
    backendDesc: 'Serveur d’analyse grammaticale (spaCy) du dossier backend/ du projet. Seules les phrases que vous demandez d’analyser sont envoyées à cette adresse.',
    backendTest: 'Tester la connexion',
    backendTesting: 'Test en cours…',
    backendOk: (n: number) => `Connecté : le serveur connaît ${n} structures grammaticales.`,
    backendUnreachable: 'Connexion impossible. Le serveur est-il démarré ?',
    backendError: (status: number | null, m: string) => `Une réponse, mais pas celle du serveur de grammaire${status ? ` (${status})` : ''} : ${m}`,
    backendInvalidUrl: 'Adresse invalide (par exemple http://127.0.0.1:8000).',
    backendReset: 'Par défaut',
    ruleBack: 'Analyse de la phrase',
    ruleExplanation: 'Explication',
    ruleKeyPoints: 'Points clés',
    ruleContextExample: 'Dans le texte que vous lisez',
    ruleMoreExamples: 'Plus d’exemples',
    ruleMoreFromAssistant: 'Plus d’exemples avec l’assistant',
    rulePractice: 'Écrire une phrase',
    ruleReadMore: 'En savoir plus',
    ruleNotFound: 'Le catalogue du serveur n’a pas encore de fiche pour cette structure.',
    practiceTitle: 'Écrire une phrase',
    practicePlaceholder: (r: string) => `Écrivez une phrase avec ${r}…`,
    practiceHint: 'Entrée pour envoyer · Maj+Entrée pour aller à la ligne',
    practiceSend: 'Envoyer',
    practiceChecking: 'Correction en cours…',
    practiceCorrect: 'La structure est bien employée, aucune erreur trouvée.',
    practiceUsesWithErrors: 'La structure est employée, mais il reste des erreurs.',
    practiceMissing: (r: string) => `La phrase n’emploie pas encore ${r}.`,
    practiceCorrection: 'Correction',
    practiceNoAi: 'Pas de retour de l’IA : le résultat vient seulement de la vérification de structure du serveur.',
    practiceRetry: 'Réessayer',
    practiceDone: 'Reprendre la lecture',
    practiceErrConjugation: (v: string, s: string | null) => `« ${v} » n’est pas bien conjugué${s ? ` avec le sujet « ${s} »` : ''}.`,
    practiceErrInfinitive: (v: string) => `Le verbe principal doit être à l’infinitif, pas « ${v} ».`,
    practiceErrMissing: (r: string, f: string) => `${r} n’apparaît pas dans la phrase${f ? ` (forme : ${f})` : ''}.`,
    historyTab: 'Pratique',
    historyTitle: 'Historique de pratique',
    historyAllRules: 'Toutes les structures',
    historyEmpty: 'Aucune phrase pour l’instant. Ouvrez une fiche de grammaire sur une page (sélection → Analyser la grammaire → une structure), puis « Écrire une phrase ».',
    historyUsed: 'Structure bien employée',
    historyNotUsed: 'Structure absente',
    historyWithErrors: 'Structure employée, avec erreurs',
    historyFrom: 'En lisant',
    historyClear: 'Effacer l’historique',
    historyClearConfirm: 'Effacer tout l’historique de pratique sur cet ordinateur ?',
    openChatPanel: "Ouvrir l'assistant de grammaire",
    chatTitle: 'Discussion',
    chatMenu: 'Ouvrir le menu',
    menuBookmarks: 'Favoris',
    menuChatHistory: 'Historique',
    menuSavedVocab: 'Vocabulaire enregistré',
    menuSavedResources: 'Ressources enregistrées',
    menuSettings: 'Paramètres',
    menuNewChat: 'Nouvelle discussion',
    chatActionExamples: (c: string) => `Donner des exemples pour ${c}`,
    chatActionPractice: (c: string) => `M'entraîner à ${c} avec des phrases`,
    chatActionExplain: (c: string) => `Expliquer brièvement ${c} et proposer des ressources`,
    chatConceptFallback: 'la grammaire de cette phrase',
    chatGreeting: 'Choisissez une action ci-dessus pour commencer !',
    chatNeedContext: "Sélectionnez une phrase sur la page, cliquez sur « Analyser la grammaire » puis « Interroger l'assistant sur cette phrase » (ou Alt+Maj+K), ou posez une question ci-dessous.",
    chatPlaceholder: 'Que voulez-vous savoir ?',
    chatSend: 'Envoyer',
    chatContextLabel: 'Phrase étudiée',
    chatClearContext: 'Retirer cette phrase',
    chatThinking: 'Réflexion…',
    chatAiDisabled: "L'assistant IA est désactivé (ENABLE_AI = false dans src/lib/config.ts). Activez l'IA et ajoutez une clé API dans les paramètres.",
    chatNoApiKey: (p: string) => `Aucune clé API pour ${p}. Ajoutez-en une dans les paramètres.`,
    chatError: (m: string) => `Échec de la requête IA : ${m}`,
    emptyBookmarks: 'Rien pour le moment. Cliquez sur ☆ sur une fiche pour l’enregistrer.',
    emptyHistory: 'Aucune discussion pour le moment.',
    emptyVocab: 'Aucun mot. Cliquez sur ☆ sur une fiche de mot pour l’enregistrer.',
    emptyResources: 'Aucune ressource. Cliquez sur ☆ à côté de la source d’une fiche de grammaire.',
    remove: 'Supprimer',
    types: {
      spelling: 'Orthographe',
      grammar: 'Grammaire',
      punctuation: 'Ponctuation',
      style: 'Style',
    },
  },
};

export function getT(lang: UILanguage = 'vi'): Translations {
  return TRANSLATIONS[lang] || TRANSLATIONS.vi;
}
