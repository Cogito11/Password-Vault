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
// macOS is intentionally left out since that build isn't available yet, so there's
// nothing to recommend even if we detect a Mac.
function detectOS() {
  const ua = navigator.userAgent || '';
  if (/Win/i.test(ua)) return 'windows';
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

function setDownloadButtons(card, os, releaseAssets, version) {
  const installerBtn = card.querySelector('[data-type="installer"]');
  const portableBtn = card.querySelector('[data-type="portable"]');
  const otherBtn = card.querySelector('[data-type="package"]');
  
  // Installer (Windows .exe or Linux .deb)
  if (installerBtn && releaseAssets) {
    const asset = matchAsset(releaseAssets, os, installerBtn.dataset.pattern);
    if (asset) {
      installerBtn.href = asset.browser_download_url;
      const sub = installerBtn.querySelector('.btn-sub');
      if (sub) {
        const sizeMb = (asset.size / (1024 * 1024)).toFixed(1);
        sub.textContent = `Version ${version} • ${sizeMb} MB`;
      }
    } else {
      installerBtn.setAttribute('disabled', 'true');
    }
  }

  // Portable (Windows portable exe or Linux AppImage)
  if (portableBtn && releaseAssets) {
    const asset = matchAsset(releaseAssets, os, portableBtn.dataset.pattern);
    if (asset) {
      portableBtn.href = asset.browser_download_url;
      const sub = portableBtn.querySelector('.btn-sub');
      if (sub) {
        const sizeMb = asset.size ? ` · ${(asset.size / (1024 * 1024)).toFixed(1)} MB` : '';
        sub.textContent = `Version ${version} • ${sizeMb} MB`;
      }
    } else {
      portableBtn.setAttribute('disabled', 'true');
    }
  }

  // Other packages (Linux only)
  if (otherBtn && releaseAssets) {
    const asset = matchAsset(releaseAssets, os, otherBtn.dataset.pattern);
    if (asset) {
      otherBtn.href = asset.browser_download_url;
      const sub = otherBtn.querySelector('.btn-sub');
      if (sub) {
        const sizeMb = asset.size ? ` · ${(asset.size / (1024 * 1024)).toFixed(1)} MB` : '';
        sub.textContent = asset.name + sizeMb;
      }
    } else {
      otherBtn.setAttribute('disabled', 'true');
    }
  }
}

fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
  .then((res) => {
    if (!res.ok) throw new Error('No releases yet');
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

    ['windows', 'linux'].forEach((os) => {
        const card = document.querySelector(`.download-card[data-os="${os}"]`);
        if (!card) return;

        setDownloadButtons(card, os, assets, version);
    });
  })
  .catch(() => {
    if (metaEl) metaEl.textContent = 'No published release yet — build it from source below, or check back soon.';
  });
