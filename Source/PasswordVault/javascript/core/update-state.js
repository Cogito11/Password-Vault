// ═══════════════════════════════
// CORE / UPDATE STATE - what the Settings "Updates" row should show
// Pure: takes a state, returns labels and visibility, touches no DOM.
// settings.js applies the result; tests/update-state.test.js covers every state.
// ═══════════════════════════════

// state: {
//   status:     'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'error'
//   inPlace:    true when this install can update itself (the app downloads and installs the update);
//               false when it can't (portable build, macOS, ...) and the person is sent to the website
//   version:    the newer version, when there is one
//   current:    the running version
//   percent:    download progress, 0-100
//   reason:     why the website flow's check failed: 'no-release' | 'rate-limited' | anything else
//   message:    why an in-place step failed, already worded for people
//   errorPhase: which in-place step failed: 'check' | 'download' | 'install'
// }
//
// Returns the three controls in the row plus the line of hint text under them:
//   check   - the "Check for update" button
//   install - the in-place action button ("Download v1.4.0", then "Restart to update")
//   website - the link to the download page, used only when the install can't update itself
function describeUpdateState(state) {
	var status = state.status;
	var v = state.version || '';
	var inPlace = !!state.inPlace;
	var percent = state.percent || 0;
	var failedStep = inPlace && state.message ? state.errorPhase : null;

	var checkLabel = {
		idle: 'Check for update',
		checking: 'Checking…',
		current: 'Up to date',
		available: 'Check for update',
		error: 'Check failed'
	}[status] || 'Check for update';

	var hint;

	if (status === 'checking') hint = 'Checking for updates…';
	else if (status === 'current') hint = 'You\'re on the latest version (v' + state.current + ').';
	else if (status === 'available') {
		hint = failedStep === 'download'
			? 'The update couldn\'t be downloaded: ' + state.message
			: 'A newer version (v' + v + ') is available.';
	}
	else if (status === 'downloading') hint = 'Downloading v' + v + '… ' + percent + '%';
	else if (status === 'downloaded') {
		hint = failedStep === 'install'
			? 'The update couldn\'t be installed: ' + state.message
			: 'v' + v + ' is ready to install. Password Vault will restart, and any unlocked books will be locked again.';
	}
	else if (status === 'error') {
		if (inPlace) hint = state.message || 'Couldn\'t check for updates right now.';
		else if (state.reason === 'no-release') hint = 'No published release found on GitHub.';
		else if (state.reason === 'rate-limited') hint = 'GitHub\'s API rate limit was hit. Try again in a few minutes.';
		else hint = 'Couldn\'t check for updates right now.';
	}
	else hint = '';

	// Only one of the three controls is the "next step" at a time
	var installStep = inPlace && (status === 'available' || status === 'downloaded');
	var websiteStep = !inPlace && status === 'available';

	return {
		check: {
			label: checkLabel,
			hidden: installStep || websiteStep || (inPlace && status === 'downloading'),
			disabled: status === 'checking'
		},
		install: {
			hidden: !installStep,
			label: status === 'downloaded'
				? (failedStep === 'install' ? 'Try again' : 'Restart to update')
				: (failedStep === 'download' ? 'Retry download' : 'Download v' + v)
		},
		website: {
			hidden: !websiteStep,
			label: 'Download v' + v
		},
		hint: hint
	};
}
