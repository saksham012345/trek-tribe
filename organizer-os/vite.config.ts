import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * The organizer app reads its screens from the main web app rather than owning
 * a copy of them.
 *
 * Thirty-two screens, the vendor panels and the small shared surface they need
 * — apiClient, Toast, Skeleton, AuthContext, the finance types — all live in
 * ../web/src. Copying them here would mean two versions of every screen and a
 * slow drift between the two, with bugs fixed in one and not the other. The
 * alias points at the originals instead, so this app is a different way to run
 * the same code, not a fork of it.
 */
const WEB_SRC = path.resolve(__dirname, '../web/src');

/**
 * The shared code was written for Create React App, which injects process.env
 * at build time. Vite does not, so importing any of it into this app threw
 * "process is not defined" before a single screen rendered.
 *
 * Rather than rewrite thirty-two screens to read import.meta.env, the three
 * variables that code actually reads are defined here. They are listed
 * explicitly rather than shimming the whole of process.env: a blanket shim
 * would hide the next one that gets added, and this app would break the same
 * way again with the same unhelpful message.
 */
const CRA_ENV = {
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  'process.env.REACT_APP_API_URL': JSON.stringify(process.env.VITE_API_URL ?? 'http://localhost:4000'),
  'process.env.REACT_APP_SOCKET_URL': JSON.stringify(process.env.VITE_SOCKET_URL ?? 'http://localhost:4000'),
};

export default defineConfig({
  define: CRA_ENV,
  plugins: [react()],
  resolve: {
    alias: { '@web': WEB_SRC },
    // One copy of each of these, or nothing works. The shared screens resolve
    // their imports from ../web/node_modules while this app resolves from its
    // own, which gave two react-router-dom instances with separate context: the
    // built app threw "useLocation() may be used only in the context of a
    // <Router>" while sitting inside one. React would fail the same way, with
    // hook errors instead.
    dedupe: ['react', 'react-dom', 'react-router-dom', 'three'],
  },
  server: {
    port: 3002,
    fs: {
      // Vite refuses to serve files above its root unless told otherwise, and
      // every screen this app renders lives above its root.
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
