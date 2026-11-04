import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    // Store listing (US-14): see store/listing.md. The version comes from package.json.
    name: 'TextChecker – French grammar in context',
    short_name: 'TextChecker',
    description:
      'Read French on any page: look up words, keep a vocabulary notebook, see the grammar of a sentence and practise it.',
    // offscreen: plays pronunciation recordings outside the page's CSP (US-04).
    // contextMenus: "Look up" / "Add to vocabulary" on selected text (US-06).
    // sidePanel / offscreen are Chrome-only (Firefox: sidebar_action, audio played in the page).
    permissions: [
      'storage',
      'activeTab',
      ...(browser === 'firefox' ? [] : ['sidePanel', 'offscreen']),
      'contextMenus',
      'alarms',
    ],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'TextChecker',
    },
    // US-16: browser-wide shortcuts (see src/lib/commands.ts). Chrome takes at most four
    // suggested keys; users change them at chrome://extensions/shortcuts.
    commands: {
      'lookup-selection': {
        suggested_key: { default: 'Alt+Shift+D', mac: 'Alt+Shift+D' },
        description: 'Look up the selected word',
      },
      'check-grammar': {
        suggested_key: { default: 'Alt+Shift+G', mac: 'Alt+Shift+G' },
        description: 'Check the text field (next error on each press), or analyze the grammar of the selected sentence',
      },
      'open-assistant': {
        suggested_key: { default: 'Alt+Shift+K', mac: 'Alt+Shift+K' },
        description: 'Open the grammar assistant with the selected sentence',
      },
      'open-vocabulary': {
        suggested_key: { default: 'Alt+Shift+V', mac: 'Alt+Shift+V' },
        description: 'Open the vocabulary notebook',
      },
    },
  }),
});
