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
      // 允许使用 @ts-ignore（兼容旧代码，推荐新代码使用 @ts-expect-error）
      '@typescript-eslint/ban-ts-comment': 'off',
      // 允许使用 any 类型（某些场景下需要类型断言）
      '@typescript-eslint/no-explicit-any': 'warn',
      // 允许导出非组件内容（常量、类型等）
      'react-refresh/only-export-components': 'warn',
      // 允许在渲染期间创建子组件（某些场景下是有意为之）
      'react-hooks/static-components': 'off',
    },
  },
])
