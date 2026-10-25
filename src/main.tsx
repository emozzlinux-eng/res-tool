import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Global safety nets so async errors outside React's tree don't silently kill
// background saves or leave a blank screen with no feedback.
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Service worker registration is handled by vite-plugin-pwa (see vite.config.js):
// it injects dist/registerSW.js into the built index.html and uses the Workbox
// `prompt` flow so updates are never applied mid-session without consent.
