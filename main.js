// DeepSeek macOS desktop client - main process
const { app, BrowserWindow, Tray, Menu, nativeImage, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const HOME_URL = 'https://chat.deepseek.com';
const stateFile = path.join(app.getPath('userData'), 'window-state.json');

let mainWindow = null;
let tray = null;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(bounds) {
  try {
    fs.writeFileSync(stateFile, JSON.stringify(bounds));
  } catch (e) {
    console.error('save window state failed:', e);
  }
}

function createWindow() {
  const state = loadState();
  const iconPath = path.join(__dirname, 'assets', 'icon.icns');

  mainWindow = new BrowserWindow({
    width: state.width || 1200,
    height: state.height || 800,
    x: state.x,
    y: state.y,
    minWidth: 480,
    minHeight: 640,
    icon: iconPath,
    show: false,
    title: 'DeepSeek',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
    },
  });

  // Strip Electron token from UA so the site renders as in Chrome
  mainWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  );

  // Focus the chat input whenever the window becomes visible or gains focus
  mainWindow.on('show', () => focusInput());
  mainWindow.on('focus', () => focusInput());

  // Also retry every second as long as the window exists — handles SPA rendering
  // delays and page navigation/redirects.
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) focusInput();
  }, 1000);

  // Periodically try to focus the input; robust against page navigation/redirects.
  mainWindow.webContents.on('did-finish-load', () => focusInput());
  mainWindow.webContents.on('did-navigate', () => focusInput());
  mainWindow.webContents.on('did-navigate-in-page', () => focusInput());

  // Map Cmd+N to Cmd+J (the site's "new chat" shortcut).
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isPlainMeta = input.meta && !input.control && !input.alt && !input.shift;
    if (isPlainMeta && input.type === 'keyDown' && input.key.toLowerCase() === 'n') {
      event.preventDefault();
      for (const type of ['keyDown', 'keyUp']) {
        mainWindow.webContents.sendInputEvent({
          type,
          keyCode: 'j',
          modifiers: ['meta'],
        });
      }
    }
  });

  mainWindow.loadURL(HOME_URL);

  // Open external links in the system default browser; keep same-origin
  // popups (login OAuth) as real child windows so window.opener works.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isSameOrigin(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Prevent the main window from navigating away to external sites.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isSameOrigin(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    createTray();
  });

  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      saveState(bounds);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function isSameOrigin(url) {
  try {
    const target = new URL(url);
    const home = new URL(HOME_URL);
    return target.origin === home.origin;
  } catch {
    return false;
  }
}

// Try to focus the visible input (chat textarea / login input) inside the page.
function focusInput() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.executeJavaScript(`
    (function() {
      // Never steal focus from a focused element (e.g. an open "..." menu
      // button), otherwise the popover closes immediately.
      var active = document.activeElement;
      if (active && active !== document.body) return false;

      var selectors = [
        'textarea[placeholder*="发消息"]',
        'textarea[placeholder*="Message"]',
        'textarea',
        'div[contenteditable="true"]',
        '[role="textbox"]',
        'input.ds-input__input',
        'input[type="text"]',
        'input[type="email"]',
        'input[type="password"]'
      ];
      for (var i = 0; i < selectors.length; i++) {
        var els = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < els.length; j++) {
          var el = els[j];
          var r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            el.focus();
            return true;
          }
        }
      }
      return false;
    })();
  `).then(r => {
    if (r) console.log('[focus] focused');
  }).catch(() => {});
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.icns');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  trayIcon.setTemplateImage(true);

  tray = new Tray(trayIcon);
  tray.setToolTip('DeepSeek');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示 / 隐藏窗口', click: toggleWindow },
    { type: 'separator' },
    { label: '清除登录状态', click: clearLoginState },
    { type: 'separator' },
    { label: '退出', role: 'quit' },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', toggleWindow);
}

function toggleWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
      focusInput();
    }
  }
}

async function clearLoginState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const ses = session.defaultSession;
  try {
    await ses.clearStorageData({ origin: HOME_URL });
    await ses.clearCache();

    const cookies = await ses.cookies.get({ url: HOME_URL });
    for (const cookie of cookies) {
      await ses.cookies.remove(HOME_URL, cookie.name);
    }
  } catch (e) {
    console.error('clear login state failed:', e);
  }

  mainWindow.loadURL(HOME_URL);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    focusInput();
  } else {
    createWindow();
  }
});
