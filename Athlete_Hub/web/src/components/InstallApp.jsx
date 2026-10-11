import { useState } from 'react'
import { useInstallPrompt } from '../lib/pwa.js'
import { useToast } from './toast.jsx'
import Icon from './icons.jsx'
import { Modal } from './ui.jsx'

/**
 * "Install app" button. Shows the browser's install dialog where supported, or step-by-step
 * Add to Home Screen instructions on iPhone and iPad. Renders nothing once installed.
 */
export default function InstallApp({ className = 'btn btn-secondary', label = 'Install the app on this device' }) {
  const { mode, install } = useInstallPrompt()
  const [showIosHelp, setShowIosHelp] = useState(false)
  const toast = useToast()

  if (!mode) return null

  const onClick = async () => {
    if (mode === 'ios') return setShowIosHelp(true)
    if (await install()) toast.success('Athlete-Hub was added to your home screen.')
  }

  return (
    <>
      <button type="button" className={className} onClick={onClick}>
        <Icon name="download" /> {label}
      </button>
      {showIosHelp && (
        <Modal title="Add Athlete-Hub to your home screen" subtitle="It opens full screen, like an app." onClose={() => setShowIosHelp(false)} size="sm"
          footer={<button className="btn btn-primary" type="button" onClick={() => setShowIosHelp(false)}>Got it</button>}>
          <ol className="help-steps">
            <li>Open this page in <strong>Safari</strong>.</li>
            <li>Tap the <strong>Share</strong> button (the square with an arrow pointing up).</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
          </ol>
        </Modal>
      )}
    </>
  )
}
