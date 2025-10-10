=== Poppit ===

Contributors:      WordPress Telex
Tags:              popup, modal, lightbox, conversion, marketing
Tested up to:      6.8
Stable tag:        1.0.0
License:           GPLv2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Create high-converting pop-ups with advanced targeting, exit-intent detection, and native Gutenberg integration.

== Description ==

Poppit is the next-generation WordPress pop-up plugin designed specifically for the Gutenberg editor. Built with performance and user experience in mind, it offers professional-grade features without the bloat of traditional pop-up solutions.

**Core Features:**

* **Native Gutenberg Integration** - Build pop-ups using any WordPress blocks with real-time preview
* **Advanced Triggers** - Exit-intent detection, scroll depth, time-based, and page targeting
* **Performance Optimized** - Lightweight code that won't slow down your site
* **Mobile Responsive** - Automatically adapts to all screen sizes
* **Professional Templates** - 15+ pre-built layouts for common use cases
* **Email Integration** - Works with MailChimp, ConvertKit, and any service via webhooks

**Trigger Options:**

* Exit-intent detection using advanced mouse tracking
* Time-based triggers (display after X seconds)
* Scroll-depth triggers (25%, 50%, 75%, 100% of page)
* Page load triggers with customizable delays
* Click-based triggers for buttons and links

**Targeting Features:**

* Page-specific and post-type targeting
* Device detection (mobile, tablet, desktop)
* New vs returning visitor differentiation
* Geographic targeting capabilities
* User role-based display rules

**Display Types:**

* Lightbox/Modal pop-ups with customizable overlays
* Slide-in notifications from any corner
* Top/bottom bars for announcements
* Inline content blocks
* Full-screen overlays

This plugin addresses the three biggest complaints about existing pop-up solutions: performance issues, poor mobile experience, and complex setup. With Gutenberg-first architecture and modern JavaScript, you get a fast, intuitive pop-up builder that integrates seamlessly with your workflow.

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/poppit` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Add the "Poppit" block to any page or post
4. Configure your pop-up settings in the block inspector
5. Customize the design using WordPress's native color, typography, and spacing tools

== Frequently Asked Questions ==

= Does this work with any theme? =

Yes! Since it's built as a native Gutenberg block, it works with any theme that supports the block editor.

= Will this slow down my website? =

No. Unlike other pop-up plugins that load heavy external libraries, this plugin is designed for performance with minimal JavaScript and CSS loading only when needed.

= Can I use this with page builders like Elementor? =

While optimized for Gutenberg, the pop-ups will display on any WordPress page regardless of how it was built. However, you'll get the best editing experience using the Gutenberg block editor.

= Is it GDPR compliant? =

Yes. The plugin includes options for GDPR-compliant data handling and doesn't store personal information without explicit consent.

= Can I export my email subscribers? =

Yes. The plugin includes CSV export functionality for all captured email addresses and supports webhook integration with any email service.

== Screenshots ==

1. Poppit block in the Gutenberg editor with real-time preview
2. Comprehensive targeting options in the block inspector
3. Professional pop-up templates and design options
4. Exit-intent and scroll-based trigger configuration
5. Email integration settings with multiple service support
6. Analytics dashboard showing conversion rates

== Changelog ==

= 1.0.0 =
* Initial release with core pop-up functionality
* Native Gutenberg block integration
* Advanced trigger system (exit-intent, scroll, time-based)
* Basic targeting options (page, device, visitor type)
* Email integration support
* 15 professional block patterns
* Performance-optimized code architecture

== Arbitrary section ==

**Technical Architecture:**

This plugin uses a hybrid database approach with WordPress custom post types for pop-up content and custom tables for high-performance analytics tracking. The Gutenberg block is built using React with WordPress's latest block API (apiVersion: 3) and supports all native block features including colors, typography, and spacing.

**Performance Features:**

* Lazy loading of pop-up resources
* Minimal DOM manipulation
* Optimized event listeners
* Efficient trigger detection algorithms
* Compressed asset delivery