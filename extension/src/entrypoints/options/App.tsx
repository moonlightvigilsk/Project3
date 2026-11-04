import { useState, useEffect } from 'react';
import { settingsStorage, apiKeysStorage, statsStorage } from '@/lib/storage';
import { getVocabulary, unignoreSpelling, watchVocabulary } from '@/lib/vocabulary/client';
import { spellingEntries } from '@/lib/vocabulary/model';
import { ENABLE_AI } from '@/lib/config';
import { getT } from '@/lib/i18n';
import type { Settings, APIKeys, AIProvider, UILanguage, ThemePreference } from '@/types';
import { DEFAULT_SETTINGS, AVAILABLE_MODELS, SUPPORTED_LANGUAGES } from '@/types';
import { Key, Settings as SettingsIcon, Book, BookOpen, BarChart3, Eye, EyeOff, Trash2, CheckCircle, Globe, ChevronUp, ChevronDown } from 'lucide-react';
import { DICTIONARY_SOURCES, moveSourcePref, normalizeSourcePrefs } from '@/lib/dictionary/sources';
import type { DictionarySourcePref } from '@/types';
import { ShortcutsSection } from './ShortcutsSection';
import { BackendSection } from './BackendSection';
import { VocabularyTab } from './VocabularyTab';

type TabType = 'api-keys' | 'settings' | 'vocabulary' | 'dictionary' | 'stats';
const TAB_IDS: readonly TabType[] = ['api-keys', 'settings', 'vocabulary', 'dictionary', 'stats'];

/** Tab named in the URL hash (the popup opens `options.html#vocabulary`). */
function tabFromHash(): TabType | null {
  const id = location.hash.slice(1) as TabType;
  if (!TAB_IDS.includes(id) || (id === 'api-keys' && !ENABLE_AI)) return null;
  return id;
}

