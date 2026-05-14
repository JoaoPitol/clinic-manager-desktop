# Clinic Manager (Desktop)

App Electron + React + Vite.

## Desenvolvimento

Use **sempre** um dos fluxos abaixo. Rodar só `electron:start` sem o Vite deixa a janela preta (não há nada em `http://127.0.0.1:5173`).

```bash
npm install
npm run electron:dev
```

Isso sobe o Vite e o Electron juntos. Alternativa em dois terminais:

```bash
npm run dev
# em outro terminal:
npm run electron:start
```

Para abrir o DevTools do Electron ao iniciar: `set ELECTRON_OPEN_DEVTOOLS=1` (Windows CMD) ou `$env:ELECTRON_OPEN_DEVTOOLS='1'` (PowerShell) antes de `npm run electron:start`.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
