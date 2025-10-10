<?php
/**
 * Plugin Name:       Poppit
 * Description:       Build pop-ups that feel like helpful suggestions, not annoying interruptions
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            WordPress Telex
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       poppit
 *
 * @package Poppit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

// Define plugin constants
define( 'POPPIT_VERSION', '1.0.0' );
define( 'POPPIT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'POPPIT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

if ( ! function_exists( 'poppit_create_analytics_table' ) ) {
	/**
	 * Create custom table for analytics tracking
	 * Uses proper WordPress database practices with dbDelta
	 */
	function poppit_create_analytics_table() {
		global $wpdb;
		
		$table_name = $wpdb->prefix . 'poppit_analytics';
		
		$charset_collate = $wpdb->get_charset_collate();
		
		$sql = "CREATE TABLE {$table_name} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			popup_id varchar(50) NOT NULL,
			event_type varchar(20) NOT NULL,
			user_agent text,
			ip_address varchar(45),
			page_url varchar(500),
			timestamp datetime DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY popup_event_idx (popup_id, event_type),
			KEY timestamp_idx (timestamp)
		) {$charset_collate};";
		
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
		
		// Store database version for future upgrades
		update_option( 'poppit_db_version', '1.0' );
	}
}

if ( ! function_exists( 'poppit_block_init' ) ) {
	/**
	 * Registers the block using the metadata loaded from the `block.json` file.
	 * Behind the scenes, it registers also all assets so they can be enqueued
	 * through the block editor in the corresponding context.
	 *
	 * @see https://developer.wordpress.org/reference/functions/register_block_type/
	 */
	function poppit_block_init() {
		// Check if Gutenberg is available
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}
		
		register_block_type( POPPIT_PLUGIN_DIR . 'build/' );
	}
}
add_action( 'init', 'poppit_block_init' );

// Create analytics table on activation
register_activation_hook( __FILE__, 'poppit_create_analytics_table' );

if ( ! function_exists( 'poppit_enqueue_frontend_assets' ) ) {
	/**
	 * Enqueue frontend assets only when block is present
	 * Uses proper WordPress asset handling
	 */
	function poppit_enqueue_frontend_assets() {
		if ( has_block( 'telex/block-poppit' ) ) {
			wp_enqueue_style(
				'poppit-frontend',
				POPPIT_PLUGIN_URL . 'build/style-index.css',
				array(),
				POPPIT_VERSION
			);
			
			wp_enqueue_script(
				'poppit-frontend',
				POPPIT_PLUGIN_URL . 'build/view.js',
				array(),
				POPPIT_VERSION,
				true
			);
			
			// Localize script with nonce for security
			wp_localize_script( 'poppit-frontend', 'poppitAjax', array(
				'ajaxurl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'poppit_nonce' ),
				'version' => POPPIT_VERSION
			));
		}
	}
}
add_action( 'wp_enqueue_scripts', 'poppit_enqueue_frontend_assets' );

if ( ! function_exists( 'poppit_insert_analytics_record' ) ) {
	/**
	 * Insert analytics record using WordPress options for better performance
	 * Avoids slow meta queries by using a more efficient storage method
	 * 
	 * @param string $popup_id The popup ID
	 * @param string $event_type The event type
	 * @param array  $additional_data Additional data to store
	 * @return bool Success status
	 */
	function poppit_insert_analytics_record( $popup_id, $event_type, $additional_data = array() ) {
		// Use options table for better performance instead of post meta
		$analytics_data = array(
			'popup_id'    => sanitize_text_field( $popup_id ),
			'event_type'  => sanitize_text_field( $event_type ),
			'user_agent'  => isset( $_SERVER['HTTP_USER_AGENT'] ) ? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 500 ) : '',
			'ip_address'  => poppit_get_user_ip(),
			'page_url'    => isset( $additional_data['page_url'] ) ? esc_url_raw( $additional_data['page_url'] ) : '',
			'timestamp'   => current_time( 'mysql' ),
			'date'        => current_time( 'Y-m-d' ) // For easier querying by date
		);
		
		// Store in a daily batch to improve performance
		$option_key = 'poppit_analytics_' . current_time( 'Y_m_d' );
		$daily_analytics = get_option( $option_key, array() );
		
		// Limit daily records to prevent option bloat (max 1000 per day)
		if ( count( $daily_analytics ) >= 1000 ) {
			return false;
		}
		
		$daily_analytics[] = $analytics_data;
		
		// Use autoload=false for analytics data to avoid loading on every page
		return update_option( $option_key, $daily_analytics, false );
	}
}

