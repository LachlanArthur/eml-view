import PostalMime from 'postal-mime';
import html from './html-template.ts';

import type { Address, Attachment, Email } from 'postal-mime';
import type { SlDialog, SlIconButton } from '@shoelace-style/shoelace';
import type { TrustedString } from './html-template.ts';

export default class EmlView extends HTMLElement {
	static get observedAttributes() {
		return [ 'src' ];
	}

	#src: string = '';

	get src() {
		return this.#src;
	}

	set src( value: string ) {
		if ( this.#src !== value ) {
			this.#src = value;
			this.#render();
		}
	}

	/**
	 * Keep track of all the blob URLs so they can be cleaned up later
	 */
	#blobUrls: string[] = [];

	// TODO: abort the previous render instead of skipping the new one
	#rendering = false;

	connectedCallback() {
		this.#render();
	}

	disconnectedCallback() {
		this.innerHTML = '';
		this.#releaseBlobUrls();
	}

	attributeChangedCallback( name: string, _oldValue: string, newValue: string ) {
		switch ( name ) {
			case 'src':
				this.src = newValue;
				break;
		}
	}

	async #render() {
		if ( !this.isConnected || this.#rendering ) {
			return;
		}

		this.#rendering = true;

		try {
			if ( !this.src ) {
				this.innerHTML = ``;
				return;
			}

			this.#renderLoadingTemplate();
			this.#releaseBlobUrls();

			const response = await fetch( this.src );

			if ( !response.ok ) {
				throw new Error( `Server responded with ${response.status} ${response.statusText}` );
			}

			await this.#renderTemplate( await response.arrayBuffer() );
		} catch ( error ) {
			console.error( error );
			this.#renderErrorTemplate( error );
		} finally {
			this.#rendering = false;
		}
	}

	async #renderTemplate( emlBytes: ArrayBufferLike ) {
		const eml = await new PostalMime().parse( emlBytes );
		const emlDownloadUrl = this.#makeBlobUrl( [ emlBytes ], 'message/rfc822' );

		eml.subject ??= '(No subject)';
		eml.from ??= { name: 'undisclosed sender' };
		eml.to ??= [ { name: 'undisclosed recipients' } ];
		eml.attachments.forEach( attachment => attachment.filename ??= 'unnamed attachment' );

		function renderMailto( addresses: Address | Address[] ): TrustedString[] {
			if ( !Array.isArray( addresses ) ) {
				addresses = [ addresses ];
			}
			return addresses
				.map( address => {
					if ( address.group ) {
						return html`<span class="eml-emailaddress-group">${address.name}: ${renderMailto( address.group )}</span>`;
					}

					if ( !address.name && address.address ) {
						return html`<a href="mailto:${address.address}" target="_blank" class="eml-emailaddress"
							><span class="eml-emailaddress-address">${address.address}</span
						></a>`
					}

					if ( !address.address ) {
						return html`<span class="eml-emailaddress-name">${address.name}</span>`;
					}

					return html`<a href="mailto:${address.name} <${address.address}>" target="_blank" class="eml-emailaddress"
						><span class="eml-emailaddress-name">${address.name}</span>
						<span class="eml-emailaddress-address">${address.address}</span
					></a>`
				} )
				.flatMap( ( link, i ) => i > 0 ? [ html`, `, link ] : [ link ] );
		};

		const details = [];

		const detailEmailAddresses: [ string, Address[]?][] = [
			[ 'Reply-To', eml.replyTo ],
			[ 'CC', eml.cc ],
			[ 'BCC', eml.bcc ],
		]

		for ( const [ label, values ] of detailEmailAddresses ) {
			if ( values ) {
				details.push( html`<dt>${label}</dt><dd>${renderMailto( values )}</dd>` );
			}
		}

		if ( eml.date ) {
			details.push( html`
				<dt>Date</dt>
				<dd><sl-format-date date="${eml.date}" year="numeric" month="numeric" day="numeric" hour="numeric" minute="numeric" second="numeric"></sl-format-date></dd>
			` );
		}

		// TODO:
		// - Ensure all links use target=_blank
		const emlHtmlContent = eml.html
			? this.#injectInlineCidImages( eml.html, eml.attachments )
			: undefined;

		const emlTextContent = eml.text;

		const onlyHtml = emlHtmlContent && !emlTextContent;
		const onlyText = emlTextContent && !emlHtmlContent;
		const bothHtmlAndText = emlHtmlContent && emlTextContent;

		const htmlViewer = ( content: string ) => html`
			<iframe
				sandbox="
					allow-popups
					allow-popups-to-escape-sandbox
					allow-downloads
				"
				credentialless
				referrerpolicy="no-referrer"
				src="${this.#makeBlobUrl( [ content ], 'text/html' )}"></iframe>
		`;
		const textViewer = ( content: string ) => html`<pre>${content}</pre>`;

		const fromInitials = eml.from.name.split( ' ', 2 ).map( ( word ) => word[ 0 ] ).join( '' );

		const attachments = eml.attachments.filter( att => att.disposition !== 'inline' );
		const inlineAttachments = eml.attachments.filter( att => att.disposition === 'inline' );

		const output = html`
			<sl-card>
				<header>
					<sl-avatar initials="${fromInitials}" label="Avatar with initials: ${fromInitials}"></sl-avatar>

					<div class="eml-info">
						${renderMailto( eml.from )}<br>
						To: ${renderMailto( eml.to )}
						<details>
							<summary>Show details</summary>
							<dl>${details}</dl>
						</details>
					</div>

					<aside>
						<div class="eml-date">
							<sl-format-date date="${eml.date}" month="long" day="numeric" year="numeric"></sl-format-date>
							<sl-divider vertical></sl-divider>
							<sl-relative-time date="${eml.date}"></sl-relative-time>
						</div>

						<sl-dropdown placement="bottom-end">
							<sl-button slot="trigger" size="small" caret>Actions</sl-button>
							<sl-menu>
								<sl-menu-item value="download-eml">
									Download email
									<sl-icon slot="prefix" name="envelope-arrow-down"></sl-icon>
								</sl-menu-item>
								${eml.attachments.length > 0 ? html`
									<sl-menu-item value="download-attachments">
										Download all attachments
										<sl-icon slot="prefix" name="paperclip"></sl-icon>
										<sl-badge slot="suffix" variant="neutral" pill>${String( eml.attachments.length )}</sl-badge>
									</sl-menu-item>
								` : null}
								<sl-divider></sl-divider>
								<sl-menu-item value="view-headers">
									View headers
									<sl-icon slot="prefix" name="table"></sl-icon>
								</sl-menu-item>
							</sl-menu>
						</sl-dropdown>
					</aside>
				</header>

				<h1>${eml.subject}</h1>

				<div class="eml-attachments">${attachments.map( a => this.#attachmentTemplate( a ) )}</div>

				${inlineAttachments.length ? html`
					<details class="eml-inline-attachments">
						<summary>Show ${inlineAttachments.length.toString()} inline ${_n( inlineAttachments.length, 'attachment', 'attachments' )}</summary>
						<div class="eml-attachments">${inlineAttachments.map( a => this.#attachmentTemplate( a ) )}</div>
					</details>
				` : null}

				<footer slot="footer">
					${onlyHtml ? htmlViewer( emlHtmlContent ) : null}
					${onlyText ? textViewer( emlTextContent ) : null}
					${bothHtmlAndText ? html`
						<sl-tab-group>
							<sl-tab slot="nav" panel="html">HTML</sl-tab>
							<sl-tab-panel name="html">${htmlViewer( emlHtmlContent )}</sl-tab-panel>

							<sl-tab slot="nav" panel="plain">Text</sl-tab>
							<sl-tab-panel name="plain">${textViewer( emlTextContent )}</sl-tab-panel>
						</sl-tab-group>
					` : null}
				</footer>
			</sl-card>
			<sl-dialog label="Email Headers" class="eml-dialog-headers" style="--width: 1000px"></sl-dialog>
			<sl-dialog label="Preview" class="eml-dialog-preview" style="--width: 1000px">
				<sl-icon-button class="eml-dialog-preview-download" slot="header-actions" name="download" label="Download" target="_blank"></sl-icon-button>
				<div class="eml-dialog-preview-content"></div>
			</sl-dialog>
		`;

		this.innerHTML = output;

		this.querySelector( 'sl-menu-item[value="download-eml"]' )?.addEventListener( 'click', () => {
			this.#downloadUrl( emlDownloadUrl, `${eml.subject}.eml` );
		} );

		this.querySelector( 'sl-menu-item[value="download-attachments"]' )?.addEventListener( 'click', () => {
			for ( const attachment of eml.attachments ) {
				this.#downloadUrl(
					this.#makeBlobUrl( [ attachment.content ], attachment.mimeType ),
					attachment.filename,
				);
			}
		} );

		this.querySelector( 'sl-menu-item[value="view-headers"]' )?.addEventListener( 'click', () => {
			const dialog = this.querySelector( 'sl-dialog.eml-dialog-headers' ) as SlDialog;
			dialog.innerHTML = this.#headerTableTemplate( eml );
			dialog.show();
		} );

		this.querySelectorAll<HTMLAnchorElement>( '.eml-attachment' )
			.forEach( link => link.addEventListener( 'click', e => {
				if ( e.ctrlKey || e.metaKey || e.shiftKey || e.altKey ) {
					return;
				}

				if ( ( e.target as HTMLElement ).closest( '[download]' ) ) {
					return;
				}

				const attachmentLink = ( e.target as HTMLElement ).closest( '.eml-attachment' )!;

				const manualDownloadButton = attachmentLink.querySelector( 'sl-icon-button[name="download"]' ) as SlIconButton;

				const dialog = this.querySelector( 'sl-dialog.eml-dialog-preview' ) as SlDialog;
				const dialogContent = dialog.querySelector( '.eml-dialog-preview-content' ) as HTMLDivElement;
				const dialogDownloadButton = dialog.querySelector( '.eml-dialog-preview-download' ) as SlIconButton;
				const mimeType = link.dataset.mime!;
				const filename = link.dataset.filename!;

				dialog.label = filename;

				dialogDownloadButton.download = filename;
				dialogDownloadButton.href = link.href;

				if ( mimeType === 'application/pdf' ) {
					if ( !navigator.pdfViewerEnabled ) {
						// Preview isn't supported, download it
						e.preventDefault();
						manualDownloadButton.click();
						return;
					}

					// PDFs don't need to be sandboxed
					dialogContent.innerHTML = html`<iframe src="${link.href}"></iframe>`;
				} else if ( mimeType === 'message/rfc822' ) {
					// It's turtles all the way down
					dialogContent.innerHTML = html`<eml-view class="eml-view-nested" src="${link.href}"></eml-view>`;
				} else if (
					// These *might* be able to be viewed in an iframe
					mimeType === 'text/plain' ||
					mimeType === 'text/html'
				) {
					dialogContent.innerHTML = html`<iframe sandbox credentialless referrerpolicy="no-referrer" src="${link.href}"></iframe>`;
				} else if ( mimeType?.startsWith( 'image/' ) ) {
					dialogContent.innerHTML = html`<img src="${link.href}">`;
				} else if ( mimeType?.startsWith( 'video/' ) ) {
					dialogContent.innerHTML = html`<video controls autoplay src="${link.href}"></video>`;
				} else if ( mimeType?.startsWith( 'audio/' ) ) {
					dialogContent.innerHTML = html`<audio controls src="${link.href}">`;
				} else {
					// Unknown type, download it
					e.preventDefault();
					manualDownloadButton.click();
					return;
				}

				e.preventDefault();
				dialog.show();
			} ) );
	}

	#attachmentTemplate( attachment: Attachment ) {
		const isImage = attachment.mimeType.startsWith( 'image/' );
		const iconName = getfileIcon( attachment.mimeType, attachment.filename );
		const blobUrl = this.#makeBlobUrl( [ attachment.content ], attachment.mimeType );

		return html`
			<a href="${blobUrl}" class="eml-attachment" data-mime="${attachment.mimeType}" data-filename="${attachment.filename}">
				${isImage ? html`
					<img src="${blobUrl}" alt="${attachment.filename}">
				` : null}
				<div class="eml-attachment-info">
					<sl-icon slot="prefix" name="${iconName}"></sl-icon>
					<div class="eml-attachment-info-text">
						<span class="eml-attachment-filename">${attachment.filename}</span><br>
						<sl-format-bytes value="${attachment.content.byteLength.toString()}" display="narrow"></sl-format-bytes>
					</div>
					<sl-icon-button name="download" label="Download"
						href="${blobUrl}" download="${attachment.filename}"></sl-icon-button>
				</div>
			</a>
		`;
	}

	#headerTableTemplate( eml: Email ) {
		return html`
			<table>
				<thead>
					<tr>
						<th>Header</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					${eml.headers.map( ( { key, value } ) => html`
						<tr><td>${key}</td><td>${value}</td></tr>
					` )}
				</tbody>
			</table>
		`;
	}

	#renderLoadingTemplate() {
		// TODO: positioning
		this.innerHTML = html`<sl-spinner style="font-size: 3rem;"></sl-spinner>`;
	}

	#renderErrorTemplate( error: any ) {
		this.innerHTML = html`
			<sl-alert variant="danger" open>
				<sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
				<strong>Email preview failed</strong><br />
				${String( error )}
			</sl-alert>
		`;
	}

	#makeBlobUrl( parts: BlobPart[], type: string ) {
		return this.#rememberBlobUrl( URL.createObjectURL( new Blob( parts, { type } ) ) );
	}

	#makeBase64Url( bytes: ArrayBufferLike, type: string ) {
		const base64 = btoa( Array.from( new Uint8Array( bytes ), ( byte ) => String.fromCodePoint( byte ) ).join( "" ) );
		return `data:${type};base64,${base64}`;
	}

	#rememberBlobUrl( blobUrl: string ) {
		this.#blobUrls.push( blobUrl );
		return blobUrl;
	}

	#releaseBlobUrls() {
		for ( const blobUrl of this.#blobUrls ) {
			URL.revokeObjectURL( blobUrl );
		}

		this.#blobUrls = [];
	}

	#downloadUrl( url: string, filename: string ) {
		const downloadLink = document.createElement( 'a' );
		downloadLink.href = url;
		downloadLink.download = filename;
		downloadLink.click();
	}

	/**
	 * Replaces inline CID (Content-ID) image references in HTML with base64-encoded data URLs.
	 *
	 * This method searches for image sources using 'cid:' protocol and matches them against 
	 * email attachments, replacing the CID reference with an inline base64 representation 
	 * of the attachment's content.
	 *
	 * @param html The HTML string containing potential CID image references
	 * @param attachments Array of email attachments to match against CID references
	 * @returns The modified HTML with CID references replaced by base64 data URLs
	 */
	#injectInlineCidImages( html: string, attachments: Attachment[] ): string {
		return html.replaceAll(
			/(<[^>]+?)('|")cid:([^>'"]+?)\2/g,
			( _, element, quote, cid ) => {
				const attachmentIndex = attachments.findIndex( att => {
					if ( att.contentId ) {
						return att.contentId === `<${cid}>`
					} else {
						// Apparently some old email clients use a filename instead
						return att.filename === cid;
					}
				} );

				let newSrc = `cid:${cid}`;

				if ( attachmentIndex >= 0 ) {
					const attachment = attachments[ attachmentIndex ];

					newSrc = this.#makeBase64Url( attachment.content, attachment.mimeType );
				}

				return `${element}${quote}${newSrc}${quote}`;
			}
		)
	}
}

