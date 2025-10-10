<?php
/**
 * Render callback for the Poppit block
 * Implements proper security practices and data validation
 *
 * @param array    $attributes Block attributes
 * @param string   $content    Block content
 * @param WP_Block $block      Block object
 * 
 * @return string The block HTML
 */

// Security: Ensure we're in a WordPress context
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Validate and sanitize all attributes with proper defaults
$popup_id = ! empty( $attributes['popupId'] ) ? sanitize_key( $attributes['popupId'] ) : 'popup-' . wp_generate_uuid4();
$popup_type = ! empty( $attributes['popupType'] ) ? sanitize_key( $attributes['popupType'] ) : 'modal';
$title = ! empty( $attributes['title'] ) ? wp_kses_post( $attributes['title'] ) : '';
$content_text = ! empty( $attributes['content'] ) ? wp_kses_post( $attributes['content'] ) : '';
$trigger_type = ! empty( $attributes['triggerType'] ) ? sanitize_key( $attributes['triggerType'] ) : 'time';
$trigger_delay = isset( $attributes['triggerDelay'] ) ? absint( $attributes['triggerDelay'] ) : 3;
$scroll_depth = isset( $attributes['scrollDepth'] ) ? min( max( absint( $attributes['scrollDepth'] ), 0 ), 100 ) : 50;
$exit_intent = ! empty( $attributes['exitIntent'] ) && $attributes['exitIntent'];
$show_close_button = ! isset( $attributes['showCloseButton'] ) || $attributes['showCloseButton'];
$overlay_opacity = isset( $attributes['overlayOpacity'] ) ? min( max( floatval( $attributes['overlayOpacity'] ), 0 ), 1 ) : 0.8;
$email_enabled = ! empty( $attributes['emailEnabled'] ) && $attributes['emailEnabled'];
$email_placeholder = ! empty( $attributes['emailPlaceholder'] ) ? sanitize_text_field( $attributes['emailPlaceholder'] ) : __( 'Enter your email address', 'poppit' );
$button_text = ! empty( $attributes['buttonText'] ) ? sanitize_text_field( $attributes['buttonText'] ) : __( 'Subscribe', 'poppit' );
$animation = ! empty( $attributes['animation'] ) ? sanitize_key( $attributes['animation'] ) : 'fadeIn';
$width = ! empty( $attributes['width'] ) ? sanitize_text_field( $attributes['width'] ) : '500px';
$height = ! empty( $attributes['height'] ) ? sanitize_text_field( $attributes['height'] ) : 'auto';
$position = ! empty( $attributes['position'] ) ? sanitize_key( $attributes['position'] ) : 'center';
$allow_reset = ! empty( $attributes['allowReset'] ) && $attributes['allowReset'];
$reset_delay = isset( $attributes['resetDelay'] ) ? min( max( absint( $attributes['resetDelay'] ), 1 ), 10080 ) : 60; // Max 1 week

// Validate targeting data with proper defaults
$targeting_defaults = [
	'devices' => [ 'desktop', 'tablet', 'mobile' ],
	'userType' => 'all'
];

$targeting = $targeting_defaults;
if ( ! empty( $attributes['targeting'] ) && is_array( $attributes['targeting'] ) ) {
	// Validate devices array
	if ( isset( $attributes['targeting']['devices'] ) && is_array( $attributes['targeting']['devices'] ) ) {
		$valid_devices = [ 'desktop', 'tablet', 'mobile' ];
		$targeting['devices'] = array_intersect( $attributes['targeting']['devices'], $valid_devices );
		// Ensure at least one device is selected
		if ( empty( $targeting['devices'] ) ) {
			$targeting['devices'] = $targeting_defaults['devices'];
		}
	}
	
	// Validate user type
	if ( isset( $attributes['targeting']['userType'] ) ) {
		$valid_user_types = [ 'all', 'new', 'returning' ];
		if ( in_array( $attributes['targeting']['userType'], $valid_user_types, true ) ) {
			$targeting['userType'] = $attributes['targeting']['userType'];
		}
	}
}

// Validate popup and trigger types against allowed values
$valid_popup_types = [ 'modal', 'slide', 'topbar', 'bottombar', 'fullscreen' ];
if ( ! in_array( $popup_type, $valid_popup_types, true ) ) {
	$popup_type = 'modal';
}

$valid_trigger_types = [ 'time', 'scroll', 'exit', 'load', 'manual' ];
if ( ! in_array( $trigger_type, $valid_trigger_types, true ) ) {
	$trigger_type = 'time';
}

