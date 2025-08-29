import { toStrictXhtml } from '../translate/HtmlSanitizer';

// XHTML/XML namespaces used for strict XML serialization
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const XML_NS   = 'http://www.w3.org/XML/1998/namespace';
const EPUB_NS  = 'http://www.idpf.org/2007/ops';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

// Simplified XML Name validation (sufficient for XHTML attribute names)
const XML_NAME = /^[A-Za-z_][A-Za-z0-9._:-]*$/;

// Basic bans for unsafe attributes
function isBannedAttr(name: string) {
  return name.startsWith('on') || name === 'srcdoc';
}

// Very lightweight CSS sanitizer; keep as a single attribute
function sanitizeStyle(value: string) {
  const v = (value ?? '').replace(/[\u0000-\u001F\u007F]/g, '');
  if (/url\s*\(\s*javascript:/i.test(v)) return '';
  if (/expression\s*\(/i.test(v)) return '';
  return v.trim();
}

function setAttrNS(el: Element, name: string, value: string) {
  if (name === 'xml:lang') { el.setAttributeNS(XML_NS, name, value); return; }
  if (name.startsWith('epub:')) { el.setAttributeNS(EPUB_NS, name, value); return; }
  if (name.startsWith('xlink:')) { el.setAttributeNS(XLINK_NS, name, value); return; }
  el.setAttribute(name, value);
}

function copyAttributesSafely(srcEl: Element, dstEl: Element) {
  for (const attr of Array.from(srcEl.attributes)) {
    let name = attr.name;
    let value = attr.value ?? '';

    // Keep style as a single attribute; do not expand/split
    if (name.toLowerCase() === 'style') {
      const s = sanitizeStyle(value);
      if (s) dstEl.setAttribute('style', s);
      continue;
    }

    // Drop unsafe attributes
    if (isBannedAttr(name)) continue;

    // Validate XML name to avoid InvalidCharacterError (e.g., 'down;')
    if (!XML_NAME.test(name)) {
      try { console.warn('[EPUB XClone] Dropping invalid attribute', name, 'on <' + srcEl.tagName + '>'); } catch {}
      continue;
    }

    // reject unknown namespace prefixes (avoid unbound prefixes)
    if (name.includes(':')) {
      const [prefix] = name.split(':', 1);
      const ok = prefix === 'xml' || prefix === 'epub' || prefix === 'xlink';
      if (!ok) continue;
    }

    // Normalize non-namespaced names to lowercase
    if (!name.includes(':')) name = name.toLowerCase();

    try {
      setAttrNS(dstEl, name, value);
    } catch (e) {
      try {
        const snippet = (srcEl as any).outerHTML ? (srcEl as any).outerHTML.slice(0, 160).replace(/\s+/g, ' ') : `<${srcEl.tagName}>`;
        console.warn('[EPUB XClone] Could not set attribute', name, 'value=', value, 'on', snippet, e);
      } catch {}
      // Continue without throwing
    }
  }
}

// Clone an HTML node tree into an XHTML XMLDocument parent
function cloneIntoXhtml(srcNode: Node, xdoc: XMLDocument, dstParent: Element) {
  switch (srcNode.nodeType) {
    case Node.ELEMENT_NODE: {
      const srcEl = srcNode as Element;
      // Lowercase localName for XHTML consistency; guard invalid names
      const name = srcEl.localName.toLowerCase();
      const isValidXmlLocalName = /^[A-Za-z_][A-Za-z0-9._-]*$/.test(name);
      if (!isValidXmlLocalName) {
        // Skip invalid element; clone its children directly into parent
        for (const child of Array.from(srcEl.childNodes)) {
          cloneIntoXhtml(child, xdoc, dstParent);
        }
        break;
      }
      const el = xdoc.createElementNS(XHTML_NS, name);
      // Copy attributes safely (validated + namespaced)
      copyAttributesSafely(srcEl, el);
      // Ensure <img> has alt for accessibility nicety
      if (el.localName === 'img' && !el.hasAttribute('alt')) {
        el.setAttribute('alt', '');
      }
      // Avoid scripts in EPUB content
      if (el.localName !== 'script') {
        for (const child of Array.from(srcEl.childNodes)) {
          cloneIntoXhtml(child, xdoc, el);
        }
      }
      dstParent.appendChild(el);
      break;
    }
    case Node.TEXT_NODE:
      dstParent.appendChild(xdoc.createTextNode(srcNode.nodeValue || ''));
      break;
    case Node.CDATA_SECTION_NODE:
      dstParent.appendChild(xdoc.createTextNode(srcNode.nodeValue || ''));
      break;
    default:
      // Skip comments and other node types
      break;
  }
}

export function htmlFragmentToXhtml(fragmentHtml: string): string {
  if (!fragmentHtml || !fragmentHtml.trim()) return '';

  try {
    // Create an XHTML XMLDocument
    const xdoc = document.implementation.createDocument(XHTML_NS, 'div', null);
    const root = xdoc.documentElement;

    // Parse the HTML fragment into a DocumentFragment
    const htmlDoc = new DOMParser().parseFromString(fragmentHtml, 'text/html');
    
    // Clone all nodes from body into our XHTML root
    for (const node of Array.from(htmlDoc.body.childNodes)) {
      cloneIntoXhtml(node, xdoc, root);
    }

    // Serialize the XHTML document root
    const serialized = new XMLSerializer().serializeToString(root);
    
    return serialized;
  } catch (error) {
    try {
      console.warn('[EPUB] htmlFragmentToXhtml conversion failed:', error);
    } catch {}
    return toStrictXhtml(fragmentHtml); // Fallback to simpler sanitizer
  }
}

export function sanitizeHtmlAllowlist(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allowedTags = new Set(['i', 'em', 'b', 'strong', 'u', 's', 'sub', 'sup', 'br', 'hr']);
  
  function processNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      
      if (!allowedTags.has(element.tagName.toLowerCase())) {
        // For disallowed tags, return their children
        const fragment = document.createDocumentFragment();
        for (const child of Array.from(element.childNodes)) {
          const processedChild = processNode(child);
          if (processedChild) fragment.appendChild(processedChild);
        }
        return fragment;
      } else {
        // For allowed tags, clone and process children
        const newElement = document.createElement(element.tagName);
        for (const child of Array.from(element.childNodes)) {
          const processedChild = processNode(child);
          if (processedChild) newElement.appendChild(processedChild);
        }
        return newElement;
      }
    }
    
    return null;
  }

  const processedBody = document.createElement('div');
  for (const child of Array.from(doc.body.childNodes)) {
    const processedChild = processNode(child);
    if (processedChild) processedBody.appendChild(processedChild);
  }
  
  return processedBody.innerHTML;
}

function convertNewlinesToBrInElement(root: Element) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  );

  const textNodes: Text[] = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    if (textNode.nodeValue && textNode.nodeValue.includes('\n')) {
      const parent = textNode.parentNode;
      if (!parent) continue;

      const parts = textNode.nodeValue.split('\n');
      const fragment = document.createDocumentFragment();

      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          fragment.appendChild(document.createTextNode(parts[i]));
        }
        if (i < parts.length - 1) {
          fragment.appendChild(document.createElement('br'));
        }
      }

      parent.replaceChild(fragment, textNode);
    }
  }
}

export function convertToXhtmlParagraphs(content: string): string {
  if (!content?.trim()) return '';

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizeHtmlAllowlist(content);
  convertNewlinesToBrInElement(tempDiv);

  const paragraphs = content.split('\n\n').map(p => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) {
    return htmlFragmentToXhtml(tempDiv.innerHTML);
  }

  const wrappedContent = paragraphs
    .map(p => `<p>${sanitizeHtmlAllowlist(p)}</p>`)
    .join('\n');

  return htmlFragmentToXhtml(wrappedContent);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { escapeHtml };