/**
 * Unified Header & Navigation Component for go-apidocs
 * Loads branding and nav items dynamically from /docs/nav (or falls back to spec/defaults)
 * Fully responsive & mobile-first with slide-out drawer, QA triggers & live spec integration.
 */
(function () {
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

  const style = document.createElement('style');
  style.textContent = `
    :root {
      --apidocs-nav-bg: rgba(9, 13, 22, 0.95);
      --apidocs-nav-border: rgba(148, 163, 184, 0.14);
      --apidocs-primary: #6366F1;
      --apidocs-primary-hover: #4F46E5;
      --apidocs-text: #FFFFFF;
      --apidocs-text-muted: #94A3B8;
      --apidocs-font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .apidocs-unified-nav {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      z-index: 99999;
      background: var(--apidocs-nav-bg);
      border-bottom: 1px solid var(--apidocs-nav-border);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      font-family: var(--apidocs-font);
      box-sizing: border-box;
    }

    .apidocs-unified-nav * {
      box-sizing: border-box;
      font-family: inherit;
    }

    .apidocs-nav-container {
      max-width: 1440px;
      margin: 0 auto;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .apidocs-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--apidocs-text);
      font-weight: 800;
      font-size: 16px;
      letter-spacing: -0.3px;
      flex-shrink: 0;
    }

    .apidocs-brand-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      color: #fff;
      box-shadow: 0 2px 10px rgba(99, 102, 241, 0.4);
    }

    .apidocs-brand-text {
      display: flex;
      flex-direction: column;
    }

    .apidocs-brand-title {
      font-size: 15px;
      font-weight: 800;
      color: #fff;
      line-height: 1.2;
    }

    .apidocs-brand-subtitle {
      font-size: 11px;
      font-weight: 500;
      color: var(--apidocs-text-muted);
      line-height: 1.2;
    }

    /* Desktop Navigation Menu */
    .apidocs-menu {
      display: flex;
      align-items: center;
      gap: 8px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .apidocs-link {
      color: var(--apidocs-text-muted);
      text-decoration: none;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .apidocs-link:hover {
      color: #FFFFFF;
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(148, 163, 184, 0.2);
    }

    .apidocs-link.active {
      color: #FFFFFF;
      background: rgba(99, 102, 241, 0.18);
      border-color: rgba(99, 102, 241, 0.45);
      font-weight: 700;
    }

    .apidocs-btn-primary {
      background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
      border: none;
      color: #FFFFFF !important;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      white-space: nowrap;
    }

    .apidocs-btn-primary:hover {
      background: linear-gradient(135deg, #818CF8 0%, #4F46E5 100%);
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.55);
      transform: translateY(-1px);
    }

    .apidocs-link-badge {
      background: rgba(99, 102, 241, 0.25);
      color: #C7D2FE;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
      border: 1px solid rgba(99, 102, 241, 0.4);
    }

    /* Extra UI Controls (Scope, QA Buttons, Logout) */
    .apidocs-extra-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Mobile Hamburger Button */
    .apidocs-hamburger {
      display: none;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--apidocs-nav-border);
      color: #FFFFFF;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      transition: background 0.2s;
    }

    .apidocs-hamburger:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    /* Mobile Drawer */
    .apidocs-mobile-drawer {
      display: none;
      flex-direction: column;
      background: #090d16;
      border-top: 1px solid var(--apidocs-nav-border);
      padding: 16px 20px;
      gap: 10px;
    }

    .apidocs-mobile-drawer.open {
      display: flex;
    }

    .apidocs-mobile-drawer .apidocs-link {
      padding: 10px 14px;
      font-size: 14px;
      border-radius: 8px;
      width: 100%;
      justify-content: flex-start;
    }

    .apidocs-mobile-drawer .apidocs-btn-primary {
      padding: 10px 14px;
      font-size: 14px;
      width: 100%;
      justify-content: center;
      margin-top: 6px;
    }

    @media (max-width: 900px) {
      .apidocs-menu {
        display: none;
      }
      .apidocs-hamburger {
        display: block;
      }
    }
  `;
  document.head.appendChild(style);

  // Render navigation markup
  async function initUnifiedNav() {
    let navConfig = {
      title: 'API Documentation',
      subtitle: 'Developer Portal',
      icon: '⚡',
      nav_items: [
        { label: 'Home', url: '/', icon: '🏠' },
        { label: 'Guide', url: '/guide', icon: '📖' },
        { label: 'API Sandbox', url: '/docs', icon: '⚡' },
        { label: 'Health', url: '/dashboard', icon: '📊' },
        { label: 'OpenAPI Spec', url: '/docs/swagger.json', icon: '📄', is_button: true }
      ]
    };

    try {
      const res = await fetch('/docs/nav');
      if (res.ok) {
        const data = await res.json();
        if (data.title) navConfig.title = data.title;
        if (data.subtitle) navConfig.subtitle = data.subtitle;
        if (data.icon) navConfig.icon = data.icon;
        if (data.nav_items && data.nav_items.length > 0) {
          navConfig.nav_items = data.nav_items;
        }
      }
    } catch (e) {
      // Use defaults if /docs/nav is unavailable
    }

    const header = document.createElement('header');
    header.className = 'apidocs-unified-nav';

    const renderLinks = (isMobile = false) => {
      return navConfig.nav_items.map(item => {
        const isCurrent = currentPath === item.url.replace(/\/$/, '') || (item.url !== '/' && currentPath.startsWith(item.url));
        const activeCls = isCurrent ? 'active' : '';
        const btnCls = item.is_button ? 'apidocs-btn-primary' : `apidocs-link ${activeCls}`;
        const target = item.external ? 'target="_blank" rel="noopener"' : '';
        const badge = item.badge ? `<span class="apidocs-link-badge">${item.badge}</span>` : '';
        const icon = item.icon ? `<span class="apidocs-link-icon">${item.icon}</span>` : '';

        return `<a href="${item.url}" class="${btnCls}" ${target}>
          ${icon}
          <span>${item.label}</span>
          ${badge}
        </a>`;
      }).join('');
    };

    header.innerHTML = `
      <div class="apidocs-nav-container">
        <a href="/" class="apidocs-brand">
          <div class="apidocs-brand-icon">${navConfig.icon || '⚡'}</div>
          <div class="apidocs-brand-text">
            <span class="apidocs-brand-title">${navConfig.title}</span>
            <span class="apidocs-brand-subtitle">${navConfig.subtitle || 'Developer Reference & Sandbox'}</span>
          </div>
        </a>

        <nav class="apidocs-menu">
          ${renderLinks(false)}
        </nav>

        <button class="apidocs-hamburger" id="apidocs-menu-toggle" aria-label="Toggle navigation menu">
          ☰
        </button>
      </div>

      <div class="apidocs-mobile-drawer" id="apidocs-mobile-menu">
        ${renderLinks(true)}
      </div>
    `;

    // Insert or replace existing header
    const existingHeader = document.querySelector('header, .guide-topbar, .swagger-header');
    if (existingHeader) {
      existingHeader.parentNode.insertBefore(header, existingHeader);
      existingHeader.remove();
    } else {
      document.body.insertBefore(header, document.body.firstChild);
    }

    // Hamburger interaction
    const toggle = document.getElementById('apidocs-menu-toggle');
    const mobileMenu = document.getElementById('apidocs-mobile-menu');
    if (toggle && mobileMenu) {
      toggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('open');
        toggle.innerHTML = mobileMenu.classList.contains('open') ? '✕' : '☰';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUnifiedNav);
  } else {
    initUnifiedNav();
  }
})();
