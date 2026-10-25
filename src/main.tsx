import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// Service worker registration is handled by vite-plugin-pwa (see vite.config.js):
// it injects dist/registerSW.js into the built index.html and uses the Workbox
// `prompt` flow so updates are never applied mid-session without consent.
