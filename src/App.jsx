import './App.css'
import GlobeComponent from './components/Globe'
import { Analytics } from "@vercel/analytics/react"

function App() {
  return (
      <div className="globe-container">
          <GlobeComponent />
          <Analytics />
      </div>
  )
}

export default App