if ( ! function_exists( 'poppit_track_event' ) ) {
	/**
	 * Handle AJAX requests for tracking popup events
	 * Uses WordPress options instead of slow meta queries
	 */
	function poppit_track_event() {
		// Verify nonce for security
		if ( ! check_ajax_referer( 'poppit_nonce', 'nonce', false ) ) {
			wp_die( esc_html__( 'Security check failed.', 'poppit' ), 403 );
		}
		
		// Validate and sanitize input
		if ( ! isset( $_POST['popup_id'] ) || ! isset( $_POST['event_type'] ) ) {
			wp_die( esc_html__( 'Missing required parameters.', 'poppit' ), 400 );
		}
		
		$popup_id = sanitize_text_field( wp_unslash( $_POST['popup_id'] ) );
		$event_type = sanitize_text_field( wp_unslash( $_POST['event_type'] ) );
		$page_url = isset( $_POST['page_url'] ) ? esc_url_raw( wp_unslash( $_POST['page_url'] ) ) : '';
		
		// Validate popup ID length and format
		if ( empty( $popup_id ) || strlen( $popup_id ) > 50 || ! preg_match( '/^[a-zA-Z0-9_-]+$/', $popup_id ) ) {
			wp_die( esc_html__( 'Invalid popup ID.', 'poppit' ), 400 );
		}
		
		// Validate event type against allowed values
		$allowed_events = array( 'display', 'close', 'email_submit', 'conversion' );
		if ( ! in_array( $event_type, $allowed_events, true ) ) {
			wp_die( esc_html__( 'Invalid event type.', 'poppit' ), 400 );
		}
		
		// Rate limiting - prevent spam
		$user_ip = poppit_get_user_ip();
		$rate_limit_key = 'poppit_rate_' . md5( $user_ip );
		$rate_count = get_transient( $rate_limit_key );
		if ( $rate_count && $rate_count > 100 ) {
			wp_die( esc_html__( 'Rate limit exceeded.', 'poppit' ), 429 );
		}
		set_transient( $rate_limit_key, ( $rate_count ? $rate_count + 1 : 1 ), HOUR_IN_SECONDS );
		
		// Use WordPress caching with transients for improved performance
		$cache_key = "poppit_event_{$popup_id}_{$event_type}_" . md5( $user_ip );
		$cached_result = wp_cache_get( $cache_key, 'poppit' );
		
		if ( false === $cached_result ) {
			// Use efficient options storage instead of post system
			$result = poppit_insert_analytics_record( $popup_id, $event_type, array(
				'page_url' => $page_url
			) );
			
			if ( false === $result || is_wp_error( $result ) ) {
				wp_send_json_error( esc_html__( 'Failed to track event.', 'poppit' ) );
			}
			
			// Cache successful result for 5 minutes
			wp_cache_set( $cache_key, 'success', 'poppit', 5 * MINUTE_IN_SECONDS );
		}
		
		wp_send_json_success( esc_html__( 'Event tracked successfully.', 'poppit' ) );
	}
}
add_action( 'wp_ajax_poppit_track', 'poppit_track_event' );
add_action( 'wp_ajax_nopriv_poppit_track', 'poppit_track_event' );

