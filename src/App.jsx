import React from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import Schedule from './components/Schedule'
import useTheme from './hooks/useTheme'

function App() {
  const { theme } = useTheme()
  const enableVercelMetrics =
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname)

  return (
    <div className="dark:bg-[#101012] bg-[#fff7f4] min-h-screen flex justify-center transition-colors duration-300">
      <div className="w-full max-w-[440px] min-w-[375px] dark:bg-[#101012] bg-[#fff7f4] shadow-2xl overflow-hidden relative transition-colors duration-300">
        <Schedule theme={theme} />
      </div>
      {enableVercelMetrics && <Analytics />}
      {enableVercelMetrics && <SpeedInsights />}
    </div>
  )
}

export default App
