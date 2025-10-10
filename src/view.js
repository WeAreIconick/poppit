/**
 * Frontend JavaScript for Poppit
 * Handles popup triggers, display logic, and user interactions
 * Security-focused implementation with proper error handling
 */

class Poppit {
	constructor() {
		this.popups = [];
		this.isReady = false;
		this.visitorType = this.getVisitorType();
		this.deviceType = this.getDeviceType();
		this.triggeredPopups = new Set();
		this.scrollDepths = new Map();
		this.timers = new Map();
		this.sessionShownPopups = new Set();
		this.debugMode = this.getUrlParam('poppit-debug') === '1';
		this.testMode = this.getUrlParam('poppit-test') === '1';
		this.rateLimits = new Map(); // Rate limiting for API calls
		
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
		try {
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
		} catch (error) {
			console.error('Error finding popups:', error);
		}
	}

	extractPopupData(block) {
		try {
			const data = {
				id: this.sanitizeString(block.dataset.popupId || ''),
				type: this.sanitizeString(block.dataset.popupType || 'modal'),
				triggerType: this.sanitizeString(block.dataset.triggerType || 'time'),
				triggerDelay: this.sanitizeNumber(block.dataset.triggerDelay, 3, 0, 300),
				scrollDepth: this.sanitizeNumber(block.dataset.scrollDepth, 50, 0, 100),
				exitIntent: block.dataset.exitIntent === 'true',
				targeting: this.parseJSON(block.dataset.targeting, {devices:['desktop','tablet','mobile'],userType:'all'}),
				allowReset: block.dataset.allowReset === 'true',
				resetDelay: this.sanitizeNumber(block.dataset.resetDelay, 60, 1, 10080), // Max 1 week
				element: block,
				shown: false,
				timestamp: Date.now()
			};
			
			// Validate required ID
			if (!data.id || data.id.length > 50) {
				this.debug('Invalid or missing popup ID');
				return null;
			}
			
			return data;
		} catch (error) {
			console.warn('Error parsing popup data:', error);
			return null;
		}
	}

	// Utility functions for data sanitization
	sanitizeString(str, maxLength = 100) {
		if (typeof str !== 'string') return '';
		return str.trim().substring(0, maxLength);
	}

	sanitizeNumber(value, defaultValue = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
		const num = parseInt(value, 10);
		if (isNaN(num)) return defaultValue;
		return Math.min(Math.max(num, min), max);
	}

	parseJSON(jsonStr, defaultValue = {}) {
		try {
			if (!jsonStr) return defaultValue;
			const parsed = JSON.parse(jsonStr);
			return typeof parsed === 'object' && parsed !== null ? parsed : defaultValue;
		} catch (error) {
			return defaultValue;
		}
	}

	getUrlParam(param) {
		const urlParams = new URLSearchParams(window.location.search);
		return urlParams.get(param);
	}

	shouldShowPopup(popup) {
		try {
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
		} catch (error) {
			console.error('Error in shouldShowPopup:', error);
			return false;
		}
	}

	checkPopupResetStatus(popup) {
		try {
			const storageKey = `poppit_${popup.id}`;
			const storedData = localStorage.getItem(storageKey);
			
			if (!storedData) {
				this.debug(`Popup ${popup.id} never shown before`);
				return true;
			}
			
			const data = this.parseJSON(storedData);
			if (!data.lastShown) return true;
			
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
			return true;
		}
	}

