export const EPUB_STYLESHEET_CSS = `
body { 
  font-family: Georgia, serif; 
  line-height: 1.6; 
  max-width: 42em; 
  margin: 0 auto; 
  padding: 1.5em; 
  color: #333;
}
h1 { 
  color: #2c3e50; 
  border-bottom: 2px solid #3498db; 
  padding-bottom: 0.5em;
  margin-bottom: 1em;
  font-weight: bold;
}
h2 {
  color: #27ae60;
  border-bottom: 1px solid #27ae60;
  padding-bottom: 0.3em;
  margin-top: 2em;
  margin-bottom: 1em;
}
h3 {
  color: #8e44ad;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}
p { 
  margin: 1em 0; 
  text-align: justify; 
  text-indent: 1.5em;
}
.illustration { 
  page-break-inside: avoid; 
  margin: 2em 0;
  text-align: center;
}
.illustration img {
  max-width: 100%;
  height: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.illustration-caption { 
  font-style: italic; 
  color: #666; 
  text-align: center; 
  font-size: 0.9em;
  margin-top: 0.5em;
  text-indent: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.9em;
}
th, td {
  border: 1px solid #ddd;
  padding: 0.75em;
  text-align: left;
}
th {
  background-color: #f8f9fa;
  font-weight: bold;
}
ol, ul {
  margin: 1em 0;
  padding-left: 2em;
}
li {
  margin-bottom: 0.5em;
  line-height: 1.5;
}
.gratitude-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2em;
  border-radius: 12px;
  margin: 3em 0;
}
.gratitude-section h2 {
  color: white;
  border-bottom: 1px solid rgba(255,255,255,0.3);
  text-align: center;
}
.gratitude-section p {
  text-indent: 0;
}
/* Footnotes styling */
.footnotes {
  margin-top: 3em;
  padding-top: 2em;
  border-top: 1px solid #ddd;
}
.footnotes h3 {
  color: #666;
  font-size: 1.1em;
  margin-bottom: 1em;
}
.footnotes ol {
  font-size: 0.9em;
  line-height: 1.4;
}
.footnotes li {
  margin-bottom: 0.75em;
}
.footnote-ref {
  font-size: 0.8em;
  vertical-align: super;
  text-decoration: none;
  color: #007bff;
  font-weight: bold;
}
.footnote-backref {
  margin-left: 0.5em;
  font-size: 0.8em;
  text-decoration: none;
  color: #007bff;
}
.footnote-ref:hover, .footnote-backref:hover {
  text-decoration: underline;
}
/* Title page specific styling */
.title-page {
  text-align: center;
  padding: 4em 2em;
  page-break-after: always;
}
.title-page h1 {
  font-size: 3em;
  margin-bottom: 0.5em;
  color: #2c3e50;
  border: none;
  padding: 0;
}
.title-page .subtitle {
  font-size: 1.5em;
  color: #7f8c8d;
  font-style: italic;
  margin-bottom: 2em;
}
.title-page .author {
  font-size: 1.25em;
  color: #34495e;
  margin-bottom: 1em;
}
.title-page .metadata {
  margin-top: 3em;
  font-size: 0.9em;
  color: #666;
  line-height: 1.6;
}
.title-page .metadata p {
  text-indent: 0;
  margin: 0.5em 0;
}`;

