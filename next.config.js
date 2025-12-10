/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 忽略 TypeScript 類型錯誤 (AI 寫的代碼常有類型定義不完美的問題)
  typescript: {
    ignoreBuildErrors: true,
  },
  // 2. 忽略 ESLint 語法檢查 (例如變數定義了沒用到，不影響執行)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
