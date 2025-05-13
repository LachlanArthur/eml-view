import '@shoelace-style/shoelace';
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
import { registerIconLibrary } from '@shoelace-style/shoelace/dist/utilities/icon-library.js';

setBasePath( '/shoelace/' );

export {
	setBasePath,
	registerIconLibrary,
}