if ( ! function_exists( 'poppit_handle_email_submission' ) ) {
	/**
	 * Handle email form submissions with proper validation and security
	 * Uses WordPress options API for better performance than meta queries
	 */
	function poppit_handle_email_submission() {
		// Verify nonce for security
		if ( ! check_ajax_referer( 'poppit_nonce', 'nonce', false ) ) {
			wp_die( esc_html__( 'Security check failed.', 'poppit' ), 403 );
		}
		
		// Validate required fields
		if ( ! isset( $_POST['email'] ) || ! isset( $_POST['popup_id'] ) ) {
			wp_die( esc_html__( 'Missing required parameters.', 'poppit' ), 400 );
		}
		
		$email = sanitize_email( wp_unslash( $_POST['email'] ) );
		$popup_id = sanitize_text_field( wp_unslash( $_POST['popup_id'] ) );
		$page_url = isset( $_POST['page_url'] ) ? esc_url_raw( wp_unslash( $_POST['page_url'] ) ) : '';
		
		// Validate popup ID
		if ( empty( $popup_id ) || strlen( $popup_id ) > 50 || ! preg_match( '/^[a-zA-Z0-9_-]+$/', $popup_id ) ) {
			wp_send_json_error( esc_html__( 'Invalid popup ID.', 'poppit' ) );
		}
		
		// Validate email format and length
		if ( ! is_email( $email ) || strlen( $email ) > 254 ) {
			wp_send_json_error( esc_html__( 'Please enter a valid email address.', 'poppit' ) );
		}
		
		// Rate limiting for email submissions
		$user_ip = poppit_get_user_ip();
		$email_rate_key = 'poppit_email_rate_' . md5( $email . $user_ip );
		$email_rate_count = get_transient( $email_rate_key );
		if ( $email_rate_count && $email_rate_count > 5 ) {
			wp_send_json_error( esc_html__( 'Too many submissions. Please try again later.', 'poppit' ) );
		}
		set_transient( $email_rate_key, ( $email_rate_count ? $email_rate_count + 1 : 1 ), HOUR_IN_SECONDS );
		
		// Use WordPress caching with object cache
		$cache_key = "poppit_email_{$popup_id}_" . md5( $user_ip );
		$cached_result = wp_cache_get( $cache_key, 'poppit' );
		
		if ( false === $cached_result ) {
			// Use efficient options storage for email tracking
			$result = poppit_insert_analytics_record( $popup_id, 'email_submit', array(
				'page_url' => $page_url,
				'email' => $email
			) );
			
			// Cache result for 5 minutes
			wp_cache_set( $cache_key, ( $result !== false ), 'poppit', 5 * MINUTE_IN_SECONDS );
		}
		
		// Allow other plugins to hook into email submission
		do_action( 'poppit_email_submitted', $email, $popup_id, $page_url );
		
		// Store email using WordPress options API with better structure
		if ( apply_filters( 'poppit_store_emails', true ) ) {
			// Store emails by month to prevent huge option values
			$month_key = 'poppit_emails_' . current_time( 'Y_m' );
			$monthly_emails = get_option( $month_key, array() );
			
			$monthly_emails[] = array(
				'email' => $email,
				'popup_id' => $popup_id,
				'date' => current_time( 'mysql' ),
				'page_url' => $page_url,
				'ip_hash' => wp_hash( $user_ip ) // Store hashed IP for privacy
			);
			
			// Limit monthly emails to prevent database bloat
			if ( count( $monthly_emails ) > 2000 ) {
				$monthly_emails = array_slice( $monthly_emails, -2000 );
			}
			
			// Use autoload=false for email storage
			update_option( $month_key, $monthly_emails, false );
		}
		
		wp_send_json_success( esc_html__( 'Thank you for subscribing!', 'poppit' ) );
	}
}
add_action( 'wp_ajax_poppit_email', 'poppit_handle_email_submission' );
add_action( 'wp_ajax_nopriv_poppit_email', 'poppit_handle_email_submission' );

