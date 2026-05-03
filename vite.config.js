import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        users: resolve(__dirname, 'users.html'),
        projects: resolve(__dirname, 'projects.html'),
        reports: resolve(__dirname, 'reports.html'),
        notification: resolve(__dirname, 'notification.html'),
        snippets: resolve(__dirname, 'snippets.html')
      }
    }
  }
})