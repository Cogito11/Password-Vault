// ===== FAQ accordion =====
document.querySelectorAll('.faq-question').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    if (!item) return;
    const isOpen = item.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });
});

// ===== Tree disclosure (organization demo) =====
document.querySelectorAll('.tree-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    if (target) target.hidden = expanded;
  });
});

// ===== Scroll reveal =====
const revealEls = document.querySelectorAll('.section');
revealEls.forEach((el) => el.classList.add('reveal'));

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('in'));
}

// ===== OS detection =====
function detectOS() {
  const ua = navigator.userAgent || '';
  if (/Win/i.test(ua)) return 'windows';
  if (/Mac/i.test(ua) && !/(iPhone|iPod)/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux';
  return null;
}

const currentOS = detectOS();

if (currentOS) {
    const card = document.querySelector(`.download-card[data-os="${currentOS}"]`);

    if (card) {
        card.classList.add("recommended");

        const label = card.querySelector(".recommended-label");
        if (label) {
            label.hidden = false;
        }
    }
}

// ===== Pull latest release info + asset links from GitHub =====
const REPO = 'Cogito11/Password-Vault';
const metaEl = document.getElementById('releaseMeta');

function matchAsset(assets, pattern) {
    const regex = new RegExp(pattern, "i");
    return assets.find(asset => regex.test(asset.name));
}

// Windows ships two .exe files with no fixed naming convention, so instead of
// relying purely on each button's own pattern, resolve them together: whichever
// .exe matches "setup" is the installer, and any other .exe is the portable build.
function resolveWindowsAssets(assets) {
  const exeAssets = assets.filter((a) => /\.exe$/i.test(a.name));
  const installer = exeAssets.find((a) => /setup/i.test(a.name)) || null;
  const portable = exeAssets.find((a) => a !== installer) || null;
  return { installer, portable };
}

function setDownloadButtons(card, releaseAssets, version) {
  const releasesUrl = 'https://github.com/Cogito11/Password-Vault/releases';
  const isWindows = card.dataset.os === 'windows';
  const winAssets = isWindows ? resolveWindowsAssets(releaseAssets || []) : null;

  // Wire up a single download button. For Windows, the installer/portable asset was
  // already resolved above; for everything else, fall back to the button's own
  // data-pattern. If nothing matches (e.g. a release without that asset type), fall
  // back to the releases page rather than disabling the button, so it's never a dead end.
  function wireBtn(btn) {
    if (!btn || !releaseAssets) return;

    const asset = isWindows
      ? (btn.dataset.type === 'installer' ? winAssets.installer : winAssets.portable)
      : matchAsset(releaseAssets, btn.dataset.pattern);

    if (asset) {
      btn.href = asset.browser_download_url;
      btn.removeAttribute('aria-disabled');
      btn.classList.remove('btn-disabled');
      const sub = btn.querySelector('.btn-sub');
      if (sub) {
        const sizeMb = asset.size ? (asset.size / (1024 * 1024)).toFixed(1) : null;
        const sizeStr = sizeMb ? ` · ${sizeMb} MB` : '';
        // "package" buttons (e.g. .rpm) show the raw filename; others show the version
        sub.textContent = btn.dataset.type === 'package'
          ? asset.name + sizeStr
          : `Version ${version}${sizeStr}`;
      }
    } else {
      btn.href = releasesUrl;
      btn.target = '_blank';
      btn.rel = 'noopener';
      const sub = btn.querySelector('.btn-sub');
      if (sub) sub.textContent = 'Not in this release · see all releases';
    }
  }

  wireBtn(card.querySelector('[data-type="installer"]'));
  wireBtn(card.querySelector('[data-type="portable"]'));
  wireBtn(card.querySelector('[data-type="package"]'));
}

fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
  .then((res) => {
    if (res.status === 404) {
      const err = new Error('No releases published yet');
      err.type = 'no-release';
      throw err;
    }
    if (res.status === 403 || res.status === 429) {
      const err = new Error(`GitHub API rate limit hit (status ${res.status})`);
      err.type = 'rate-limited';
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`GitHub API returned status ${res.status}`);
      err.type = 'api-error';
      throw err;
    }
    return res.json();
  })
  .then((release) => {
    const tag = release.tag_name || '';
    const date = release.published_at ? new Date(release.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    if (metaEl) {
      metaEl.textContent = tag ? `Latest release: ${tag}${date ? ' · ' + date : ''}` : 'Pick the build for your platform below.';
    }

    const assets = release.assets || [];
    
    const version = (release.tag_name || '').replace(/^v/, '');

    ['windows', 'linux', 'mac'].forEach((os) => {
        const card = document.querySelector(`.download-card[data-os="${os}"]`);
        if (!card) return;

        setDownloadButtons(card, assets, version);
    });
  })
  .catch((err) => {
    console.error('Failed to load latest release:', err);

    if (!metaEl) return;

    // A genuine network failure (offline, DNS, CORS, blocked request) throws
    // a TypeError from fetch itself rather than reaching the .then() above.
    const isNetworkError = err instanceof TypeError;

    if (isNetworkError) {
      metaEl.textContent = "Couldn't reach GitHub, check your connection and refresh, or build from source below.";
    } else if (err.type === 'rate-limited') {
      metaEl.textContent = 'GitHub is rate-limiting requests right now, try refreshing shortly, or build from source below.';
    } else if (err.type === 'no-release') {
      metaEl.textContent = 'No published release yet, build it from source below, or check back soon.';
    } else {
      metaEl.textContent = 'Could not load release info, build it from source below, or check back soon.';
    }
  });