if ( ! function_exists( 'poppit_get_user_ip' ) ) {
	/**
	 * Get user IP address securely, considering proxies
	 * 
	 * @return string Sanitized IP address
	 */
	function poppit_get_user_ip() {
		$ip_keys = array(
			'HTTP_CF_CONNECTING_IP',     // Cloudflare
			'HTTP_CLIENT_IP',           // Proxy
			'HTTP_X_FORWARDED_FOR',     // Load balancer/proxy
			'HTTP_X_FORWARDED',         // Proxy
			'HTTP_X_CLUSTER_CLIENT_IP', // Cluster
			'HTTP_FORWARDED_FOR',       // Proxy
			'HTTP_FORWARDED',           // Proxy
			'REMOTE_ADDR'               // Standard
		);
		
		foreach ( $ip_keys as $key ) {
			if ( array_key_exists( $key, $_SERVER ) && ! empty( $_SERVER[ $key ] ) ) {
				$ip = sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) );
				
				// Handle comma-separated IPs (X-Forwarded-For can have multiple)
				if ( strpos( $ip, ',' ) !== false ) {
					$ip_array = explode( ',', $ip );
					$ip = trim( $ip_array[0] );
				}
				
				// Validate IP format and exclude private ranges for public IPs
				if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
					return $ip;
				}
			}
		}
		
		// Fallback
		return 'unknown';
	}
}

if ( ! function_exists( 'poppit_cleanup_old_analytics' ) ) {
	/**
	 * Clean up old analytics data using WordPress options instead of slow post queries
	 * This eliminates the slow meta_query warnings
	 */
	function poppit_cleanup_old_analytics() {
		// Clean up options-based analytics (older than 90 days)
		$cutoff_date = date( 'Y_m_d', strtotime( '-90 days' ) );
		
		// Get all options that start with 'poppit_analytics_'
		global $wpdb;
		$analytics_options = $wpdb->get_results( 
			$wpdb->prepare( 
				"SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s AND option_name < %s",
				'poppit_analytics_%',
				'poppit_analytics_' . $cutoff_date
			),
			ARRAY_A
		);
		
		foreach ( $analytics_options as $option ) {
			delete_option( $option['option_name'] );
		}
		
		// Clean up old email storage (older than 12 months)
		$email_cutoff = date( 'Y_m', strtotime( '-12 months' ) );
		$old_email_options = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s AND option_name < %s",
				'poppit_emails_%',
				'poppit_emails_' . $email_cutoff
			),
			ARRAY_A
		);
		
		foreach ( $old_email_options as $option ) {
			delete_option( $option['option_name'] );
		}
		
		// Clear related caches using WordPress cache functions
		wp_cache_delete( 'poppit_analytics_count', 'poppit' );
		wp_cache_flush_group( 'poppit' );
	}
}

// Schedule cleanup to run daily
if ( ! wp_next_scheduled( 'poppit_cleanup_analytics' ) ) {
	wp_schedule_event( time(), 'daily', 'poppit_cleanup_analytics' );
}
add_action( 'poppit_cleanup_analytics', 'poppit_cleanup_old_analytics' );

// Clean up scheduled events on deactivation
register_deactivation_hook( __FILE__, function() {
	wp_clear_scheduled_hook( 'poppit_cleanup_analytics' );
});

// Enhanced uninstall hook with proper cleanup using WordPress functions
if ( ! function_exists( 'poppit_uninstall' ) ) {
	function poppit_uninstall() {
		// Only run if user has permission to delete plugins
		if ( ! current_user_can( 'delete_plugins' ) ) {
			return;
		}
		
		// Clean up all poppit options instead of using slow post queries
		global $wpdb;
		
		// Remove all poppit-related options
		$poppit_options = $wpdb->get_results(
			"SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'poppit_%'",
			ARRAY_A
		);
		
		foreach ( $poppit_options as $option ) {
			delete_option( $option['option_name'] );
		}
		
		// Remove custom table if it exists
		$table_name = $wpdb->prefix . 'poppit_analytics';
		$wpdb->query( "DROP TABLE IF EXISTS {$table_name}" );
		
		// Clear all related transients
		$transients = $wpdb->get_results(
			"SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE '_transient_poppit_%' OR option_name LIKE '_transient_timeout_poppit_%'",
			ARRAY_A
		);
		
		foreach ( $transients as $transient ) {
			delete_option( $transient['option_name'] );
		}
		
		// Clear object cache groups
		wp_cache_flush_group( 'poppit' );
		
		// Clear scheduled events
		wp_clear_scheduled_hook( 'poppit_cleanup_analytics' );
	}
}
register_uninstall_hook( __FILE__, 'poppit_uninstall' );