export default function App() {
  const [activeTab, setActiveTabState] = useState<TabType>(() => tabFromHash() ?? (ENABLE_AI ? 'api-keys' : 'settings'));

  function setActiveTab(tab: TabType) {
    setActiveTabState(tab);
    history.replaceState(null, '', `#${tab}`);
  }

  useEffect(() => {
    // Options page already open in a tab and the popup link is followed again.
    const onHash = () => {
      const tab = tabFromHash();
      if (tab) setActiveTabState(tab);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKeys, setApiKeys] = useState<APIKeys>({});
  /** Words ignored by the spell check (vocabulary entries with ignoreSpelling). */
  const [dictionary, setDictionary] = useState<{ id: string; word: string }[]>([]);
  const [stats, setStats] = useState({ checksPerformed: 0, errorsFound: 0, correctionsApplied: 0 });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const currentUiLang: UILanguage = settings.uiLanguage || 'vi';
  const t = getT(currentUiLang);

  useEffect(() => {
    loadData();
    return watchVocabulary((state) => setDictionary(spellingEntries(state)));
  }, []);

  async function loadData() {
    const [loadedSettings, loadedKeys, loadedDictionary, loadedStats] = await Promise.all([
      settingsStorage.getValue(),
      apiKeysStorage.getValue(),
      getVocabulary().then(spellingEntries),
      statsStorage.getValue(),
    ]);
    setSettings(loadedSettings);
    setApiKeys(loadedKeys);
    setDictionary(loadedDictionary);
    setStats(loadedStats);
  }

  async function saveSettings(newSettings: Settings) {
    setSettings(newSettings);
    setSaveStatus('saving');
    await settingsStorage.setValue(newSettings);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  async function saveApiKey(provider: AIProvider, key: string) {
    const newKeys = { ...apiKeys, [provider]: key };
    setApiKeys(newKeys);
    setSaveStatus('saving');
    await apiKeysStorage.setValue(newKeys);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  async function removeFromDictionary(id: string) {
    setDictionary((list) => list.filter((e) => e.id !== id));
    await unignoreSpelling(id);
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    ...(ENABLE_AI ? [{ id: 'api-keys' as TabType, label: t.tabApiKeys, icon: <Key className="w-4 h-4" /> }] : []),
    { id: 'settings' as TabType, label: t.tabSettings, icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'vocabulary' as TabType, label: t.tabVocabulary, icon: <BookOpen className="w-4 h-4" /> },
    { id: 'dictionary' as TabType, label: t.tabDictionary, icon: <Book className="w-4 h-4" /> },
    { id: 'stats' as TabType, label: t.tabStats, icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-parchment-100 text-ink-900 font-sans selection:bg-french-bordeaux selection:text-white">
      <div className={`${activeTab === 'vocabulary' ? 'max-w-6xl' : 'max-w-4xl'} mx-auto py-10 px-6`}>
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-border pb-6">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
              {t.pageTitle}
            </h1>
            <p className="text-ink-600 text-sm mt-1">
              {t.pageSubtitle}
            </p>
          </div>

          {/* Quick UI Language Pill Switcher */}
          <div className="flex items-center gap-1.5 bg-parchment-50 border border-stone-border rounded-lg p-1 self-start sm:self-auto shadow-sm">
            <Globe className="w-3.5 h-3.5 text-ink-500 ml-1.5 mr-1" />
            <button
              onClick={() => saveSettings({ ...settings, uiLanguage: 'vi' })}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                currentUiLang === 'vi'
                  ? 'bg-ink-900 text-parchment-50 shadow-sm'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-parchment-200'
              }`}
            >
              Tiếng Việt
            </button>
            <button
              onClick={() => saveSettings({ ...settings, uiLanguage: 'en' })}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                currentUiLang === 'en'
                  ? 'bg-ink-900 text-parchment-50 shadow-sm'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-parchment-200'
              }`}
            >
              English
            </button>
            <button
              onClick={() => saveSettings({ ...settings, uiLanguage: 'fr' })}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                currentUiLang === 'fr'
                  ? 'bg-ink-900 text-parchment-50 shadow-sm'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-parchment-200'
              }`}
            >
              Français
            </button>
          </div>
        </header>

        {/* Main Card */}
        <div className="bg-parchment-50 rounded-xl border border-stone-border shadow-sm overflow-hidden">
          {/* Navigation Tabs */}
          <div className="border-b border-stone-border bg-parchment-100/60 px-4 py-2">
            <nav className="flex flex-wrap gap-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-ink-900 text-parchment-50 shadow-sm'
                      : 'text-ink-700 hover:text-ink-900 hover:bg-parchment-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6 sm:p-8">
            {ENABLE_AI && activeTab === 'api-keys' && (
              <APIKeysTab
                apiKeys={apiKeys}
                showKeys={showKeys}
                setShowKeys={setShowKeys}
                saveApiKey={saveApiKey}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab settings={settings} saveSettings={saveSettings} apiKeys={apiKeys} t={t} />
            )}
            {activeTab === 'vocabulary' && <VocabularyTab t={t} lang={currentUiLang} />}
            {activeTab === 'dictionary' && (
              <DictionaryTab dictionary={dictionary} removeFromDictionary={removeFromDictionary} t={t} />
            )}
            {activeTab === 'stats' && <StatsTab stats={stats} t={t} />}
          </div>
        </div>

        {/* Save indicator */}
        {saveStatus !== 'idle' && (
          <div className="fixed bottom-6 right-6 bg-ink-900 text-parchment-50 px-4 py-2.5 rounded-lg text-xs font-medium shadow-lg flex items-center gap-2 animate-fade-in border border-ink-800">
            {saveStatus === 'saving' ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-parchment-50 border-t-transparent rounded-full animate-spin" />
                ...
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                {t.savedNotice}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function APIKeysTab({
  apiKeys,
  showKeys,
  setShowKeys,
  saveApiKey,
}: {
  apiKeys: APIKeys;
  showKeys: Record<string, boolean>;
  setShowKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  saveApiKey: (provider: AIProvider, key: string) => void;
}) {
  const [keys, setKeys] = useState(apiKeys);

  const providers: { id: AIProvider; name: string; desc: string; url: string; placeholder: string }[] = [
    {
      id: 'google',
      name: 'Google Gemini',
      desc: 'Recommandé. Clé gratuite disponible sur Google AI Studio.',
      url: 'https://aistudio.google.com/apikey',
      placeholder: 'AIzaSy...',
    },
    {
      id: 'openai',
      name: 'OpenAI GPT',
      desc: 'Nécessite des crédits sur la plateforme OpenAI.',
      url: 'https://platform.openai.com/api-keys',
      placeholder: 'sk-...',
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      desc: 'Nécessite un compte Anthropic Console avec crédits.',
      url: 'https://console.anthropic.com/settings/keys',
      placeholder: 'sk-ant-...',
    },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-serif font-bold text-base text-ink-900 mb-1">
          Fournisseurs d'Intelligence Artificielle
        </h3>
        <p className="text-xs text-ink-600 leading-relaxed">
          Vos clés API restent strictement stockées dans votre navigateur et synchronisées via votre compte Chrome.
        </p>
      </div>

      <div className="space-y-4">
        {providers.map((p) => (
          <div key={p.id} className="p-4 rounded-xl border border-stone-border bg-parchment-100/60 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-sm font-semibold text-ink-900">{p.name}</span>
                <p className="text-xs text-ink-600 mt-0.5">{p.desc}</p>
              </div>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-french-bordeaux hover:underline flex-shrink-0"
              >
                Obtenir une clé &rarr;
              </a>
            </div>

            <div className="relative">
              <input
                type={showKeys[p.id] ? 'text' : 'password'}
                value={keys[p.id] || ''}
                onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
                placeholder={p.placeholder}
                className="w-full pl-3 pr-20 py-2 bg-parchment-50 border border-stone-border rounded-lg text-xs font-mono text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-french-bordeaux"
              />
              <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKeys({ ...showKeys, [p.id]: !showKeys[p.id] })}
                  className="p-1 text-ink-400 hover:text-ink-700"
                >
                  {showKeys[p.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => saveApiKey(p.id, keys[p.id] || '')}
                  className="px-2.5 py-1 bg-ink-900 text-parchment-50 rounded text-[11px] font-medium hover:bg-ink-800 transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </div>

            {apiKeys[p.id] && (
              <p className="text-[11px] text-emerald-700 flex items-center gap-1 font-mono">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                Clé configurée et active
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({
  settings,
  saveSettings,
  apiKeys,
  t,
}: {
  settings: Settings;
  saveSettings: (settings: Settings) => void;
  apiKeys: APIKeys;
  t: ReturnType<typeof getT>;
}) {
  const providers: AIProvider[] = ['google', 'openai', 'anthropic'];
  const availableProviders = providers.filter((p) => apiKeys[p]);

  return (
    <div className="space-y-6 max-w-2xl">
      {!ENABLE_AI && (
        <div className="bg-ok border border-ok-line rounded-xl p-4 text-xs text-ink-800">
          <p className="font-semibold text-emerald-800 mb-1">{t.offlineBannerTitle}</p>
          <p className="text-ink-700 leading-relaxed">{t.offlineBannerDesc}</p>
        </div>
      )}

      {/* Interface Language */}
      <div>
        <label className="block text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">
          {t.uiLanguageLabel}
        </label>
        <select
          value={settings.uiLanguage || 'vi'}
          onChange={(e) => saveSettings({ ...settings, uiLanguage: e.target.value as UILanguage })}
          className="w-full px-3 py-2 bg-parchment-100 border border-stone-border rounded-lg text-sm text-ink-900 focus:outline-none focus:border-french-bordeaux"
        >
          <option value="vi">Tiếng Việt (Vietnamese)</option>
          <option value="en">English (Tiếng Anh)</option>
          <option value="fr">Français (Tiếng Pháp)</option>
        </select>
      </div>

      {/* Light / dark theme (US-15) */}
      <div>
        <label htmlFor="theme-select" className="block text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">
          {t.themeLabel}
        </label>
        <select
          id="theme-select"
          value={settings.theme}
          onChange={(e) => saveSettings({ ...settings, theme: e.target.value as ThemePreference })}
          className="w-full px-3 py-2 bg-parchment-100 border border-stone-border rounded-lg text-sm text-ink-900 focus:outline-none focus:border-french-bordeaux"
        >
          <option value="system">{t.themeSystem}</option>
          <option value="light">{t.themeLight}</option>
          <option value="dark">{t.themeDark}</option>
        </select>
      </div>

      {ENABLE_AI && (
        <>
          {availableProviders.length === 0 && (
            <div className="bg-note border border-note-line rounded-xl p-4 text-xs text-ink-800">
              <p className="font-semibold text-french-ochre mb-1">Aucune clé API configurée</p>
              <p>Veuillez renseigner au moins une clé dans l'onglet &laquo; Clés API &raquo; pour activer l'assistant.</p>
            </div>
          )}

          {/* Select Provider */}
          <div>
            <label className="block text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">
              Fournisseur d'IA actif
            </label>
            <select
              value={settings.provider}
              onChange={(e) => {
                const provider = e.target.value as AIProvider;
                const defaultModel = AVAILABLE_MODELS[provider][0].id;
                saveSettings({ ...settings, provider, model: defaultModel });
              }}
              className="w-full px-3 py-2 bg-parchment-100 border border-stone-border rounded-lg text-sm text-ink-900 focus:outline-none focus:border-french-bordeaux"
            >
              {providers.map((p) => (
                <option key={p} value={p} disabled={!apiKeys[p]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)} {!apiKeys[p] && '(clé manquante)'}
                </option>
              ))}
            </select>
          </div>

          {/* Select Model */}
          <div>
            <label className="block text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">
              Modèle d'inférence
            </label>
            <select
              value={settings.model}
              onChange={(e) => {
                const model = e.target.value;
                if (model === 'custom') {
                  saveSettings({ ...settings, model: 'custom' });
                } else {
                  saveSettings({ ...settings, model, customModel: undefined });
                }
              }}
              className="w-full px-3 py-2 bg-parchment-100 border border-stone-border rounded-lg text-sm text-ink-900 focus:outline-none focus:border-french-bordeaux"
            >
              {AVAILABLE_MODELS[settings.provider].map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
              <option value="custom">Autre modèle (ID personnalisé)...</option>
            </select>
          </div>

          {settings.model === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">
                Identifiant du modèle personnalisé
              </label>
              <input
                type="text"
                value={settings.customModel || ''}
                onChange={(e) => saveSettings({ ...settings, customModel: e.target.value })}
                placeholder="ex: gpt-4o-mini"
                className="w-full px-3 py-2 bg-parchment-100 border border-stone-border rounded-lg text-xs font-mono text-ink-900 focus:outline-none focus:border-french-bordeaux"
              />
            </div>
          )}
        </>
      )}

      {/* Check Mode */}
      <div className="pt-2 border-t border-stone-border">
        <label className="block text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">
          {t.analysisMode}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => saveSettings({ ...settings, checkMode: 'realtime' })}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              settings.checkMode === 'realtime'
                ? 'border-french-bordeaux bg-french-bordeaux/5 text-ink-900 shadow-sm'
                : 'border-stone-border bg-parchment-100/60 hover:bg-parchment-200/60 text-ink-600'
            }`}
          >
            <div className="text-xs font-semibold">{t.realtime}</div>
            <div className="text-[11px] text-ink-500 mt-1">{t.realtimeDescLong}</div>
          </button>
          <button
            type="button"
            onClick={() => saveSettings({ ...settings, checkMode: 'ondemand' })}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              settings.checkMode === 'ondemand'
                ? 'border-french-bordeaux bg-french-bordeaux/5 text-ink-900 shadow-sm'
                : 'border-stone-border bg-parchment-100/60 hover:bg-parchment-200/60 text-ink-600'
            }`}
          >
            <div className="text-xs font-semibold">{t.ondemand}</div>
            <div className="text-[11px] text-ink-500 mt-1">{t.ondemandDescLong}</div>
          </button>
        </div>
      </div>

      {/* Target Language */}
      <div>
        <label className="block text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">
          {t.targetLanguage}
        </label>
        <select
          value={settings.language}
          onChange={(e) => saveSettings({ ...settings, language: e.target.value })}
          className="w-full px-3 py-2 bg-parchment-100 border border-stone-border rounded-lg text-sm text-ink-900 focus:outline-none focus:border-french-bordeaux"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Realtime Delay */}
      {settings.checkMode === 'realtime' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-ink-800 uppercase tracking-wider">
              {t.delayLabel}
            </label>
            <span className="text-xs font-mono text-ink-600">{settings.realtimeDelay} ms</span>
          </div>
          <input
            type="range"
            min="300"
            max="2000"
            step="100"
            value={settings.realtimeDelay}
            onChange={(e) => saveSettings({ ...settings, realtimeDelay: Number(e.target.value) })}
            className="w-full accent-french-bordeaux"
          />
        </div>
      )}

      {/* Selection Lookup (US-01) */}
      <div className="pt-2 border-t border-stone-border">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <label
              htmlFor="selection-lookup-enabled"
              className="block text-xs font-semibold text-ink-800 uppercase tracking-wider"
            >
              {t.selectionLookupTitle}
            </label>
            <p className="text-[11px] text-ink-500 mt-1">{t.selectionLookupDesc}</p>
          </div>
          <input
            id="selection-lookup-enabled"
            type="checkbox"
            checked={settings.selectionLookup.enabled}
            onChange={(e) =>
              saveSettings({
                ...settings,
                selectionLookup: { ...settings.selectionLookup, enabled: e.target.checked },
              })
            }
            className="mt-1 w-4 h-4 accent-french-bordeaux"
          />
        </div>

        {settings.selectionLookup.enabled && (
          <>
            <div className="text-[11px] font-semibold text-ink-700 mb-2">{t.lookupTriggerLabel}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  ['button', t.lookupTriggerButton, t.lookupTriggerButtonDesc],
                  ['instant', t.lookupTriggerInstant, t.lookupTriggerInstantDesc],
                  ['alt', t.lookupTriggerAlt, t.lookupTriggerAltDesc],
                ] as const
              ).map(([trigger, label, desc]) => (
                <button
                  key={trigger}
                  type="button"
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      selectionLookup: { ...settings.selectionLookup, trigger },
                    })
                  }
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    settings.selectionLookup.trigger === trigger
                      ? 'border-french-bordeaux bg-french-bordeaux/5 text-ink-900 shadow-sm'
                      : 'border-stone-border bg-parchment-100/60 hover:bg-parchment-200/60 text-ink-600'
                  }`}
                >
                  <div className="text-xs font-semibold">{label}</div>
                  <div className="text-[11px] text-ink-500 mt-1">{desc}</div>
                </button>
              ))}
            </div>

            <SourcePrefsEditor
              prefs={settings.selectionLookup.sources}
              t={t}
              onChange={(sources) =>
                saveSettings({
                  ...settings,
                  selectionLookup: { ...settings.selectionLookup, sources },
                })
              }
            />
          </>
        )}
      </div>

      {/* Highlight saved words on pages (US-09) */}
      <div className="pt-2 border-t border-stone-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <label htmlFor="vocab-highlight-enabled" className="block text-xs font-semibold text-ink-800 uppercase tracking-wider">
              {t.vocabHighlightTitle}
            </label>
            <p className="text-[11px] text-ink-500 mt-1">{t.vocabHighlightDesc}</p>
            <p className="text-[11px] mt-1.5 flex flex-wrap gap-3 text-ink-700">
              <span>
                <span className="px-1 rounded-sm bg-[rgba(52,96,200,0.13)] underline decoration-dotted decoration-[rgba(52,96,200,0.75)]">mot</span>{' '}
                {t.vocabStatusNew}
              </span>
              <span>
                <span className="px-1 rounded-sm bg-[rgba(234,179,8,0.2)] underline decoration-dotted decoration-[rgba(161,98,7,0.75)]">mot</span>{' '}
                {t.vocabStatusLearning}
              </span>
            </p>
          </div>
          <input
            id="vocab-highlight-enabled"
            type="checkbox"
            checked={settings.vocabHighlight}
            onChange={(e) => saveSettings({ ...settings, vocabHighlight: e.target.checked })}
            className="mt-1 w-4 h-4 accent-french-bordeaux"
          />
        </div>
      </div>

      {/* Due-word badge (US-10) */}
      <div className="pt-2 border-t border-stone-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <label htmlFor="review-badge-enabled" className="block text-xs font-semibold text-ink-800 uppercase tracking-wider">
              {t.reviewBadgeSettingTitle}
            </label>
            <p className="text-[11px] text-ink-500 mt-1">{t.reviewBadgeSettingDesc}</p>
          </div>
          <input
            id="review-badge-enabled"
            type="checkbox"
            checked={settings.reviewBadge}
            onChange={(e) => saveSettings({ ...settings, reviewBadge: e.target.checked })}
            className="mt-1 w-4 h-4 accent-french-bordeaux"
          />
        </div>
      </div>

      {/* Grammar backend (US-17) */}
      <BackendSection settings={settings} saveSettings={saveSettings} t={t} />

      {/* Keyboard shortcuts (US-16) */}
      <ShortcutsSection t={t} />
    </div>
  );
}

