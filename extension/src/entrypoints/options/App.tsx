import { useState, useEffect } from 'react';
import { settingsStorage, apiKeysStorage, dictionaryStorage, statsStorage } from '@/lib/storage';
import { ENABLE_AI } from '@/lib/config';
import type { Settings, APIKeys, AIProvider } from '@/types';
import { DEFAULT_SETTINGS, AVAILABLE_MODELS, SUPPORTED_LANGUAGES } from '@/types';
import { Key, Settings as SettingsIcon, Book, BarChart3, Eye, EyeOff, Trash2, Save, CheckCircle } from 'lucide-react';

type TabType = 'api-keys' | 'settings' | 'dictionary' | 'stats';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>(ENABLE_AI ? 'api-keys' : 'settings');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKeys, setApiKeys] = useState<APIKeys>({});
  const [dictionary, setDictionary] = useState<string[]>([]);
  const [stats, setStats] = useState({ checksPerformed: 0, errorsFound: 0, correctionsApplied: 0 });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [loadedSettings, loadedKeys, loadedDictionary, loadedStats] = await Promise.all([
      settingsStorage.getValue(),
      apiKeysStorage.getValue(),
      dictionaryStorage.getValue(),
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

  async function removeFromDictionary(word: string) {
    const newDictionary = dictionary.filter((w) => w !== word);
    setDictionary(newDictionary);
    await dictionaryStorage.setValue(newDictionary);
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    ...(ENABLE_AI ? [{ id: 'api-keys' as TabType, label: 'Clés API', icon: <Key className="w-4 h-4" /> }] : []),
    { id: 'settings' as TabType, label: 'Configuration', icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'dictionary' as TabType, label: 'Dictionnaire personnel', icon: <Book className="w-4 h-4" /> },
    { id: 'stats' as TabType, label: 'Statistiques', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-parchment-100 text-ink-900 font-sans selection:bg-french-bordeaux selection:text-white">
      <div className="max-w-4xl mx-auto py-10 px-6">
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-border pb-6">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
              TextChecker &bull; Paramètres
            </h1>
            <p className="text-ink-600 text-sm mt-1">
              Assistant de rédaction et correction de grammaire.
            </p>
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
              <SettingsTab settings={settings} saveSettings={saveSettings} apiKeys={apiKeys} />
            )}
            {activeTab === 'dictionary' && (
              <DictionaryTab dictionary={dictionary} removeFromDictionary={removeFromDictionary} />
            )}
            {activeTab === 'stats' && <StatsTab stats={stats} />}
          </div>
        </div>

        {/* Save indicator */}
        {saveStatus !== 'idle' && (
          <div className="fixed bottom-6 right-6 bg-ink-900 text-parchment-50 px-4 py-2.5 rounded-lg text-xs font-medium shadow-lg flex items-center gap-2 animate-fade-in border border-ink-800">
            {saveStatus === 'saving' ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-parchment-50 border-t-transparent rounded-full animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                Paramètres enregistrés
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
}: {
  settings: Settings;
  saveSettings: (settings: Settings) => void;
  apiKeys: APIKeys;
}) {
  const providers: AIProvider[] = ['google', 'openai', 'anthropic'];
  const availableProviders = providers.filter((p) => apiKeys[p]);

  return (
    <div className="space-y-6 max-w-2xl">
      {!ENABLE_AI && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 text-xs text-ink-800">
          <p className="font-semibold text-emerald-800 mb-1">Moteur de Règles Grammaticales Actif</p>
          <p className="text-ink-700 leading-relaxed">
            L'assistant analyse vos textes localement avec les règles grammaticales autonomes (accords, élisions, verbes), garantissant une exécution instantanée, sans dépendance externe ni besoin de clé API.
          </p>
        </div>
      )}

      {ENABLE_AI && (
        <>
          {availableProviders.length === 0 && (
            <div className="bg-[#FAF5EB] border border-[#E8DCB8] rounded-xl p-4 text-xs text-ink-800">
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
          Mode d'analyse
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
            <div className="text-xs font-semibold">Temps réel</div>
            <div className="text-[11px] text-ink-500 mt-1">
              Vérifie au fur et à mesure de votre saisie.
            </div>
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
            <div className="text-xs font-semibold">À la demande</div>
            <div className="text-[11px] text-ink-500 mt-1">
              Raccourci clavier (Ctrl+Shift+G).
            </div>
          </button>
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="block text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">
          Langue cible
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
              Délai de temporisation
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
    </div>
  );
}

function DictionaryTab({
  dictionary,
  removeFromDictionary,
}: {
  dictionary: string[];
  removeFromDictionary: (word: string) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-serif font-bold text-base text-ink-900 mb-1">
          Dictionnaire personnel
        </h3>
        <p className="text-xs text-ink-600 leading-relaxed">
          Mots ignorés par le correcteur orthographique lors de vos sessions d'écriture.
        </p>
      </div>

      {dictionary.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-stone-border rounded-xl">
          <Book className="w-8 h-8 text-ink-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-ink-500">Aucun mot ignoré pour le moment</p>
          <p className="text-[11px] text-ink-400 mt-1">
            Utilisez &laquo; Ignorer &raquo; dans les popovers de correction pour en ajouter.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-border border border-stone-border rounded-xl bg-parchment-100/40 overflow-hidden">
          {dictionary.map((word) => (
            <div key={word} className="flex items-center justify-between px-4 py-3">
              <span className="font-mono text-xs text-ink-800">{word}</span>
              <button
                onClick={() => removeFromDictionary(word)}
                className="p-1 text-ink-400 hover:text-french-bordeaux transition-colors"
                title="Supprimer du dictionnaire"
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

function StatsTab({ stats }: { stats: { checksPerformed: number; errorsFound: number; correctionsApplied: number } }) {
  return (
    <div>
      <div className="mb-6">
        <h3 className="font-serif font-bold text-base text-ink-900 mb-1">
          Bilan d'utilisation
        </h3>
        <p className="text-xs text-ink-600 leading-relaxed">
          Statistiques de détection et corrections appliquées sur l'ensemble de votre navigation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-parchment-100 border border-stone-border rounded-xl p-5 text-center">
          <div className="text-3xl font-mono font-bold text-ink-900">{stats.checksPerformed}</div>
          <div className="text-xs font-sans uppercase tracking-wider text-ink-500 mt-1">
            Analyses effectuées
          </div>
        </div>
        <div className="bg-[#FAF5EB] border border-[#E8DCB8] rounded-xl p-5 text-center">
          <div className="text-3xl font-mono font-bold text-french-bordeaux">{stats.errorsFound}</div>
          <div className="text-xs font-sans uppercase tracking-wider text-ink-500 mt-1">
            Erreurs relevées
          </div>
        </div>
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-5 text-center">
          <div className="text-3xl font-mono font-bold text-emerald-700">{stats.correctionsApplied}</div>
          <div className="text-xs font-sans uppercase tracking-wider text-ink-500 mt-1">
            Corrections adoptées
          </div>
        </div>
      </div>
    </div>
  );
}
