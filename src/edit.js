/**
 * Retrieves the translation of text.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-i18n/
 */
import { __ } from '@wordpress/i18n';

/**
 * React hook that is used to mark the block wrapper element.
 * It provides all the necessary props like the class name.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/packages/packages-block-editor/#useblockprops
 */
import { 
	useBlockProps, 
	InspectorControls,
	RichText,
	BlockControls
} from '@wordpress/block-editor';

import {
	PanelBody,
	SelectControl,
	ToggleControl,
	RangeControl,
	TextControl,
	Button,
	CheckboxControl,
	ToolbarGroup,
	ToolbarButton,
	ExternalLink
} from '@wordpress/components';

import { useState, useEffect } from '@wordpress/element';

/**
 * Lets webpack process CSS, SASS or SCSS files referenced in JavaScript files.
 * Those files can contain any CSS code that gets applied to the editor.
 *
 * @see https://www.npmjs.com/package/@wordpress/scripts#using-css
 */
import './editor.scss';

/**
 * The edit function describes the structure of your block in the context of the
 * editor. This represents what the editor will render when the block is used.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-edit-save/#edit
 *
 * @return {Element} Element to render.
 */
export default function Edit( { attributes, setAttributes } ) {
	const {
		popupType,
		title,
		content,
		triggerType,
		triggerDelay,
		scrollDepth,
		exitIntent,
		showCloseButton,
		overlayOpacity,
		emailEnabled,
		emailPlaceholder,
		buttonText,
		targeting,
		animation,
		width,
		height,
		position,
		allowReset,
		resetDelay
	} = attributes;

	const [ previewMode, setPreviewMode ] = useState( false );

	// Generate unique popup ID if not exists
	useEffect( () => {
		if ( ! attributes.popupId ) {
			setAttributes( { popupId: 'popup-' + Math.random().toString(36).substr(2, 9) } );
		}
	}, [] );

	const blockProps = useBlockProps( {
		className: `poppit-block popup-type-${popupType} position-${position}`,
		style: {
			'--popup-width': width,
			'--popup-height': height,
			'--overlay-opacity': overlayOpacity
		}
	} );

	const popupTypeOptions = [
		{ label: __( 'Modal/Lightbox', 'poppit' ), value: 'modal' },
		{ label: __( 'Slide In', 'poppit' ), value: 'slide' },
		{ label: __( 'Top Bar', 'poppit' ), value: 'topbar' },
		{ label: __( 'Bottom Bar', 'poppit' ), value: 'bottombar' },
		{ label: __( 'Full Screen', 'poppit' ), value: 'fullscreen' }
	];

	const triggerTypeOptions = [
		{ label: __( 'Time Based', 'poppit' ), value: 'time' },
		{ label: __( 'Scroll Depth', 'poppit' ), value: 'scroll' },
		{ label: __( 'Exit Intent', 'poppit' ), value: 'exit' },
		{ label: __( 'Page Load', 'poppit' ), value: 'load' },
		{ label: __( 'Manual Trigger', 'poppit' ), value: 'manual' }
	];

	const animationOptions = [
		{ label: __( 'Fade In', 'poppit' ), value: 'fadeIn' },
		{ label: __( 'Slide Down', 'poppit' ), value: 'slideDown' },
		{ label: __( 'Slide Up', 'poppit' ), value: 'slideUp' },
		{ label: __( 'Zoom In', 'poppit' ), value: 'zoomIn' },
		{ label: __( 'Bounce In', 'poppit' ), value: 'bounceIn' }
	];

	const positionOptions = [
		{ label: __( 'Center', 'poppit' ), value: 'center' },
		{ label: __( 'Top Left', 'poppit' ), value: 'top-left' },
		{ label: __( 'Top Right', 'poppit' ), value: 'top-right' },
		{ label: __( 'Bottom Left', 'poppit' ), value: 'bottom-left' },
		{ label: __( 'Bottom Right', 'poppit' ), value: 'bottom-right' }
	];

	const renderPopupPreview = () => {
		return (
			<div className="poppit-preview">
				<div className="popup-overlay" style={{ opacity: overlayOpacity }}>
					<div className={`popup-container popup-${popupType} animation-${animation}`}>
						{ showCloseButton && (
							<button className="popup-close" aria-label={ __( 'Close', 'poppit' ) }>
								×
							</button>
						) }
						
						<div className="popup-content">
							<RichText
								tagName="h3"
								className="popup-title"
								value={ title }
								onChange={ ( value ) => setAttributes( { title: value } ) }
								placeholder={ __( 'Enter popup title...', 'poppit' ) }
							/>
							
							<RichText
								tagName="div"
								className="popup-text"
								value={ content }
								onChange={ ( value ) => setAttributes( { content: value } ) }
								placeholder={ __( 'Enter popup content...', 'poppit' ) }
							/>
							
							{ emailEnabled && (
								<div className="popup-email-form">
									<input
										type="email"
										placeholder={ emailPlaceholder }
										className="popup-email-input"
									/>
									<button className="popup-submit-btn">
										{ buttonText }
									</button>
								</div>
							) }
						</div>
					</div>
				</div>
			</div>
		);
	};

	const renderEditorView = () => {
		return (
			<div className="poppit-editor">
				<div className="poppit-header">
					<h4>{ __( 'Poppit', 'poppit' ) }</h4>
					<div className="poppit-meta">
						<span className="popup-type-badge">{ popupType.toUpperCase() }</span>
						<span className="trigger-type-badge">
							{ triggerType === 'time' && __( `After ${triggerDelay}s`, 'poppit' ) }
							{ triggerType === 'scroll' && __( `At ${scrollDepth}%`, 'poppit' ) }
							{ triggerType === 'exit' && __( 'Exit Intent', 'poppit' ) }
							{ triggerType === 'load' && __( 'Page Load', 'poppit' ) }
							{ triggerType === 'manual' && __( 'Manual', 'poppit' ) }
						</span>
						{ allowReset && (
							<span className="reset-badge">{ __( 'RESETS', 'poppit' ) }</span>
						) }
					</div>
				</div>
				
				<div className="poppit-preview-container">
					{ renderPopupPreview() }
				</div>
			</div>
		);
	};

	return (
		<>
			<BlockControls>
				<ToolbarGroup>
					<ToolbarButton
						label={ previewMode ? __( 'Edit Mode', 'poppit' ) : __( 'Preview Mode', 'poppit' ) }
						onClick={ () => setPreviewMode( ! previewMode ) }
						isPressed={ previewMode }
					>
						{ previewMode ? '⚙️' : '👁️' }
					</ToolbarButton>
				</ToolbarGroup>
			</BlockControls>

			<InspectorControls>
				<PanelBody title={ __( 'Pop-up Settings', 'poppit' ) } initialOpen={ true }>
					<SelectControl
						label={ __( 'Pop-up Type', 'poppit' ) }
						value={ popupType }
						options={ popupTypeOptions }
						onChange={ ( value ) => setAttributes( { popupType: value } ) }
					/>
					
					<SelectControl
						label={ __( 'Animation', 'poppit' ) }
						value={ animation }
						options={ animationOptions }
						onChange={ ( value ) => setAttributes( { animation: value } ) }
					/>
					
					{ popupType === 'modal' && (
						<SelectControl
							label={ __( 'Position', 'poppit' ) }
							value={ position }
							options={ positionOptions }
							onChange={ ( value ) => setAttributes( { position: value } ) }
						/>
					) }
					
					<TextControl
						label={ __( 'Width', 'poppit' ) }
						value={ width }
						onChange={ ( value ) => setAttributes( { width: value } ) }
						help={ __( 'e.g., 500px, 80%, auto', 'poppit' ) }
					/>
					
					<ToggleControl
						label={ __( 'Show Close Button', 'poppit' ) }
						checked={ showCloseButton }
						onChange={ ( value ) => setAttributes( { showCloseButton: value } ) }
					/>
					
					<RangeControl
						label={ __( 'Overlay Opacity', 'poppit' ) }
						value={ overlayOpacity }
						onChange={ ( value ) => setAttributes( { overlayOpacity: value } ) }
						min={ 0 }
						max={ 1 }
						step={ 0.1 }
					/>
				</PanelBody>

				<PanelBody title={ __( 'Trigger Settings', 'poppit' ) } initialOpen={ false }>
					<SelectControl
						label={ __( 'Trigger Type', 'poppit' ) }
						value={ triggerType }
						options={ triggerTypeOptions }
						onChange={ ( value ) => setAttributes( { triggerType: value } ) }
					/>
					
					{ triggerType === 'time' && (
						<RangeControl
							label={ __( 'Delay (seconds)', 'poppit' ) }
							value={ triggerDelay }
							onChange={ ( value ) => setAttributes( { triggerDelay: value } ) }
							min={ 0 }
							max={ 60 }
							step={ 1 }
						/>
					) }
					
					{ triggerType === 'scroll' && (
						<RangeControl
							label={ __( 'Scroll Depth (%)', 'poppit' ) }
							value={ scrollDepth }
							onChange={ ( value ) => setAttributes( { scrollDepth: value } ) }
							min={ 0 }
							max={ 100 }
							step={ 5 }
						/>
					) }
					
					{ triggerType === 'exit' && (
						<ToggleControl
							label={ __( 'Enable Exit Intent', 'poppit' ) }
							checked={ exitIntent }
							onChange={ ( value ) => setAttributes( { exitIntent: value } ) }
							help={ __( 'Show popup when user moves cursor to leave the page', 'poppit' ) }
						/>
					) }
				</PanelBody>

				<PanelBody title={ __( 'Reset Behavior', 'poppit' ) } initialOpen={ false }>
					<ToggleControl
						label={ __( 'Allow Reset', 'poppit' ) }
						checked={ allowReset }
						onChange={ ( value ) => setAttributes( { allowReset: value } ) }
						help={ __( 'Allow the popup to be shown again after a specified delay', 'poppit' ) }
					/>
					
					{ allowReset && (
						<>
							<RangeControl
								label={ __( 'Reset Delay (minutes)', 'poppit' ) }
								value={ resetDelay || 60 }
								onChange={ ( value ) => setAttributes( { resetDelay: value } ) }
								min={ 1 }
								max={ 1440 }
								step={ 1 }
								help={ __( 'Time in minutes before the popup can be shown again', 'poppit' ) }
							/>
							
							<div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#f0f6fc', border: '1px solid #c3e4f7', borderRadius: '4px', fontSize: '13px' }}>
								<strong>{ __( 'Testing Options:', 'poppit' ) }</strong>
								<p style={{ margin: '5px 0 0 0', lineHeight: '1.4' }}>{ __( 'Add ?poppit-test=1 to your URL to ignore all display restrictions for testing.', 'poppit' ) }</p>
							</div>
						</>
					) }
				</PanelBody>

				<PanelBody title={ __( 'Email Integration', 'poppit' ) } initialOpen={ false }>
					<ToggleControl
						label={ __( 'Enable Email Collection', 'poppit' ) }
						checked={ emailEnabled }
						onChange={ ( value ) => setAttributes( { emailEnabled: value } ) }
					/>
					
					{ emailEnabled && (
						<>
							<TextControl
								label={ __( 'Email Placeholder', 'poppit' ) }
								value={ emailPlaceholder }
								onChange={ ( value ) => setAttributes( { emailPlaceholder: value } ) }
							/>
							
							<TextControl
								label={ __( 'Button Text', 'poppit' ) }
								value={ buttonText }
								onChange={ ( value ) => setAttributes( { buttonText: value } ) }
							/>
						</>
					) }
				</PanelBody>

				<PanelBody title={ __( 'Targeting Options', 'poppit' ) } initialOpen={ false }>
					<h4>{ __( 'Device Targeting', 'poppit' ) }</h4>
					<CheckboxControl
						label={ __( 'Desktop', 'poppit' ) }
						checked={ targeting.devices.includes( 'desktop' ) }
						onChange={ ( checked ) => {
							const devices = checked 
								? [ ...targeting.devices, 'desktop' ]
								: targeting.devices.filter( d => d !== 'desktop' );
							setAttributes( { targeting: { ...targeting, devices } } );
						} }
					/>
					<CheckboxControl
						label={ __( 'Tablet', 'poppit' ) }
						checked={ targeting.devices.includes( 'tablet' ) }
						onChange={ ( checked ) => {
							const devices = checked 
								? [ ...targeting.devices, 'tablet' ]
								: targeting.devices.filter( d => d !== 'tablet' );
							setAttributes( { targeting: { ...targeting, devices } } );
						} }
					/>
					<CheckboxControl
						label={ __( 'Mobile', 'poppit' ) }
						checked={ targeting.devices.includes( 'mobile' ) }
						onChange={ ( checked ) => {
							const devices = checked 
								? [ ...targeting.devices, 'mobile' ]
								: targeting.devices.filter( d => d !== 'mobile' );
							setAttributes( { targeting: { ...targeting, devices } } );
						} }
					/>
					
					<SelectControl
						label={ __( 'User Type', 'poppit' ) }
						value={ targeting.userType }
						options={ [
							{ label: __( 'All Visitors', 'poppit' ), value: 'all' },
							{ label: __( 'New Visitors', 'poppit' ), value: 'new' },
							{ label: __( 'Returning Visitors', 'poppit' ), value: 'returning' }
						] }
						onChange={ ( value ) => setAttributes( { targeting: { ...targeting, userType: value } } ) }
					/>
				</PanelBody>

				<PanelBody title={ __( 'More Blocks by iconick', 'poppit' ) } initialOpen={ false }>
					<p>
						{ __( 'Think these ideas are wild? You ain\'t seen nothing yet.', 'poppit' ) }
					</p>
					<ExternalLink href="https://iconick.io/blocks/">
						{ __( 'Click to enter the block wonderland', 'poppit' ) }
					</ExternalLink>
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				{ previewMode ? renderPopupPreview() : renderEditorView() }
			</div>
		</>
	);
}