/** US-03: pick the external dictionaries shown on the lookup card and their order. */
function SourcePrefsEditor({
  prefs,
  t,
  onChange,
}: {
  prefs: DictionarySourcePref[];
  t: ReturnType<typeof getT>;
  onChange: (prefs: DictionarySourcePref[]) => void;
}) {
  const list = normalizeSourcePrefs(prefs);
  const iconBtn =
    'p-1 rounded-md text-ink-500 hover:text-ink-900 hover:bg-parchment-200/60 disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="mt-5">
      <div className="text-[11px] font-semibold text-ink-700">{t.lookupSourcesLabel}</div>
      <p className="text-[11px] text-ink-500 mt-0.5 mb-2">{t.lookupSourcesDesc}</p>
      <ul className="rounded-xl border border-stone-border divide-y divide-stone-border bg-parchment-100/60">
        {list.map((pref, i) => {
          const source = DICTIONARY_SOURCES[pref.id];
          const inputId = `lookup-source-${pref.id}`;
          return (
            <li key={pref.id} className="flex items-center gap-3 px-3 py-2">
              <input
                id={inputId}
                type="checkbox"
                checked={pref.enabled}
                onChange={(e) =>
                  onChange(list.map((p) => (p.id === pref.id ? { ...p, enabled: e.target.checked } : p)))
                }
                className="w-4 h-4 accent-french-bordeaux"
              />
              <label htmlFor={inputId} className={`flex-1 text-xs ${pref.enabled ? 'text-ink-900' : 'text-ink-500'}`}>
                {source.label}
              </label>
              <button
                type="button"
                className={iconBtn}
                disabled={i === 0}
                title={t.moveUp}
                aria-label={`${t.moveUp}: ${source.label}`}
                onClick={() => onChange(moveSourcePref(list, i, -1))}
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                className={iconBtn}
                disabled={i === list.length - 1}
                title={t.moveDown}
                aria-label={`${t.moveDown}: ${source.label}`}
                onClick={() => onChange(moveSourcePref(list, i, 1))}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DictionaryTab({
  dictionary,
  removeFromDictionary,
  t,
}: {
  dictionary: { id: string; word: string }[];
  removeFromDictionary: (id: string) => void;
  t: ReturnType<typeof getT>;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-serif font-bold text-base text-ink-900 mb-1">
          {t.dictTitle}
        </h3>
        <p className="text-xs text-ink-600 leading-relaxed">
          {t.dictDesc}
        </p>
      </div>

      {dictionary.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-stone-border rounded-xl">
          <Book className="w-8 h-8 text-ink-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-ink-500">{t.dictEmpty}</p>
          <p className="text-[11px] text-ink-400 mt-1">
            {t.dictEmptyDesc}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-border border border-stone-border rounded-xl bg-parchment-100/40 overflow-hidden">
          {dictionary.map(({ id, word }) => (
            <div key={id} className="flex items-center justify-between px-4 py-3">
              <span className="font-mono text-xs text-ink-800">{word}</span>
              <button
                onClick={() => removeFromDictionary(id)}
                className="p-1 text-ink-400 hover:text-french-bordeaux transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsTab({
  stats,
  t,
}: {
  stats: { checksPerformed: number; errorsFound: number; correctionsApplied: number };
  t: ReturnType<typeof getT>;
}) {
  return (
    <div>
      <div className="mb-6">
        <h3 className="font-serif font-bold text-base text-ink-900 mb-1">
          {t.statsTitle}
        </h3>
        <p className="text-xs text-ink-600 leading-relaxed">
          {t.statsDesc}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-parchment-100 border border-stone-border rounded-xl p-5 text-center">
          <div className="text-3xl font-mono font-bold text-ink-900">{stats.checksPerformed}</div>
          <div className="text-xs font-sans uppercase tracking-wider text-ink-500 mt-1">
            {t.analyses}
          </div>
        </div>
        <div className="bg-note border border-note-line rounded-xl p-5 text-center">
          <div className="text-3xl font-mono font-bold text-french-bordeaux">{stats.errorsFound}</div>
          <div className="text-xs font-sans uppercase tracking-wider text-ink-500 mt-1">
            {t.errors}
          </div>
        </div>
        <div className="bg-ok border border-ok-line rounded-xl p-5 text-center">
          <div className="text-3xl font-mono font-bold text-emerald-700">{stats.correctionsApplied}</div>
          <div className="text-xs font-sans uppercase tracking-wider text-ink-500 mt-1">
            {t.corrected}
          </div>
        </div>
      </div>
    </div>
  );
}
