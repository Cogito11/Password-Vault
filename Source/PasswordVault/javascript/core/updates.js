// ═══════════════════════════════
// CORE / UPDATES - check GitHub for a newer published release
// Used by the "Check for update" button in Settings.
// ═══════════════════════════════

// Single source of truth for "which repo" and "where to send people to download"
var APP_REPO_SLUG = 'Cogito11/Password-Vault';
var APP_DOWNLOAD_URL = 'https://cogito11.github.io/Password-Vault/#download';

// Plain dot-separated numeric comparison (1.2.10 > 1.2.9, etc.). Good enough
// for this app's vX.Y.Z tag scheme without pulling in a semver library.
// Returns false when either version is missing or the current version isn't
// numeric (ex: "unknown"), so we never claim an update we can't verify.
function isNewerVersion(latest, current) {
	if (!latest || !current) return false;
	if (!/^\d/.test(String(current)) || !/^\d/.test(String(latest))) return false;

	var toParts = function (v) {
		return String(v).split('.').map(function (p) { return parseInt(p, 10) || 0; });
	};

	var a = toParts(latest);
	var b = toParts(current);

	for (var i = 0; i < Math.max(a.length, b.length); i++) {
		var x = a[i] || 0;
		var y = b[i] || 0;
		if (x !== y) return x > y;
	}

	return false;
}

// Fetch the latest published (non-draft, non-prerelease) release from GitHub.
// Throws an Error whose message is one of:
//   'no-release'   - the repo has no published release yet
//   'rate-limited' - GitHub's unauthenticated API limit was hit
//   'fetch-failed' - anything else (offline, server error, bad response)
// so callers can show a specific message instead of a generic failure.
async function fetchLatestRelease() {
	var res;

	try {
		res = await fetch('https://api.github.com/repos/' + APP_REPO_SLUG + '/releases/latest');
	} catch (err) {
		throw new Error('fetch-failed');
	}

	if (res.status === 404) throw new Error('no-release');

	if (res.status === 403 || res.status === 429) {
		var remaining = res.headers && res.headers.get('X-RateLimit-Remaining');
		throw new Error(remaining === '0' || res.status === 429 ? 'rate-limited' : 'fetch-failed');
	}

	if (!res.ok) throw new Error('fetch-failed');

	var release;

	try {
		release = await res.json();
	} catch (err) {
		throw new Error('fetch-failed');
	}

	return {
		version: String(release.tag_name || '').replace(/^v/, ''),
		publishedAt: release.published_at || null
	};
}

// Reports whether the latest published release is newer than currentVersion.
// Throws on failure (see fetchLatestRelease), callers decide how to show it.
async function checkForUpdate(currentVersion) {
	var release = await fetchLatestRelease();

	return {
		hasUpdate: isNewerVersion(release.version, currentVersion),
		latestVersion: release.version,
		publishedAt: release.publishedAt
	};
}
