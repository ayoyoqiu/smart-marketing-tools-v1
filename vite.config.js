import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    host: '0.0.0.0', // 允许外部访问
    strictPort: false, // 不严格端口，允许自动分配
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('代理请求错误:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('代理请求:', req.method, req.url);
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // 生产环境关闭sourcemap
    rollupOptions: {
      output: {
        // 简化的代码分割配置
        manualChunks: {
          // 只分离主要的第三方库
          vendor: ['react', 'react-dom'],
          antd: ['antd']
        },
        // 文件名配置
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // 开发环境保留console
        drop_debugger: false
      }
    },
    // 分块大小警告阈值
    chunkSizeWarningLimit: 1000
  },
  preview: {
    port: 3000,
    host: '0.0.0.0'
  },
  // 优化配置
  optimizeDeps: {
    include: ['react', 'react-dom', 'antd', '@ant-design/icons'],
    exclude: ['@ant-design/icons']
  },
  // 兼容性配置
  define: {
    global: 'globalThis'
  },
  resolve: {
    alias: {
      'classnames': 'classnames'
    }
  }
}) 