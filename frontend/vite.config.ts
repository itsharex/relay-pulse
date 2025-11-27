import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html.replace(
            '%VITE_GA_MEASUREMENT_ID%',
            env.VITE_GA_MEASUREMENT_ID || ''
          )
        },
      },
    ],
    // Vite 的开发服务器默认支持 SPA 路由回退
  }
})
