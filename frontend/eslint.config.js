import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Config mínima -- o projeto não tinha nenhum lint configurado antes.
// Mesmo espírito pragmático do resto do repo: regras básicas de
// corretude (hooks, variáveis não usadas) em vez de um style guide
// completo, pra não gerar centenas de avisos de formatação sem relação
// com bugs de verdade.
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // react/jsx-uses-vars é o que evita falso positivo de
      // no-unused-vars em tudo que só é referenciado dentro de JSX
      // (ex.: `import { Link } from ...` usado só como `<Link>`).
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // JSX runtime automático (React 18 + @vitejs/plugin-react)
      'react/prop-types': 'off', // projeto não usa PropTypes em lugar nenhum
      // As regras novas de "static-components"/"set-state-in-effect" (do
      // ruleset voltado pro React Compiler) pegaram bastante código
      // pré-existente que não tem relação com esta tarefa -- rebaixadas
      // pra warning pra não travar `npm run lint` em débito técnico de
      // outras partes do projeto. As regras clássicas (rules-of-hooks,
      // exhaustive-deps) continuam no nível padrão.
      'react-hooks/static-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': 'off',
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['**/*.test.{js,jsx}', 'src/setupTests.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
