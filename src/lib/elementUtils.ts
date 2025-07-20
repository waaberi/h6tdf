/**
 * Utility functions for element validation and type checking
 */

/**
 * Checks if an element name is a valid HTML5 element by attempting to create it
 * @param elementName - The element name to check (e.g., 'div', 'iframe', 'custom')
 * @returns true if the element is a valid HTML5 element, false otherwise
 */
export function isValidHTMLElement(elementName: string): boolean {
  try {
    const element = document.createElement(elementName);
    return element.toString() !== "[object HTMLUnknownElement]";
  } catch {
    // If createElement throws an error, it's not a valid element name
    return false;
  }
}

/**
 * Checks if an element name is a valid web component (custom element)
 * Web components must contain a hyphen according to the spec
 * @param elementName - The element name to check
 * @returns true if the element name follows web component naming rules
 */
export function isWebComponent(elementName: string): boolean {
  return elementName.includes('-') && elementName.toLowerCase() === elementName;
}
