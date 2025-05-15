/**
 * @license MIT
 * Mostly from:
 * @see https://github.com/AntonioVdlC/html-template-tag
 * @see https://github.com/AntonioVdlC/html-es6cape
 */

// Inspired on http://www.2ality.com/2015/01/template-strings-html.html#comment-2078932192

// List of the characters we want to escape and their HTML escaped version
const chars: Record<string, string> = {
	"&": "&amp;",
	">": "&gt;",
	"<": "&lt;",
	'"': "&quot;",
	"'": "&#39;",
	"`": "&#96;",
};

// Dynamically create a RegExp from the `chars` object
const re = new RegExp( Object.keys( chars ).join( "|" ), "g" );

const trusted: unique symbol = Symbol( 'trusted' );

// Return the escaped string
function escape( str: string | TemplateStringsArray = "" ): string {
	return String( str ).replace( re, ( match ) => chars[ match ] );
}

type MixedArray<T> = Array<T | T[]>;

export default function html(
	literals: TemplateStringsArray,
	...substs: MixedArray<TrustedString | string | undefined | null>
): TrustedString {
	return trustedString( literals.raw.reduce( ( acc, lit, i ) => {
		let safe = false;
		let subst = substs[ i - 1 ];

		if ( literals.raw[ i - 1 ] && literals.raw[ i - 1 ].endsWith( "$" ) ) {
			// If the interpolation is preceded by a dollar sign,
			// substitution is considered safe and will not be escaped
			acc = acc.slice( 0, -1 );
			safe = true;
		}

		if ( !Array.isArray( subst ) ) {
			subst = [ subst ];
		}

		subst = subst.map( s => {
			if ( s === undefined || s === null ) {
				return '';
			}
			if ( safe || isTrustedString( s ) ) {
				return s;
			}
			return escape( s );
		} );

		return acc + subst.join( '' ) + lit;
	} ) );
}

export type TrustedString = string & { [ trusted ]: true };

function trustedString( input: string ): TrustedString {
	const output = new String( input );

	Object.defineProperty( output, trusted, {
		configurable: false,
		enumerable: false,
		writable: false,
		value: true,
	} );

	return output as TrustedString;
}

function isTrustedString( input: unknown ): input is TrustedString {
	return typeof input === 'object' && !!( input as TrustedString )[ trusted ];
}
