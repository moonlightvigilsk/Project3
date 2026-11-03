import { useState, useEffect } from 'react';
import { settingsStorage, statsStorage } from '@/lib/storage';
import { ENABLE_AI } from '@/lib/config';
import { getT } from '@/lib/i18n';
import type { Settings, AIProvider, CheckMode, UILanguage } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { Settings as SettingsIcon, Power, Keyboard, Zap, AlertCircle } from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hasApiKey, setHasApiKey] = useState<Record<AIProvider, boolean>>({
    google: false,
    openai: false,
    anthropic: false,
  });
  const [stats, setStats] = useState({ checksPerformed: 0, errorsFound: 0, correctionsApplied: 0 });
  const [loading, setLoading] = useState(true);

  const currentUiLang: UILanguage = settings.uiLanguage || 'vi';
  const t = getT(currentUiLang);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response && response.success) {
        setSettings(response.settings);
        setHasApiKey(response.hasApiKey);
      }
      const loadedStats = await statsStorage.getValue();
      setStats(loadedStats);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    setLoading(false);
  }

  async function toggleEnabled() {
    const newSettings = { ...settings, enabled: !settings.enabled };
    setSettings(newSettings);
    await settingsStorage.setValue(newSettings);
  }

  async function toggleCheckMode() {
    const newMode: CheckMode = settings.checkMode === 'realtime' ? 'ondemand' : 'realtime';
    const newSettings: Settings = { ...settings, checkMode: newMode };
    setSettings(newSettings);
    await settingsStorage.setValue(newSettings);
  }

  async function setUiLanguage(uiLanguage: UILanguage) {
    const newSettings: Settings = { ...settings, uiLanguage };
    setSettings(newSettings);
    await settingsStorage.setValue(newSettings);
  }

  function openOptions() {
    browser.runtime.openOptionsPage();
  }

  const hasAnyApiKey = hasApiKey.google || hasApiKey.openai || hasApiKey.anthropic;
  const isReady = ENABLE_AI ? hasAnyApiKey : true;
  const providerName = settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1);

  if (loading) {
    return (
      <div className="w-full min-w-72 max-w-80 p-6 flex flex-col items-center justify-center bg-parchment-50">
        <div className="animate-spin w-5 h-5 border-2 border-french-bordeaux border-t-transparent rounded-full mb-2" />
        <span className="text-xs text-ink-500 font-mono">...</span>
      </div>
    );
  }

  return (
    <div className="w-full min-w-72 max-w-80 bg-parchment-50 text-ink-900 border border-stone-border select-none">
      {/* Header */}
      <div className="border-b border-stone-border bg-parchment-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-base text-ink-900 tracking-tight">
            {t.appName}
          </span>
          {/* Quick UI Language Switcher */}
          <div className="flex items-center bg-parchment-200 border border-stone-border rounded p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setUiLanguage('vi')}
              className={`px-1.5 py-0.5 rounded ${
                currentUiLang === 'vi'
                  ? 'bg-ink-900 text-white font-bold'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
              title="Tiếng Việt"
            >
              VI
            </button>
            <button
              onClick={() => setUiLanguage('en')}
              className={`px-1.5 py-0.5 rounded ${
                currentUiLang === 'en'
                  ? 'bg-ink-900 text-white font-bold'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
              title="English"
            >
              EN
            </button>
            <button
              onClick={() => setUiLanguage('fr')}
              className={`px-1.5 py-0.5 rounded ${
                currentUiLang === 'fr'
                  ? 'bg-ink-900 text-white font-bold'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
              title="Français"
            >
              FR
            </button>
          </div>
        </div>

        <button
          onClick={openOptions}
          className="p-1.5 text-ink-600 hover:text-ink-900 hover:bg-parchment-200 rounded-md transition-colors"
          title={t.settings}
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Status Bar */}
      <div className="p-3.5 border-b border-stone-border bg-parchment-50">
        {!isReady ? (
          <div className="flex items-start gap-2.5 bg-[#FAF5EB] border border-[#E8DCB8] text-ink-900 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-french-ochre" />
            <div className="text-xs">
              <p className="font-semibold text-french-ochre">Configuration requise</p>
              <p className="text-ink-700 mt-0.5 leading-relaxed">
                Ajoutez une clé API pour activer la vérification.
              </p>
              <button
                onClick={openOptions}
                className="font-medium text-french-bordeaux underline mt-1.5 hover:text-ink-900 transition-colors"
              >
                Ouvrir les paramètres &rarr;
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  settings.enabled ? 'bg-emerald-600' : 'bg-ink-400'
                }`}
              />
              <span className="text-xs font-semibold text-ink-800">
                {settings.enabled ? t.active : t.disabled}
              </span>
            </div>
            <span className="text-[11px] font-mono text-ink-500 bg-parchment-200 px-2 py-0.5 rounded border border-stone-border">
              {ENABLE_AI ? providerName : t.localRulesBadge}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      {isReady && (
        <div className="p-3.5 space-y-2.5">
          {/* Enable / Disable Button */}
          <button
            onClick={toggleEnabled}
            className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
              settings.enabled
                ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-950'
                : 'border-stone-border bg-parchment-100 hover:bg-parchment-200 text-ink-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Power
                className={`w-4 h-4 ${
                  settings.enabled ? 'text-emerald-700' : 'text-ink-400'
                }`}
              />
              <div className="text-xs">
                <span className="font-medium">
                  {settings.enabled ? t.checkEnabled : t.checkDisabled}
                </span>
              </div>
            </div>
            <div
              className={`w-8 h-4 rounded-full p-0.5 transition-colors ${
                settings.enabled ? 'bg-emerald-600' : 'bg-ink-300'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white transition-transform ${
                  settings.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          {/* Mode Switcher */}
          <button
            onClick={toggleCheckMode}
            className="w-full flex items-center justify-between p-2.5 rounded-lg border border-stone-border bg-parchment-100 hover:bg-parchment-200 text-left transition-all"
          >
            <div className="flex items-center gap-2.5">
              {settings.checkMode === 'realtime' ? (
                <Zap className="w-4 h-4 text-french-ochre" />
              ) : (
                <Keyboard className="w-4 h-4 text-french-navy" />
              )}
              <div>
                <div className="text-xs font-medium text-ink-900">
                  {settings.checkMode === 'realtime' ? t.realtime : t.ondemand}
                </div>
                <div className="text-[11px] text-ink-500 font-mono mt-0.5">
                  {settings.checkMode === 'realtime' ? t.realtimeDesc : t.ondemandDesc}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-ink-400 hover:text-ink-700">
              {t.switchMode}
            </span>
          </button>
        </div>
      )}

      {/* Stats Summary */}
      <div className="p-3.5 border-t border-stone-border bg-parchment-100/60">
        <div className="text-[11px] font-semibold text-ink-600 uppercase tracking-wider mb-2">
          {t.sessionStats}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-parchment-50 border border-stone-border rounded-lg">
            <div className="font-mono text-sm font-bold text-ink-900">
              {stats.checksPerformed}
            </div>
            <div className="text-[10px] text-ink-500 font-mono mt-0.5">{t.analyses}</div>
          </div>
          <div className="p-2 bg-parchment-50 border border-stone-border rounded-lg">
            <div className="font-mono text-sm font-bold text-french-bordeaux">
              {stats.errorsFound}
            </div>
            <div className="text-[10px] text-ink-500 font-mono mt-0.5">{t.errors}</div>
          </div>
          <div className="p-2 bg-parchment-50 border border-stone-border rounded-lg">
            <div className="font-mono text-sm font-bold text-emerald-700">
              {stats.correctionsApplied}
            </div>
            <div className="text-[10px] text-ink-500 font-mono mt-0.5">{t.corrected}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
