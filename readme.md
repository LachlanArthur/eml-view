# EML file preview web component

## [Demo](https://prev.iew.email)

Preview the contents of an email file right in your browser.

## Installation

```sh
npm install eml-view
```

```js
import 'eml-view';
import 'eml-view/dist/eml-view.css';
```

[Install Shoelace](https://shoelace.style/getting-started/installation)

## Usage

```html
<!-- Pass a URL to an EML file to preview -->
<eml-view src="https://example.com/reply.eml"></eml-view>

<!-- Or use blob/data URLs to load files however you like -->
<eml-view src="blob:https://example.com/4df96023-a58c-4bbd-82d6-3c4b98bdc040"></eml-view>
<eml-view src="data:..."></eml-view>
```

## Screenshot

![firefox_baE3vovayG](https://github.com/user-attachments/assets/59d6d597-97e4-4473-a131-3755e5416570)

## Features

- Toggle between HTML and text parts
- Preview arbitrarily nested attached EML files
- See large previews of attachments like PDFs, images, videos, text, html
- View the full headers
- Download all attachments with a single click

## Uses

- [postal-mime](https://github.com/postalsys/postal-mime) to parse the email files
- [@shoelace-style/shoelace](https://shoelace.style/) for the UI

## Todo

- Additional previews of common attachments
  - iCal ICS files
