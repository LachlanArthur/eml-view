window.addEventListener( 'DOMContentLoaded', function () {
  const favicon = document.documentElement.querySelector( 'head link[rel="icon"][data-light][data-dark]' ) as HTMLLinkElement | null;
  const dark = favicon?.dataset.dark;
  const light = favicon?.dataset.light;

  if ( !favicon || !dark || !light || !window.matchMedia ) return;

  const listener = ( e: MediaQueryListEvent | MediaQueryList ) => favicon.setAttribute( 'href', e.matches ? dark : light );

  const mq = window.matchMedia( '(prefers-color-scheme: dark)' );
  listener( mq );
  mq.addListener( listener );
} );
