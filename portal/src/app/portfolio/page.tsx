'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import styles from './page.module.css'

const PortfolioCanvas = dynamic(() => import('./PortfolioCanvas'), { ssr: false })

export default function PortfolioPage() {
  const [showPortalLink, setShowPortalLink] = useState(false)

  return (
    <div className={styles.portfolioRoot}>
      <div id="loading" className={styles.loading}>
        <div className={styles.loadingBarWrapper}>
          <div id="loadingBar" className={styles.loadingBar} />
        </div>
      </div>

      <canvas id="webgl-canvas" className={styles.webglCanvas} />

      <div className={styles.topBar}>
        <nav className={styles.topLinks}>
          {['home', 'work', 'about', 'services', 'contact'].map((nav) => (
            <a key={nav} href={`#page-${nav}`} data-nav={nav} className={styles.navLink}>
              {nav.charAt(0).toUpperCase() + nav.slice(1)}
            </a>
          ))}
        </nav>
        <div className={styles.topRight}>
          <button id="chatToggle" className={styles.chatToggle} aria-label="AI Chat">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          {showPortalLink && (
            <a href="/dashboard" className={styles.portalLink}>Личный кабинет</a>
          )}
        </div>
      </div>

      <div id="progressBar" className={styles.progressBar} />

      <section id="page-home" className={styles.page}>
        <div className={styles.homeContent}>
          <h1 className={styles.homeTitle}>Creative Developer</h1>
          <p className={styles.homeSubtitle}>Building immersive 3D experiences for the web</p>
          <p className={styles.homeTagline}>WebGL · Three.js · React · Shaders · Interactive</p>
        </div>
        <button id="scrollHint" className={styles.scrollHint} aria-label="Scroll down">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      </section>

      <section id="page-work" className={styles.page}>
        <header className={styles.workHeader}>
          <div className={styles.workFilters} id="workFilters" />
        </header>
        <div className={styles.projectsGrid} id="projectsGrid" />
      </section>

      <section id="page-about" className={styles.page}>
        <header className={styles.aboutHeader}>
          <h2>About</h2>
        </header>
        <div className={styles.aboutGrid}>
          <div className={styles.skillsSection}>
            <h3>Skills</h3>
            <div className={styles.skillsGrid} id="skillsGrid" />
          </div>
          <div className={styles.timelineSection}>
            <h3>Experience</h3>
            <div className={styles.timeline} id="timeline" />
          </div>
        </div>
      </section>

      <section id="page-services" className={styles.page}>
        <header className={styles.servicesHeader}>
          <h2>Services</h2>
        </header>
        <div className={styles.servicesGrid} id="servicesGrid" />
        <div className={styles.processSection}>
          <h3>Process</h3>
          <div className={styles.processSteps} id="processSteps" />
        </div>
      </section>

      <section id="page-contact" className={styles.page}>
        <header className={styles.contactHeader}>
          <h2>Contact</h2>
        </header>
        <div className={styles.contactGrid}>
          <form id="contactForm" className={styles.contactForm}>
            <div className={styles.formRow}>
              <input type="text" name="name" placeholder="Name" required />
              <input type="email" name="email" placeholder="Email" required />
            </div>
            <textarea name="message" placeholder="Message" rows={5} required />
            <button type="submit" className={styles.submitBtn}>Отправить заявку</button>
          </form>
          <div className={styles.contactInfo}>
            <div className={styles.contactItem}>
              <h4>Email</h4>
              <p>hello@example.com</p>
            </div>
            <div className={styles.contactItem}>
              <h4>Telegram</h4>
              <p>@username</p>
            </div>
            <div className={styles.contactItem}>
              <h4>Location</h4>
              <p>Remote Worldwide</p>
            </div>
          </div>
        </div>
      </section>

      <div id="projectModal" className={styles.modal}>
        <div className={styles.modalContent}>
          <button id="modalClose" className={styles.modalClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="24" height="24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div id="modalContent" className={styles.modalBody} />
        </div>
      </div>

      <div id="radialMenu" className={styles.radialMenu}>
        <button id="radialToggle" className={styles.radialToggle} aria-label="Menu">
          <svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        </button>
        <div id="radialItems" className={styles.radialItems} />
      </div>

      <div id="multiplayer" className={styles.multiplayer}>
        <span id="mpText" />
      </div>

      <PortfolioCanvas />
    </div>
  )
}