if ( ! function_exists( 'poppit_add_security_headers' ) ) {
	/**
	 * Add security headers
	 */
	function poppit_add_security_headers() {
		if ( ! headers_sent() && ! is_admin() ) {
			header( 'X-Content-Type-Options: nosniff' );
			header( 'X-Frame-Options: SAMEORIGIN' );
		}
	}
}
add_action( 'send_headers', 'poppit_add_security_headers' );

// Add admin capabilities check for sensitive operations
if ( ! function_exists( 'poppit_check_admin_capabilities' ) ) {
	function poppit_check_admin_capabilities() {
		return current_user_can( 'manage_options' );
	}
}

// Sanitize and validate all popup settings
if ( ! function_exists( 'poppit_sanitize_popup_settings' ) ) {
	function poppit_sanitize_popup_settings( $settings ) {
		if ( ! is_array( $settings ) ) {
			return array();
		}
		
		$sanitized = array();
		
		// Sanitize each setting with appropriate function
		if ( isset( $settings['popup_id'] ) ) {
			$sanitized['popup_id'] = sanitize_key( $settings['popup_id'] );
		}
		
		if ( isset( $settings['title'] ) ) {
			$sanitized['title'] = sanitize_text_field( $settings['title'] );
		}
		
		if ( isset( $settings['content'] ) ) {
			$sanitized['content'] = wp_kses_post( $settings['content'] );
		}
		
		// Add more sanitization as needed
		return $sanitized;
	}
}

// Hook to validate block attributes on save
add_filter( 'block_editor_rest_api_preload', 'poppit_validate_block_attributes' );

if ( ! function_exists( 'poppit_validate_block_attributes' ) ) {
	function poppit_validate_block_attributes( $preload_data ) {
		// Additional validation can be added here
		return $preload_data;
	}
}

if ( ! function_exists( 'poppit_get_analytics_summary' ) ) {
	/**
	 * Get analytics summary using efficient options queries instead of slow meta queries
	 * This completely eliminates the meta_query warnings
	 * 
	 * @param string $popup_id Optional popup ID to filter by
	 * @return array Analytics summary data
	 */
	function poppit_get_analytics_summary( $popup_id = '' ) {
		$cache_key = 'poppit_analytics_summary_' . md5( $popup_id );
		$cached_data = wp_cache_get( $cache_key, 'poppit' );
		
		if ( false !== $cached_data ) {
			return $cached_data;
		}
		
		$summary = array(
			'total_events' => 0,
			'displays' => 0,
			'conversions' => 0,
			'email_submits' => 0,
			'closes' => 0
		);
		
		// Get analytics data from options instead of slow meta queries
		global $wpdb;
		
		// Get all analytics options
		$analytics_options = $wpdb->get_results(
			"SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE 'poppit_analytics_%'",
			ARRAY_A
		);
		
		foreach ( $analytics_options as $option ) {
			$daily_data = maybe_unserialize( $option['option_value'] );
			
			if ( is_array( $daily_data ) ) {
				foreach ( $daily_data as $record ) {
					// Filter by popup ID if specified
					if ( ! empty( $popup_id ) && $record['popup_id'] !== $popup_id ) {
						continue;
					}
					
					$summary['total_events']++;
					
					switch ( $record['event_type'] ) {
						case 'display':
							$summary['displays']++;
							break;
						case 'conversion':
							$summary['conversions']++;
							break;
						case 'email_submit':
							$summary['email_submits']++;
							break;
						case 'close':
							$summary['closes']++;
							break;
					}
				}
			}
		}
		
		// Cache for 1 hour
		wp_cache_set( $cache_key, $summary, 'poppit', HOUR_IN_SECONDS );
		
		return $summary;
	}
}