$valid_animations = [ 'fadeIn', 'slideDown', 'slideUp', 'zoomIn', 'bounceIn' ];
if ( ! in_array( $animation, $valid_animations, true ) ) {
	$animation = 'fadeIn';
}

$valid_positions = [ 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right' ];
if ( ! in_array( $position, $valid_positions, true ) ) {
	$position = 'center';
}

// Sanitize width and height values to prevent CSS injection
$width = preg_match( '/^[0-9]+(px|%|em|rem|vw|vh|auto)$/i', $width ) ? $width : '500px';
$height = preg_match( '/^[0-9]+(px|%|em|rem|vw|vh|auto)$/i', $height ) ? $height : 'auto';

// Security: Limit popup ID length and ensure it's safe
if ( strlen( $popup_id ) > 50 ) {
	$popup_id = substr( $popup_id, 0, 50 );
}

// Security: Limit text field lengths to prevent abuse
$email_placeholder = substr( $email_placeholder, 0, 100 );
$button_text = substr( $button_text, 0, 50 );

// Build safe CSS custom properties
$css_vars = sprintf(
	'--popup-width: %s; --popup-height: %s;',
	esc_attr( $width ),
	esc_attr( $height )
);

// Prepare data attributes with proper escaping
$data_attributes = [
	'data-popup-id' => esc_attr( $popup_id ),
	'data-popup-type' => esc_attr( $popup_type ),
	'data-trigger-type' => esc_attr( $trigger_type ),
	'data-trigger-delay' => esc_attr( $trigger_delay ),
	'data-scroll-depth' => esc_attr( $scroll_depth ),
	'data-exit-intent' => $exit_intent ? 'true' : 'false',
	'data-show-close-button' => $show_close_button ? 'true' : 'false',
	'data-overlay-opacity' => esc_attr( $overlay_opacity ),
	'data-email-enabled' => $email_enabled ? 'true' : 'false',
	'data-email-placeholder' => esc_attr( $email_placeholder ),
	'data-button-text' => esc_attr( $button_text ),
	'data-targeting' => esc_attr( wp_json_encode( $targeting, JSON_UNESCAPED_SLASHES ) ),
	'data-animation' => esc_attr( $animation ),
	'data-width' => esc_attr( $width ),
	'data-height' => esc_attr( $height ),
	'data-position' => esc_attr( $position ),
	'data-allow-reset' => $allow_reset ? 'true' : 'false',
	'data-reset-delay' => esc_attr( $reset_delay )
];

// Get block wrapper attributes with proper escaping
$wrapper_attributes = get_block_wrapper_attributes( [
	'class' => 'poppit-block',
	'style' => $css_vars
] + $data_attributes );

// Prepare JSON data for the JavaScript (double-encoded for security)
$popup_data = [
	'id' => $popup_id,
	'type' => $popup_type,
	'title' => $title,
	'content' => $content_text,
	'triggerType' => $trigger_type,
	'triggerDelay' => $trigger_delay,
	'scrollDepth' => $scroll_depth,
	'exitIntent' => $exit_intent,
	'showCloseButton' => $show_close_button,
	'overlayOpacity' => $overlay_opacity,
	'emailEnabled' => $email_enabled,
	'emailPlaceholder' => $email_placeholder,
	'buttonText' => $button_text,
	'targeting' => $targeting,
	'animation' => $animation,
	'width' => $width,
	'height' => $height,
	'position' => $position,
	'allowReset' => $allow_reset,
	'resetDelay' => $reset_delay,
	'nonce' => wp_create_nonce( 'poppit_view_' . $popup_id ) // Add view-specific nonce
];

// Start output buffering for clean HTML
ob_start();
?>

<div <?php echo wp_kses_post( $wrapper_attributes ); ?>>
	<?php if ( ! empty( $title ) ) : ?>
		<div class="popup-title" style="display: none;"><?php echo wp_kses_post( $title ); ?></div>
	<?php endif; ?>
	
	<?php if ( ! empty( $content_text ) ) : ?>
		<div class="popup-text" style="display: none;"><?php echo wp_kses_post( $content_text ); ?></div>
	<?php endif; ?>
	
	<!-- Popup configuration data for JavaScript -->
	<script type="application/json" class="popup-data">
		<?php echo wp_json_encode( $popup_data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ); ?>
	</script>
</div>

<?php
// Return the buffered output
return ob_get_clean();