window.customElements.define( 'eml-view', EmlView );

/**
 * Determines the appropriate file icon based on file mime type and filename.
 *
 * @param mime The MIME type of the file
 * @param filename Optional filename to help determine the icon
 * @returns A Bootstrap icon name representing the file type
 */
function getfileIcon( mime: string, filename?: string | null ): string {
	const extensionIcon: Record<string, string> = {
		// Office
		'doc': 'file-earmark-word',
		'docx': 'file-earmark-word',
		'ppt': 'file-earmark-slides',
		'pptx': 'file-earmark-slides',
		'xls': 'file-earmark-spreadsheet',
		'xlsx': 'file-earmark-spreadsheet',

		// Adobe
		'ai': 'filetype-ai',
		'psd': 'file-earmark-image',
		'pdf': 'file-earmark-pdf',

		// Archives
		'zip': 'file-earmark-zip',
		'gz': 'file-earmark-zip',
		'rar': 'file-earmark-zip',
		'tar': 'file-earmark-zip',
		'7z': 'file-earmark-zip',
		'xz': 'file-earmark-zip',
		'bz2': 'file-earmark-zip',

		// Binary
		'exe': 'filetype-exe',

		// Text
		'eml': 'envelope-at',
		'ics': 'calendar3',
		'css': 'filetype-css',
		'csv': 'filetype-csv',
		'htm': 'filetype-html',
		'html': 'filetype-html',
		'js': 'filetype-js',
		'jsx': 'filetype-jsx',
		'json': 'filetype-json',
		'md': 'filetype-md',
		'php': 'filetype-php',
		'py': 'filetype-py',
		'sh': 'filetype-sh',
		'sql': 'filetype-sql',
		'tsx': 'filetype-tsx',
		'txt': 'filetype-txt',
		'xml': 'filetype-xml',
		'yml': 'filetype-yml',
	};

	const mimeDefaultsIcon: Record<string, string> = {
		'video': 'file-earmark-play',
		'audio': 'file-earmark-music',
		'image': 'file-earmark-image',
		'font': 'file-earmark-font',
		'text': 'file-earmark-text',
	};

	const defaultIcon = 'file-earmark';

	const mimeType = mime.split( '/', 2 )[ 0 ];
	const extension = filename?.match( /\.([^.]+)$/ )?.[ 1 ];

	return ( extension && extensionIcon[ extension ] )
		?? mimeDefaultsIcon[ mimeType ]
		?? defaultIcon;
}

/**
 * Selects between singular and plural forms based on the number.
 *
 * @param n The number to determine grammatical number
 * @param singular The form to use when n is 1
 * @param plural The form to use when n is not 1
 * @returns The appropriate grammatical form
 */
function _n( n: number, singular: string, plural: string ): string {
	return n === 1 ? singular : plural;
}
