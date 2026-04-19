import { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Colors } from '../lib/colors'
import { Card } from '../components/Card'

export function PrivacyPolicyPage() {
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

  const sectionStyle: CSSProperties = {
    marginBottom: '24px',
  }

  const sectionTitleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: Colors.onSurface,
    marginBottom: '12px',
  }

  const textStyle: CSSProperties = {
    color: Colors.onSurfaceVariant,
    fontSize: '15px',
    lineHeight: 1.6,
    marginBottom: '12px',
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
        <h1 style={titleStyle}>Privacy Policy</h1>
      </header>

      <p style={{ ...textStyle, marginBottom: '24px' }}>
        Last updated: March 2026
      </p>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Information We Collect</h3>
        <p style={textStyle}>We collect the following information to provide our services:</p>
        <ul style={listStyle}>
          <li>Account Information: Email, name, phone number</li>
          <li>Device Information: Serial number, hardware ID, make, model</li>
          <li>Location Data: When reporting lost devices or detecting devices</li>
          <li>Aadhaar Verification: Last 4 digits only, for identity verification</li>
        </ul>
      </Card>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>How We Use Your Information</h3>
        <ul style={listStyle}>
          <li>To register and verify your devices</li>
          <li>To facilitate lost device recovery</li>
          <li>To enable anonymous communication between users</li>
          <li>To send you notifications about your devices</li>
          <li>To improve our services</li>
        </ul>
      </Card>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Data Sharing</h3>
        <p style={textStyle}>We do not sell your personal information. We may share data:</p>
        <ul style={listStyle}>
          <li>With law enforcement when legally required</li>
          <li>Anonymously with other users during device recovery</li>
          <li>With service providers who help us operate LOQIT</li>
        </ul>
      </Card>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Data Security</h3>
        <p style={textStyle}>
          We implement industry-standard security measures to protect your data. All communications
          are encrypted, and sensitive identifiers are hashed when possible.
        </p>
      </Card>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Your Rights</h3>
        <ul style={listStyle}>
          <li>Access your personal data</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your account and data</li>
          <li>Opt out of marketing communications</li>
        </ul>
      </Card>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Cookies and Tracking</h3>
        <p style={textStyle}>
          We use essential cookies to maintain your session and preferences. We do not use
          third-party tracking cookies for advertising purposes.
        </p>
      </Card>

      <Card style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Contact Us</h3>
        <p style={textStyle}>
          If you have questions about this Privacy Policy or your data, please contact us at:
        </p>
        <p style={{ ...textStyle, color: Colors.primary }}>privacy@loqit.app</p>
      </Card>
    </div>
  )
}
