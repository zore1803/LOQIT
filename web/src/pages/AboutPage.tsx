import { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Colors } from '../lib/colors'
import { Card } from '../components/Card'

export function AboutPage() {
  const navigate = useNavigate()

  const containerStyle: CSSProperties = {
    padding: '32px',
    maxWidth: '800px',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '32px',
  }

  const backButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    color: Colors.onSurfaceVariant,
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
  }

  const titleStyle: CSSProperties = {
    fontSize: '28px',
    fontWeight: 600,
    color: Colors.onSurface,
  }

  const logoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
  }

  const sectionStyle: CSSProperties = {
    marginBottom: '24px',
  }

  const sectionTitleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: Colors.onSurface,
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const textStyle: CSSProperties = {
    color: Colors.onSurfaceVariant,
    fontSize: '15px',
    lineHeight: 1.6,
  }

  const listStyle: CSSProperties = {
    ...textStyle,
    paddingLeft: '20px',
    margin: '8px 0',
  }

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <button style={backButtonStyle} onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 style={titleStyle}>About LOQIT</h1>
      </header>

      <Card style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={logoStyle}>
          <span className="material-icons" style={{ fontSize: '48px', color: Colors.primary }}>
            security
          </span>
          <span style={{ fontSize: '32px', fontWeight: 700, color: Colors.primary }}>LOQIT</span>
        </div>
        <p style={{ color: Colors.onSurfaceVariant, marginBottom: '8px' }}>
          Secure Phone Ownership & Recovery System
        </p>
        <p style={{ color: Colors.outline, fontSize: '14px' }}>Version 1.0.0</p>
      </Card>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span className="material-icons" style={{ color: Colors.primary }}>info</span>
          What is LOQIT?
        </h3>
        <p style={textStyle}>
          LOQIT is a comprehensive device protection and recovery system that uses Bluetooth Low
          Energy (BLE) technology to help locate lost or stolen devices through a community-powered
          network of users.
        </p>
      </Card>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span className="material-icons" style={{ color: Colors.secondary }}>star</span>
          Key Features
        </h3>
        <ul style={listStyle}>
          <li>Register your devices with unique hardware serial numbers</li>
          <li>Report devices as lost with detailed incident information</li>
          <li>BLE-based passive scanning network (mobile app only)</li>
          <li>Anonymous chat system for device recovery coordination</li>
          <li>Real-time location alerts when lost devices are detected</li>
          <li>Aadhaar verification for enhanced trust</li>
        </ul>
      </Card>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span className="material-icons" style={{ color: Colors.tertiary }}>help</span>
          How It Works
        </h3>
        <ol style={listStyle}>
          <li>Register your device with its serial number and details</li>
          <li>If your device is lost, mark it as lost in the app</li>
          <li>Other LOQIT users' phones passively scan for your device</li>
          <li>When found, you receive an alert with location info</li>
          <li>Use anonymous chat to coordinate safe recovery</li>
        </ol>
      </Card>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span className="material-icons" style={{ color: Colors.primary }}>computer</span>
          Desktop Version
        </h3>
        <p style={textStyle}>
          This desktop version allows you to manage your devices and account without the BLE
          scanning capabilities. For full functionality including device detection and broadcasting,
          please use the LOQIT mobile app.
        </p>
      </Card>

      <Card
        style={{
          backgroundColor: `${Colors.tertiary}10`,
          borderLeft: `4px solid ${Colors.tertiary}`,
        }}
      >
        <h3 style={{ ...sectionTitleStyle, color: Colors.tertiary }}>
          <span className="material-icons">warning</span>
          Disclaimer
        </h3>
        <p style={textStyle}>
          LOQIT is a device tracking aid and does not guarantee device recovery. Always report
          theft to local authorities. Use caution when meeting to recover devices. Never meet
          alone in isolated locations.
        </p>
      </Card>
    </div>
  )
}
