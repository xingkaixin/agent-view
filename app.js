// OpenCode Session Visualization
class OpenCodeViz {
  constructor() {
    this.sessions = new Map();
    this.sessionsBySlug = new Map();
    this.currentSession = null;
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.render();
  }

  async loadData() {
    try {
      // Load index file
      const indexResponse = await fetch('data/sessions/index.json');
      if (!indexResponse.ok) {
        throw new Error('Failed to load index');
      }
      const index = await indexResponse.json();

      // Build slug->sessionInfo map
      const slugMap = new Map();
      index.sessions.forEach(info => {
        slugMap.set(info.id, info.slug);
      });

      // Load all session files based on index
      const sessionPromises = index.sessions.map(async (sessionInfo) => {
        try {
          const response = await fetch(`data/sessions/${sessionInfo.slug}.json`);
          if (!response.ok) return null;
          const session = await response.json();
          // Store the correct slug from filename
          session._urlSlug = sessionInfo.slug;
          return session;
        } catch (e) {
          console.warn(`Failed to load session ${sessionInfo.slug}:`, e);
          return null;
        }
      });

      const loadedSessions = (await Promise.all(sessionPromises)).filter(s => s !== null);

      // Build session lookup maps
      loadedSessions.forEach(session => {
        this.sessions.set(session.id, session);
        // Use the URL slug from filename
        this.sessionsBySlug.set(session._urlSlug, session);
      });
    } catch (error) {
      console.error('Failed to load data:', error);
      document.body.innerHTML = '<div style="padding: 40px; text-align: center;">加载数据失败，请确保已运行 build 生成索引</div>';
    }
  }

