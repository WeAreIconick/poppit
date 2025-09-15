/**
 * Frontend JavaScript for Advanced Pop-up Maker
 * Handles popup triggers, display logic, and user interactions
 */

class Poppit {
	constructor() {
		this.popups = [];
		this.isReady = false;
		this.visitorType = this.getVisitorType();
		this.deviceType = this.getDeviceType();
		this.triggeredPopups = new Set();
		this.scrollDepths = new Map();
		this.timers = new Map(); // Track active timers
		this.sessionShownPopups = new Set(); // Track popups shown in current session
		this.debugMode = window.location.search.includes('poppit-debug=1');
		this.testMode = window.location.search.includes('poppit-test=1');
		
		this.init();
	}

	init() {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => this.onReady());
		} else {
			this.onReady();
		}
	}

	onReady() {
		this.debug('Poppit initialized');
		this.isReady = true;
		this.findPopups();
		this.setupEventListeners();
		// Small delay to ensure all DOM elements are ready
		setTimeout(() => {
			this.processPopups();
		}, 100);
	}

	findPopups() {
		const popupBlocks = document.querySelectorAll('[data-popup-id]');
		this.debug(`Found ${popupBlocks.length} popup blocks`);
		
		popupBlocks.forEach((block, index) => {
			const popupData = this.extractPopupData(block);
			if (popupData && this.shouldShowPopup(popupData)) {
				this.popups.push(popupData);
				this.debug(`Added popup ${popupData.id} to queue (${index + 1}/${popupBlocks.length})`);
			} else {
				this.debug(`Skipped popup ${popupData?.id || 'unknown'} due to targeting rules or previous display`);
			}
		});
		
		this.debug(`Total popups in queue: ${this.popups.length}`);
	}

	extractPopupData(block) {
		try {
			const data = {
				id: block.dataset.popupId,
				type: block.dataset.popupType || 'modal',
				triggerType: block.dataset.triggerType || 'time',
				triggerDelay: parseInt(block.dataset.triggerDelay) || 3,
				scrollDepth: parseInt(block.dataset.scrollDepth) || 50,
				exitIntent: block.dataset.exitIntent === 'true',
				targeting: JSON.parse(block.dataset.targeting || '{"devices":["desktop","tablet","mobile"],"userType":"all"}'),
				allowReset: block.dataset.allowReset === 'true',
				resetDelay: parseInt(block.dataset.resetDelay) || 60,
				element: block,
				shown: false,
				timestamp: Date.now() // Add timestamp for debugging
			};
			
			return data;
		} catch (error) {
			console.warn('Error parsing popup data:', error);
			return null;
		}
	}

	shouldShowPopup(popup) {
		// Check device targeting
		if (!popup.targeting.devices.includes(this.deviceType)) {
			this.debug(`Popup ${popup.id} filtered out by device targeting`);
			return false;
		}

		// Check visitor type targeting
		if (popup.targeting.userType !== 'all' && popup.targeting.userType !== this.visitorType) {
			this.debug(`Popup ${popup.id} filtered out by visitor type targeting`);
			return false;
		}

		// In test mode, always show popups
		if (this.testMode) {
			this.debug(`Test mode enabled - popup ${popup.id} will be shown`);
			return true;
		}

		// Check if popup was already shown in current session
		if (this.sessionShownPopups.has(popup.id)) {
			this.debug(`Popup ${popup.id} already shown in current session`);
			return false;
		}

		// Check if popup was already shown with reset logic
		return this.checkPopupResetStatus(popup);
	}

	checkPopupResetStatus(popup) {
		const storageKey = `poppit_${popup.id}`;
		const storedData = localStorage.getItem(storageKey);
		
		if (!storedData) {
			// Never shown before
			this.debug(`Popup ${popup.id} never shown before`);
			return true;
		}
		
		try {
			const data = JSON.parse(storedData);
			const lastShown = new Date(data.lastShown);
			const now = new Date();
			
			// If reset is not allowed, never show again
			if (!popup.allowReset) {
				this.debug(`Popup ${popup.id} already shown and reset not allowed`);
				return false;
			}
			
			// Calculate time since last shown
			const minutesSinceLastShown = (now - lastShown) / (1000 * 60);
			const resetDelayMinutes = popup.resetDelay;
			
			if (minutesSinceLastShown >= resetDelayMinutes) {
				this.debug(`Popup ${popup.id} reset period expired (${Math.round(minutesSinceLastShown)}/${resetDelayMinutes} minutes)`);
				return true;
			} else {
				this.debug(`Popup ${popup.id} still in reset cooldown (${Math.round(minutesSinceLastShown)}/${resetDelayMinutes} minutes)`);
				return false;
			}
			
		} catch (error) {
			console.warn('Error parsing popup reset data:', error);
			// If data is corrupted, allow showing
			return true;
		}
	}

	processPopups() {
		this.debug('Processing popup triggers...');
		
		this.popups.forEach(popup => {
			this.debug(`Setting up trigger for popup ${popup.id}: ${popup.triggerType}`);
			
			// Clear any existing setup for this popup
			this.clearPopupTriggers(popup.id);
			
			switch (popup.triggerType) {
				case 'time':
					this.setupTimeBasedTrigger(popup);
					break;
				case 'scroll':
					this.setupScrollTrigger(popup);
					break;
				case 'exit':
					this.setupExitIntentTrigger(popup);
					break;
				case 'load':
					// Add small delay even for immediate triggers to avoid race conditions
					setTimeout(() => this.showPopup(popup), 100);
					break;
			}
		});
	}

	clearPopupTriggers(popupId) {
		// Clear any existing timer
		if (this.timers.has(popupId)) {
			clearTimeout(this.timers.get(popupId));
			this.timers.delete(popupId);
			this.debug(`Cleared existing timer for popup ${popupId}`);
		}
		
		// Remove from triggered set
		this.triggeredPopups.delete(popupId);
		
		// Clear scroll depth tracking
		this.scrollDepths.delete(popupId);
	}

	setupTimeBasedTrigger(popup) {
		const delay = Math.max(popup.triggerDelay * 1000, 100); // Minimum 100ms delay
		this.debug(`Setting timer for popup ${popup.id}: ${delay}ms`);
		
		const timerId = setTimeout(() => {
			this.debug(`Timer fired for popup ${popup.id}`);
			if (!this.triggeredPopups.has(popup.id)) {
				this.showPopup(popup);
			} else {
				this.debug(`Popup ${popup.id} was already triggered`);
			}
			// Clean up timer reference
			this.timers.delete(popup.id);
		}, delay);
		
		this.timers.set(popup.id, timerId);
		this.debug(`Timer set for popup ${popup.id} with ID ${timerId}`);
	}

	setupScrollTrigger(popup) {
		this.scrollDepths.set(popup.id, {
			popup,
			targetDepth: popup.scrollDepth,
			triggered: false
		});
		this.debug(`Scroll trigger set for popup ${popup.id} at ${popup.scrollDepth}%`);
	}

	setupExitIntentTrigger(popup) {
		let exitIntentFired = false;
		
		const handleMouseLeave = (e) => {
			if (exitIntentFired || this.triggeredPopups.has(popup.id)) return;
			
			// Check if mouse is leaving from the top of the viewport
			if (e.clientY <= 0 || (e.relatedTarget === null && e.target === document.documentElement)) {
				exitIntentFired = true;
				this.debug(`Exit intent triggered for popup ${popup.id}`);
				this.showPopup(popup);
				document.removeEventListener('mouseleave', handleMouseLeave);
				document.removeEventListener('mousemove', handleMouseMove);
			}
		};

		// Also listen for mouse movements near the top edge
		let lastMouseY = 0;
		const handleMouseMove = (e) => {
			if (exitIntentFired || this.triggeredPopups.has(popup.id)) return;
			
			// Detect rapid upward movement towards browser controls
			if (e.clientY < 100 && lastMouseY > e.clientY + 50) {
				exitIntentFired = true;
				this.debug(`Exit intent triggered via mouse movement for popup ${popup.id}`);
				this.showPopup(popup);
				document.removeEventListener('mouseleave', handleMouseLeave);
				document.removeEventListener('mousemove', handleMouseMove);
			}
			lastMouseY = e.clientY;
		};

		document.addEventListener('mouseleave', handleMouseLeave);
		document.addEventListener('mousemove', handleMouseMove);
		this.debug(`Exit intent listener set for popup ${popup.id}`);
	}

	setupEventListeners() {
		// Scroll listener for scroll-based triggers
		let scrollTimeout;
		window.addEventListener('scroll', () => {
			clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(() => {
				this.handleScroll();
			}, 100);
		});

		// Close popup listeners
		document.addEventListener('click', (e) => {
			if (e.target.classList.contains('popup-close') || 
				(e.target.classList.contains('popup-overlay') && e.target === e.currentTarget)) {
				this.closePopup(e.target.closest('.popup-overlay'));
			}
		});

		// Escape key listener
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				this.closeAllPopups();
			}
		});

		// Form submission listener
		document.addEventListener('submit', (e) => {
			if (e.target.classList.contains('popup-email-form')) {
				e.preventDefault();
				this.handleEmailSubmission(e.target);
			}
		});
	}

	handleScroll() {
		const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
		
		this.scrollDepths.forEach((data, popupId) => {
			if (!data.triggered && !this.triggeredPopups.has(popupId) && scrollPercent >= data.targetDepth) {
				data.triggered = true;
				this.debug(`Scroll trigger activated for popup ${popupId} at ${Math.round(scrollPercent)}%`);
				this.showPopup(data.popup);
				this.scrollDepths.delete(popupId);
			}
		});
	}

	showPopup(popup) {
		if (popup.shown || this.triggeredPopups.has(popup.id)) {
			this.debug(`Popup ${popup.id} already shown or triggered`);
			return;
		}

		this.debug(`Showing popup ${popup.id}`);
		this.triggeredPopups.add(popup.id);
		this.sessionShownPopups.add(popup.id);
		popup.shown = true;

		// Clear any pending timer for this popup
		if (this.timers.has(popup.id)) {
			clearTimeout(this.timers.get(popup.id));
			this.timers.delete(popup.id);
		}

		// Create popup HTML
		const popupHTML = this.createPopupHTML(popup);
		document.body.insertAdjacentHTML('beforeend', popupHTML);

		// Trigger animation with proper timing
		const overlay = document.getElementById(`popup-${popup.id}`);
		if (overlay) {
			// Force reflow to ensure the element is rendered
			overlay.offsetHeight;
			
			// Use requestAnimationFrame for smooth animation
			requestAnimationFrame(() => {
				overlay.classList.add('popup-active');
				this.debug(`Popup ${popup.id} animation started`);
			});
		} else {
			this.debug(`Error: Could not find overlay for popup ${popup.id}`);
		}

		// Track display event
		this.trackEvent(popup.id, 'display');

		// Store in localStorage with timestamp (only in non-test mode)
		if (!this.testMode) {
			const storageKey = `poppit_${popup.id}`;
			const data = {
				lastShown: new Date().toISOString(),
				showCount: this.getShowCount(popup.id) + 1
			};
			localStorage.setItem(storageKey, JSON.stringify(data));
			this.debug(`Popup ${popup.id} stored with reset data`);
		}
		this.debug(`Popup ${popup.id} marked as shown`);
	}

	getShowCount(popupId) {
		const storageKey = `poppit_${popupId}`;
		const storedData = localStorage.getItem(storageKey);
		
		if (storedData) {
			try {
				const data = JSON.parse(storedData);
				return data.showCount || 0;
			} catch (error) {
				return 0;
			}
		}
		
		return 0;
	}

	createPopupHTML(popup) {
		const element = popup.element;
		const title = element.querySelector('.popup-title')?.innerHTML || '';
		const content = element.querySelector('.popup-text')?.innerHTML || '';
		const emailEnabled = element.dataset.emailEnabled === 'true';
		const emailPlaceholder = element.dataset.emailPlaceholder || 'Enter your email';
		const buttonText = element.dataset.buttonText || 'Subscribe';
		const showCloseButton = element.dataset.showCloseButton !== 'false';
		const overlayOpacity = element.dataset.overlayOpacity || '0.8';
		const animation = element.dataset.animation || 'fadeIn';

		return `
			<div class="popup-overlay animation-${animation}" id="popup-${popup.id}" style="background: rgba(0, 0, 0, ${overlayOpacity})">
				<div class="popup-container popup-${popup.type}">
					${showCloseButton ? '<button class="popup-close" aria-label="Close">×</button>' : ''}
					<div class="popup-content">
						${title ? `<h3 class="popup-title">${title}</h3>` : ''}
						${content ? `<div class="popup-text">${content}</div>` : ''}
						${emailEnabled ? `
							<form class="popup-email-form" data-popup-id="${popup.id}">
								<input type="email" class="popup-email-input" placeholder="${emailPlaceholder}" required>
								<button type="submit" class="popup-submit-btn">${buttonText}</button>
							</form>
						` : ''}
					</div>
				</div>
			</div>
		`;
	}

	closePopup(overlay) {
		if (!overlay) return;

		overlay.classList.remove('popup-active');
		
		setTimeout(() => {
			if (overlay.parentNode) {
				overlay.remove();
			}
		}, 300);

		const popupId = overlay.id.replace('popup-', '');
		this.trackEvent(popupId, 'close');
		this.debug(`Popup ${popupId} closed`);
	}

	closeAllPopups() {
		const activePopups = document.querySelectorAll('.popup-overlay.popup-active');
		activePopups.forEach(popup => this.closePopup(popup));
		this.debug(`Closed ${activePopups.length} active popups`);
	}

	handleEmailSubmission(form) {
		const email = form.querySelector('input[type="email"]').value;
		const popupId = form.dataset.popupId;
		const submitBtn = form.querySelector('.popup-submit-btn');
		
		// Disable button and show loading state
		submitBtn.disabled = true;
		submitBtn.textContent = 'Submitting...';

		// Submit email
		if (typeof popupMakerAjax !== 'undefined') {
			fetch(popupMakerAjax.ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					action: 'popup_maker_email',
					nonce: popupMakerAjax.nonce,
					email: email,
					popup_id: popupId,
					page_url: window.location.href
				})
			})
			.then(response => response.json())
			.then(data => {
				if (data.success) {
					// Show success message
					form.innerHTML = '<div class="popup-success">Thank you for subscribing!</div>';
					this.trackEvent(popupId, 'email_submit');
					
					// Auto-close after success
					setTimeout(() => {
						this.closePopup(document.getElementById(`popup-${popupId}`));
					}, 2000);
				} else {
					throw new Error(data.data || 'Submission failed');
				}
			})
			.catch(error => {
				console.error('Email submission error:', error);
				submitBtn.disabled = false;
				submitBtn.textContent = 'Try Again';
				
				// Show error message
				const errorDiv = document.createElement('div');
				errorDiv.className = 'popup-error';
				errorDiv.textContent = 'Something went wrong. Please try again.';
				form.appendChild(errorDiv);
			});
		} else {
			// Fallback if AJAX is not available
			console.log('Email submitted:', email);
			form.innerHTML = '<div class="popup-success">Thank you for subscribing!</div>';
			setTimeout(() => {
				this.closePopup(document.getElementById(`popup-${popupId}`));
			}, 2000);
		}
	}

	trackEvent(popupId, eventType) {
		if (typeof popupMakerAjax !== 'undefined') {
			fetch(popupMakerAjax.ajaxurl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					action: 'popup_maker_track',
					nonce: popupMakerAjax.nonce,
					popup_id: popupId,
					event_type: eventType,
					page_url: window.location.href
				})
			}).catch(error => {
				console.warn('Analytics tracking failed:', error);
			});
		}
	}

	debug(message) {
		if (this.debugMode) {
			console.log(`[Poppit Debug] ${message}`);
		}
	}

	getVisitorType() {
		const visited = localStorage.getItem('poppit_visited');
		if (visited) {
			return 'returning';
		} else {
			localStorage.setItem('poppit_visited', 'true');
			return 'new';
		}
	}

	getDeviceType() {
		const width = window.innerWidth;
		if (width <= 768) return 'mobile';
		if (width <= 1024) return 'tablet';
		return 'desktop';
	}

	// Method to manually reset popup display (for testing)
	resetPopupDisplay(popupId) {
		if (popupId) {
			// Reset localStorage for specific popup
			const storageKey = `poppit_${popupId}`;
			localStorage.removeItem(storageKey);
			
			// Reset session tracking
			this.sessionShownPopups.delete(popupId);
			this.triggeredPopups.delete(popupId);
			
			// Clear any active timers or triggers
			this.clearPopupTriggers(popupId);
			
			this.debug(`Reset display status for popup ${popupId}`);
		} else {
			// Reset all popups
			const keys = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key.startsWith('poppit_')) {
					keys.push(key);
				}
			}
			keys.forEach(key => localStorage.removeItem(key));
			
			this.sessionShownPopups.clear();
			this.triggeredPopups.clear();
			
			// Clear all timers
			this.timers.forEach((timerId) => {
				clearTimeout(timerId);
			});
			this.timers.clear();
			this.scrollDepths.clear();
			
			this.debug('Reset all popup display statuses');
		}
	}

	// Method to reprocess popups (useful for testing)
	reprocessPopups() {
		this.debug('Reprocessing popups...');
		
		// Clear existing state
		this.popups = [];
		
		// Re-find and process popups
		this.findPopups();
		this.processPopups();
	}

	// Method to get popup status for debugging
	getPopupStatus(popupId) {
		const storageKey = `poppit_${popupId}`;
		const storedData = localStorage.getItem(storageKey);
		
		const status = {
			popupId: popupId,
			shownInSession: this.sessionShownPopups.has(popupId),
			triggered: this.triggeredPopups.has(popupId),
			hasActiveTimer: this.timers.has(popupId),
			storedData: null,
			canShow: false
		};
		
		if (storedData) {
			try {
				status.storedData = JSON.parse(storedData);
				const lastShown = new Date(status.storedData.lastShown);
				const minutesSince = (new Date() - lastShown) / (1000 * 60);
				status.minutesSinceLastShown = Math.round(minutesSince);
			} catch (error) {
				status.storageError = error.message;
			}
		}
		
		// Find the popup configuration to check if it can show
		const popupElement = document.querySelector(`[data-popup-id="${popupId}"]`);
		if (popupElement) {
			const popup = this.extractPopupData(popupElement);
			if (popup) {
				status.canShow = this.shouldShowPopup(popup);
				status.allowReset = popup.allowReset;
				status.resetDelay = popup.resetDelay;
			}
		}
		
		return status;
	}
}

// Initialize when DOM is ready
const poppitInstance = new Poppit();

// Expose instance to global scope for debugging and testing
if (window.location.search.includes('poppit-debug=1') || window.location.search.includes('poppit-test=1')) {
	window.Poppit = poppitInstance;
	console.log('Poppit debug mode enabled. Use window.Poppit to access the instance.');
	console.log('Available methods:');
	console.log('- resetPopupDisplay(popupId) - Reset display status for specific popup or all popups');
	console.log('- reprocessPopups() - Re-scan and setup all popup triggers');
	console.log('- getPopupStatus(popupId) - Get detailed status information for a popup');
	console.log('URL parameters:');
	console.log('- ?poppit-debug=1 (debug mode with console logs)');
	console.log('- ?poppit-test=1 (test mode - ignores localStorage restrictions)');
}