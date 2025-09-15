<?php
/**
 * Render callback for the Advanced Pop-up Maker block
 *
 * @param array    $attributes Block attributes
 * @param string   $content    Block content
 * @param WP_Block $block      Block object
 * 
 * @return string The block HTML
 */

// Get all block attributes with defaults
$popup_id = $attributes['popupId'] ?? uniqid('popup-');
$popup_type = $attributes['popupType'] ?? 'modal';
$title = $attributes['title'] ?? '';
$content_text = $attributes['content'] ?? '';
$trigger_type = $attributes['triggerType'] ?? 'time';
$trigger_delay = $attributes['triggerDelay'] ?? 3;
$scroll_depth = $attributes['scrollDepth'] ?? 50;
$exit_intent = $attributes['exitIntent'] ?? false;
$show_close_button = $attributes['showCloseButton'] ?? true;
$overlay_opacity = $attributes['overlayOpacity'] ?? 0.8;
$email_enabled = $attributes['emailEnabled'] ?? false;
$email_placeholder = $attributes['emailPlaceholder'] ?? __('Enter your email address', 'poppit');
$button_text = $attributes['buttonText'] ?? __('Subscribe', 'poppit');
$targeting = $attributes['targeting'] ?? ['devices' => ['desktop', 'tablet', 'mobile'], 'userType' => 'all'];
$animation = $attributes['animation'] ?? 'fadeIn';
$width = $attributes['width'] ?? '500px';
$height = $attributes['height'] ?? 'auto';
$position = $attributes['position'] ?? 'center';
$allow_reset = $attributes['allowReset'] ?? false;
$reset_delay = $attributes['resetDelay'] ?? 60;

// Get block wrapper attributes
$wrapper_attributes = get_block_wrapper_attributes([
	'class' => 'poppit-block',
	'data-popup-id' => esc_attr($popup_id),
	'data-popup-type' => esc_attr($popup_type),
	'data-trigger-type' => esc_attr($trigger_type),
	'data-trigger-delay' => esc_attr($trigger_delay),
	'data-scroll-depth' => esc_attr($scroll_depth),
	'data-exit-intent' => $exit_intent ? 'true' : 'false',
	'data-show-close-button' => $show_close_button ? 'true' : 'false',
	'data-overlay-opacity' => esc_attr($overlay_opacity),
	'data-email-enabled' => $email_enabled ? 'true' : 'false',
	'data-email-placeholder' => esc_attr($email_placeholder),
	'data-button-text' => esc_attr($button_text),
	'data-targeting' => esc_attr(json_encode($targeting)),
	'data-animation' => esc_attr($animation),
	'data-width' => esc_attr($width),
	'data-height' => esc_attr($height),
	'data-position' => esc_attr($position),
	'data-allow-reset' => $allow_reset ? 'true' : 'false',
	'data-reset-delay' => esc_attr($reset_delay),
	'style' => '--popup-width: ' . esc_attr($width) . '; --popup-height: ' . esc_attr($height) . ';'
]);
?>

<div <?php echo $wrapper_attributes; ?>>
	<?php if (!empty($title)): ?>
		<div class="popup-title" style="display: none;"><?php echo wp_kses_post($title); ?></div>
	<?php endif; ?>
	
	<?php if (!empty($content_text)): ?>
		<div class="popup-text" style="display: none;"><?php echo wp_kses_post($content_text); ?></div>
	<?php endif; ?>
	
	<!-- Hidden content that will be used by the JavaScript -->
	<script type="application/json" class="popup-data">
		<?php echo wp_json_encode([
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
			'resetDelay' => $reset_delay
		]); ?>
	</script>
</div>