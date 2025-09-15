<?php
/**
 * Plugin Name:       Poppit
 * Description:       Create high-converting pop-ups with advanced targeting, exit-intent detection,  * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:      	  iconick
 * Author URI:        https://iconick.io
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       poppit
 *
 * @package Poppit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Create custom table for analytics tracking
 */
function popup_maker_create_analytics_table() {
	global $wpdb;
	
	$table_name = $wpdb->prefix . 'popup_analytics';
	
	$charset_collate = $wpdb->get_charset_collate();
	
	$sql = "CREATE TABLE $table_name (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		popup_id bigint(20) unsigned NOT NULL,
		event_type varchar(20) NOT NULL,
		user_agent text,
		ip_address varchar(45),
		page_url varchar(255),
		timestamp datetime DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (id),
		KEY popup_event_idx (popup_id, event_type),
		KEY timestamp_idx (timestamp)
	) $charset_collate;";
	
	require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
	dbDelta( $sql );
}

if ( ! function_exists( 'popup_maker_block_init' ) ) {
	/**
	 * Registers the block using the metadata loaded from the `block.json` file.
	 * Behind the scenes, it registers also all assets so they can be enqueued
	 * through the block editor in the corresponding context.
	 *
	 * @see https://developer.wordpress.org/reference/functions/register_block_type/
	 */
	function telex_poppit_block_init() {
		register_block_type( __DIR__ . '/build/' );
	}
}
add_action( 'init', 'telex_poppit_block_init' );

// Create analytics table on activation
register_activation_hook( __FILE__, 'popup_maker_create_analytics_table' );

if ( ! function_exists( 'popup_maker_enqueue_frontend_assets' ) ) {
	/**
	 * Enqueue frontend assets only when block is present
	 */
	function popup_maker_enqueue_frontend_assets() {
		if ( has_block( 'telex/block-poppit' ) ) {
			wp_enqueue_style(
				'poppit-frontend',
				plugin_dir_url( __FILE__ ) . 'build/style-index.css',
				array(),
				'0.1.0'
			);
			
			wp_enqueue_script(
				'poppit-frontend',
				plugin_dir_url( __FILE__ ) . 'build/view.js',
				array(),
				'0.1.0',
				true
			);
			
			// Pass data to frontend script
			wp_localize_script( 'poppit-frontend', 'popupMakerAjax', array(
				'ajaxurl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'popup_maker_nonce' )
			));
		}
	}
}
add_action( 'wp_enqueue_scripts', 'popup_maker_enqueue_frontend_assets' );

if ( ! function_exists( 'popup_maker_track_event' ) ) {
	/**
	 * Handle AJAX requests for tracking popup events
	 */
	function popup_maker_track_event() {
		check_ajax_referer( 'popup_maker_nonce', 'nonce' );
		
		global $wpdb;
		
		$popup_id = intval( $_POST['popup_id'] );
		$event_type = sanitize_text_field( $_POST['event_type'] );
		
		$wpdb->insert(
			$wpdb->prefix . 'popup_analytics',
			array(
				'popup_id' => $popup_id,
				'event_type' => $event_type,
				'user_agent' => sanitize_text_field( $_SERVER['HTTP_USER_AGENT'] ),
				'ip_address' => sanitize_text_field( $_SERVER['REMOTE_ADDR'] ),
				'page_url' => sanitize_url( $_POST['page_url'] )
			),
			array( '%d', '%s', '%s', '%s', '%s' )
		);
		
		wp_die();
	}
}
add_action( 'wp_ajax_popup_maker_track', 'popup_maker_track_event' );
add_action( 'wp_ajax_nopriv_popup_maker_track', 'popup_maker_track_event' );

if ( ! function_exists( 'popup_maker_handle_email_submission' ) ) {
	/**
	 * Handle email form submissions
	 */
	function popup_maker_handle_email_submission() {
		check_ajax_referer( 'popup_maker_nonce', 'nonce' );
		
		$email = sanitize_email( $_POST['email'] );
		$popup_id = intval( $_POST['popup_id'] );
		
		if ( ! is_email( $email ) ) {
			wp_send_json_error( 'Invalid email address' );
		}
		
		// Store email submission
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'popup_analytics',
			array(
				'popup_id' => $popup_id,
				'event_type' => 'email_submit',
				'user_agent' => sanitize_text_field( $_SERVER['HTTP_USER_AGENT'] ),
				'ip_address' => sanitize_text_field( $_SERVER['REMOTE_ADDR'] ),
				'page_url' => sanitize_url( $_POST['page_url'] )
			),
			array( '%d', '%s', '%s', '%s', '%s' )
		);
		
		wp_send_json_success( 'Email submitted successfully' );
	}
}
add_action( 'wp_ajax_popup_maker_email', 'popup_maker_handle_email_submission' );
add_action( 'wp_ajax_nopriv_popup_maker_email', 'popup_maker_handle_email_submission' );