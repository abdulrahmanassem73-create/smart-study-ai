import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // ملفات UI (shadcn) تصدّر ثوابت/أنواع بجانب المكونات → هذا لا يؤثر على الإنتاج.
      'react-refresh/only-export-components': 'off',

      // كانت تُنتج False Positives في هذا القالب.
      'react-hooks/purity': 'off',

      // نُبقي TypeScript صارم داخل الملفات الأساسية، لكن لا نُسقط lint بسبب any في ملفات طرف ثالث/قالب.
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'warn',
      'no-useless-escape': 'warn',
    },
  },
])
