import { useState, useEffect } from 'react';
import { settingsStorage, apiKeysStorage, dictionaryStorage, statsStorage } from '@/lib/storage';
import type { Settings, APIKeys, AIProvider } from '@/types';
import { DEFAULT_SETTINGS, AVAILABLE_MODELS, SUPPORTED_LANGUAGES } from '@/types';
import { Key, Settings as SettingsIcon, Book, BarChart3, Eye, EyeOff, Trash2, Save, CheckCircle } from 'lucide-react';

type TabType = 'api-keys' | 'settings' | 'dictionary' | 'stats';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('api-keys');
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
    { id: 'api-keys', label: 'Clés API', icon: <Key className="w-4 h-4" /> },
    { id: 'settings', label: 'Configuration', icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'dictionary', label: 'Dictionnaire personnel', icon: <Book className="w-4 h-4" /> },
    { id: 'stats', label: 'Statistiques', icon: <BarChart3 className="w-4 h-4" /> },
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
            {activeTab === 'api-keys' && (
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

        {/* Save Status Notification */}
        {saveStatus !== 'idle' && (
          <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-ink-900 text-parchment-50 border border-stone-border px-4 py-2.5 rounded-lg shadow-lg text-xs font-mono">
            {saveStatus === 'saving' ? (
              <>
                <Save className="w-3.5 h-3.5 animate-pulse text-french-ochre" />
                <span>Enregistrement en cours...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Modifications enregistrées !</span>
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
  setShowKeys: (keys: Record<string, boolean>) => void;
  saveApiKey: (provider: AIProvider, key: string) => void;
}) {
  const providers: { id: AIProvider; name: string; url: string; desc: string }[] = [
    {
      id: 'google',
      name: 'Google AI (Gemini)',
      url: 'https://aistudio.google.com/apikey',
      desc: 'Gemini 2.5 Flash / Flash Lite',
    },
    {
      id: 'openai',
      name: 'OpenAI (GPT-4o)',
      url: 'https://platform.openai.com/api-keys',
      desc: 'GPT-4o / GPT-4o Mini',
    },
    {
      id: 'anthropic',
      name: 'Anthropic (Claude)',
      url: 'https://console.anthropic.com/settings/keys',
      desc: 'Claude 3.5 Sonnet / Haiku',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#FAF5EB] border border-[#E8DCB8] rounded-xl p-4 text-ink-900">
        <h3 className="font-serif font-semibold text-sm text-french-ochre mb-1">
          À propos des clés d'API
        </h3>
        <p className="text-xs text-ink-700 leading-relaxed">
          Vos clés API sont stockées localement dans votre navigateur et ne sont transmises à aucun serveur tiers.
        </p>
      </div>

      <div className="space-y-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="border border-stone-border bg-parchment-50 rounded-xl p-4 hover:border-parchment-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="font-serif font-semibold text-ink-900 text-sm">
                  {provider.name}
                </label>
                <p className="text-xs text-ink-500 mt-0.5">{provider.desc}</p>
              </div>
              <a
                href={provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-french-bordeaux hover:underline hover:text-ink-900"
              >
                Obtenir une clé &rarr;
              </a>
            </div>

            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeys[provider.id] ? 'text' : 'password'}
                  value={apiKeys[provider.id] || ''}
                  onChange={(e) => saveApiKey(provider.id, e.target.value)}
                  placeholder={`Collez votre clé API ${provider.name}`}
                  className="w-full px-3 py-2 bg-parchment-100 border border-stone-border rounded-lg text-ink-900 font-mono text-xs focus:outline-none focus:border-french-bordeaux focus:ring-1 focus:ring-french-bordeaux/30"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys({ ...showKeys, [provider.id]: !showKeys[provider.id] })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                >
                  {showKeys[provider.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {apiKeys[provider.id] && (
              <p className="text-xs font-mono text-emerald-700 mt-2 flex items-center gap-1.5">
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
            placeholder="ex: gpt-4o-2024-08-06"
            className="w-full px-3 py-2 bg-parchment-100 border border-stone-border rounded-lg text-xs font-mono text-ink-900 focus:outline-none focus:border-french-bordeaux"
          />
        </div>
      )}

      {/* Check Mode */}
      <div className="pt-2 border-t border-stone-border">
        <label className="block text-xs font-semibold text-ink-800 uppercase tracking-wider mb-2">
          Mode d'analyse
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              settings.checkMode === 'realtime'
                ? 'bg-parchment-200 border-ink-900'
                : 'bg-parchment-50 border-stone-border hover:bg-parchment-100'
            }`}
          >
            <input
              type="radio"
              name="checkMode"
              value="realtime"
              checked={settings.checkMode === 'realtime'}
              onChange={() => saveSettings({ ...settings, checkMode: 'realtime' })}
              className="mt-1 accent-french-bordeaux"
            />
            <div>
              <span className="font-serif font-semibold text-xs text-ink-900">Temps réel</span>
              <p className="text-[11px] text-ink-600 mt-0.5">Vérifie automatiquement au fil de la frappe.</p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              settings.checkMode === 'ondemand'
                ? 'bg-parchment-200 border-ink-900'
                : 'bg-parchment-50 border-stone-border hover:bg-parchment-100'
            }`}
          >
            <input
              type="radio"
              name="checkMode"
              value="ondemand"
              checked={settings.checkMode === 'ondemand'}
              onChange={() => saveSettings({ ...settings, checkMode: 'ondemand' })}
              className="mt-1 accent-french-bordeaux"
            />
            <div>
              <span className="font-serif font-semibold text-xs text-ink-900">À la demande</span>
              <p className="text-[11px] text-ink-600 mt-0.5">Appuyez sur Ctrl/Cmd + Shift + G pour déclencher.</p>
            </div>
          </label>
        </div>
      </div>

      {settings.checkMode === 'realtime' && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-ink-800 uppercase tracking-wider">
              Délai de frappe (Debounce)
            </label>
            <span className="text-xs font-mono text-ink-600">{settings.realtimeDelay} ms</span>
          </div>
          <input
            type="range"
            min="200"
            max="2000"
            step="100"
            value={settings.realtimeDelay}
            onChange={(e) => saveSettings({ ...settings, realtimeDelay: Number(e.target.value) })}
            className="w-full accent-french-bordeaux cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-ink-400 font-mono mt-1">
            <span>200 ms (réactif)</span>
            <span>2000 ms (économe)</span>
          </div>
        </div>
      )}

      {/* Language */}
      <div className="pt-2 border-t border-stone-border">
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

      {/* Enable Toggle */}
      <div className="pt-2 border-t border-stone-border">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => saveSettings({ ...settings, enabled: e.target.checked })}
            className="w-4 h-4 accent-french-bordeaux rounded"
          />
          <div>
            <span className="font-serif font-semibold text-sm text-ink-900">
              Activer TextChecker sur toutes les pages
            </span>
            <p className="text-xs text-ink-500">
              Lorsque cette case est décochée, aucune analyse automatique n'est exécutée sur vos champs de saisie.
            </p>
          </div>
        </label>
      </div>
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
    <div>
      <div className="mb-6">
        <h3 className="font-serif font-bold text-base text-ink-900 mb-1">
          Mots ignorés / Lexique personnel
        </h3>
        <p className="text-xs text-ink-600 leading-relaxed">
          Les mots listés ici ne seront plus signalés comme fautes d'orthographe ou d'usage.
        </p>
      </div>

      {dictionary.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-stone-border rounded-xl bg-parchment-100/50">
          <Book className="w-8 h-8 mx-auto mb-2 text-ink-400" />
          <p className="font-serif text-sm text-ink-800">Votre dictionnaire est vide</p>
          <p className="text-xs text-ink-500 mt-1">
            Cliquez sur &laquo; Ajouter au dictionnaire &raquo; directement depuis une suggestion d'erreur pour mémoriser un mot.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {dictionary.sort().map((word) => (
            <div
              key={word}
              className="flex items-center gap-2 bg-parchment-200 border border-parchment-300 px-3 py-1.5 rounded-full text-xs font-mono text-ink-800"
            >
              <span>{word}</span>
              <button
                onClick={() => removeFromDictionary(word)}
                className="text-ink-400 hover:text-french-bordeaux transition-colors"
                title="Supprimer ce mot"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
