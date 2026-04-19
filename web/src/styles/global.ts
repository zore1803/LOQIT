
export const globalStyles = `
  :root {
    --color-background: #f8fafc;
    --color-surface: #ffffff;
    --color-surfaceDim: #f1f5f9;
    --color-surfaceContainerLowest: #ffffff;
    --color-surfaceContainerLow: #f8fafc;
    --color-surfaceContainer: #f1f5f9;
    --color-surfaceContainerHigh: #e2e8f0;
    --color-surfaceContainerHighest: #cbd5e1;
    --color-surfaceBright: #ffffff;
    --color-surfaceVariant: #e2e8f0;
    --color-onSurface: #0f172a;
    --color-onSurfaceVariant: #475569;
    --color-primary: #2563eb;
    --color-primaryContainer: #dbeafe;
    --color-inversePrimary: #1e3a8a;
    --color-accent: #3b82f6;
    --color-onPrimary: #ffffff;
    --color-secondary: #059669;
    --color-secondaryContainer: #d1fae5;
    --color-onSecondary: #ffffff;
    --color-tertiary: #d97706;
    --color-tertiaryContainer: #fef3c7;
    --color-error: #dc2626;
    --color-errorContainer: #fee2e2;
    --color-outline: #94a3b8;
    --color-outlineVariant: #cbd5e1;
    --logo-filter: brightness(1) saturate(1);
  }

  :root.dark-mode {
    --color-background: #111318;
    --color-surface: #111318;
    --color-surfaceDim: #111318;
    --color-surfaceContainerLowest: #0c0e13;
    --color-surfaceContainerLow: #1a1b21;
    --color-surfaceContainer: #1e2025;
    --color-surfaceContainerHigh: #282a2f;
    --color-surfaceContainerHighest: #33353a;
    --color-surfaceBright: #37393f;
    --color-surfaceVariant: #33353a;
    --color-onSurface: #e2e2e9;
    --color-onSurfaceVariant: #c1c6d6;
    --color-primary: #aac7ff;
    --color-primaryContainer: #7491c6;
    --color-inversePrimary: #418fff;
    --color-accent: #3D8EFF;
    --color-onPrimary: #0c305f;
    --color-secondary: #46f1bb;
    --color-secondaryContainer: #06d4a1;
    --color-onSecondary: #003828;
    --color-tertiary: #ffb95f;
    --color-tertiaryContainer: #ca8100;
    --color-error: #FF4E4E;
    --color-errorContainer: #93000a;
    --color-outline: #8b919f;
    --color-outlineVariant: #414753;
    --logo-filter: brightness(1.8) saturate(1.2);
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    transition: background-color 0.3s ease, border-color 0.3s ease;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: var(--color-background);
    color: var(--color-onSurface);
    min-height: 100vh;
  }

  #root {
    min-height: 100vh;
  }

  a {
    color: var(--color-primary);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  button {
    font-family: inherit;
    cursor: pointer;
  }

  input, textarea, select {
    font-family: inherit;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--color-surfaceContainer);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--color-outline);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--color-onSurfaceVariant);
  }

  @keyframes pulse {
    0%, 100% { 
      opacity: 1; 
      box-shadow: 0 0 8px var(--color-primary);
      transform: scale(1);
    }
    50% { 
      opacity: 0.6; 
      box-shadow: 0 0 24px var(--color-primary);
      transform: scale(1.05);
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .page-enter {
    animation: fadeIn 0.3s ease forwards;
  }

  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-background-clip: text;
    -webkit-text-fill-color: var(--color-onSurface) !important;
    transition: background-color 5000s ease-in-out 0s;
    box-shadow: inset 0 0 20px 20px var(--color-surfaceContainerHigh);
  }

  .input-wrapper:focus-within {
    border-color: var(--color-primary) !important;
  }

  input::placeholder {
    color: var(--color-outline);
    opacity: 0.7;
  }

  input:focus::placeholder {
    opacity: 0.5;
  }
`
