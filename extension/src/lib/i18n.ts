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
  errorState: string;
  panelTitle: string;
  applyAll: string;
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
    errorState: 'Lỗi',
    panelTitle: 'Danh sách gợi ý sửa lỗi',
    applyAll: 'Sửa tất cả',
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
    errorState: 'Error',
    panelTitle: 'Correction Suggestions',
    applyAll: 'Fix all',
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
    errorState: 'Erreur',
    panelTitle: 'Suggestions de correction',
    applyAll: 'Tout corriger',
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