  setupEventListeners() {
    window.addEventListener('hashchange', () => this.render());
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }
  }

  render() {
    const hash = window.location.hash;
    const sessionMatch = hash.match(/^#opencode\/(.+)$/);
    
    if (sessionMatch) {
      this.renderSessionDetailBySlug(sessionMatch[1]);
    } else {
      this.renderSessionList();
    }
  }

  // Render session list page
  renderSessionList() {
    const container = document.querySelector('.container');
    if (!container) return;

    const allSessions = Array.from(this.sessions.values())
      .sort((a, b) => b.time_created - a.time_created);

    let html = `
      <div class="search-container">
        <input type="text" id="search-input" class="search-input" placeholder="搜索会话标题..." />
      </div>
      <div class="session-list" id="session-list">
    `;

    allSessions.forEach(session => {
      const date = new Date(session.time_created).toLocaleString('zh-CN');
      const stats = session.stats;
      const slug = session._urlSlug || session.id;
      
      html += `
        <a href="#opencode/${slug}" class="session-card">
          <div class="session-card-title">${this.escapeHtml(session.title)}</div>
          <div class="session-card-meta">
            <span>📁 ${this.escapeHtml(session.directory)}</span>
            <span>🕐 ${date}</span>
          </div>
          <div class="session-card-stats">
            <span class="stat-tag">💬 ${stats.message_count} 消息</span>
            <span class="stat-tag">🪙 ${this.formatTokens(stats.total_input_tokens + stats.total_output_tokens)}</span>
            <span class="stat-tag">💰 $${stats.total_cost.toFixed(4)}</span>
          </div>
        </a>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Update header
    this.updateHeaderForList();

    // Re-attach search listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }
  }

  // Render session detail by slug
  renderSessionDetailBySlug(slug) {
    const session = this.sessionsBySlug.get(slug);
    if (!session) {
      window.location.hash = '';
      return;
    }
    this.renderSessionDetail(session);
  }

  // Render single session detail page
  renderSessionDetail(session) {
    if (!session) {
      window.location.hash = '';
      return;
    }

    this.currentSession = session;
    const container = document.querySelector('.container');
    if (!container) return;

    const date = new Date(session.time_created).toLocaleString('zh-CN');
    const stats = session.stats;

    let html = `
      <div class="session-header-detail">
        <h1 class="session-title">${this.escapeHtml(session.title)}</h1>
        <div class="session-meta">
          <span class="session-meta-item">📁 ${this.escapeHtml(session.directory)}</span>
          <span class="session-meta-item">🕐 ${date}</span>
          <span class="session-meta-item">🏷️ ${session.slug}</span>
        </div>
        <div class="session-stats-row">
          <span class="stat-tag">💬 ${stats.message_count} 消息</span>
          <span class="stat-tag">📥 ${this.formatTokens(stats.total_input_tokens)} input</span>
          <span class="stat-tag">📤 ${this.formatTokens(stats.total_output_tokens)} output</span>
          <span class="stat-tag">💰 $${stats.total_cost.toFixed(4)}</span>
        </div>
      </div>
      <div class="timeline" id="timeline">
    `;

    // Render messages
    session.messages.forEach((msg, index) => {
      html += this.renderMessage(msg, index);
    });

    html += '</div>';
    container.innerHTML = html;

    // Update header
    this.updateHeaderForSession(session);

    // Attach tool toggle handlers
    document.querySelectorAll('.tool-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.tool-item').classList.toggle('expanded');
      });
    });

    // Attach reasoning toggle handlers
    document.querySelectorAll('.reasoning-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.reasoning-section').classList.toggle('expanded');
      });
    });
  }

  renderMessage(msg, index) {
    const role = msg.role;
    const time = new Date(msg.time_created).toLocaleString('zh-CN');
    
    // 获取 agent 标签 HTML
    const getAgentRoleHtml = () => {
      if (typeof ModelConfig !== 'undefined') {
        const agentKey = ModelConfig.getDefaultAgentKey() || 'opencode';
        const agentName = ModelConfig.getAgentName(agentKey);
        const agentIcon = ModelConfig.getAgentIconHtml(agentKey);
        return `${agentIcon} ${agentName}`;
      }
      return '🤖 OpenCode';
    };

    let html = `
      <article class="msg ${role}">
        <div class="msg-head">
          <span class="badge role ${role}">${role === 'user' ? '👤 用户' : getAgentRoleHtml()}</span>
    `;

      if (role === 'assistant') {
      if (msg.mode && typeof ModelConfig !== 'undefined') {
        const agentIcon = ModelConfig.getAgentIconHtml(msg.mode);
        html += `<span class="badge agent">${agentIcon} ${msg.mode}</span>`;
      } else if (msg.mode) {
        html += `<span class="badge agent">🤖 ${msg.mode}</span>`;
      }
      if (msg.model) {
        if (typeof ModelConfig !== 'undefined') {
          const providerIcon = ModelConfig.getModelIconHtml(msg.model);
          html += `<span class="badge model">${providerIcon} ${msg.model}</span>`;
        } else {
          html += `<span class="badge model">🧠 ${msg.model}</span>`;
        }
      }
    }

    html += `<time class="time">${time}</time></div>`;

    // Message content parts
    const textParts = msg.parts.filter(p => p.type === 'text');
    const toolParts = msg.parts.filter(p => p.type === 'tool');
    const reasoningParts = msg.parts.filter(p => p.type === 'reasoning');

    // Render reasoning first (before message content)
    if (reasoningParts.length > 0) {
      html += this.renderReasoning(reasoningParts);
    }

    html += '<div class="msg-content">';
    
    // Render text content
    textParts.forEach(part => {
      html += this.renderMarkdown(part.text);
    });

    html += '</div>';

    // Render tools
    if (toolParts.length > 0) {
      html += this.renderTools(toolParts);
    }

    // Render stats for assistant messages
    if (role === 'assistant' && msg.tokens) {
      html += '<div class="msg-stats">';
      if (msg.tokens.input) {
        html += `<span>📥 ${this.formatTokens(msg.tokens.input)} input</span>`;
      }
      if (msg.tokens.output) {
        html += `<span>📤 ${this.formatTokens(msg.tokens.output)} output</span>`;
      }
      if (msg.tokens.reasoning) {
        html += `<span>💭 ${this.formatTokens(msg.tokens.reasoning)} reasoning</span>`;
      }
      if (msg.cost) {
        html += `<span>💰 $${msg.cost.toFixed(4)}</span>`;
      }
      html += '</div>';
    }

    html += '</article>';
    return html;
  }

  renderTools(toolParts) {
    let html = `
      <div class="tools-section">
        <div class="tools-header">🔧 工具调用 (${toolParts.length})</div>
    `;

    toolParts.forEach(tool => {
      const state = tool.state || {};
      const status = state.status || 'completed';
      const statusClass = status === 'completed' ? 'completed' : status === 'error' ? 'error' : 'running';
      const statusText = status === 'completed' ? '✓ 完成' : status === 'error' ? '✗ 错误' : '⏳ 运行中';
      
      const input = state.input || {};
      const output = state.output || '';
      
      html += `
        <div class="tool-item">
          <button class="tool-header">
            <span class="tool-icon">${this.getToolIcon(tool.tool)}</span>
            <span class="tool-name">${tool.title || tool.tool || 'Tool'}</span>
            <span class="tool-status ${statusClass}">${statusText}</span>
            <span class="tool-toggle">▼</span>
          </button>
          <div class="tool-content">
            <div class="tool-section tool-input">
              <div class="section-label">输入</div>
              <pre class="tool-code">${this.escapeHtml(JSON.stringify(input, null, 2))}</pre>
            </div>
            <div class="tool-section tool-output">
              <div class="section-label">输出</div>
              <pre class="tool-code">${this.escapeHtml(output)}</pre>
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  renderReasoning(reasoningParts) {
    const fullText = reasoningParts.map(p => p.text).join('\n\n');
    
    return `
      <div class="reasoning-section">
        <div class="reasoning-header">
          <span class="reasoning-title">💭 思考 (${reasoningParts.length} 段)</span>
          <span class="reasoning-toggle">▼ 展开</span>
        </div>
        <div class="reasoning-content">
          <div class="reasoning-text">${this.escapeHtml(fullText)}</div>
        </div>
      </div>
    `;
  }

  updateHeaderForList() {
    const header = document.querySelector('.header');
    if (!header) return;

    header.innerHTML = `
      <div class="header-left">
        <h1>Agent View</h1>
      </div>
      <div class="header-stats">
        <span class="stat">📊 ${this.sessions.size} 会话</span>
      </div>
    `;
  }

  updateHeaderForSession(session) {
    const header = document.querySelector('.header');
    if (!header) return;

    header.innerHTML = `
      <div class="header-left">
        <a href="#" class="back-link">← 返回列表</a>
      </div>
      <div class="header-stats">
        <span class="stat">💬 ${session.stats.message_count} 消息</span>
        <span class="stat">💰 $${session.stats.total_cost.toFixed(4)}</span>
      </div>
    `;
  }

  handleSearch(query) {
    const sessionList = document.getElementById('session-list');
    if (!sessionList) return;

    const cards = sessionList.querySelectorAll('.session-card');
    const lowerQuery = query.toLowerCase();

    cards.forEach(card => {
      const title = card.querySelector('.session-card-title').textContent.toLowerCase();
      if (title.includes(lowerQuery)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  }

  getToolIcon(tool) {
    const icons = {
      'bash': '⚡',
      'read': '📄',
      'edit': '✏️',
      'write': '📝',
      'glob': '🔍',
      'grep': '🔎',
      'bash:12': '⚡',
      'default': '🔧'
    };
    return icons[tool] || icons['default'];
  }

  renderMarkdown(text) {
    if (!text) return '';
    
    // Simple markdown-like rendering
    let html = this.escapeHtml(text);
    
    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }

  formatTokens(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const viz = new OpenCodeViz();
  viz.init();
});