	processPopups() {
		try {
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
						// Add small delay even for immediate triggers
						setTimeout(() => this.showPopup(popup), 100);
						break;
				}
			});
		} catch (error) {
			console.error('Error processing popups:', error);
		}
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
		const delay = Math.max(popup.triggerDelay * 1000, 100);
		this.debug(`Setting timer for popup ${popup.id}: ${delay}ms`);
		
		const timerId = setTimeout(() => {
			this.debug(`Timer fired for popup ${popup.id}`);
			if (!this.triggeredPopups.has(popup.id)) {
				this.showPopup(popup);
			}
			this.timers.delete(popup.id);
		}, delay);
		
		this.timers.set(popup.id, timerId);
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
			
			if (e.clientY <= 0 || (e.relatedTarget === null && e.target === document.documentElement)) {
				exitIntentFired = true;
				this.debug(`Exit intent triggered for popup ${popup.id}`);
				this.showPopup(popup);
				document.removeEventListener('mouseleave', handleMouseLeave);
				document.removeEventListener('mousemove', handleMouseMove);
			}
		};

		let lastMouseY = 0;
		const handleMouseMove = (e) => {
			if (exitIntentFired || this.triggeredPopups.has(popup.id)) return;
			
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
	}

	setupEventListeners() {
		try {
			// Scroll listener with debouncing
			let scrollTimeout;
			window.addEventListener('scroll', () => {
				clearTimeout(scrollTimeout);
				scrollTimeout = setTimeout(() => {
					this.handleScroll();
				}, 100);
			}, { passive: true });

			// Close popup listeners
			document.addEventListener('click', (e) => {
				if (e.target && (e.target.classList.contains('popup-close') || 
					(e.target.classList.contains('popup-overlay') && e.target === e.currentTarget))) {
					e.preventDefault();
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
				if (e.target && e.target.classList.contains('popup-email-form')) {
					e.preventDefault();
					this.handleEmailSubmission(e.target);
				}
			});
		} catch (error) {
			console.error('Error setting up event listeners:', error);
		}
	}

	handleScroll() {
		try {
			const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
			const scrollHeight = document.body.scrollHeight - window.innerHeight;
			const scrollPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
			
			this.scrollDepths.forEach((data, popupId) => {
				if (!data.triggered && !this.triggeredPopups.has(popupId) && scrollPercent >= data.targetDepth) {
					data.triggered = true;
					this.debug(`Scroll trigger activated for popup ${popupId} at ${Math.round(scrollPercent)}%`);
					this.showPopup(data.popup);
					this.scrollDepths.delete(popupId);
				}
			});
		} catch (error) {
			console.error('Error in scroll handler:', error);
		}
	}

	showPopup(popup) {
		try {
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

			// Trigger animation
			const overlay = document.getElementById(`popup-${popup.id}`);
			if (overlay) {
				overlay.offsetHeight; // Force reflow
				requestAnimationFrame(() => {
					overlay.classList.add('popup-active');
				});
			}

			// Track display event
			this.trackEvent(popup.id, 'display');

			// Store in localStorage (only in non-test mode)
			if (!this.testMode) {
				try {
					const storageKey = `poppit_${popup.id}`;
					const data = {
						lastShown: new Date().toISOString(),
						showCount: this.getShowCount(popup.id) + 1
					};
					localStorage.setItem(storageKey, JSON.stringify(data));
				} catch (storageError) {
					console.warn('Failed to save popup data to localStorage:', storageError);
				}
			}
		} catch (error) {
			console.error('Error showing popup:', error);
		}
	}

	getShowCount(popupId) {
		try {
			const storageKey = `poppit_${popupId}`;
			const storedData = localStorage.getItem(storageKey);
			
			if (storedData) {
				const data = this.parseJSON(storedData);
				return data.showCount || 0;
			}
		} catch (error) {
			console.warn('Error getting show count:', error);
		}
		
		return 0;
	}

	createPopupHTML(popup) {
		try {
			const element = popup.element;
			if (!element) return '';
			
			// Sanitize content from DOM
			const titleEl = element.querySelector('.popup-title');
			const contentEl = element.querySelector('.popup-text');
			
			const title = titleEl ? this.sanitizeHTML(titleEl.innerHTML) : '';
			const content = contentEl ? this.sanitizeHTML(contentEl.innerHTML) : '';
			
			// Get sanitized attributes
			const emailEnabled = element.dataset.emailEnabled === 'true';
			const emailPlaceholder = this.sanitizeString(element.dataset.emailPlaceholder || 'Enter your email', 100);
			const buttonText = this.sanitizeString(element.dataset.buttonText || 'Subscribe', 50);
			const showCloseButton = element.dataset.showCloseButton !== 'false';
			const overlayOpacity = this.sanitizeNumber(element.dataset.overlayOpacity * 100, 80, 0, 100) / 100;
			const animation = this.sanitizeString(element.dataset.animation || 'fadeIn', 20);

			return `
				<div class="popup-overlay animation-${animation}" id="popup-${popup.id}" style="background: rgba(0, 0, 0, ${overlayOpacity})">
					<div class="popup-container popup-${popup.type}" role="dialog" aria-modal="true" aria-labelledby="popup-title-${popup.id}">
						${showCloseButton ? `<button class="popup-close" aria-label="Close popup">×</button>` : ''}
						<div class="popup-content">
							${title ? `<h3 class="popup-title" id="popup-title-${popup.id}">${title}</h3>` : ''}
							${content ? `<div class="popup-text">${content}</div>` : ''}
							${emailEnabled ? `
								<form class="popup-email-form" data-popup-id="${popup.id}" novalidate>
									<input type="email" class="popup-email-input" placeholder="${emailPlaceholder}" required autocomplete="email" maxlength="254">
									<button type="submit" class="popup-submit-btn">${buttonText}</button>
								</form>
							` : ''}
						</div>
					</div>
				</div>
			`;
		} catch (error) {
			console.error('Error creating popup HTML:', error);
			return '';
		}
	}

	// Basic HTML sanitization (for display content only)
	sanitizeHTML(html) {
		const div = document.createElement('div');
		div.textContent = html;
		return div.innerHTML;
	}

	closePopup(overlay) {
		try {
			if (!overlay) return;

			overlay.classList.remove('popup-active');
			
			setTimeout(() => {
				if (overlay.parentNode) {
					overlay.remove();
				}
			}, 300);

			const popupId = overlay.id.replace('popup-', '');
			if (popupId) {
				this.trackEvent(popupId, 'close');
				this.debug(`Popup ${popupId} closed`);
			}
		} catch (error) {
			console.error('Error closing popup:', error);
		}
	}

	closeAllPopups() {
		try {
			const activePopups = document.querySelectorAll('.popup-overlay.popup-active');
			activePopups.forEach(popup => this.closePopup(popup));
			this.debug(`Closed ${activePopups.length} active popups`);
		} catch (error) {
			console.error('Error closing all popups:', error);
		}
	}

	handleEmailSubmission(form) {
		try {
			const emailInput = form.querySelector('input[type="email"]');
			const submitBtn = form.querySelector('.popup-submit-btn');
			const popupId = this.sanitizeString(form.dataset.popupId || '');
			
			if (!emailInput || !submitBtn || !popupId) {
				console.error('Missing form elements or popup ID');
				return;
			}
			
			const email = emailInput.value.trim();
			
			// Client-side email validation
			if (!this.isValidEmail(email)) {
				this.showFormError(form, 'Please enter a valid email address.');
				return;
			}
			
			// Rate limiting check
			if (this.isRateLimited('email', popupId)) {
				this.showFormError(form, 'Please wait before submitting again.');
				return;
			}
			
			// Disable button and show loading state
			const originalText = submitBtn.textContent;
			submitBtn.disabled = true;
			submitBtn.textContent = 'Submitting...';
			
			// Clear any existing errors
			this.clearFormError(form);

			// Submit email
			if (typeof poppitAjax !== 'undefined' && poppitAjax.ajaxurl) {
				const formData = new FormData();
				formData.append('action', 'poppit_email');
				formData.append('nonce', poppitAjax.nonce);
				formData.append('email', email);
				formData.append('popup_id', popupId);
				formData.append('page_url', window.location.href);
				
				fetch(poppitAjax.ajaxurl, {
					method: 'POST',
					body: formData,
					credentials: 'same-origin'
				})
				.then(response => {
					if (!response.ok) {
						throw new Error(`HTTP error! status: ${response.status}`);
					}
					return response.json();
				})
				.then(data => {
					if (data && data.success) {
						// Show success message
						form.innerHTML = '<div class="popup-success">Thank you for subscribing!</div>';
						this.trackEvent(popupId, 'email_submit');
						
						// Auto-close after success
						setTimeout(() => {
							this.closePopup(document.getElementById(`popup-${popupId}`));
						}, 2000);
					} else {
						throw new Error(data?.data || 'Submission failed');
					}
				})
				.catch(error => {
					console.error('Email submission error:', error);
					submitBtn.disabled = false;
					submitBtn.textContent = originalText;
					
					this.showFormError(form, 'Something went wrong. Please try again.');
				});
			} else {
				// Fallback if AJAX is not available
				console.log('Email submitted (fallback):', email);
				form.innerHTML = '<div class="popup-success">Thank you for subscribing!</div>';
				setTimeout(() => {
					this.closePopup(document.getElementById(`popup-${popupId}`));
				}, 2000);
			}
		} catch (error) {
			console.error('Error in email submission handler:', error);
		}
	}

	// Email validation
	isValidEmail(email) {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email) && email.length <= 254;
	}

	// Rate limiting
	isRateLimited(action, identifier) {
		const key = `${action}_${identifier}`;
		const now = Date.now();
		const limit = this.rateLimits.get(key);
		
		if (limit && (now - limit.lastAction) < limit.cooldown) {
			return true;
		}
		
		this.rateLimits.set(key, {
			lastAction: now,
			cooldown: 2000 // 2 second cooldown
		});
		
		return false;
	}

	showFormError(form, message) {
		this.clearFormError(form);
		const errorDiv = document.createElement('div');
		errorDiv.className = 'popup-error';
		errorDiv.textContent = message;
		form.appendChild(errorDiv);
	}

	clearFormError(form) {
		const existingError = form.querySelector('.popup-error');
		if (existingError) {
			existingError.remove();
		}
	}

	trackEvent(popupId, eventType) {
		try {
			if (typeof poppitAjax !== 'undefined' && poppitAjax.ajaxurl) {
				// Rate limiting for tracking calls
				if (this.isRateLimited('track', popupId)) {
					return;
				}
				
				const formData = new FormData();
				formData.append('action', 'poppit_track');
				formData.append('nonce', poppitAjax.nonce);
				formData.append('popup_id', popupId);
				formData.append('event_type', eventType);
				formData.append('page_url', window.location.href);
				
				fetch(poppitAjax.ajaxurl, {
					method: 'POST',
					body: formData,
					credentials: 'same-origin'
				}).catch(error => {
					console.warn('Analytics tracking failed:', error);
				});
			}
		} catch (error) {
			console.warn('Error in trackEvent:', error);
		}
	}

	debug(message) {
		if (this.debugMode) {
			console.log(`[Poppit Debug] ${message}`);
		}
	}

	getVisitorType() {
		try {
			const visited = localStorage.getItem('poppit_visited');
			if (visited) {
				return 'returning';
			} else {
				localStorage.setItem('poppit_visited', 'true');
				return 'new';
			}
		} catch (error) {
			// Fallback if localStorage is not available
			return 'new';
		}
	}

	getDeviceType() {
		const width = window.innerWidth;
		if (width <= 768) return 'mobile';
		if (width <= 1024) return 'tablet';
		return 'desktop';
	}

	// Utility methods for debugging (only available in debug/test mode)
	resetPopupDisplay(popupId) {
		if (!this.testMode && !this.debugMode) {
			console.warn('Reset methods only available in test or debug mode');
			return;
		}
		
		try {
			if (popupId) {
				const storageKey = `poppit_${popupId}`;
				localStorage.removeItem(storageKey);
				this.sessionShownPopups.delete(popupId);
				this.triggeredPopups.delete(popupId);
				this.clearPopupTriggers(popupId);
				this.debug(`Reset display status for popup ${popupId}`);
			} else {
				// Reset all popups
				const keys = [];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key && key.startsWith('poppit_')) {
						keys.push(key);
					}
				}
				keys.forEach(key => localStorage.removeItem(key));
				
				this.sessionShownPopups.clear();
				this.triggeredPopups.clear();
				
				this.timers.forEach((timerId) => {
					clearTimeout(timerId);
				});
				this.timers.clear();
				this.scrollDepths.clear();
				
				this.debug('Reset all popup display statuses');
			}
		} catch (error) {
			console.error('Error resetting popup display:', error);
		}
	}

	reprocessPopups() {
		if (!this.testMode && !this.debugMode) {
			console.warn('Reprocess method only available in test or debug mode');
			return;
		}
		
		try {
			this.debug('Reprocessing popups...');
			this.popups = [];
			this.findPopups();
			this.processPopups();
		} catch (error) {
			console.error('Error reprocessing popups:', error);
		}
	}

	getPopupStatus(popupId) {
		if (!this.testMode && !this.debugMode) {
			console.warn('Status method only available in test or debug mode');
			return null;
		}
		
		try {
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
				status.storedData = this.parseJSON(storedData);
				if (status.storedData.lastShown) {
					const lastShown = new Date(status.storedData.lastShown);
					const minutesSince = (new Date() - lastShown) / (1000 * 60);
					status.minutesSinceLastShown = Math.round(minutesSince);
				}
			}
			
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
		} catch (error) {
			console.error('Error getting popup status:', error);
			return null;
		}
	}
}

// Initialize when DOM is ready
try {
	const poppitInstance = new Poppit();

	// Expose instance to global scope for debugging and testing
	if (poppitInstance.debugMode || poppitInstance.testMode) {
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
} catch (error) {
	console.error('Failed to initialize Poppit:', error);
}