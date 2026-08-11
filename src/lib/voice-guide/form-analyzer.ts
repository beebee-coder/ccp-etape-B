export interface DetectedField {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  label: string;
  type: string;
  id: string;
  name: string;
  placeholder?: string;
  required: boolean;
  selector: string;
}

export interface DetectedForm {
  formElement: HTMLFormElement | null;
  fields: DetectedField[];
  submitButton: HTMLButtonElement | HTMLInputElement | null;
}

export function detectFormFields(): DetectedForm {
  const fields: DetectedField[] = [];

  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])'
    )
  );
  const textareas = Array.from(
    document.querySelectorAll<HTMLTextAreaElement>("textarea")
  );
  const selects = Array.from(
    document.querySelectorAll<HTMLSelectElement>("select")
  );

  const allElements = [...inputs, ...textareas, ...selects];

  for (const el of allElements) {
    if (el.disabled) continue;
    if ((el as HTMLInputElement | HTMLTextAreaElement).readOnly) continue;
    if (el.type === "file") continue;

    const label = extractLabel(el);
    const id = el.id || el.name || `field-${fields.length}`;
    const name = el.name || id;
    const placeholder = el.getAttribute("placeholder") || undefined;
    const required = el.hasAttribute("required");

    let type = el.type || "text";
    if (el.tagName === "TEXTAREA") type = "textarea";
    if (el.tagName === "SELECT") type = "select";

    fields.push({
      element: el,
      label,
      type,
      id,
      name,
      placeholder,
      required,
      selector: getSelector(el),
    });
  }

  const formElement = document.querySelector("form") as HTMLFormElement | null;
  const submitButton = formElement
    ? (formElement.querySelector(
        'button[type="submit"], input[type="submit"]'
      ) as HTMLButtonElement | HTMLInputElement | null)
    : null;

  return { formElement, fields, submitButton };
}

export function extractLabel(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
): string {
  const id = el.id;
  if (id) {
    const labelEl = document.querySelector(`label[for="${id}"]`);
    if (labelEl?.textContent?.trim()) {
      return labelEl.textContent.trim();
    }
  }

  const parentLabel = el.closest("label");
  if (parentLabel?.textContent?.trim()) {
    return parentLabel.textContent.trim();
  }

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel?.trim()) {
    return ariaLabel.trim();
  }

  const placeholder = (el as HTMLInputElement | HTMLTextAreaElement).placeholder?.trim();
  if (placeholder) {
    return placeholder;
  }

  const name = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).name || el.id || "champ";
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function getSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const name = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).name;
  if (name) return `[name="${name}"]`;
  return el.tagName.toLowerCase();
}

export function fillField(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
): boolean {
  try {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (el.tagName === "INPUT" && nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else if (el.tagName === "TEXTAREA" && nativeTextareaValueSetter) {
      nativeTextareaValueSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

export function focusField(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  el.focus();
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}
