// Copies text to the clipboard. navigator.clipboard needs a secure context and
// is missing in some in-app browsers, so fall back to the old execCommand path
// rather than failing silently. Resolves true when either path succeeded.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none;'
    document.body.appendChild(el)
    el.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    document.body.removeChild(el)
    return ok
  }
}
