import { useState, useEffect } from 'react';
import { settingsStorage, statsStorage } from '@/lib/storage';
import type { Settings, AIProvider, CheckMode } from '@/types';
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

  function openOptions() {
    browser.runtime.openOptionsPage();
  }

  const hasAnyApiKey = hasApiKey.google || hasApiKey.openai || hasApiKey.anthropic;
  const providerName = settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1);

  if (loading) {
    return (
      <div className="w-full min-w-72 max-w-80 p-6 flex flex-col items-center justify-center bg-parchment-50">
        <div className="animate-spin w-5 h-5 border-2 border-french-bordeaux border-t-transparent rounded-full mb-2" />
        <span className="text-xs text-ink-500 font-mono">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="w-full min-w-72 max-w-80 bg-parchment-50 text-ink-900 border border-stone-border select-none">
      {/* Header */}
      <div className="border-b border-stone-border bg-parchment-100 px-4 py-3 flex items-center justify-between">
        <span className="font-serif font-bold text-base text-ink-900 tracking-tight">
          TextChecker
        </span>
        <button
          onClick={openOptions}
          className="p-1.5 text-ink-600 hover:text-ink-900 hover:bg-parchment-200 rounded-md transition-colors"
          title="Paramètres"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Status Bar */}
      <div className="p-3.5 border-b border-stone-border bg-parchment-50">
        {!hasAnyApiKey ? (
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
                {settings.enabled ? 'Actif' : 'Désactivé'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-ink-500 bg-parchment-200 px-2 py-0.5 rounded border border-stone-border">
              {providerName}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      {hasAnyApiKey && (
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
                  {settings.enabled ? 'Vérification activée' : 'Vérification suspendue'}
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
                  {settings.checkMode === 'realtime' ? 'Temps réel' : 'À la demande'}
                </div>
                <div className="text-[11px] text-ink-500 font-mono mt-0.5">
                  {settings.checkMode === 'realtime'
                    ? 'Vérification continue'
                    : 'Raccourci: Ctrl+Shift+G'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-ink-400 hover:text-ink-700">
              Basculer
            </span>
          </button>
        </div>
      )}

      {/* Statistics */}
      <div className="p-3 border-t border-stone-border bg-parchment-100/70">
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="px-1 py-1">
            <div className="text-base font-mono font-semibold text-ink-900">
              {stats.checksPerformed}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-sans">
              Analyses
            </div>
          </div>
          <div className="px-1 py-1 border-x border-stone-border">
            <div className="text-base font-mono font-semibold text-french-bordeaux">
              {stats.errorsFound}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-sans">
              Erreurs
            </div>
          </div>
          <div className="px-1 py-1">
            <div className="text-base font-mono font-semibold text-emerald-700">
              {stats.correctionsApplied}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-sans">
              Corrigées
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-stone-border flex justify-between items-center text-[10px] font-mono text-ink-400 bg-parchment-50">
        <span>v1.0.0</span>
      </div>
    </div>
  );
}
