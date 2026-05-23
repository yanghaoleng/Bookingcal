import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const workCalUrl = new URL(process.env.VITE_WORK_CAL_URL)

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/work-calendar': {
        target: workCalUrl.origin,
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/work-calendar/, workCalUrl.pathname),
      },
      '/api/holiday-calendar': {
        target: 'https://calendars.icloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/holiday-calendar/, '/holidays/cn_zh.ics/'),
      },
    },
  },
})
